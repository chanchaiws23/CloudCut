import { Test, TestingModule } from '@nestjs/testing';
import { AssetMetadataProcessor } from '../processors/asset-metadata.processor';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FfmpegService } from '../ffmpeg.service';
import { OrchestratorService } from '../orchestrator.service';
import { ProgressService } from '../progress.service';

const mockPrisma = {};

const mockFfmpeg = {
  extractMetadata: jest.fn(),
};

const mockOrchestrator = {
  startParallelProcessing: jest.fn().mockResolvedValue(undefined),
};

const mockProgress = {
  updateAssetStatus: jest.fn().mockResolvedValue(undefined),
  updateExportProgress: jest.fn().mockResolvedValue(undefined),
};

const mockJob = {
  id: 'job-1',
  attemptsMade: 0,
  data: { assetId: 'asset-1', originalUrl: 'https://storage/test.mp4' },
  updateProgress: jest.fn(),
};

describe('Retry Logic', () => {
  let processor: AssetMetadataProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetMetadataProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FfmpegService, useValue: mockFfmpeg },
        { provide: OrchestratorService, useValue: mockOrchestrator },
        { provide: ProgressService, useValue: mockProgress },
      ],
    }).compile();

    processor = module.get<AssetMetadataProcessor>(AssetMetadataProcessor);
    jest.clearAllMocks();
  });

  it('processes job successfully on first attempt', async () => {
    mockFfmpeg.extractMetadata.mockResolvedValue({
      durationMs: 5000, width: 1920, height: 1080, codec: 'h264',
      audioCodec: 'aac', audioChannels: 2, fileSizeBytes: 10000000,
    });
    await processor.process(mockJob as any);
    expect(mockProgress.updateAssetStatus).toHaveBeenCalledWith(
      'asset-1',
      'processing',
      expect.any(Object),
    );
    expect(mockOrchestrator.startParallelProcessing).toHaveBeenCalledWith(
      'asset-1',
      'https://storage/test.mp4',
      expect.any(Object),
    );
  });

  it('throws error on failure so BullMQ can retry', async () => {
    mockFfmpeg.extractMetadata.mockRejectedValue(new Error('ffmpeg error'));
    await expect(processor.process(mockJob as any)).rejects.toThrow();
  });

  it('marks asset as failed on final attempt (attemptsMade >= 2)', async () => {
    const finalAttemptJob = { ...mockJob, attemptsMade: 2 };
    mockFfmpeg.extractMetadata.mockRejectedValue(new Error('ffmpeg permanent error'));
    try {
      await processor.process(finalAttemptJob as any);
    } catch {}
    expect(mockProgress.updateAssetStatus).toHaveBeenCalledWith(
      'asset-1',
      'failed',
    );
  });
});
