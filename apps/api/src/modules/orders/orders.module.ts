import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { EmailModule } from '../email/email.module';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [EmailModule, FileStorageModule, WalletModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
