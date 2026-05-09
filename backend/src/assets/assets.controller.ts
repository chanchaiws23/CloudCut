import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AssetsService } from './assets.service';
import { PresignedUrlDto, ConfirmUploadDto } from './dto/asset.dto';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post('presigned-url')
  @ApiOperation({ summary: 'Get presigned URL for upload' })
  getPresignedUrl(@Body() dto: PresignedUrlDto, @Request() req: any) {
    return this.assetsService.getPresignedUrl(dto.projectId, dto.fileName, dto.type, req.user.id);
  }

  @Post('confirm-upload')
  @ApiOperation({ summary: 'Confirm upload and trigger processing' })
  confirmUpload(@Body() dto: ConfirmUploadDto, @Request() req: any) {
    return this.assetsService.confirmUpload(dto.assetId, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List assets for project' })
  findAll(@Query('projectId') projectId: string, @Query('type') type: string, @Query('status') status: string, @Request() req: any) {
    return this.assetsService.findAll(projectId, req.user.id, type, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get asset details' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.assetsService.findById(id, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete asset' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.assetsService.softDelete(id, req.user.id);
  }
}
