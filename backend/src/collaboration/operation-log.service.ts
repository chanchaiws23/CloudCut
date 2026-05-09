import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class OperationLogService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, userId: string, operationType: string, payload: any) {
    const lastLog = await this.prisma.operationLog.findFirst({
      where: { projectId },
      orderBy: { clientSeq: 'desc' },
    });
    const clientSeq = (lastLog?.clientSeq || 0) + 1;
    return this.prisma.operationLog.create({
      data: { projectId, userId, operationType, payload, clientSeq },
    });
  }

  async getOperationsSince(projectId: string, sinceSeq: number, limit = 100) {
    return this.prisma.operationLog.findMany({
      where: { projectId, clientSeq: { gt: sinceSeq } },
      orderBy: { clientSeq: 'asc' },
      take: limit,
    });
  }
}
