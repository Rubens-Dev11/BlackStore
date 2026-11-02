import { Module } from '@nestjs/common';
import { SellerStatsService } from './seller-stats.service';
import { AdminStatsController, SellerStatsController } from './stats.controller';

@Module({
  controllers: [SellerStatsController, AdminStatsController],
  providers: [SellerStatsService],
})
export class StatsModule {}
