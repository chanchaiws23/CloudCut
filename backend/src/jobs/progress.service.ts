import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SyncService } from '../collaboration/sync.service';

@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncService: SyncService,
  ) {}

  async updateExportProgress(exportId: string, progress: number, status?: string) {
    const data: Record<string, any> = { progressPercent: Math.round(progress) };
    if (status) data.status = status;
    if (status === 'processing' && progress === 0) data.startedAt = new Date();
    if (status === 'completed') data.completedAt = new Date();

    const job = await this.prisma.exportJob.update({ where: { id: exportId }, data });
    await this.syncService.notifyUser(job.requestedById, 'job-progress', {
      jobId: exportId,
      type: 'export',
      progress: Math.round(progress),
      status: job.status,
    });
    return job;
  }

  async updateAssetStatus(assetId: string, status: string, metadata?: any) {
    const data: Record<string, any> = { status };
    if (metadata) data.metadata = metadata;

    const asset = await this.prisma.asset.update({ where: { id: assetId }, data });
    await this.syncService.notifyUser(asset.uploadedById, 'asset-ready', { assetId, status });
    return asset;
  }
}
