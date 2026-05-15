import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FfmpegService } from '../ffmpeg.service';
import { ProgressService } from '../progress.service';
import { OrchestratorService } from '../orchestrator.service';
import { THUMBNAIL_GENERATION_QUEUE } from '../queues.module';
import * as fs from 'fs';
import * as path from 'path';

@Processor('thumbnail-generation')
export class ThumbnailGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ThumbnailGenerationProcessor.name);

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
    this.logger.log(`Generating thumbnails for asset: ${assetId}`);
    try {
      await this.progressService.updateAssetProgress?.(assetId, 60);
      const thumbnails = await this.ffmpegService.generateThumbnails(originalUrl, assetId);
      const thumbnailDir = path.join(process.cwd(), 'uploads', 'thumbnails', assetId);
      fs.mkdirSync(thumbnailDir, { recursive: true });
      thumbnails.forEach((thumbnail, index) => {
        fs.writeFileSync(path.join(thumbnailDir, `thumb_${String(index + 1).padStart(3, '0')}.jpg`), thumbnail);
      });
      const stripUrl = `/uploads/thumbnails/${assetId}/thumb_001.jpg`;
      this.logger.log(`Generated ${thumbnails.length} thumbnails, total bytes: ${thumbnails.reduce((s, t) => s + t.byteLength, 0)}`);
      await this.prisma.assetVariant.create({
        data: { assetId, type: 'thumbnail_strip', url: stripUrl, metadata: { count: thumbnails.length, interval: 5 } },
      });
      await this.progressService.updateAssetProgress?.(assetId, 75);
      await this.progressService.markAssetReadyIfProcessingComplete(assetId);
      return { count: thumbnails.length, stripUrl };
    } catch (error) {
      if (job.attemptsMade + 1 >= (job.opts?.attempts || 1)) {
        await this.orchestratorService.sendToDeadLetter(THUMBNAIL_GENERATION_QUEUE, job, error);
      }
      throw error;
    }
  }
}
