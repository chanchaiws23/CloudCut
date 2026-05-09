import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  async getPresignedUrl(projectId: string, fileName: string, type: string, userId: string) {
    await this.projectsService.assertProjectAccess(projectId, userId, ['owner', 'admin', 'editor']);
    const assetId = uuidv4();
    const key = `projects/${projectId}/assets/${assetId}/${fileName}`;
    const asset = await this.prisma.asset.create({
      data: {
        id: assetId,
        projectId,
        uploadedById: userId,
        type,
        originalUrl: key,
        status: 'uploading',
      },
    });
    return {
      assetId: asset.id,
      uploadUrl: `/uploads/${key}`,
      key,
    };
  }

  async confirmUpload(assetId: string, userId: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Asset not found');
    await this.projectsService.assertProjectAccess(asset.projectId, userId, ['owner', 'admin', 'editor']);
    return this.prisma.asset.update({
      where: { id: assetId },
      data: { status: 'processing' },
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
