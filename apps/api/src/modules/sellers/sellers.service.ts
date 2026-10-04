import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Seller, SellerStatus, SellerTokenType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '@/prisma';
import { EmailService } from '../email/email.service';
import { passwordStamp } from '../auth/password-stamp';
import { LEGAL_VERSION } from '../legal/legal-version';
import {
  LoginSellerDto,
  RegisterSellerDto,
  ResetSellerPasswordDto,
} from './dto/seller-auth.dto';
import { ChangeSellerPasswordDto, UpdateSellerProfileDto } from './dto/seller-account.dto';

const VERIFICATION_TTL_MS = 48 * 3600 * 1000;
const PASSWORD_RESET_TTL_MS = 3600 * 1000;

/** Champs d'un vendeur renvoyés par l'API (jamais le hash du mot de passe). */
const SELLER_PROFILE = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  status: true,
  emailVerifiedAt: true,
  statusChangedAt: true,
  lastLogin: true,
  createdAt: true,
  store: { select: { name: true, slug: true } },
  // Dernière vérification d'identité (obligatoire avant le premier retrait).
  identityChecks: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, reviewedAt: true } },
} satisfies Prisma.SellerSelect;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class SellersService {
  private readonly logger = new Logger(SellersService.name);

  // Comparé quand l'e-mail est inconnu, pour que la réponse prenne le même
  // temps qu'avec un vrai compte (sinon on devine quels e-mails existent).
  private static readonly DUMMY_HASH = bcrypt.hashSync('compte-inexistant', 12);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  // ── Inscription et confirmation de l'e-mail ─────────────────────────

  async register(dto: RegisterSellerDto) {
    let seller: Seller;
    try {
      seller = await this.prisma.seller.create({
        data: {
          email: dto.email,
          passwordHash: await this.hashPassword(dto.password),
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: SellersService.normalizePhone(dto.phone),
          termsVersion: LEGAL_VERSION,
          termsAcceptedAt: new Date(),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Un compte vendeur existe déjà avec cet e-mail');
      }
      throw error;
    }

    await this.sendVerificationEmail(seller);
    this.logger.log(`Vendeur inscrit : ${seller.email}`);
    return { message: 'Compte créé. Un e-mail de confirmation vous a été envoyé.' };
  }

  async verifyEmail(token: string) {
    const seller = await this.consumeToken(token, 'email_verification');
    if (!seller.emailVerifiedAt) {
      await this.prisma.seller.update({
        where: { id: seller.id },
        data: { emailVerifiedAt: new Date() },
      });
    }
    return { message: 'Adresse e-mail confirmée. Vous pouvez vous connecter.' };
  }

  async resendVerification(email: string) {
    const seller = await this.prisma.seller.findUnique({ where: { email } });
    if (seller && !seller.emailVerifiedAt) {
      await this.sendVerificationEmail(seller);
    }
    return { message: "Si un compte non confirmé existe pour cet e-mail, un nouveau lien vient d'être envoyé." };
  }

  // ── Connexion ───────────────────────────────────────────────────────

  async login(dto: LoginSellerDto) {
    const seller = await this.prisma.seller.findUnique({ where: { email: dto.email } });
    const passwordOk = await bcrypt.compare(dto.password, seller?.passwordHash ?? SellersService.DUMMY_HASH);
    if (!seller || !passwordOk) {
      throw new UnauthorizedException('E-mail ou mot de passe incorrect');
    }
    if (!seller.emailVerifiedAt) {
      throw new ForbiddenException({ message: "Confirmez d'abord votre adresse e-mail.", code: 'EMAIL_NOT_VERIFIED' });
    }
    if (seller.status === 'suspended') {
      throw new ForbiddenException({ message: 'Ce compte vendeur est suspendu.', code: 'ACCOUNT_SUSPENDED' });
    }

    await this.prisma.seller.update({ where: { id: seller.id }, data: { lastLogin: new Date() } });
    this.logger.log(`Connexion vendeur : ${seller.email}`);
    return this.generateTokens(seller);
  }

  async refresh(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Session expirée');
    }
    if (payload.type !== 'refresh' || payload.role !== 'seller') {
      throw new UnauthorizedException('Session expirée');
    }

    const seller = await this.prisma.seller.findUnique({ where: { id: payload.sub } });
    if (!seller || seller.status === 'suspended' || payload.pwd !== passwordStamp(seller.passwordHash)) {
      throw new UnauthorizedException('Session expirée');
    }

    return { accessToken: this.signAccessToken(seller.id, payload.pwd) };
  }

  // ── Mot de passe oublié ─────────────────────────────────────────────

  async forgotPassword(email: string) {
    const seller = await this.prisma.seller.findUnique({ where: { email } });
    if (seller && seller.status !== 'suspended') {
      const token = await this.issueToken(seller.id, 'password_reset', PASSWORD_RESET_TTL_MS);
      await this.emailService.sendSellerPasswordReset(
        seller.email,
        seller.firstName,
        this.appLink('/vendeur/reinitialiser-mot-de-passe', token),
      );
    }
    return { message: "Si un compte existe pour cet e-mail, un lien de réinitialisation vient d'être envoyé." };
  }

  async resetPassword(dto: ResetSellerPasswordDto) {
    const seller = await this.consumeToken(dto.token, 'password_reset');
    await this.prisma.seller.update({
      where: { id: seller.id },
      data: {
        passwordHash: await this.hashPassword(dto.newPassword),
        // Le lien est arrivé dans sa boîte mail : l'adresse est prouvée.
        emailVerifiedAt: seller.emailVerifiedAt ?? new Date(),
      },
    });
    this.logger.log(`Mot de passe vendeur réinitialisé : ${seller.email}`);
    return { message: 'Mot de passe modifié. Vous pouvez vous connecter.' };
  }

  // ── Compte du vendeur connecté ──────────────────────────────────────

  async getProfile(sellerId: string) {
    const seller = await this.prisma.seller.findUnique({ where: { id: sellerId }, select: SELLER_PROFILE });
    if (!seller) {
      throw new NotFoundException('Compte vendeur introuvable');
    }
    return seller;
  }

  async updateProfile(sellerId: string, dto: UpdateSellerProfileDto) {
    return this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone !== undefined ? SellersService.normalizePhone(dto.phone) : undefined,
      },
      select: SELLER_PROFILE,
    });
  }

  /** Change le mot de passe ; toutes les sessions ouvertes sont fermées. */
  async changePassword(sellerId: string, dto: ChangeSellerPasswordDto) {
    const seller = await this.prisma.seller.findUnique({ where: { id: sellerId } });
    if (!seller) {
      throw new UnauthorizedException();
    }
    // 400 et non 401 : côté application, un 401 déclenche le rafraîchissement de session.
    if (!(await bcrypt.compare(dto.currentPassword, seller.passwordHash))) {
      throw new BadRequestException('Mot de passe actuel incorrect');
    }
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException("Le nouveau mot de passe doit être différent de l'actuel");
    }
    await this.prisma.seller.update({
      where: { id: sellerId },
      data: { passwordHash: await this.hashPassword(dto.newPassword) },
    });
    this.logger.log(`Mot de passe vendeur modifié : ${seller.email}`);
  }

  // ── Administration ──────────────────────────────────────────────────

  async listForAdmin(status?: SellerStatus) {
    return this.prisma.seller.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      select: SELLER_PROFILE,
    });
  }

  /** Valide, suspend ou remet en attente un vendeur, et le prévient par e-mail. */
  async setStatus(sellerId: string, status: SellerStatus) {
    const seller = await this.prisma.seller.findUnique({ where: { id: sellerId } });
    if (!seller) {
      throw new NotFoundException('Vendeur introuvable');
    }
    if (seller.status === status) {
      return this.getProfile(sellerId);
    }

    const updated = await this.prisma.seller.update({
      where: { id: sellerId },
      data: { status, statusChangedAt: new Date() },
      select: SELLER_PROFILE,
    });
    this.logger.log(`Statut du vendeur ${seller.email} : ${seller.status} → ${status}`);
    if (status !== 'pending') {
      await this.emailService.sendSellerStatus(seller.email, seller.firstName, status);
    }
    return updated;
  }

  // ── Outils ──────────────────────────────────────────────────────────

  /**
   * Numéro au format international. Un numéro de 9 chiffres sans indicatif
   * est considéré comme camerounais (+237).
   */
  static normalizePhone(raw: string): string {
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('00')) {
      digits = digits.slice(2);
    } else if (!raw.trim().startsWith('+') && digits.length === 9) {
      digits = `237${digits}`;
    }
    const phone = `+${digits}`;
    if (!/^\+\d{8,15}$/.test(phone)) {
      throw new BadRequestException('Numéro de téléphone invalide');
    }
    return phone;
  }

  private hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, Number(this.configService.get('BCRYPT_SALT_ROUNDS')) || 12);
  }

  private signAccessToken(sellerId: string, pwd: string): string {
    return this.jwtService.sign({ sub: sellerId, type: 'access', role: 'seller', pwd }, { expiresIn: '15m' });
  }

  private generateTokens(seller: Seller) {
    const pwd = passwordStamp(seller.passwordHash);
    const refreshToken = this.jwtService.sign(
      { sub: seller.id, type: 'refresh', role: 'seller', pwd },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      },
    );
    return { accessToken: this.signAccessToken(seller.id, pwd), refreshToken };
  }

  private appLink(path: string, token: string): string {
    const base = this.configService.get<string>('SELLER_APP_URL', 'http://localhost:3002').replace(/\/+$/, '');
    return `${base}${path}?token=${token}`;
  }

  private async sendVerificationEmail(seller: Seller): Promise<void> {
    const token = await this.issueToken(seller.id, 'email_verification', VERIFICATION_TTL_MS);
    await this.emailService.sendSellerVerification(
      seller.email,
      seller.firstName,
      this.appLink('/vendeur/verifier-email', token),
    );
  }

  /** Crée un lien à usage unique ; les liens précédents du même type sont annulés. */
  private async issueToken(sellerId: string, type: SellerTokenType, ttlMs: number): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.prisma.$transaction([
      this.prisma.sellerToken.updateMany({
        where: { sellerId, type, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.sellerToken.create({
        data: { sellerId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) },
      }),
    ]);
    return token;
  }

  /** Consomme un lien valide (non utilisé, non expiré) et renvoie son vendeur. */
  private async consumeToken(token: string, type: SellerTokenType): Promise<Seller> {
    const record = await this.prisma.sellerToken.findUnique({
      where: { tokenHash: sha256(token) },
      include: { seller: true },
    });
    if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Lien invalide ou expiré');
    }
    // Mise à jour conditionnelle : deux clics simultanés ne consomment le lien qu'une fois.
    const { count } = await this.prisma.sellerToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count === 0) {
      throw new BadRequestException('Lien invalide ou expiré');
    }
    return record.seller;
  }
}
