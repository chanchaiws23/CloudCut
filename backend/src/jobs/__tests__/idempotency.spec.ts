import { Test, TestingModule } from '@nestjs/testing';
import { ExportsService } from '../../exports/exports.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProjectsService } from '../../projects/projects.service';
import { PlanLimitsService } from '../../common/guards/plan-limits.service';
import { OrchestratorService } from '../orchestrator.service';
import { PusherService } from '../../collaboration/pusher.service';

const mockPrisma = {
  exportJob: {
    findUnique: jest.fn(),
    create: jest.fn().mockResolvedValue({
      id: 'export-1', projectId: 'proj-1', status: 'queued',
      idempotencyKey: 'key-abc', format: 'mp4', resolution: '1080p',
    }),
    update: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
  },
  project: {
    findFirst: jest.fn().mockResolvedValue({ id: 'proj-1', workspaceId: 'ws-1' }),
    findUnique: jest.fn().mockResolvedValue({ id: 'proj-1', workspaceId: 'ws-1' }),
  },
  workspaceMember: {
    findFirst: jest.fn().mockResolvedValue({ role: 'editor' }),
  },
  workspace: {
    findUnique: jest.fn().mockResolvedValue({ id: 'ws-1', plan: 'pro' }),
  },
};

const mockProjectsService = {
  findById: jest.fn().mockResolvedValue({ id: 'proj-1', workspaceId: 'ws-1' }),
  assertProjectAccess: jest.fn().mockResolvedValue(undefined),
};

const mockPlanLimits = {
  assertCanCreateExport: jest.fn().mockResolvedValue(undefined),
  getWorkspacePlan: jest.fn().mockResolvedValue('pro'),
};

const mockOrchestrator = { startExport: jest.fn().mockResolvedValue(undefined) };
const mockPusher = { trigger: jest.fn(), getUserChannel: jest.fn().mockReturnValue('private-user-1') };

describe('Idempotency', () => {
  let service: ExportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProjectsService, useValue: mockProjectsService },
        { provide: PlanLimitsService, useValue: mockPlanLimits },
        { provide: OrchestratorService, useValue: mockOrchestrator },
        { provide: PusherService, useValue: mockPusher },
      ],
    }).compile();

    service = module.get<ExportsService>(ExportsService);
    jest.clearAllMocks();
  });

  it('returns existing export job when idempotency key already exists', async () => {
    const existingJob = {
      id: 'export-existing',
      idempotencyKey: 'key-abc',
      status: 'queued',
    };
    mockPrisma.exportJob.findUnique.mockResolvedValue(existingJob);

    const result = await service.create('proj-1', {
      format: 'mp4',
      resolution: '1080p',
      quality: 'standard',
      idempotencyKey: 'key-abc',
    }, 'user-1');

    expect(result).toEqual(existingJob);
    expect(mockPrisma.exportJob.create).not.toHaveBeenCalled();
    expect(mockOrchestrator.startExport).not.toHaveBeenCalled();
  });

  it('creates new export job when idempotency key is unique', async () => {
    mockPrisma.exportJob.findUnique.mockResolvedValue(null);

    await service.create('proj-1', {
      format: 'mp4',
      resolution: '1080p',
      quality: 'standard',
      idempotencyKey: 'key-new',
    }, 'user-1');

    expect(mockPrisma.exportJob.create).toHaveBeenCalled();
    expect(mockOrchestrator.startExport).toHaveBeenCalled();
  });

  it('does not trigger duplicate export processing for same key', async () => {
    const existingJob = { id: 'export-existing', idempotencyKey: 'same-key', status: 'processing' };
    mockPrisma.exportJob.findUnique.mockResolvedValue(existingJob);

    await service.create('proj-1', {
      format: 'mp4',
      resolution: '1080p',
      quality: 'standard',
      idempotencyKey: 'same-key',
    }, 'user-1');

    expect(mockOrchestrator.startExport).not.toHaveBeenCalled();
  });
});
