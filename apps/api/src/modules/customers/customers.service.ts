import { GoneException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '@/prisma';
import { EmailService } from '../email/email.service';
import { downloadState } from '../downloads/downloads.service';
import { requestDeadline } from '../disputes/dispute-rules';

const LOGIN_LINK_MINUTES = 30;
const SESSION_DAYS = 30;
/** Un seul lien par minute et par adresse : le formulaire ne peut pas servir à inonder une boîte. */
const RESEND_DELAY_MS = 60_000;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

export interface ClientSession {
  sessionId: string;
  email: string;
}

/**
 * Espace client sans mot de passe : l'acheteur reçoit par e-mail un lien de connexion (30 minutes, une
 * seule fois) qui ouvre une session de 30 jours sur son appareil. Il y retrouve tous les achats faits
 * avec cette adresse. Seules les empreintes des jetons sont enregistrées.
 */
@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  private storefrontUrl(): string {
    return this.configService.get<string>('STOREFRONT_URL', 'http://localhost:3001').replace(/\/+$/, '');
  }

  /** Même réponse que l'adresse ait des achats ou non : on ne révèle pas qui a acheté. */
  async requestLoginLink(rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    const message = `Si des achats sont liés à cette adresse, un lien de connexion vient d’y être envoyé. Il est valable ${LOGIN_LINK_MINUTES} minutes.`;
    const purchases = await this.prisma.order.count({
      where: { buyerEmail: { equals: email, mode: 'insensitive' }, status: { in: ['paid', 'refunded'] } },
    });
    if (purchases === 0) {
      return { message };
    }
    const recent = await this.prisma.customerLoginToken.findFirst({
      where: { email, createdAt: { gt: new Date(Date.now() - RESEND_DELAY_MS) } },
      select: { id: true },
    });
    if (recent) {
      return { message };
    }
    const token = newToken();
    await this.prisma.customerLoginToken.create({
      data: { email, tokenHash: sha256(token), expiresAt: new Date(Date.now() + LOGIN_LINK_MINUTES * 60_000) },
    });
    await this.emailService.sendClientLoginLink(email, `${this.storefrontUrl()}/mon-espace/connexion?jeton=${token}`, LOGIN_LINK_MINUTES);
    this.logger.log('Lien de connexion à l’espace client envoyé');
    return { message };
  }

  /** Le lien sert une fois : il est marqué utilisé dans la même requête qui le vérifie. */
  async openSession(jeton: string) {
    const tokenHash = sha256(jeton);
    const now = new Date();
    const used = await this.prisma.customerLoginToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (used.count === 0) {
      throw new GoneException('Ce lien de connexion a expiré ou a déjà servi : demandez-en un nouveau.');
    }
    const login = await this.prisma.customerLoginToken.findUniqueOrThrow({ where: { tokenHash } });
    const token = newToken();
    const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 3600 * 1000);
    await this.prisma.customerSession.create({ data: { email: login.email, tokenHash: sha256(token), expiresAt } });
    return { token, email: login.email, expiresAt };
  }

  async sessionFor(token: string): Promise<ClientSession | null> {
    const session = await this.prisma.customerSession.findUnique({ where: { tokenHash: sha256(token) } });
    if (!session || session.expiresAt < new Date()) {
      return null;
    }
    // Date de dernière visite : notée au plus une fois par heure.
    if (Date.now() - session.lastUsedAt.getTime() > 3600_000) {
      await this.prisma.customerSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
    }
    return { sessionId: session.id, email: session.email };
  }

  async logout(sessionId: string) {
    await this.prisma.customerSession.deleteMany({ where: { id: sessionId } });
    return { message: 'Vous êtes déconnecté de votre espace.' };
  }

  /** Achats payés ou remboursés faits avec l'adresse de la session, du plus récent au plus ancien. */
  async purchases(email: string) {
    const orders = await this.prisma.order.findMany({
      where: { buyerEmail: { equals: email, mode: 'insensitive' }, status: { in: ['paid', 'refunded'] } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            product: {
              select: { name: true, slug: true, isActive: true, filePath: true, storeId: true, scanStatus: true, store: { select: { name: true, slug: true } } },
            },
            downloadTokens: { orderBy: { createdAt: 'desc' }, take: 1 },
            dispute: { select: { reference: true, status: true } },
          },
        },
      },
    });
    const now = Date.now();
    return {
      email,
      orders: orders.map((order) => {
        const paidAt = order.paidAt ?? order.createdAt;
        const refundDeadline = requestDeadline(paidAt, null);
        return {
          orderNumber: order.orderNumber,
          status: order.status,
          paidAt,
          totalAmount: order.totalAmount,
          items: order.items.map((item) => {
            const token = item.downloadTokens[0] ?? null;
            return {
              id: item.id,
              productName: item.product.name,
              // Fiche du produit seulement s'il est encore en vente.
              productSlug: item.product.isActive ? item.product.slug : null,
              store: item.product.store,
              price: item.priceAtPurchase,
              download: token
                ? {
                    token: token.token,
                    etat: downloadState({ ...token, orderItem: { order: { status: order.status }, product: item.product } }),
                    expiresAt: token.expiresAt,
                    remaining: Math.max(0, token.maxDownloads - token.downloadCount),
                    max: token.maxDownloads,
                  }
                : null,
              dispute: item.dispute,
              // Remboursement encore possible (politique : 7 jours, produit payant, aucune demande en cours).
              refundUntil: order.status === 'paid' && item.priceAtPurchase > 0 && !item.dispute && now <= refundDeadline.getTime() ? refundDeadline : null,
            };
          }),
        };
      }),
    };
  }
}
