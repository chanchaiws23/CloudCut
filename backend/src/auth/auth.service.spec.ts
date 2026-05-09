import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

const mockJwt = {
  signAsync: jest.fn().mockResolvedValue('mock-token'),
  verify: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string, def?: string) => def || ''),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('throws ConflictException when email exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: '1', email: 'a@a.com' });
      await expect(service.register({ email: 'a@a.com', name: 'Alice', password: 'pass1234' }))
        .rejects.toThrow(ConflictException);
    });

    it('creates user and returns tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: '1', email: 'a@a.com', name: 'Alice', avatarUrl: null, createdAt: new Date(),
      });
      const result = await service.register({ email: 'a@a.com', name: 'Alice', password: 'pass1234' });
      expect(result.accessToken).toBe('mock-token');
      expect(result.user.email).toBe('a@a.com');
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException for unknown email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login({ email: 'x@x.com', password: 'pass1234' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const hash = await bcrypt.hash('correct', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: '1', email: 'a@a.com', name: 'Alice', passwordHash: hash, avatarUrl: null, createdAt: new Date(),
      });
      await expect(service.login({ email: 'a@a.com', password: 'wrong' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('returns tokens on correct credentials', async () => {
      const hash = await bcrypt.hash('pass1234', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: '1', email: 'a@a.com', name: 'Alice', passwordHash: hash, avatarUrl: null, createdAt: new Date(),
      });
      const result = await service.login({ email: 'a@a.com', password: 'pass1234' });
      expect(result.accessToken).toBe('mock-token');
    });
  });
});
