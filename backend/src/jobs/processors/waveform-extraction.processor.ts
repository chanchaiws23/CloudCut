import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FfmpegService } from '../ffmpeg.service';
import { ProgressService } from '../progress.service';
import { OrchestratorService } from '../orchestrator.service';
import { WAVEFORM_EXTRACTION_QUEUE } from '../queues.module';

@Processor('waveform-extraction')
export class WaveformExtractionProcessor extends WorkerHost {
  private readonly logger = new Logger(WaveformExtractionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ffmpegService: FfmpegService,
    private readonly progressService: ProgressService,
    private readonly orchestratorService: OrchestratorService,
  ) {
    super();
  }

  async process(job: Job<{ assetId: string; originalUrl: string; metadata: any }>) {
    const { assetId, originalUrl } = job.data;
    this.logger.log(`Extracting waveform for asset: ${assetId}`);
    try {
      await this.progressService.updateAssetProgress?.(assetId, 80);
      const waveform = await this.ffmpegService.extractWaveform(originalUrl, assetId);
      await this.prisma.assetVariant.create({
        data: { assetId, type: 'waveform_data', url: `waveforms/${assetId}.json`, metadata: waveform },
      });
      await this.progressService.updateAssetProgress?.(assetId, 95);
      await this.progressService.markAssetReadyIfProcessingComplete(assetId);
      return waveform;
    } catch (error) {
      if (job.attemptsMade + 1 >= (job.opts?.attempts || 1)) {
        await this.orchestratorService.sendToDeadLetter(WAVEFORM_EXTRACTION_QUEUE, job, error);
      }
      throw error;
    }
  }
}
