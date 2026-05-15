import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import * as fs from 'fs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FfmpegService } from '../ffmpeg.service';
import { ProgressService } from '../progress.service';
import { OrchestratorService } from '../orchestrator.service';
import { EXPORT_RENDER_QUEUE } from '../queues.module';

@Processor('export-render')
export class ExportRenderProcessor extends WorkerHost {
  private readonly logger = new Logger(ExportRenderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ffmpegService: FfmpegService,
    private readonly progressService: ProgressService,
    @Optional() private readonly orchestratorService?: OrchestratorService,
  ) {
    super();
  }

  async process(job: Job<{ exportId: string; projectId: string }>) {
    const { exportId, projectId } = job.data;
    this.logger.log(`Starting export render: ${exportId}`);

    try {
      await this.progressService.updateExportProgress(exportId, 0, 'processing');

      const exportJob = await this.prisma.exportJob.findUnique({ where: { id: exportId } });
      if (!exportJob || exportJob.status === 'cancelled') {
        this.logger.log(`Export ${exportId} was cancelled`);
        return;
      }

      const clips = await this.prisma.clip.findMany({
        where: { projectId, deletedAt: null },
        include: { effects: { where: { enabled: true }, orderBy: { orderIndex: 'asc' } }, asset: true },
        orderBy: { trackPositionMs: 'asc' },
      });

      if (clips.length === 0) {
        await this.progressService.updateExportProgress(exportId, 100, 'failed');
        throw new Error('No clips found in project');
      }

      await this.progressService.updateExportProgress(exportId, 10);
      await this.assertNotCancelled(exportId);

      const tracks = await this.prisma.track.findMany({ where: { projectId } });
      const clipsByTrack = new Map<string, typeof clips>();
      for (const track of tracks) {
        clipsByTrack.set(track.id, clips.filter((c) => c.trackId === track.id));
      }

      const videoTracks = tracks.filter((t) => t.type === 'video');

      const outputPath = `exports/${exportId}.${exportJob.format}`;

      const isRenderableVideoClip = (clip: (typeof clips)[number]) =>
        Boolean(clip.asset) && clip.asset?.type !== 'audio' && clip.asset?.type !== 'image';

      const renderableVideoClips = (trackId: string) =>
        (clipsByTrack.get(trackId) || []).filter(isRenderableVideoClip);

      const renderableVideoTracks = videoTracks.filter((track) => renderableVideoClips(track.id).length > 0);

      if (renderableVideoTracks.length > 1) {
        const trackOutputs: string[] = [];
        for (const track of renderableVideoTracks) {
          const segments = renderableVideoClips(track.id)
            .map((clip) => ({
              inputPath: clip.asset!.originalUrl,
              inPointMs: clip.inPointMs,
              outPointMs: clip.outPointMs,
            }));
          const trackPath = `tmp_track_${track.id}.mp4`;
          await this.ffmpegService.trimAndConcat(segments, trackPath);
          await this.assertNotCancelled(exportId);
          trackOutputs.push(trackPath);
        }

        if (trackOutputs.length > 1) {
          await this.ffmpegService.overlayTracks(trackOutputs, outputPath);
        } else if (trackOutputs.length === 1) {
          fs.copyFileSync(trackOutputs[0], outputPath);
        }
      } else {
        const primaryVideoTrack = renderableVideoTracks[0];
        const segments = (primaryVideoTrack ? renderableVideoClips(primaryVideoTrack.id) : clips.filter(isRenderableVideoClip))
          .map((clip) => ({
            inputPath: clip.asset!.originalUrl,
            inPointMs: clip.inPointMs,
            outPointMs: clip.outPointMs,
          }));
        if (segments.length === 0) throw new Error('No video clips found in project');
        await this.ffmpegService.trimAndConcat(segments, outputPath);
      }

      await this.progressService.updateExportProgress(exportId, 70);
      await this.assertNotCancelled(exportId);

      for (const clip of clips) {
        if (clip.effects.length > 0) {
          const effects = clip.effects.map((e) => ({ type: e.type, params: e.params as Record<string, any> }));
          await this.ffmpegService.applyEffects(outputPath, outputPath, effects);
          await this.assertNotCancelled(exportId);
        }
      }
      await this.progressService.updateExportProgress(exportId, 80);

      const textOverlays = await this.prisma.textOverlay.findMany({ where: { projectId } });
      if (textOverlays.length > 0) {
        await this.ffmpegService.burnTextOverlays(
          outputPath,
          outputPath,
          textOverlays.map((o) => ({
            content: o.content,
            positionX: o.positionX,
            positionY: o.positionY,
            fontSize: o.fontSize,
            fontColor: o.fontColor,
            durationMs: o.durationMs,
            trackPositionMs: o.trackPositionMs,
          })),
        );
      }
      await this.progressService.updateExportProgress(exportId, 90);

      const outputFileSize = fs.existsSync(outputPath) ? BigInt(fs.statSync(outputPath).size) : undefined;
      await this.prisma.exportJob.update({
        where: { id: exportId },
        data: {
          status: 'completed',
          outputUrl: outputPath,
          ...(outputFileSize !== undefined ? { outputFileSize } : {}),
          progressPercent: 100,
          completedAt: new Date(),
        },
      });

      await this.progressService.updateExportProgress(exportId, 100, 'completed');
      this.logger.log(`Export completed: ${exportId}`);
      return { outputPath };
    } catch (error) {
      this.logger.error(`Export failed: ${exportId}`, error);
      await this.prisma.exportJob.update({
        where: { id: exportId },
        data: { status: 'failed', errorMessage: (error as Error).message },
      });
      if (job.attemptsMade + 1 >= (job.opts?.attempts || 1)) {
        await this.orchestratorService?.sendToDeadLetter(EXPORT_RENDER_QUEUE, job, error);
      }
      throw error;
    }
  }

  private async assertNotCancelled(exportId: string) {
    const latest = await this.prisma.exportJob.findUnique({ where: { id: exportId }, select: { status: true } });
    if (latest?.status === 'cancelled') {
      throw new Error('Export cancelled');
    }
  }
}
