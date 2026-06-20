import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/prisma';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Authenticate admin and generate tokens.
   */
  async login(loginDto: LoginDto) {
    const admin = await this.prisma.admin.findUnique({
      where: { email: loginDto.email },
    });

    if (!admin || !admin.isActive) {
      this.logger.warn(`Tentative de login échouée pour l'email: ${loginDto.email}`);
      throw new UnauthorizedException('Identifiants invalides');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, admin.passwordHash);

    if (!isPasswordValid) {
      this.logger.warn(`Mot de passe incorrect pour l'email: ${loginDto.email}`);
      throw new UnauthorizedException('Identifiants invalides');
    }

    // Update last login
    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { lastLogin: new Date() },
    });

    const tokens = this.generateTokens(admin.id);
    this.logger.log(`Login réussi pour l'admin: ${admin.email}`);

    return tokens;
  }

  /**
   * Generate access and refresh tokens.
   */
  generateTokens(adminId: string) {
    const accessToken = this.jwtService.sign(
      { sub: adminId, type: 'access' },
      { expiresIn: '15m' },
    );

    const refreshToken = this.jwtService.sign(
      { sub: adminId, type: 'refresh' },
      { expiresIn: '7d' },
    );

    return { accessToken, refreshToken };
  }

  /**
   * Refresh access token using refresh token.
   */
  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Token invalide');
      }

      const newAccessToken = this.jwtService.sign(
        { sub: payload.sub, type: 'access' },
        { expiresIn: '15m' },
      );

      this.logger.log(`Token rafraîchi pour l'admin: ${payload.sub}`);
      return { accessToken: newAccessToken };
    } catch (error) {
      this.logger.warn('Tentative de rafraîchissement de token échouée');
      throw new UnauthorizedException('Token invalide ou expiré');
    }
  }
}
