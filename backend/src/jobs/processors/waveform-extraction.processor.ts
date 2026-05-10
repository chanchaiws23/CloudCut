import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FfmpegService } from '../ffmpeg.service';

@Processor('waveform-extraction')
export class WaveformExtractionProcessor extends WorkerHost {
  private readonly logger = new Logger(WaveformExtractionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ffmpegService: FfmpegService,
  ) {
    super();
  }

  async process(job: Job<{ assetId: string; originalUrl: string; metadata: any }>) {
    const { assetId, originalUrl } = job.data;
    this.logger.log(`Extracting waveform for asset: ${assetId}`);
    const waveform = await this.ffmpegService.extractWaveform(originalUrl, assetId);
    await this.prisma.assetVariant.create({
      data: { assetId, type: 'waveform_data', url: `waveforms/${assetId}.json`, metadata: waveform },
    });
    return waveform;
  }
}
