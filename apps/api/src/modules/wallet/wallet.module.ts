import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { AdminWalletController, SellerWalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [EmailModule],
  controllers: [SellerWalletController, AdminWalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
