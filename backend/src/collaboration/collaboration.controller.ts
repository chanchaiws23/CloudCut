import { Controller, Post, Get, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PusherService } from './pusher.service';
import { OperationLogService } from './operation-log.service';
import { PresenceService } from './presence.service';

@ApiTags('Collaboration')
@Controller('collaboration')
export class CollaborationController {
  constructor(
    private readonly pusherService: PusherService,
    private readonly operationLogService: OperationLogService,
    private readonly presenceService: PresenceService,
  ) {}

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
  getOperations(@Param('projectId') projectId: string, @Query('sinceSeq') sinceSeq: number) {
    return this.operationLogService.getOperationsSince(projectId, sinceSeq || 0);
  }

  @Get('projects/:projectId/presence')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get online users in project' })
  getPresence(@Param('projectId') projectId: string) {
    return this.presenceService.getOnlineUsers(projectId);
  }
}
