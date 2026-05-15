import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as PusherLib from 'pusher';
const Pusher = (PusherLib as any).default ?? PusherLib;

@Injectable()
export class PusherService {
  private readonly logger = new Logger(PusherService.name);
  private pusher: any;

  constructor(private readonly configService: ConfigService) {
    this.pusher = new Pusher({
      appId: this.configService.get<string>('PUSHER_APP_ID', ''),
      key: this.configService.get<string>('PUSHER_KEY', ''),
      secret: this.configService.get<string>('PUSHER_SECRET', ''),
      cluster: this.configService.get<string>('PUSHER_CLUSTER', 'ap1'),
      useTLS: true,
    });
  }

  async trigger(channel: string, event: string, data: any) {
    try {
      await this.pusher.trigger(channel, event, data);
    } catch (error) {
      this.logger.error(`Pusher trigger failed: ${channel}/${event}`, (error as Error).stack);
    }
  }

  async authenticateUser(socketId: string, channel: string, userId: string, userInfo: Record<string, any>) {
    if (channel.startsWith('presence-')) {
      return this.pusher.authorizeChannel(socketId, channel, {
        user_id: userId,
        user_info: userInfo,
      });
    }
    return this.pusher.authorizeChannel(socketId, channel);
  }

  getUserColor(userId: string) {
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];
    const hash = userId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  getProjectChannel(projectId: string) {
    return `private-project-${projectId}`;
  }

  getPresenceChannel(projectId: string) {
    return `presence-project-${projectId}`;
  }

  getUserChannel(userId: string) {
    return `private-user-${userId}`;
  }
}
