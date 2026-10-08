import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma';
import { passwordStamp } from '../password-stamp';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * Validate the JWT payload and attach the user to the request object.
   */
  async validate(payload: any) {
    // Les jetons vendeurs sont signés avec le même secret : jamais valables ici.
    if (payload.role === 'seller') {
      throw new UnauthorizedException();
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.sub },
    });

    // Un jeton émis avant le dernier changement de mot de passe n'est plus valable, ni aucun jeton
    // tant que le mot de passe doit être remplacé.
    if (!admin || !admin.isActive || admin.mustChangePassword || payload.pwd !== passwordStamp(admin.passwordHash)) {
      throw new UnauthorizedException();
    }

    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
