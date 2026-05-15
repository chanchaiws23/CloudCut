import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import {
  ASSET_METADATA_QUEUE,
  CLEANUP_QUEUE,
  DEAD_LETTER_QUEUE,
  EXPORT_RENDER_QUEUE,
  PROXY_GENERATION_QUEUE,
  THUMBNAIL_GENERATION_QUEUE,
  WAVEFORM_EXTRACTION_QUEUE,
} from './queues.module';

const RETRY_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 1000 },
  removeOnComplete: true,
  removeOnFail: false,
};

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    @InjectQueue(ASSET_METADATA_QUEUE) private readonly metadataQueue: Queue,
    @InjectQueue(PROXY_GENERATION_QUEUE) private readonly proxyQueue: Queue,
    @InjectQueue(THUMBNAIL_GENERATION_QUEUE) private readonly thumbnailQueue: Queue,
    @InjectQueue(WAVEFORM_EXTRACTION_QUEUE) private readonly waveformQueue: Queue,
    @InjectQueue(EXPORT_RENDER_QUEUE) private readonly exportQueue: Queue,
    @Optional() @InjectQueue(CLEANUP_QUEUE) private readonly cleanupQueue?: Queue,
    @Optional() @InjectQueue(DEAD_LETTER_QUEUE) private readonly deadLetterQueue?: Queue,
  ) {}

  async startAssetProcessing(assetId: string, originalUrl: string) {
    this.logger.log(`Starting asset processing pipeline for: ${assetId}`);
    await this.metadataQueue.add(
      'extract-metadata',
      { assetId, originalUrl },
      {
        ...RETRY_OPTIONS,
        jobId: `asset-metadata-${assetId}`,
      },
    );
  }

  async startParallelProcessing(assetId: string, originalUrl: string, metadata: any) {
    this.logger.log(`Starting parallel processing for: ${assetId}`);
    const jobOptions = RETRY_OPTIONS;

    await Promise.all([
      this.proxyQueue.add('generate-proxy', { assetId, originalUrl, metadata }, { ...jobOptions, jobId: `proxy-${assetId}` }),
      this.thumbnailQueue.add('generate-thumbnails', { assetId, originalUrl, metadata }, { ...jobOptions, jobId: `thumbnails-${assetId}` }),
      this.waveformQueue.add('extract-waveform', { assetId, originalUrl, metadata }, { ...jobOptions, jobId: `waveform-${assetId}` }),
    ]);
  }

  async startExport(exportId: string, projectId: string) {
    this.logger.log(`Starting export render for: ${exportId}`);
    await this.exportQueue.add(
      'render-export',
      { exportId, projectId },
      {
        ...RETRY_OPTIONS,
        jobId: `export-${exportId}`,
      },
    );
  }

  async ensureExportQueued(exportId: string, projectId: string) {
    const jobId = `export-${exportId}`;
    const existingJob = await this.exportQueue.getJob(jobId);

    if (existingJob) {
      const state = await existingJob.getState();
      if (['waiting', 'active', 'delayed', 'prioritized', 'waiting-children'].includes(state)) {
        return existingJob;
      }
      await existingJob.remove().catch(() => undefined);
    }

    this.logger.warn(`Re-queueing missing export job: ${exportId}`);
    return this.exportQueue.add(
      'render-export',
      { exportId, projectId },
      {
        ...RETRY_OPTIONS,
        jobId,
      },
    );
  }

  async cancelExport(exportId: string) {
    const job = await this.exportQueue.getJob(`export-${exportId}`);
    if (!job) return false;
    const state = await job.getState();
    if (state === 'active') return false;
    await job.remove();
    return true;
  }

  async enqueueCleanup() {
    if (!this.cleanupQueue) return null;
    return this.cleanupQueue.add('daily-cleanup', {}, { ...RETRY_OPTIONS, jobId: `cleanup-${new Date().toISOString().slice(0, 10)}` });
  }

  async sendToDeadLetter(sourceQueue: string, job: Job, error: unknown) {
    if (!this.deadLetterQueue) return;
    await this.deadLetterQueue.add(
      'failed-job',
      {
        sourceQueue,
        sourceJobId: job.id,
        failedReason: (error as Error).message || String(error),
        attemptsMade: job.attemptsMade,
        data: job.data,
        failedAt: new Date().toISOString(),
      },
      { removeOnComplete: false, removeOnFail: false },
    );
  }
}
