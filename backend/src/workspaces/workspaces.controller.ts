import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto, InviteMemberDto, UpdateMemberRoleDto } from './dto/create-workspace.dto';
import { ListWorkspacesDto } from './dto/list-workspaces.dto';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@ApiTags('Workspaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: 'Create workspace' })
  create(@Body() dto: CreateWorkspaceDto, @Req() req: AuthenticatedRequest) {
    return this.workspacesService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List user workspaces' })
  findAll(@Query() query: ListWorkspacesDto, @Req() req: AuthenticatedRequest) {
    return this.workspacesService.findAllForUser(req.user.id, query.cursor, query.take);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workspace details' })
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.workspacesService.findById(id, req.user.id);
  }

  @Post(':id/invite')
  @ApiOperation({ summary: 'Invite member by email' })
  invite(@Param('id') id: string, @Body() dto: InviteMemberDto, @Req() req: AuthenticatedRequest) {
    return this.workspacesService.invite(id, dto, req.user.id);
  }

  @Patch(':id/members/:userId')
  @ApiOperation({ summary: 'Change member role' })
  updateRole(@Param('id') id: string, @Param('userId') targetUserId: string, @Body() dto: UpdateMemberRoleDto, @Req() req: AuthenticatedRequest) {
    return this.workspacesService.updateMemberRole(id, targetUserId, dto, req.user.id);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Remove member' })
  removeMember(@Param('id') id: string, @Param('userId') targetUserId: string, @Req() req: AuthenticatedRequest) {
    return this.workspacesService.removeMember(id, targetUserId, req.user.id);
  }
}
