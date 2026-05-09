import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { FfmpegService } from './ffmpeg.service';
import { OrchestratorService } from './orchestrator.service';
import { ProgressService } from './progress.service';
import { AssetMetadataProcessor } from './processors/asset-metadata.processor';
import { ProxyGenerationProcessor } from './processors/proxy-generation.processor';
import { ThumbnailGenerationProcessor } from './processors/thumbnail-generation.processor';
import { WaveformExtractionProcessor } from './processors/waveform-extraction.processor';
import { ExportRenderProcessor } from './processors/export-render.processor';
import { CleanupProcessor } from './processors/cleanup.processor';

@Module({
  imports: [
    CollaborationModule,
    BullModule.registerQueue(
      { name: 'asset-metadata' },
      { name: 'proxy-generation' },
      { name: 'thumbnail-generation' },
      { name: 'waveform-extraction' },
      { name: 'export-render' },
      { name: 'cleanup' },
    ),
  ],
  providers: [
    FfmpegService,
    OrchestratorService,
    ProgressService,
    AssetMetadataProcessor,
    ProxyGenerationProcessor,
    ThumbnailGenerationProcessor,
    WaveformExtractionProcessor,
    ExportRenderProcessor,
    CleanupProcessor,
  ],
  exports: [OrchestratorService, FfmpegService],
})
export class JobsModule {}
