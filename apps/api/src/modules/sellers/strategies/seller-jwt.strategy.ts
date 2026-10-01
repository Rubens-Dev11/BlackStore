import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma';
import { passwordStamp } from '../../auth/password-stamp';

export interface SellerRequestUser {
  sellerId: string;
  email: string;
  role: 'seller';
}

@Injectable()
export class SellerJwtStrategy extends PassportStrategy(Strategy, 'seller-jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * Un jeton vendeur n'est valable que pour un compte existant, non suspendu,
   * et émis après le dernier changement de mot de passe.
   */
  async validate(payload: any): Promise<SellerRequestUser> {
    if (payload.role !== 'seller' || payload.type !== 'access') {
      throw new UnauthorizedException();
    }

    const seller = await this.prisma.seller.findUnique({ where: { id: payload.sub } });
    if (!seller || seller.status === 'suspended' || payload.pwd !== passwordStamp(seller.passwordHash)) {
      throw new UnauthorizedException();
    }

    return { sellerId: seller.id, email: seller.email, role: 'seller' };
  }
}
