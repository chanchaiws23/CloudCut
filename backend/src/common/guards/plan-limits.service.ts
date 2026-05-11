import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PlanLimits {
  maxProjects: number;
  maxExportsPerMonth: number;
  maxExportResolution: string; // e.g. '720p'
  allowedFormats: string[];
  maxStorageBytes: number;
  allowedEffects: string[];
  collaborationEnabled: boolean;
}

const PLAN_CONFIG: Record<string, PlanLimits> = {
  free: {
    maxProjects: 3,
    maxExportsPerMonth: 5,
    maxExportResolution: '720p',
    allowedFormats: ['mp4'],
    maxStorageBytes: 1024 * 1024 * 1024, // 1 GB
    allowedEffects: ['brightness', 'contrast', 'saturation'],
    collaborationEnabled: false,
  },
  pro: {
    maxProjects: 100,
    maxExportsPerMonth: 100,
    maxExportResolution: '4k',
    allowedFormats: ['mp4', 'webm'],
    maxStorageBytes: 1024 * 1024 * 1024 * 100, // 100 GB
    allowedEffects: ['brightness', 'contrast', 'saturation', 'blur', 'grayscale'],
    collaborationEnabled: true,
  },
  team: {
    maxProjects: 1000,
    maxExportsPerMonth: 1000,
    maxExportResolution: '4k',
    allowedFormats: ['mp4', 'webm'],
    maxStorageBytes: 1024 * 1024 * 1024 * 500, // 500 GB
    allowedEffects: ['brightness', 'contrast', 'saturation', 'blur', 'grayscale'],
    collaborationEnabled: true,
  },
};

const RESOLUTION_RANK: Record<string, number> = {
  '720p': 1,
  '1080p': 2,
  '4k': 3,
};

@Injectable()
export class PlanLimitsService {
  constructor(private readonly prisma: PrismaService) {}

  getLimits(plan: string): PlanLimits {
    return PLAN_CONFIG[plan] || PLAN_CONFIG['free'];
  }

  async assertCanCreateProject(workspaceId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) return;
    const limits = this.getLimits(workspace.plan);
    const count = await this.prisma.project.count({
      where: { workspaceId, deletedAt: null },
    });
    if (count >= limits.maxProjects) {
      throw new Error(`Project limit reached for ${workspace.plan} plan (${limits.maxProjects}). Upgrade to create more projects.`);
    }
  }

  async assertCanCreateExport(workspaceId: string, resolution?: string, format?: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) return;
    const limits = this.getLimits(workspace.plan);

    // Format check
    const fmt = format || 'mp4';
    if (!limits.allowedFormats.includes(fmt)) {
      throw new Error(`Format "${fmt}" is not allowed on ${workspace.plan} plan. Upgrade to Pro.`);
    }

    // Resolution check
    const res = resolution || '1080p';
    if ((RESOLUTION_RANK[res] || 0) > (RESOLUTION_RANK[limits.maxExportResolution] || 0)) {
      throw new Error(`Resolution "${res}" exceeds ${workspace.plan} plan limit (${limits.maxExportResolution}). Upgrade to Pro.`);
    }

    // Monthly export count check
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const exportCount = await this.prisma.exportJob.count({
      where: {
        project: { workspaceId },
        createdAt: { gte: startOfMonth },
        status: { in: ['queued', 'processing', 'completed'] },
      },
    });
    if (exportCount >= limits.maxExportsPerMonth) {
      throw new Error(`Monthly export limit reached for ${workspace.plan} plan (${limits.maxExportsPerMonth}). Upgrade to export more.`);
    }
  }

  async assertCanUseEffect(workspaceId: string, effectType: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) return;
    const limits = this.getLimits(workspace.plan);
    if (!limits.allowedEffects.includes(effectType)) {
      throw new Error(`Effect "${effectType}" is not available on ${workspace.plan} plan. Upgrade to Pro.`);
    }
  }

  async getWorkspacePlan(workspaceId: string): Promise<string> {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { plan: true } });
    return workspace?.plan || 'free';
  }
}
