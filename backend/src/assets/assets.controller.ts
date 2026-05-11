import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AssetsService } from './assets.service';
import { PresignedUrlDto, ConfirmUploadDto } from './dto/asset.dto';
import * as path from 'path';
import * as fs from 'fs';
import * as express from 'express';

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

  @Post('upload/:assetId')
  @ApiOperation({ summary: 'Direct multipart file upload' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        const dir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req: express.Request, file, cb) => {
        const assetId = (req as any).params?.assetId || 'unknown';
        const ext = path.extname(file.originalname);
        cb(null, `${assetId}${ext}`);
      },
    }),
    limits: { fileSize: 500 * 1024 * 1024 },
  }))
  async uploadFile(
    @Param('assetId') assetId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.assetsService.saveUploadedFile(assetId, file.buffer ?? fs.readFileSync(file.path), file.originalname, req.user.id);
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
