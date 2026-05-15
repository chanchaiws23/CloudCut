import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { OrchestratorService } from '../jobs/orchestrator.service';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AssetsService {
  private readonly s3?: S3Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly orchestrator: OrchestratorService,
  ) {
    const endpoint = process.env.S3_ENDPOINT;
    const accessKeyId = process.env.S3_ACCESS_KEY;
    const secretAccessKey = process.env.S3_SECRET_KEY;
    if (endpoint && accessKeyId && secretAccessKey && !accessKeyId.startsWith('your-')) {
      this.s3 = new S3Client({
        region: process.env.S3_REGION || 'auto',
        endpoint,
        forcePathStyle: true,
        credentials: { accessKeyId, secretAccessKey },
      });
    }
  }

  private uploadsDir(): string {
    const dir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  async getPresignedUrl(projectId: string, fileName: string, type: string, userId: string, contentType?: string) {
    const project = await this.projectsService.assertProjectAccess(projectId, userId, ['owner', 'admin', 'editor']);
    await this.assertUploadRateLimit(project.workspaceId);
    const assetId = uuidv4();
    const ext = path.extname(fileName);
    const storedName = `${assetId}${ext}`;
    const key = `projects/${projectId}/assets/original/${storedName}`;
    const publicBase = process.env.S3_PUBLIC_URL?.replace(/\/$/, '');
    const bucket = process.env.S3_BUCKET;
    const originalUrl = this.s3 && bucket && publicBase ? `${publicBase}/${key}` : `/uploads/${storedName}`;
    const asset = await this.prisma.asset.create({
      data: {
        id: assetId,
        projectId,
        uploadedById: userId,
        type,
        originalUrl,
        status: 'uploading',
        metadata: { fileName, storageKey: key },
      },
    });

    if (this.s3 && bucket) {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType || (type === 'video' ? 'video/mp4' : type === 'audio' ? 'audio/mpeg' : 'image/jpeg'),
      });
      return {
        assetId: asset.id,
        url: await getSignedUrl(this.s3, command, { expiresIn: 900 }),
        key,
        method: 'PUT',
        headers: { 'Content-Type': command.input.ContentType },
        uploadMode: 'presigned',
      };
    }

    return {
      assetId: asset.id,
      url: `/assets/upload/${assetId}`,
      key: storedName,
      method: 'POST',
      uploadMode: 'local',
    };
  }

  async saveUploadedFile(assetId: string, fileBuffer: Buffer, originalName: string, userId: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Asset not found');
    await this.projectsService.assertProjectAccess(asset.projectId, userId, ['owner', 'admin', 'editor']);
    const ext = path.extname(originalName);
    const storedName = `${assetId}${ext}`;
    const destPath = path.join(this.uploadsDir(), storedName);
    fs.writeFileSync(destPath, fileBuffer);
    const isImage = asset.type === 'image';
    const updated = await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        originalUrl: `/uploads/${storedName}`,
        status: isImage ? 'ready' : 'processing',
        metadata: { fileName: originalName, file_size_bytes: fileBuffer.byteLength },
      },
    });
    if (!isImage) await this.orchestrator.startAssetProcessing(updated.id, updated.originalUrl);
    return updated;
  }

  async confirmUpload(assetId: string, userId: string, idempotencyKey?: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Asset not found');
    await this.projectsService.assertProjectAccess(asset.projectId, userId, ['owner', 'admin', 'editor']);
    const metadata = (asset.metadata || {}) as Record<string, any>;
    if (asset.status !== 'uploading' || (idempotencyKey && metadata.confirmUploadIdempotencyKey === idempotencyKey)) {
      return asset;
    }
    const isImage = asset.type === 'image';
    const updated = await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        status: isImage ? 'ready' : 'processing',
        metadata: { ...metadata, ...(idempotencyKey ? { confirmUploadIdempotencyKey: idempotencyKey } : {}) },
      },
    });
    if (!isImage) await this.orchestrator.startAssetProcessing(updated.id, updated.originalUrl);
    return updated;
  }

  private async assertUploadRateLimit(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { plan: true } });
    const plan = workspace?.plan || 'free';
    const limits = { free: 5, pro: 50, team: 50 } as const;
    const limit = limits[plan as keyof typeof limits] || 5;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const count = await this.prisma.asset.count({
      where: {
        project: { workspaceId },
        createdAt: { gte: oneHourAgo },
      },
    });
    if (count >= limit) {
      throw new ForbiddenException(`Upload rate limit reached for ${plan} plan (${limit}/hour).`);
    }
  }

  async findAll(projectId: string, userId: string, type?: string, status?: string, cursor?: string, take = 20) {
    await this.projectsService.assertProjectAccess(projectId, userId);
    const assets = await this.prisma.asset.findMany({
      where: {
        projectId,
        deletedAt: null,
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
      },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
    });
    const hasMore = assets.length > take;
    const data = hasMore ? assets.slice(0, take) : assets;
    return {
      data,
      nextCursor: hasMore ? data[data.length - 1]?.id : null,
    };
  }

  async findById(id: string, userId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, deletedAt: null },
      include: { variants: true },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    await this.projectsService.assertProjectAccess(asset.projectId, userId);
    return asset;
  }

  async softDelete(id: string, userId: string) {
    const asset = await this.prisma.asset.findFirst({ where: { id, deletedAt: null } });
    if (!asset) throw new NotFoundException('Asset not found');
    await this.projectsService.assertProjectAccess(asset.projectId, userId, ['owner', 'admin', 'editor']);
    return this.prisma.asset.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
