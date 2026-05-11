import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  private uploadsDir(): string {
    const dir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  async getPresignedUrl(projectId: string, fileName: string, type: string, userId: string) {
    await this.projectsService.assertProjectAccess(projectId, userId, ['owner', 'admin', 'editor']);
    const assetId = uuidv4();
    const ext = path.extname(fileName);
    const storedName = `${assetId}${ext}`;
    const asset = await this.prisma.asset.create({
      data: {
        id: assetId,
        projectId,
        uploadedById: userId,
        type,
        originalUrl: `/uploads/${storedName}`,
        status: 'uploading',
        metadata: { fileName },
      },
    });
    return {
      assetId: asset.id,
      url: `/assets/upload/${assetId}`,
      key: storedName,
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
    return this.prisma.asset.update({
      where: { id: assetId },
      data: {
        originalUrl: `/uploads/${storedName}`,
        status: 'ready',
        metadata: { fileName: originalName, file_size_bytes: fileBuffer.byteLength },
      },
    });
  }

  async confirmUpload(assetId: string, userId: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Asset not found');
    await this.projectsService.assertProjectAccess(asset.projectId, userId, ['owner', 'admin', 'editor']);
    return this.prisma.asset.update({
      where: { id: assetId },
      data: { status: 'ready' },
    });
  }

  async findAll(projectId: string, userId: string, type?: string, status?: string) {
    await this.projectsService.assertProjectAccess(projectId, userId);
    return this.prisma.asset.findMany({
      where: {
        projectId,
        deletedAt: null,
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
      },
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
    });
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
