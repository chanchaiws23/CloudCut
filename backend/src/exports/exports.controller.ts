import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExportsService } from './exports.service';
import { CreateExportDto } from './dto/export.dto';

@ApiTags('Exports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post('projects/:projectId/exports')
  @ApiOperation({ summary: 'Create export job' })
  create(@Param('projectId') projectId: string, @Body() dto: CreateExportDto, @Request() req: any) {
    return this.exportsService.create(projectId, dto, req.user.id);
  }

  @Get('projects/:projectId/exports')
  @ApiOperation({ summary: 'List exports for project' })
  findByProject(@Param('projectId') projectId: string, @Request() req: any) {
    return this.exportsService.findByProject(projectId, req.user.id);
  }

  @Get('exports/:id')
  @ApiOperation({ summary: 'Get export status and download URL' })
  findOne(@Param('id') id: string) {
    return this.exportsService.findById(id);
  }

  @Delete('exports/:id')
  @ApiOperation({ summary: 'Cancel export' })
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.exportsService.cancel(id, req.user.id);
  }
}
