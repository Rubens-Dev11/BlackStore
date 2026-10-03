import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { EmailModule } from '../email/email.module';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [EmailModule, FileStorageModule, WalletModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
