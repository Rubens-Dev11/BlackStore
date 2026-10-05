import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { WalletModule } from '../wallet/wallet.module';
import { AdminDisputesController, DisputesController, SellerDisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';

@Module({
  imports: [EmailModule, WalletModule],
  controllers: [DisputesController, SellerDisputesController, AdminDisputesController],
  providers: [DisputesService],
})
export class DisputesModule {}
