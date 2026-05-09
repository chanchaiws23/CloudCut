import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { SyncService } from '../collaboration/sync.service';
import {
  CreateTrackDto, UpdateTrackDto,
  CreateClipDto, UpdateClipDto, SplitClipDto,
  CreateEffectDto, UpdateEffectDto, ReorderEffectsDto,
  CreateTransitionDto, UpdateTransitionDto,
  CreateTextOverlayDto, UpdateTextOverlayDto,
} from './dto/timeline.dto';

@Injectable()
export class TimelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly syncService: SyncService,
  ) {}

  // === Tracks ===
  async createTrack(projectId: string, dto: CreateTrackDto, userId: string) {
    await this.projectsService.assertProjectAccess(projectId, userId, ['owner', 'admin', 'editor']);
    const track = await this.prisma.track.create({
      data: { projectId, type: dto.type, label: dto.label, orderIndex: dto.orderIndex, color: dto.color || '#3b82f6' },
    });
    await this.syncService.broadcastOperation(projectId, userId, 'track.add', track);
    return track;
  }

  async updateTrack(projectId: string, trackId: string, dto: UpdateTrackDto, userId: string) {
    await this.projectsService.assertProjectAccess(projectId, userId, ['owner', 'admin', 'editor']);
    const track = await this.prisma.track.update({
      where: { id: trackId },
      data: { ...dto },
    });
    await this.syncService.broadcastOperation(projectId, userId, 'track.update', { trackId, changes: dto });
    return track;
  }

  async deleteTrack(projectId: string, trackId: string, userId: string) {
    await this.projectsService.assertProjectAccess(projectId, userId, ['owner', 'admin', 'editor']);
    await this.prisma.track.delete({ where: { id: trackId } });
    await this.syncService.broadcastOperation(projectId, userId, 'track.delete', { trackId });
    return { deleted: true };
  }

  // === Clips ===
  async createClip(projectId: string, dto: CreateClipDto, userId: string) {
    await this.projectsService.assertProjectAccess(projectId, userId, ['owner', 'admin', 'editor']);
    const durationMs = dto.outPointMs - dto.inPointMs;
    const clip = await this.prisma.clip.create({
      data: {
        trackId: dto.trackId,
        projectId,
        assetId: dto.assetId,
        trackPositionMs: dto.trackPositionMs,
        inPointMs: dto.inPointMs,
        outPointMs: dto.outPointMs,
        durationMs,
        transform: dto.transform || { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      },
      include: { effects: true },
    });
    await this.syncService.broadcastOperation(projectId, userId, 'clip.add', clip);
    return clip;
  }

  async updateClip(projectId: string, clipId: string, dto: UpdateClipDto, userId: string) {
    await this.projectsService.assertProjectAccess(projectId, userId, ['owner', 'admin', 'editor']);
    const updateData: Record<string, any> = {};
    if (dto.trackId !== undefined) updateData.trackId = dto.trackId;
    if (dto.trackPositionMs !== undefined) updateData.trackPositionMs = dto.trackPositionMs;
    if (dto.inPointMs !== undefined) updateData.inPointMs = dto.inPointMs;
    if (dto.outPointMs !== undefined) updateData.outPointMs = dto.outPointMs;
    if (dto.inPointMs !== undefined || dto.outPointMs !== undefined) {
      const existing = await this.prisma.clip.findUnique({ where: { id: clipId } });
      if (existing) {
        const inP = dto.inPointMs ?? existing.inPointMs;
        const outP = dto.outPointMs ?? existing.outPointMs;
        updateData.durationMs = outP - inP;
      }
    }
    if (dto.transform !== undefined) updateData.transform = dto.transform;

    const clip = await this.prisma.clip.update({ where: { id: clipId }, data: updateData });
    await this.syncService.broadcastOperation(projectId, userId, 'clip.update', { clipId, changes: dto });
    return clip;
  }

  async deleteClip(projectId: string, clipId: string, userId: string) {
    await this.projectsService.assertProjectAccess(projectId, userId, ['owner', 'admin', 'editor']);
    await this.prisma.clip.update({ where: { id: clipId }, data: { deletedAt: new Date() } });
    await this.syncService.broadcastOperation(projectId, userId, 'clip.delete', { clipId });
    return { deleted: true };
  }

  async splitClip(projectId: string, clipId: string, dto: SplitClipDto, userId: string) {
    await this.projectsService.assertProjectAccess(projectId, userId, ['owner', 'admin', 'editor']);
    const clip = await this.prisma.clip.findUnique({ where: { id: clipId } });
    if (!clip) throw new NotFoundException('Clip not found');

    const splitPoint = dto.atTimeMs;
    const relativeToClipStart = splitPoint - clip.trackPositionMs;
    if (relativeToClipStart <= 0 || relativeToClipStart >= clip.durationMs) {
      throw new NotFoundException('Split point is outside clip boundaries');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedClip = await tx.clip.update({
        where: { id: clipId },
        data: {
          outPointMs: clip.inPointMs + relativeToClipStart,
          durationMs: relativeToClipStart,
        },
      });
      const newClip = await tx.clip.create({
        data: {
          trackId: clip.trackId,
          projectId: clip.projectId,
          assetId: clip.assetId,
          trackPositionMs: splitPoint,
          inPointMs: clip.inPointMs + relativeToClipStart,
          outPointMs: clip.outPointMs,
          durationMs: clip.durationMs - relativeToClipStart,
          transform: clip.transform as any,
        },
      });
      return { original: updatedClip, new: newClip };
    });

    await this.syncService.broadcastOperation(projectId, userId, 'clip.split', { clipId, atTimeMs: splitPoint, result });
    return result;
  }

  // === Effects ===
  async addEffect(projectId: string, clipId: string, dto: CreateEffectDto, userId: string) {
    await this.projectsService.assertProjectAccess(projectId, userId, ['owner', 'admin', 'editor']);
    const existingEffects = await this.prisma.clipEffect.count({ where: { clipId } });
    const effect = await this.prisma.clipEffect.create({
      data: {
        clipId,
        type: dto.type,
        orderIndex: existingEffects,
        params: dto.params || {},
        enabled: dto.enabled ?? true,
      },
    });
    await this.syncService.broadcastOperation(projectId, userId, 'effect.add', { clipId, effect });
    return effect;
  }

  async updateEffect(projectId: string, clipId: string, effectId: string, dto: UpdateEffectDto, userId: string) {
    await this.projectsService.assertProjectAccess(projectId, userId, ['owner', 'admin', 'editor']);
    const effect = await this.prisma.clipEffect.update({
      where: { id: effectId },
      data: { params: dto.params as any, enabled: dto.enabled },
    });
    await this.syncService.broadcastOperation(projectId, userId, 'effect.update', { clipId, effectId, changes: dto });
    return effect;
  }

  async deleteEffect(projectId: string, clipId: string, effectId: string, userId: string) {
    await this.projectsService.assertProjectAccess(projectId, userId, ['owner', 'admin', 'editor']);
    await this.prisma.clipEffect.delete({ where: { id: effectId } });
    await this.syncService.broadcastOperation(projectId, userId, 'effect.delete', { clipId, effectId });
    return { deleted: true };
  }

  async reorderEffects(projectId: string, clipId: string, dto: ReorderEffectsDto, userId: string) {
    await this.projectsService.assertProjectAccess(projectId, userId, ['owner', 'admin', 'editor']);
    await this.prisma.$transaction(
      dto.effectIds.map((id, index) =>
        this.prisma.clipEffect.update({ where: { id }, data: { orderIndex: index } }),
      ),
    );
    await this.syncService.broadcastOperation(projectId, userId, 'effect.reorder', { clipId, effectIds: dto.effectIds });
    return { reordered: true };
  }

  // === Transitions ===
  async createTransition(projectId: string, dto: CreateTransitionDto, userId: string) {
    await this.projectsService.assertProjectAccess(projectId, userId, ['owner', 'admin', 'editor']);
    const transition = await this.prisma.transition.create({
      data: {
        projectId,
        fromClipId: dto.fromClipId,
        toClipId: dto.toClipId,
        type: dto.type,
        durationMs: dto.durationMs,
        params: dto.params || {},
      },
    });
    await this.syncService.broadcastOperation(projectId, userId, 'transition.add', transition);
    return transition;
  }

  async updateTransition(projectId: string, transitionId: string, dto: UpdateTransitionDto, userId: string) {
    await this.projectsService.assertProjectAccess(projectId, userId, ['owner', 'admin', 'editor']);
    const transition = await this.prisma.transition.update({
      where: { id: transitionId },
      data: { ...dto, params: dto.params as any },
    });
    await this.syncService.broadcastOperation(projectId, userId, 'transition.update', { transitionId, changes: dto });
    return transition;
  }

  async deleteTransition(projectId: string, transitionId: string, userId: string) {
    await this.projectsService.assertProjectAccess(projectId, userId, ['owner', 'admin', 'editor']);
    await this.prisma.transition.delete({ where: { id: transitionId } });
    await this.syncService.broadcastOperation(projectId, userId, 'transition.delete', { transitionId });
    return { deleted: true };
  }

  // === Text Overlays ===
  async createTextOverlay(projectId: string, dto: CreateTextOverlayDto, userId: string) {
    await this.projectsService.assertProjectAccess(projectId, userId, ['owner', 'admin', 'editor']);
    const overlay = await this.prisma.textOverlay.create({
      data: { projectId, ...dto },
    });
    await this.syncService.broadcastOperation(projectId, userId, 'textOverlay.add', overlay);
    return overlay;
  }

  async updateTextOverlay(projectId: string, overlayId: string, dto: UpdateTextOverlayDto, userId: string) {
    await this.projectsService.assertProjectAccess(projectId, userId, ['owner', 'admin', 'editor']);
    const overlay = await this.prisma.textOverlay.update({
      where: { id: overlayId },
      data: { ...dto },
    });
    await this.syncService.broadcastOperation(projectId, userId, 'textOverlay.update', { overlayId, changes: dto });
    return overlay;
  }

  async deleteTextOverlay(projectId: string, overlayId: string, userId: string) {
    await this.projectsService.assertProjectAccess(projectId, userId, ['owner', 'admin', 'editor']);
    await this.prisma.textOverlay.delete({ where: { id: overlayId } });
    await this.syncService.broadcastOperation(projectId, userId, 'textOverlay.delete', { overlayId });
    return { deleted: true };
  }
}
