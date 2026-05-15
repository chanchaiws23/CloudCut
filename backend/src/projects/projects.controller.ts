import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import { ListProjectsDto } from './dto/list-projects.dto';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create project' })
  create(@Body() dto: CreateProjectDto, @Req() req: AuthenticatedRequest) {
    return this.projectsService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List projects (cursor-based pagination)' })
  findAll(@Query() query: ListProjectsDto, @Req() req: AuthenticatedRequest) {
    return this.projectsService.findAll(query.workspaceId, req.user.id, query.cursor, query.take);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project with full timeline data' })
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.projectsService.findById(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update project settings' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto, @Req() req: AuthenticatedRequest) {
    return this.projectsService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete project' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.projectsService.softDelete(id, req.user.id);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Deep copy project' })
  duplicate(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.projectsService.duplicate(id, req.user.id);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Get project version history (snapshots)' })
  getVersions(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.projectsService.getVersions(id, req.user.id);
  }

  @Post(':id/versions')
  @ApiOperation({ summary: 'Create manual project snapshot' })
  createSnapshot(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.projectsService.createSnapshot(id, req.user.id);
  }
}
