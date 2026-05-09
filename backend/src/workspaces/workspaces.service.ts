import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateWorkspaceDto, InviteMemberDto, UpdateMemberRoleDto } from './dto/create-workspace.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWorkspaceDto, userId: string) {
    const existing = await this.prisma.workspace.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Slug already taken');

    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: { name: dto.name, slug: dto.slug, plan: dto.plan || 'free', ownerId: userId },
      });
      await tx.workspaceMember.create({
        data: { workspaceId: workspace.id, userId, role: 'owner' },
      });
      return workspace;
    });
  }

  async findAllForUser(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
    });
    return memberships.map((m) => ({ ...m.workspace, role: m.role }));
  }

  async findById(id: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: { members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } } },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    const isMember = workspace.members.some((m) => m.userId === userId);
    if (!isMember) throw new ForbiddenException('Not a member of this workspace');
    return workspace;
  }

  async invite(workspaceId: string, dto: InviteMemberDto, userId: string) {
    await this.assertRole(workspaceId, userId, ['owner', 'admin']);
    const token = uuidv4();
    return this.prisma.invitation.create({
      data: {
        workspaceId,
        email: dto.email,
        role: dto.role || 'editor',
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  async updateMemberRole(workspaceId: string, targetUserId: string, dto: UpdateMemberRoleDto, userId: string) {
    await this.assertRole(workspaceId, userId, ['owner', 'admin']);
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: targetUserId },
    });
    if (!member) throw new NotFoundException('Member not found');
    return this.prisma.workspaceMember.update({ where: { id: member.id }, data: { role: dto.role } });
  }

  async removeMember(workspaceId: string, targetUserId: string, userId: string) {
    await this.assertRole(workspaceId, userId, ['owner', 'admin']);
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: targetUserId },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === 'owner') throw new ForbiddenException('Cannot remove workspace owner');
    return this.prisma.workspaceMember.delete({ where: { id: member.id } });
  }

  async assertRole(workspaceId: string, userId: string, roles: string[]) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');
    if (!roles.includes(member.role)) throw new ForbiddenException(`Requires role: ${roles.join(' or ')}`);
    return member;
  }

  async assertMember(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');
    return member;
  }
}
