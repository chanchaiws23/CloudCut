import { Test, TestingModule } from '@nestjs/testing';
import { ExportRenderProcessor } from '../processors/export-render.processor';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FfmpegService } from '../ffmpeg.service';
import { ProgressService } from '../progress.service';

const mockPrisma = {
  exportJob: {
    update: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn().mockResolvedValue({
      id: 'export-1',
      projectId: 'proj-1',
      format: 'mp4',
      resolution: '1080p',
      quality: 'standard',
      status: 'queued',
    }),
  },
  project: {
    findUnique: jest.fn().mockResolvedValue({
      id: 'proj-1',
      clips: [],
      tracks: [],
    }),
  },
};

const mockFfmpeg = {
  extractMetadata: jest.fn().mockResolvedValue({ durationMs: 5000 }),
  generateProxy: jest.fn().mockResolvedValue('/tmp/proxy.mp4'),
  renderExport: jest.fn().mockResolvedValue('/tmp/output.mp4'),
};

const mockProgress = { reportProgress: jest.fn() };

const mockJob = {
  id: 'job-1',
  data: { exportId: 'export-1', projectId: 'proj-1' },
  updateProgress: jest.fn(),
};

describe('Export Pipeline', () => {
  let processor: ExportRenderProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportRenderProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FfmpegService, useValue: mockFfmpeg },
        { provide: ProgressService, useValue: mockProgress },
      ],
    }).compile();

    processor = module.get<ExportRenderProcessor>(ExportRenderProcessor);
    jest.clearAllMocks();
  });

  it('updates export status to processing when job starts', async () => {
    await processor.process(mockJob as any);
    expect(mockPrisma.exportJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'export-1' },
        data: expect.objectContaining({ status: 'processing' }),
      }),
    );
  });

  it('updates export status to completed on success', async () => {
    await processor.process(mockJob as any);
    const calls = mockPrisma.exportJob.update.mock.calls;
    const completedCall = calls.find((c: any[]) => c[0].data?.status === 'completed');
    expect(completedCall).toBeDefined();
  });

  it('updates export status to failed on error', async () => {
    mockFfmpeg.renderExport.mockRejectedValueOnce(new Error('ffmpeg failed'));
    try { await processor.process(mockJob as any); } catch {}
    const calls = mockPrisma.exportJob.update.mock.calls;
    const failedCall = calls.find((c: any[]) => c[0].data?.status === 'failed');
    expect(failedCall).toBeDefined();
  });
});
