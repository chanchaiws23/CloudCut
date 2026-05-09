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
    await this.pusherService.trigger(channel, 'operation', {
      type: operationType,
      payload,
      userId,
      seq: log.clientSeq,
      timestamp: log.createdAt,
    });
    return log;
  }

  async notifyUser(userId: string, event: string, data: any) {
    const channel = this.pusherService.getUserChannel(userId);
    await this.pusherService.trigger(channel, event, data);
  }
}
