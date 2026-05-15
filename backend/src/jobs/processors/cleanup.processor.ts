import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Cron } from '@nestjs/schedule';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
@Processor('cleanup')
export class CleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job) {
    this.logger.log('Running cleanup job');
    return this.runCleanup();
  }

  @Cron('0 3 * * *')
  async scheduledCleanup() {
    this.logger.log('Running scheduled daily cleanup');
    await this.runCleanup();
  }

  private async runCleanup() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const deletedProjects = await this.prisma.project.deleteMany({
      where: { deletedAt: { lt: thirtyDaysAgo } },
    });

    const expiredExports = await this.prisma.exportJob.updateMany({
      where: { expiresAt: { lt: now }, status: 'completed' },
      data: { status: 'failed', errorMessage: 'Export expired' },
    });

    const orphanedAssets = await this.prisma.asset.deleteMany({
      where: {
        deletedAt: { lt: sevenDaysAgo },
        clips: { none: {} },
      },
    });

    const deletedUsers = await this.prisma.user.deleteMany({
      where: { deletedAt: { lt: ninetyDaysAgo } },
    });

    const summary = {
      deleted_projects: deletedProjects.count,
      expired_exports: expiredExports.count,
      orphaned_assets: orphanedAssets.count,
      deleted_users: deletedUsers.count,
      freed_bytes: 0,
    };

    this.logger.log(`Cleanup summary: ${JSON.stringify(summary)}`);
    return summary;
  }
}
