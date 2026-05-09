import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto, InviteMemberDto, UpdateMemberRoleDto } from './dto/create-workspace.dto';

@ApiTags('Workspaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: 'Create workspace' })
  create(@Body() dto: CreateWorkspaceDto, @Request() req: any) {
    return this.workspacesService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List user workspaces' })
  findAll(@Request() req: any) {
    return this.workspacesService.findAllForUser(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workspace details' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.workspacesService.findById(id, req.user.id);
  }

  @Post(':id/invite')
  @ApiOperation({ summary: 'Invite member by email' })
  invite(@Param('id') id: string, @Body() dto: InviteMemberDto, @Request() req: any) {
    return this.workspacesService.invite(id, dto, req.user.id);
  }

  @Patch(':id/members/:userId')
  @ApiOperation({ summary: 'Change member role' })
  updateRole(@Param('id') id: string, @Param('userId') targetUserId: string, @Body() dto: UpdateMemberRoleDto, @Request() req: any) {
    return this.workspacesService.updateMemberRole(id, targetUserId, dto, req.user.id);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Remove member' })
  removeMember(@Param('id') id: string, @Param('userId') targetUserId: string, @Request() req: any) {
    return this.workspacesService.removeMember(id, targetUserId, req.user.id);
  }
}
