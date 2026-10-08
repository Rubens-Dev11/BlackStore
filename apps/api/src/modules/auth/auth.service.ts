import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  GoneException,
  HttpException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { Admin } from '@prisma/client';
import { PrismaService } from '@/prisma';
import { EmailService } from '../email/email.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConfirmPasswordChangeDto } from './dto/confirm-password-change.dto';
import { passwordStamp } from './password-stamp';

/** Changement obligatoire du mot de passe : code par e-mail. */
const CODE_MINUTES = 15;
const CODE_MAX_ATTEMPTS = 5;
/** Un code par minute et 5 par heure au plus : la connexion ne peut pas servir à inonder la boîte de l'admin. */
const CODE_RESEND_DELAY_MS = 60_000;
const CODE_MAX_PER_HOUR = 5;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** « rubens@exemple.com » → « ru•••ns@exemple.com ». */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return local.length <= 4 ? `${local[0]}•••@${domain}` : `${local.slice(0, 2)}•••${local.slice(-2)}@${domain}`;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Authenticate admin and generate tokens. If the password must be replaced, no session is opened:
   * a code is e-mailed to the admin instead (see confirmPasswordChange).
   */
  async login(loginDto: LoginDto) {
    const admin = await this.prisma.admin.findFirst({
      where: { email: { equals: loginDto.email, mode: 'insensitive' } },
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

    if (admin.mustChangePassword) {
      return this.startPasswordChange(admin);
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
      if (!admin || !admin.isActive || admin.mustChangePassword || payload.pwd !== passwordStamp(admin.passwordHash)) {
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

  /**
   * Mot de passe à remplacer : un code à 6 chiffres part à l'adresse de l'admin. Quelqu'un qui connaît
   * seulement le mot de passe ne peut donc pas en choisir un nouveau.
   */
  private async startPasswordChange(admin: Admin) {
    const now = Date.now();
    const recent = await this.prisma.adminPasswordChallenge.findMany({
      where: { adminId: admin.id, createdAt: { gt: new Date(now - 3600_000) } },
      select: { createdAt: true },
    });
    if (recent.some((c) => c.createdAt.getTime() > now - CODE_RESEND_DELAY_MS)) {
      throw new HttpException(
        "Un code vient d'être envoyé à votre adresse e-mail : attendez une minute avant d'en demander un autre.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (recent.length >= CODE_MAX_PER_HOUR) {
      throw new HttpException('Trop de codes demandés : réessayez dans une heure.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const challenge = randomBytes(32).toString('base64url');
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const created = await this.prisma.adminPasswordChallenge.create({
      data: {
        adminId: admin.id,
        tokenHash: sha256(challenge),
        codeHash: sha256(`${challenge}:${code}`),
        expiresAt: new Date(now + CODE_MINUTES * 60_000),
      },
    });
    if (!(await this.emailService.sendAdminPasswordCode(admin.email, code, CODE_MINUTES))) {
      await this.prisma.adminPasswordChallenge.delete({ where: { id: created.id } });
      throw new ServiceUnavailableException("Le code de sécurité n'a pas pu être envoyé par e-mail : réessayez dans quelques minutes.");
    }
    this.logger.warn(`Mot de passe à remplacer : code de sécurité envoyé à l'admin ${admin.email}`);
    return {
      passwordChangeRequired: true as const,
      challenge,
      sentTo: maskEmail(admin.email),
      expiresInMinutes: CODE_MINUTES,
    };
  }

  /**
   * Code reçu par e-mail + nouveau mot de passe : le mot de passe est remplacé et la session ouverte.
   * Chaque essai est compté avant la vérification, dans la même requête SQL : des essais envoyés en
   * parallèle ne dépassent pas la limite.
   */
  async confirmPasswordChange(dto: ConfirmPasswordChangeDto) {
    const expired = "Ce code n'est plus valable : reconnectez-vous pour en recevoir un nouveau.";
    const tokenHash = sha256(dto.challenge);
    const counted = await this.prisma.adminPasswordChallenge.updateMany({
      where: { tokenHash, attempts: { lt: CODE_MAX_ATTEMPTS }, expiresAt: { gt: new Date() } },
      data: { attempts: { increment: 1 } },
    });
    if (counted.count === 0) {
      throw new GoneException(expired);
    }
    const challenge = await this.prisma.adminPasswordChallenge.findUnique({ where: { tokenHash }, include: { admin: true } });
    if (!challenge || !challenge.admin.isActive || !challenge.admin.mustChangePassword) {
      throw new GoneException(expired);
    }

    const expected = Buffer.from(challenge.codeHash, 'hex');
    const given = Buffer.from(sha256(`${dto.challenge}:${dto.code}`), 'hex');
    if (!timingSafeEqual(expected, given)) {
      const left = CODE_MAX_ATTEMPTS - challenge.attempts;
      if (left <= 0) {
        throw new GoneException("Code incorrect, et c'était le dernier essai : reconnectez-vous pour recevoir un nouveau code.");
      }
      throw new BadRequestException(`Code incorrect : il vous reste ${left} essai${left > 1 ? 's' : ''}.`);
    }

    if (await bcrypt.compare(dto.newPassword, challenge.admin.passwordHash)) {
      throw new BadRequestException("Choisissez un mot de passe différent de l'ancien : celui-ci doit être remplacé.");
    }

    const saltRounds = Number(this.configService.get('BCRYPT_SALT_ROUNDS')) || 12;
    const passwordHash = await bcrypt.hash(dto.newPassword, saltRounds);
    const admin = await this.prisma.$transaction(async (tx) => {
      // Deux confirmations simultanées : seule la première trouve encore la demande.
      const removed = await tx.adminPasswordChallenge.deleteMany({ where: { id: challenge.id } });
      if (removed.count === 0) {
        return null;
      }
      await tx.adminPasswordChallenge.deleteMany({ where: { adminId: challenge.adminId } });
      return tx.admin.update({
        where: { id: challenge.adminId },
        data: { passwordHash, mustChangePassword: false, lastLogin: new Date() },
      });
    });
    if (!admin) {
      throw new GoneException(expired);
    }
    this.logger.log(`Mot de passe remplacé après confirmation par e-mail pour l'admin: ${admin.email}`);
    return this.generateTokens(admin.id, admin.passwordHash);
  }
}
