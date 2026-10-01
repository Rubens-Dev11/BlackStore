import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailModule } from '../email/email.module';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { AntivirusProcessor } from './antivirus.processor';
import { AntivirusService, FILE_SCAN_QUEUE } from './antivirus.service';

@Module({
  imports: [BullModule.registerQueue({ name: FILE_SCAN_QUEUE }), EmailModule, FileStorageModule],
  providers: [AntivirusService, AntivirusProcessor],
  exports: [AntivirusService],
})
export class AntivirusModule {}
