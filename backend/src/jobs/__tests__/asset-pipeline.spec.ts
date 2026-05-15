import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { OrchestratorService } from '../orchestrator.service';

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
};

describe('Asset Processing Pipeline', () => {
  let orchestrator: OrchestratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestratorService,
        { provide: getQueueToken('asset-metadata'), useValue: mockQueue },
        { provide: getQueueToken('proxy-generation'), useValue: mockQueue },
        { provide: getQueueToken('thumbnail-generation'), useValue: mockQueue },
        { provide: getQueueToken('waveform-extraction'), useValue: mockQueue },
        { provide: getQueueToken('export-render'), useValue: mockQueue },
      ],
    }).compile();

    orchestrator = module.get<OrchestratorService>(OrchestratorService);
    jest.clearAllMocks();
  });

  describe('startAssetProcessing', () => {
    it('enqueues extract-metadata job', async () => {
      await orchestrator.startAssetProcessing('asset-1', 'https://storage/asset-1.mp4');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'extract-metadata',
        expect.objectContaining({ assetId: 'asset-1' }),
        expect.any(Object),
      );
    });

    it('passes assetId and originalUrl in job data', async () => {
      await orchestrator.startAssetProcessing('asset-1', 'https://storage/asset-1.mp4');
      const callArgs = mockQueue.add.mock.calls[0];
      expect(callArgs[1]).toMatchObject({ assetId: 'asset-1', originalUrl: 'https://storage/asset-1.mp4' });
    });

    it('configures retry with 3 attempts and exponential backoff', async () => {
      await orchestrator.startAssetProcessing('asset-1', 'url');
      const opts = mockQueue.add.mock.calls[0][2];
      expect(opts.attempts).toBe(3);
      expect(opts.backoff).toMatchObject({ type: 'exponential', delay: 1000 });
    });
  });

  describe('startParallelProcessing', () => {
    it('enqueues proxy, thumbnail, and waveform jobs in parallel', async () => {
      const metadata = { durationMs: 5000, width: 1920, height: 1080 };
      await orchestrator.startParallelProcessing('asset-1', 'url', metadata);
      const jobNames = mockQueue.add.mock.calls.map((c: any[]) => c[0]);
      expect(jobNames).toContain('generate-proxy');
      expect(jobNames).toContain('generate-thumbnails');
      expect(jobNames).toContain('extract-waveform');
    });
  });

  describe('startExport', () => {
    it('enqueues render-export job', async () => {
      await orchestrator.startExport('export-1', 'project-1');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'render-export',
        expect.objectContaining({ exportId: 'export-1', projectId: 'project-1' }),
        expect.any(Object),
      );
    });

    it('configures retry with 3 attempts', async () => {
      await orchestrator.startExport('export-1', 'proj-1');
      const opts = mockQueue.add.mock.calls[0][2];
      expect(opts.attempts).toBe(3);
    });
  });
});
