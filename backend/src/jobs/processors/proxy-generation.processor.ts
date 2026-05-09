import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FfmpegService } from '../ffmpeg.service';
import { ProgressService } from '../progress.service';

@Processor('proxy-generation')
export class ProxyGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ProxyGenerationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ffmpegService: FfmpegService,
    private readonly progressService: ProgressService,
  ) {
    super();
  }

  async process(job: Job<{ assetId: string; originalUrl: string; metadata: any }>) {
    const { assetId, originalUrl } = job.data;
    this.logger.log(`Generating 720p proxy for asset: ${assetId}`);

    try {
      const proxyUrl = await this.ffmpegService.generateProxy(originalUrl, `proxies/${assetId}_720p.mp4`);
      await this.prisma.assetVariant.create({
        data: { assetId, type: 'proxy', url: proxyUrl, metadata: { resolution: '720p' } },
      });
      await this.checkAndMarkReady(assetId);
      return { proxyUrl };
    } catch (error) {
      this.logger.error(`Failed to generate proxy for asset: ${assetId}`, error);
      throw error;
    }
  }

  private async checkAndMarkReady(assetId: string) {
    const variants = await this.prisma.assetVariant.findMany({ where: { assetId } });
    const types = variants.map((v) => v.type);
    if (types.includes('proxy') && types.includes('thumbnail_strip') && types.includes('waveform_data')) {
      await this.progressService.updateAssetStatus(assetId, 'ready');
    }
  }
}
