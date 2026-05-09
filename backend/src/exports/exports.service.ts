import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateExportDto } from './dto/export.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  async create(projectId: string, dto: CreateExportDto, userId: string) {
    await this.projectsService.assertProjectAccess(projectId, userId, ['owner', 'admin', 'editor']);

    const idempotencyKey = dto.idempotencyKey || uuidv4();
    const existing = await this.prisma.exportJob.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.status === 'completed' || existing.status === 'processing' || existing.status === 'queued') {
        return existing;
      }
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

    return exportJob;
  }

  async findByProject(projectId: string, userId: string) {
    await this.projectsService.assertProjectAccess(projectId, userId);
    return this.prisma.exportJob.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const job = await this.prisma.exportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Export job not found');
    return job;
  }

  async cancel(id: string, userId: string) {
    const job = await this.prisma.exportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Export job not found');
    await this.projectsService.assertProjectAccess(job.projectId, userId, ['owner', 'admin', 'editor']);
    if (job.status === 'completed' || job.status === 'failed') {
      throw new ConflictException('Cannot cancel a completed or failed export');
    }
    return this.prisma.exportJob.update({ where: { id }, data: { status: 'cancelled' } });
  }
}
