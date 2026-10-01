import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/prisma';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { passwordStamp } from './password-stamp';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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

    const tokens = this.generateTokens(admin.id, admin.passwordHash);
    this.logger.log(`Login réussi pour l'admin: ${admin.email}`);

    return tokens;
  }

  /**
   * Generate access and refresh tokens, bound to the current password (`pwd`).
   */
  generateTokens(adminId: string, passwordHash: string) {
    const pwd = passwordStamp(passwordHash);
    const accessToken = this.jwtService.sign(
      { sub: adminId, type: 'access', pwd },
      { expiresIn: '15m' },
    );

    const refreshToken = this.jwtService.sign(
      { sub: adminId, type: 'refresh', pwd },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      },
    );

    return { accessToken, refreshToken };
  }

  /**
   * Refresh access token using refresh token.
   */
  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
      if (payload.type !== 'refresh' || payload.role === 'seller') {
        throw new UnauthorizedException('Token invalide');
      }

      // Refuse les sessions ouvertes avant le dernier changement de mot de passe.
      const admin = await this.prisma.admin.findUnique({ where: { id: payload.sub } });
      if (!admin || !admin.isActive || payload.pwd !== passwordStamp(admin.passwordHash)) {
        throw new UnauthorizedException('Session expirée');
      }

      const newAccessToken = this.jwtService.sign(
        { sub: payload.sub, type: 'access', pwd: payload.pwd },
        { expiresIn: '15m' },
      );

      this.logger.log(`Token rafraîchi pour l'admin: ${payload.sub}`);
      return { accessToken: newAccessToken };
    } catch (error) {
      this.logger.warn('Tentative de rafraîchissement de token échouée');
      throw new UnauthorizedException('Token invalide ou expiré');
    }
  }

  /**
   * Change the logged-in admin's password (current password required).
   * Every existing session, including the current one, is closed.
   */
  async changePassword(adminId: string, dto: ChangePasswordDto) {
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException();
    }

    // 400 et non 401 : côté admin, un 401 déclenche le rafraîchissement de session.
    if (!(await bcrypt.compare(dto.currentPassword, admin.passwordHash))) {
      throw new BadRequestException('Mot de passe actuel incorrect');
    }
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException("Le nouveau mot de passe doit être différent de l'actuel");
    }

    const saltRounds = Number(this.configService.get('BCRYPT_SALT_ROUNDS')) || 12;
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, saltRounds) },
    });
    this.logger.log(`Mot de passe modifié pour l'admin: ${admin.email}`);
  }
}
