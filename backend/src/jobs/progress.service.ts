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
    if (job.status === 'completed') {
      await this.syncService.notifyUser(job.requestedById, 'export-completed', {
        exportId,
        downloadUrl: job.outputUrl,
      });
    }
    return job;
  }

  async updateAssetStatus(assetId: string, status: string, metadata?: any) {
    const data: Record<string, any> = { status };
    if (metadata) data.metadata = metadata;

    const asset = await this.prisma.asset.update({ where: { id: assetId }, data });
    await this.syncService.notifyUser(asset.uploadedById, 'asset-ready', { assetId, status });
    return asset;
  }

  async updateAssetProgress(assetId: string, progress: number, status = 'processing') {
    const existing = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!existing) return null;
    const metadata = (existing.metadata || {}) as Record<string, any>;
    const asset = await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        status,
        metadata: {
          ...metadata,
          processing_progress: Math.round(progress),
        },
      },
    });
    await this.syncService.notifyUser(asset.uploadedById, 'job-progress', {
      jobId: assetId,
      type: 'asset',
      progress: Math.round(progress),
      status: asset.status,
    });
    return asset;
  }

  async markAssetReadyIfProcessingComplete(assetId: string) {
    const variants = await this.prisma.assetVariant.findMany({ where: { assetId } });
    const types = new Set(variants.map((variant) => variant.type));
    const isComplete =
      types.has('proxy') &&
      types.has('thumbnail_strip') &&
      types.has('waveform_data');

    if (!isComplete) return null;
    return this.updateAssetProgress(assetId, 100, 'ready');
  }
}
