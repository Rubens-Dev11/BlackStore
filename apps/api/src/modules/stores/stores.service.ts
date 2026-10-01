import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Store } from '@prisma/client';
import { PrismaService } from '@/prisma';
import { FileStorageService } from '../file-storage/file-storage.service';
import { detectImageType } from '../file-storage/image-type';
import { ProductsService } from '../products/products.service';
import { SellersService } from '../sellers/sellers.service';
import { UpsertStoreDto } from './dto/upsert-store.dto';
import 'multer';

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_URL_TTL = 7 * 24 * 3600;

export const STORE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Adresses réservées : une boutique ne doit pas pouvoir se faire passer pour BlackStore.
const RESERVED_SLUGS = new Set([
  'admin', 'aide', 'api', 'blackstore', 'boutique', 'boutiques', 'contact',
  'help', 'officiel', 'official', 'pymail', 'support', 'vendeur', 'vendeurs',
]);

// Un lien social doit pointer vers le réseau annoncé (pas de lien piégé sous un logo Facebook).
const SOCIAL_LINKS = {
  facebookUrl: { label: 'Facebook', hosts: ['facebook.com', 'fb.com', 'fb.me'] },
  instagramUrl: { label: 'Instagram', hosts: ['instagram.com'] },
  tiktokUrl: { label: 'TikTok', hosts: ['tiktok.com'] },
} as const;

@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorageService: FileStorageService,
    private readonly productsService: ProductsService,
    private readonly configService: ConfigService,
  ) {}

  // ── Espace vendeur ──────────────────────────────────────────────────

  /** Boutique du vendeur connecté, ou null s'il n'en a pas encore. */
  async getMine(sellerId: string) {
    const store = await this.prisma.store.findUnique({ where: { sellerId } });
    return store ? this.toSellerView(store) : null;
  }

  /** Crée ou met à jour la boutique du vendeur (un champ facultatif absent est effacé). */
  async upsertMine(sellerId: string, dto: UpsertStoreDto) {
    if (RESERVED_SLUGS.has(dto.slug)) {
      throw new BadRequestException('Cette adresse est réservée, choisissez-en une autre');
    }
    for (const [field, { label, hosts }] of Object.entries(SOCIAL_LINKS)) {
      const url = dto[field as keyof typeof SOCIAL_LINKS];
      if (url && !StoresService.hostMatches(url, hosts)) {
        throw new BadRequestException(`Le lien ${label} doit pointer vers ${hosts[0]}`);
      }
    }

    const data = {
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? null,
      facebookUrl: dto.facebookUrl ?? null,
      instagramUrl: dto.instagramUrl ?? null,
      tiktokUrl: dto.tiktokUrl ?? null,
      whatsapp: dto.whatsapp ? SellersService.normalizePhone(dto.whatsapp) : null,
    };

    try {
      const store = await this.prisma.store.upsert({
        where: { sellerId },
        create: { sellerId, ...data },
        update: data,
      });
      this.logger.log(`Boutique enregistrée : ${store.slug} (vendeur ${sellerId})`);
      return this.toSellerView(store);
    } catch (error) {
      // La boutique est retrouvée par vendeur : seul le slug peut entrer en conflit.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Cette adresse est déjà prise par une autre boutique');
      }
      throw error;
    }
  }

  async uploadLogo(sellerId: string, file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Aucun fichier reçu');
    }
    if (file.size > LOGO_MAX_BYTES) {
      throw new BadRequestException('Le logo doit faire au plus 2 Mo');
    }
    // Le type annoncé par le navigateur ne prouve rien : on lit la signature du fichier.
    const mimeType = detectImageType(file.buffer);
    if (!mimeType) {
      throw new BadRequestException('Le logo doit être une image JPG, PNG ou WebP');
    }

    const store = await this.prisma.store.findUnique({ where: { sellerId } });
    if (!store) {
      throw new NotFoundException("Enregistrez d'abord votre boutique");
    }

    const logoKey = await this.fileStorageService.uploadStoreLogo(file.buffer, store.id, mimeType);
    const updated = await this.prisma.store.update({ where: { id: store.id }, data: { logoKey } });
    if (store.logoKey) {
      await this.fileStorageService.removeObject(store.logoKey);
    }
    return this.toSellerView(updated);
  }

  // ── Page publique ───────────────────────────────────────────────────

  /** Boutique publique : visible seulement si son vendeur est validé. */
  async getPublic(slug: string) {
    const store = STORE_SLUG_PATTERN.test(slug)
      ? await this.prisma.store.findUnique({
          where: { slug },
          include: { seller: { select: { status: true } } },
        })
      : null;
    if (!store || store.seller.status !== 'approved') {
      throw new NotFoundException('Boutique introuvable');
    }

    return {
      name: store.name,
      slug: store.slug,
      description: store.description,
      logoUrl: await this.logoUrl(store),
      facebookUrl: store.facebookUrl,
      instagramUrl: store.instagramUrl,
      tiktokUrl: store.tiktokUrl,
      whatsapp: store.whatsapp,
      createdAt: store.createdAt,
      products: await this.productsService.findByStore(store.id),
    };
  }

  // ── Outils ──────────────────────────────────────────────────────────

  private async toSellerView(store: Store) {
    const { logoKey: _logoKey, ...fields } = store;
    const base = this.configService.get<string>('STOREFRONT_URL', 'http://localhost:3001').replace(/\/+$/, '');
    return {
      ...fields,
      logoUrl: await this.logoUrl(store),
      publicUrl: `${base}/boutique/${store.slug}`,
    };
  }

  private logoUrl(store: Store): Promise<string | null> {
    return store.logoKey
      ? this.fileStorageService.getPresignedUrl(store.logoKey, LOGO_URL_TTL)
      : Promise.resolve(null);
  }

  private static hostMatches(url: string, hosts: readonly string[]): boolean {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return hosts.some((h) => host === h || host.endsWith(`.${h}`));
    } catch {
      return false;
    }
  }
}
