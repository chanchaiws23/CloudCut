import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FfmpegService } from '../ffmpeg.service';
import { ProgressService } from '../progress.service';
import { OrchestratorService } from '../orchestrator.service';
import { PROXY_GENERATION_QUEUE } from '../queues.module';
import * as fs from 'fs';
import * as path from 'path';

@Processor('proxy-generation')
export class ProxyGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ProxyGenerationProcessor.name);

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
    this.logger.log(`Generating 720p proxy for asset: ${assetId}`);

    try {
      await this.progressService.updateAssetProgress?.(assetId, 35);
      const proxyData = await this.ffmpegService.generateProxy(originalUrl, assetId);
      const proxyDir = path.join(process.cwd(), 'uploads', 'proxies');
      fs.mkdirSync(proxyDir, { recursive: true });
      fs.writeFileSync(path.join(proxyDir, `${assetId}_720p.mp4`), proxyData);
      const proxyUrl = `/uploads/proxies/${assetId}_720p.mp4`;
      this.logger.log(`Proxy size: ${proxyData.byteLength} bytes → stored at ${proxyUrl}`);
      await this.prisma.assetVariant.create({
        data: { assetId, type: 'proxy', url: proxyUrl, metadata: { resolution: '720p', sizeBytes: proxyData.byteLength } },
      });
      await this.progressService.updateAssetProgress?.(assetId, 55);
      await this.progressService.markAssetReadyIfProcessingComplete(assetId);
      return { proxyUrl };
    } catch (error) {
      this.logger.error(`Failed to generate proxy for asset: ${assetId}`, error);
      if (job.attemptsMade + 1 >= (job.opts?.attempts || 1)) {
        await this.orchestratorService.sendToDeadLetter(PROXY_GENERATION_QUEUE, job, error);
      }
      throw error;
    }
  }

}
