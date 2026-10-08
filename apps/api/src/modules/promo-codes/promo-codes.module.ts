import { Module } from '@nestjs/common';
import { AdminPromoCodesController, PromoCodesController, SellerPromoCodesController } from './promo-codes.controller';
import { PromoCodesService } from './promo-codes.service';

@Module({
  controllers: [PromoCodesController, SellerPromoCodesController, AdminPromoCodesController],
  providers: [PromoCodesService],
  exports: [PromoCodesService],
})
export class PromoCodesModule {}
