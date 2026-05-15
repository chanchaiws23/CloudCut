import { Controller, Post, Get, Body, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PusherService } from './pusher.service';
import { OperationLogService } from './operation-log.service';
import { PresenceService } from './presence.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@ApiTags('Collaboration')
@Controller('collaboration')
export class CollaborationController {
  constructor(
    private readonly pusherService: PusherService,
    private readonly operationLogService: OperationLogService,
    private readonly presenceService: PresenceService,
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  private parseProjectChannel(channelName: string) {
    const match = channelName.match(/^(?:private|presence)-project-(.+)$/);
    return match?.[1];
  }

  private parseUserChannel(channelName: string) {
    const match = channelName.match(/^private-user-(.+)$/);
    return match?.[1];
  }

  @Post('pusher/auth')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Authenticate Pusher channel' })
  async authenticatePusher(@Body() body: { socket_id: string; channel_name: string }, @Req() req: AuthenticatedRequest) {
    const projectId = this.parseProjectChannel(body.channel_name);
    if (projectId) {
      await this.projectsService.assertProjectAccess(projectId, req.user.id);
    }

    const channelUserId = this.parseUserChannel(body.channel_name);
    if (channelUserId && channelUserId !== req.user.id) {
      throw new ForbiddenException('Cannot subscribe to another user channel');
    }

    const user = await this.prisma.user.findUnique({ where: { id: req.user.id } });
    const userInfo = {
      userId: req.user.id,
      name: user?.name || req.user.email,
      avatar: user?.avatarUrl || '',
      color: this.pusherService.getUserColor(req.user.id),
    };
    if (projectId && body.channel_name.startsWith('presence-')) {
      this.presenceService.addUser(projectId, { ...userInfo, currentTimeMs: 0 });
    }
    return this.pusherService.authenticateUser(body.socket_id, body.channel_name, req.user.id, {
      ...userInfo,
    });
  }

  @Get('projects/:projectId/operations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get operations since sequence number (for reconnect sync)' })
  async getOperations(@Param('projectId') projectId: string, @Query('sinceSeq') sinceSeq: number, @Req() req: AuthenticatedRequest) {
    await this.projectsService.assertProjectAccess(projectId, req.user.id);
    return this.operationLogService.getOperationsSince(projectId, sinceSeq || 0);
  }

  @Get('projects/:projectId/presence')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get online users in project' })
  async getPresence(@Param('projectId') projectId: string, @Req() req: AuthenticatedRequest) {
    await this.projectsService.assertProjectAccess(projectId, req.user.id);
    return this.presenceService.getOnlineUsers(projectId);
  }
}
