import { Module } from '@nestjs/common';
import { PusherService } from './pusher.service';
import { SyncService } from './sync.service';
import { OperationLogService } from './operation-log.service';
import { PresenceService } from './presence.service';
import { CollaborationController } from './collaboration.controller';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [ProjectsModule],
  controllers: [CollaborationController],
  providers: [PusherService, SyncService, OperationLogService, PresenceService],
  exports: [PusherService, SyncService, OperationLogService, PresenceService],
})
export class CollaborationModule {}
