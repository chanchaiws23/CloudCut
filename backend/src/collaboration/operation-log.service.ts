import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { uuidV7Like } from '../common/utils/uuid-v7-like';

@Injectable()
export class OperationLogService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, userId: string, operationType: string, payload: any) {
    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.operationLog.aggregate({
        where: { projectId },
        _max: { clientSeq: true },
      });
      const clientSeq = (latest._max.clientSeq || 0) + 1;
      return tx.operationLog.create({
        data: { id: uuidV7Like(), projectId, userId, operationType, payload, clientSeq },
      });
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
