import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FfmpegService } from '../ffmpeg.service';

@Processor('thumbnail-generation')
export class ThumbnailGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ThumbnailGenerationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ffmpegService: FfmpegService,
  ) {
    super();
  }

  async process(job: Job<{ assetId: string; originalUrl: string; metadata: any }>) {
    const { assetId, originalUrl } = job.data;
    this.logger.log(`Generating thumbnails for asset: ${assetId}`);
    const thumbnails = await this.ffmpegService.generateThumbnails(originalUrl, `thumbnails/${assetId}`);
    await this.prisma.assetVariant.create({
      data: { assetId, type: 'thumbnail_strip', url: thumbnails[0] || '', metadata: { count: thumbnails.length, interval: 5 } },
    });
    return { thumbnails };
  }
}
