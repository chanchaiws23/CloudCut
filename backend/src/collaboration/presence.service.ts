import { Injectable } from '@nestjs/common';

interface PresenceUser {
  userId: string;
  name: string;
  avatar: string;
  color: string;
  currentTimeMs: number;
  activeTrackId?: string;
  activeClipId?: string;
}

@Injectable()
export class PresenceService {
  private projectUsers = new Map<string, Map<string, PresenceUser>>();

  addUser(projectId: string, user: PresenceUser) {
    if (!this.projectUsers.has(projectId)) {
      this.projectUsers.set(projectId, new Map());
    }
    this.projectUsers.get(projectId)!.set(user.userId, user);
  }

  removeUser(projectId: string, userId: string) {
    this.projectUsers.get(projectId)?.delete(userId);
  }

  updateCursor(projectId: string, userId: string, data: { currentTimeMs: number; activeTrackId?: string; activeClipId?: string }) {
    const user = this.projectUsers.get(projectId)?.get(userId);
    if (user) {
      user.currentTimeMs = data.currentTimeMs;
      user.activeTrackId = data.activeTrackId;
      user.activeClipId = data.activeClipId;
    }
  }

  getOnlineUsers(projectId: string): PresenceUser[] {
    const users = this.projectUsers.get(projectId);
    return users ? Array.from(users.values()) : [];
  }
}
