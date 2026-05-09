import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    @InjectQueue('asset-metadata') private readonly metadataQueue: Queue,
    @InjectQueue('proxy-generation') private readonly proxyQueue: Queue,
    @InjectQueue('thumbnail-generation') private readonly thumbnailQueue: Queue,
    @InjectQueue('waveform-extraction') private readonly waveformQueue: Queue,
    @InjectQueue('export-render') private readonly exportQueue: Queue,
  ) {}

  async startAssetProcessing(assetId: string, originalUrl: string) {
    this.logger.log(`Starting asset processing pipeline for: ${assetId}`);
    await this.metadataQueue.add(
      'extract-metadata',
      { assetId, originalUrl },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  async startParallelProcessing(assetId: string, originalUrl: string, metadata: any) {
    this.logger.log(`Starting parallel processing for: ${assetId}`);
    const jobOptions = {
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 1000 },
      removeOnComplete: true,
      removeOnFail: false,
    };

    await Promise.all([
      this.proxyQueue.add('generate-proxy', { assetId, originalUrl, metadata }, jobOptions),
      this.thumbnailQueue.add('generate-thumbnails', { assetId, originalUrl, metadata }, jobOptions),
      this.waveformQueue.add('extract-waveform', { assetId, originalUrl, metadata }, jobOptions),
    ]);
  }

  async startExport(exportId: string, projectId: string) {
    this.logger.log(`Starting export render for: ${exportId}`);
    await this.exportQueue.add(
      'render-export',
      { exportId, projectId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
