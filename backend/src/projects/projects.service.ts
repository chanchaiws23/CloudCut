import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { PlanLimitsService } from '../common/guards/plan-limits.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspacesService: WorkspacesService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  async create(dto: CreateProjectDto, userId: string) {
    await this.workspacesService.assertRole(dto.workspaceId, userId, ['owner', 'admin', 'editor']);
    await this.planLimits.assertCanCreateProject(dto.workspaceId);
    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        workspaceId: dto.workspaceId,
        settings: dto.settings || { resolution: '1920x1080', fps: 30, aspectRatio: '16:9' },
        createdById: userId,
      },
    });
  }

  async findAll(workspaceId: string, userId: string, cursor?: string, take = 20) {
    await this.workspacesService.assertMember(workspaceId, userId);
    const projects = await this.prisma.project.findMany({
      where: { workspaceId, deletedAt: null },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });
    const hasMore = projects.length > take;
    const data = hasMore ? projects.slice(0, take) : projects;
    return {
      data,
      nextCursor: hasMore ? data[data.length - 1]?.id : null,
    };
  }

  async findById(id: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        tracks: { orderBy: { orderIndex: 'asc' } },
        clips: { where: { deletedAt: null }, include: { asset: true, effects: { orderBy: { orderIndex: 'asc' } } } },
        transitions: true,
        textOverlays: true,
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    await this.workspacesService.assertMember(project.workspaceId, userId);
    return project;
  }

  async update(id: string, dto: UpdateProjectDto, userId: string) {
    const project = await this.prisma.project.findFirst({ where: { id, deletedAt: null } });
    if (!project) throw new NotFoundException('Project not found');
    await this.workspacesService.assertRole(project.workspaceId, userId, ['owner', 'admin', 'editor']);
    return this.prisma.project.update({
      where: { id },
      data: { name: dto.name, description: dto.description, settings: dto.settings as any },
    });
  }

  async softDelete(id: string, userId: string) {
    const project = await this.prisma.project.findFirst({ where: { id, deletedAt: null } });
    if (!project) throw new NotFoundException('Project not found');
    await this.workspacesService.assertRole(project.workspaceId, userId, ['owner', 'admin', 'editor']);
    return this.prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async duplicate(id: string, userId: string) {
    const project = await this.findById(id, userId);
    await this.planLimits.assertCanCreateProject(project.workspaceId);
    return this.prisma.$transaction(async (tx) => {
      const newProject = await tx.project.create({
        data: {
          name: `${project.name} (Copy)`,
          description: project.description,
          workspaceId: project.workspaceId,
          settings: project.settings as any,
          createdById: userId,
        },
      });

      const trackIdMap = new Map<string, string>();
      for (const track of project.tracks) {
        const newTrack = await tx.track.create({
          data: {
            projectId: newProject.id,
            type: track.type,
            label: track.label,
            orderIndex: track.orderIndex,
            isLocked: track.isLocked,
            isMuted: track.isMuted,
            color: track.color,
          },
        });
        trackIdMap.set(track.id, newTrack.id);
      }

      for (const clip of project.clips) {
        const newTrackId = trackIdMap.get(clip.trackId);
        if (!newTrackId) continue;
        await tx.clip.create({
          data: {
            trackId: newTrackId,
            projectId: newProject.id,
            assetId: clip.assetId,
            trackPositionMs: clip.trackPositionMs,
            inPointMs: clip.inPointMs,
            outPointMs: clip.outPointMs,
            durationMs: clip.durationMs,
            transform: clip.transform as any,
          },
        });
      }

      return newProject;
    });
  }

  async getVersions(projectId: string, userId: string) {
    const project = await this.findById(projectId, userId);
    return this.prisma.operationLog.findMany({
      where: { projectId: project.id, operationType: 'project.snapshot' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async createSnapshot(projectId: string, userId: string) {
    const project = await this.findById(projectId, userId);
    await this.workspacesService.assertRole(project.workspaceId, userId, ['owner', 'admin', 'editor']);
    const snapshot = JSON.stringify({
      tracks: project.tracks,
      clips: project.clips,
      transitions: project.transitions,
      textOverlays: project.textOverlays,
    });
    return this.prisma.operationLog.create({
      data: {
        projectId: project.id,
        userId,
        operationType: 'project.snapshot',
        payload: { snapshot, name: `Snapshot ${new Date().toISOString()}` },
        clientSeq: 0,
      },
    });
  }

  async assertProjectAccess(projectId: string, userId: string, roles?: string[]) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
    if (!project) throw new NotFoundException('Project not found');
    if (roles) {
      await this.workspacesService.assertRole(project.workspaceId, userId, roles);
    } else {
      await this.workspacesService.assertMember(project.workspaceId, userId);
    }
    return project;
  }
}
