import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { EmailModule } from '../email/email.module';
import { SellersService } from './sellers.service';
import { SellerJwtStrategy } from './strategies/seller-jwt.strategy';
import { SellerAuthController } from './seller-auth.controller';
import { SellerAccountController } from './seller-account.controller';
import { AdminSellersController } from './admin-sellers.controller';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    EmailModule,
  ],
  controllers: [SellerAuthController, SellerAccountController, AdminSellersController],
  providers: [SellersService, SellerJwtStrategy],
  exports: [SellersService],
})
export class SellersModule {}
