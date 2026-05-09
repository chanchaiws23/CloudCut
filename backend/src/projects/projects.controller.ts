import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create project' })
  create(@Body() dto: CreateProjectDto, @Request() req: any) {
    return this.projectsService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List projects (cursor-based pagination)' })
  findAll(@Query('workspaceId') workspaceId: string, @Query('cursor') cursor: string, @Query('take') take: number, @Request() req: any) {
    return this.projectsService.findAll(workspaceId, req.user.id, cursor, take || 20);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project with full timeline data' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.projectsService.findById(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update project settings' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto, @Request() req: any) {
    return this.projectsService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete project' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.projectsService.softDelete(id, req.user.id);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Deep copy project' })
  duplicate(@Param('id') id: string, @Request() req: any) {
    return this.projectsService.duplicate(id, req.user.id);
  }
}
