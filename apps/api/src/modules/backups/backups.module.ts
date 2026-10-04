import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailModule } from '../email/email.module';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { AdminBackupsController } from './backups.controller';
import { BackupsService, MAINTENANCE_QUEUE } from './backups.service';
import { MaintenanceProcessor } from './maintenance.processor';
import { RetentionService } from './retention.service';

@Module({
  imports: [BullModule.registerQueue({ name: MAINTENANCE_QUEUE }), EmailModule, FileStorageModule],
  controllers: [AdminBackupsController],
  providers: [BackupsService, RetentionService, MaintenanceProcessor],
})
export class BackupsModule {}
