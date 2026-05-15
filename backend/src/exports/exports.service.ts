import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { PlanLimitsService } from '../common/guards/plan-limits.service';
import { OrchestratorService } from '../jobs/orchestrator.service';
import { CreateExportDto } from './dto/export.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly planLimits: PlanLimitsService,
    private readonly orchestrator: OrchestratorService,
  ) {}

  async create(projectId: string, dto: CreateExportDto, userId: string) {
    await this.projectsService.assertProjectAccess(projectId, userId, ['owner', 'admin', 'editor']);

    const idempotencyKey = dto.idempotencyKey || uuidv4();

    const existing = await this.prisma.exportJob.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.status === 'completed') return existing;
      if (existing.status === 'processing' || existing.status === 'queued' || existing.status === 'uploading') {
        await this.orchestrator.ensureExportQueued(existing.id, existing.projectId);
        return existing;
      }

      const resetJob = await this.prisma.exportJob.update({
        where: { id: existing.id },
        data: {
          status: 'queued',
          progressPercent: 0,
          outputUrl: null,
          outputFileSize: null,
          startedAt: null,
          completedAt: null,
          errorMessage: null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      await this.orchestrator.ensureExportQueued(resetJob.id, resetJob.projectId);
      return resetJob;
    }

    const activeProjectExport = await this.prisma.exportJob.findFirst({
      where: {
        projectId,
        requestedById: userId,
        status: { in: ['queued', 'processing', 'uploading'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (activeProjectExport) {
      await this.orchestrator.ensureExportQueued(activeProjectExport.id, activeProjectExport.projectId);
      return activeProjectExport;
    }

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (project) {
      await this.planLimits.assertCanCreateExport(project.workspaceId, dto.resolution, dto.format);
    }

    const exportJob = await this.prisma.exportJob.create({
      data: {
        projectId,
        requestedById: userId,
        format: dto.format || 'mp4',
        resolution: dto.resolution || '1080p',
        quality: dto.quality || 'standard',
        status: 'queued',
        idempotencyKey,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await this.orchestrator.startExport(exportJob.id, projectId);

    return exportJob;
  }

  async findByProject(projectId: string, userId: string, cursor?: string, take = 20) {
    await this.projectsService.assertProjectAccess(projectId, userId);
    const jobs = await this.prisma.exportJob.findMany({
      where: { projectId },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });
    const hasMore = jobs.length > take;
    const data = hasMore ? jobs.slice(0, take) : jobs;
    return {
      data,
      nextCursor: hasMore ? data[data.length - 1]?.id : null,
    };
  }

  async findById(id: string, userId: string) {
    const job = await this.prisma.exportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Export job not found');
    await this.projectsService.assertProjectAccess(job.projectId, userId);
    return job;
  }

  async cancel(id: string, userId: string) {
    const job = await this.prisma.exportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Export job not found');
    await this.projectsService.assertProjectAccess(job.projectId, userId, ['owner', 'admin', 'editor']);
    if (job.status === 'completed' || job.status === 'failed') {
      throw new ConflictException('Cannot cancel a completed or failed export');
    }
    await this.orchestrator.cancelExport(id);
    return this.prisma.exportJob.update({ where: { id }, data: { status: 'cancelled' } });
  }
}
