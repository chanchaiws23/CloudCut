import { Injectable } from '@nestjs/common';
import { PusherService } from './pusher.service';
import { OperationLogService } from './operation-log.service';

@Injectable()
export class SyncService {
  constructor(
    private readonly pusherService: PusherService,
    private readonly operationLogService: OperationLogService,
  ) {}

  async broadcastOperation(projectId: string, userId: string, operationType: string, payload: any) {
    const log = await this.operationLogService.create(projectId, userId, operationType, payload);
    const channel = this.pusherService.getProjectChannel(projectId);
    const eventPayload = {
      type: operationType,
      payload,
      userId,
      seq: log.clientSeq,
      timestamp: log.createdAt,
    };

    await this.pusherService.trigger(channel, 'operation', eventPayload);
    const specificEvent = this.toSpecificEvent(operationType, payload, userId, log.clientSeq);
    if (specificEvent) {
      await this.pusherService.trigger(channel, specificEvent.event, specificEvent.payload);
    }
    return log;
  }

  private toSpecificEvent(operationType: string, payload: any, userId: string, seq: number) {
    const base = { userId, seq };
    switch (operationType) {
      case 'clip.add':
        return { event: 'clip-added', payload: { clip: payload, ...base } };
      case 'clip.update':
        return { event: 'clip-updated', payload: { clipId: payload.clipId, changes: payload.changes, ...base } };
      case 'clip.delete':
        return { event: 'clip-deleted', payload: { clipId: payload.clipId, ...base } };
      case 'track.add':
        return { event: 'track-added', payload: { track: payload, ...base } };
      case 'track.update':
        return { event: 'track-updated', payload: { trackId: payload.trackId, changes: payload.changes, ...base } };
      case 'track.delete':
        return { event: 'track-deleted', payload: { trackId: payload.trackId, ...base } };
      case 'effect.add':
        return { event: 'effect-added', payload: { clipId: payload.clipId, effect: payload.effect, ...base } };
      case 'effect.update':
        return { event: 'effect-updated', payload: { clipId: payload.clipId, effectId: payload.effectId, changes: payload.changes, ...base } };
      case 'effect.delete':
        return { event: 'effect-deleted', payload: { clipId: payload.clipId, effectId: payload.effectId, ...base } };
      default:
        return null;
    }
  }

  async notifyUser(userId: string, event: string, data: any) {
    const channel = this.pusherService.getUserChannel(userId);
    await this.pusherService.trigger(channel, event, data);
  }
}
