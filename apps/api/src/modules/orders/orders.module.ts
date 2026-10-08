import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { EmailModule } from '../email/email.module';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { WalletModule } from '../wallet/wallet.module';
import { PromoCodesModule } from '../promo-codes/promo-codes.module';

@Module({
  imports: [EmailModule, FileStorageModule, WalletModule, PromoCodesModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
