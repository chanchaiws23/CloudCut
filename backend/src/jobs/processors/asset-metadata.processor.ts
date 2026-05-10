import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FfmpegService } from '../ffmpeg.service';
import { ProgressService } from '../progress.service';
import { OrchestratorService } from '../orchestrator.service';

@Processor('asset-metadata')
export class AssetMetadataProcessor extends WorkerHost {
  private readonly logger = new Logger(AssetMetadataProcessor.name);

  constructor(
    private readonly ffmpegService: FfmpegService,
    private readonly progressService: ProgressService,
    private readonly orchestratorService: OrchestratorService,
  ) {
    super();
  }

  async process(job: Job<{ assetId: string; originalUrl: string }>) {
    const { assetId, originalUrl } = job.data;
    this.logger.log(`Extracting metadata for asset: ${assetId}`);

    try {
      const metadata = await this.ffmpegService.extractMetadata(originalUrl);
      await this.progressService.updateAssetStatus(assetId, 'processing', {
        durationMs: metadata.durationMs,
        width: metadata.width,
        height: metadata.height,
        codec: metadata.codec,
        audioCodec: metadata.audioCodec,
        audioChannels: metadata.audioChannels,
        fileSizeBytes: metadata.fileSizeBytes,
      });
      await this.orchestratorService.startParallelProcessing(assetId, originalUrl, metadata);
      this.logger.log(`Metadata extracted for asset: ${assetId}`);
      return metadata;
    } catch (error) {
      this.logger.error(`Failed to extract metadata for asset: ${assetId}`, error);
      await this.progressService.updateAssetStatus(assetId, 'failed');
      throw error;
    }
  }
}
