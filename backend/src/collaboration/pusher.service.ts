import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as PusherLib from 'pusher';
const Pusher = (PusherLib as any).default ?? PusherLib;

@Injectable()
export class PusherService {
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
      console.error(`Pusher trigger failed: ${channel}/${event}`, error);
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
