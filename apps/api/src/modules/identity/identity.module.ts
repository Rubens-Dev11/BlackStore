import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { AdminIdentityController, SellerIdentityController } from './identity.controller';
import { IdentityService } from './identity.service';

@Module({
  imports: [EmailModule, FileStorageModule],
  controllers: [SellerIdentityController, AdminIdentityController],
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
