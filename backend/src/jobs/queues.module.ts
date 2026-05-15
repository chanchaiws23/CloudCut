import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

export const ASSET_METADATA_QUEUE = 'asset-metadata';
export const PROXY_GENERATION_QUEUE = 'proxy-generation';
export const THUMBNAIL_GENERATION_QUEUE = 'thumbnail-generation';
export const WAVEFORM_EXTRACTION_QUEUE = 'waveform-extraction';
export const EXPORT_RENDER_QUEUE = 'export-render';
export const CLEANUP_QUEUE = 'cleanup';
export const DEAD_LETTER_QUEUE = 'dead-letter';

export const PROCESSING_QUEUE_NAMES = [
  ASSET_METADATA_QUEUE,
  PROXY_GENERATION_QUEUE,
  THUMBNAIL_GENERATION_QUEUE,
  WAVEFORM_EXTRACTION_QUEUE,
  EXPORT_RENDER_QUEUE,
  CLEANUP_QUEUE,
  DEAD_LETTER_QUEUE,
] as const;

@Module({
  imports: [
    BullModule.registerQueue(
      ...PROCESSING_QUEUE_NAMES.map((name) => ({
        name,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      })),
    ),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
