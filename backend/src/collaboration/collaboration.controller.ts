import { Controller, Post, Get, Body, Param, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PusherService } from './pusher.service';
import { OperationLogService } from './operation-log.service';
import { PresenceService } from './presence.service';
import { PlanLimitsService } from '../common/guards/plan-limits.service';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('Collaboration')
@Controller('collaboration')
export class CollaborationController {
  constructor(
    private readonly pusherService: PusherService,
    private readonly operationLogService: OperationLogService,
    private readonly presenceService: PresenceService,
    private readonly planLimits: PlanLimitsService,
    private readonly prisma: PrismaService,
  ) {}

  private async assertCollaborationEnabled(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return;
    const plan = await this.planLimits.getWorkspacePlan(project.workspaceId);
    const limits = this.planLimits.getLimits(plan);
    if (!limits.collaborationEnabled) {
      throw new ForbiddenException('Real-time collaboration is only available on Pro plan. Upgrade to collaborate.');
    }
  }

  @Post('pusher/auth')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Authenticate Pusher channel' })
  async authenticatePusher(@Body() body: { socket_id: string; channel_name: string }, @Request() req: any) {
    return this.pusherService.authenticateUser(body.socket_id, body.channel_name, req.user.id, {
      name: req.user.name || req.user.email,
    });
  }

  @Get('projects/:projectId/operations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get operations since sequence number (for reconnect sync)' })
  async getOperations(@Param('projectId') projectId: string, @Query('sinceSeq') sinceSeq: number) {
    await this.assertCollaborationEnabled(projectId);
    return this.operationLogService.getOperationsSince(projectId, sinceSeq || 0);
  }

  @Get('projects/:projectId/presence')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get online users in project' })
  async getPresence(@Param('projectId') projectId: string) {
    await this.assertCollaborationEnabled(projectId);
    return this.presenceService.getOnlineUsers(projectId);
  }
}
