import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AssetsService } from './assets.service';
import { PresignedUrlDto, ConfirmUploadDto } from './dto/asset.dto';
import { ListAssetsDto } from './dto/list-assets.dto';
import * as path from 'path';
import * as fs from 'fs';
import * as express from 'express';
import type { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post('presigned-url')
  @ApiOperation({ summary: 'Get presigned URL for upload' })
  getPresignedUrl(@Body() dto: PresignedUrlDto, @Req() req: AuthenticatedRequest) {
    return this.assetsService.getPresignedUrl(dto.projectId, dto.fileName, dto.type, req.user.id, dto.contentType);
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
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.assetsService.saveUploadedFile(assetId, file.buffer ?? fs.readFileSync(file.path), file.originalname, req.user.id);
  }

  @Post('confirm-upload')
  @ApiOperation({ summary: 'Confirm upload and trigger processing' })
  confirmUpload(@Body() dto: ConfirmUploadDto, @Req() req: AuthenticatedRequest) {
    return this.assetsService.confirmUpload(dto.assetId, req.user.id, dto.idempotencyKey);
  }

  @Get()
  @ApiOperation({ summary: 'List assets for project' })
  findAll(@Query() query: ListAssetsDto, @Req() req: AuthenticatedRequest) {
    return this.assetsService.findAll(query.projectId, req.user.id, query.type, query.status, query.cursor, query.take);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get asset details' })
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.assetsService.findById(id, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete asset' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.assetsService.softDelete(id, req.user.id);
  }
}
