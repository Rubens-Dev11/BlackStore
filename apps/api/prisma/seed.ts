import { PrismaClient, Platform } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Seed script — populates the database with initial test data.
 * Creates: 1 admin, 3 categories, 2 demo products.
 */
async function main(): Promise<void> {
  console.log('🌱 Starting seed...');

  // ── ADMIN ─────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin@BlackStore2026!', 12);

  const admin = await prisma.admin.upsert({
    where: { email: 'admin@blackstore.cm' },
    update: {},
    create: {
      email: 'admin@blackstore.cm',
      passwordHash,
      isActive: true,
    },
  });
  console.log(`✅ Admin créé : ${admin.email}`);

  // ── CATÉGORIES ────────────────────────────────────────────────────
  const categoriesData = [
    {
      name: 'Applications Android',
      slug: 'applications-android',
      description: 'Applications mobiles pour Android — APK vérifiés et sécurisés.',
      iconUrl: '📱',
      sortOrder: 1,
    },
    {
      name: 'Logiciels Desktop',
      slug: 'logiciels-desktop',
      description: 'Logiciels pour Windows et macOS — installateurs vérifiés.',
      iconUrl: '💻',
      sortOrder: 2,
    },
    {
      name: 'Outils Bureautique',
      slug: 'outils-bureautique',
      description: 'Suites bureautiques, éditeurs PDF, outils de productivité.',
      iconUrl: '📊',
      sortOrder: 3,
    },
  ];

  const categories = [];
  for (const cat of categoriesData) {
    const category = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
    categories.push(category);
    console.log(`✅ Catégorie créée : ${category.name}`);
  }

  // ── PRODUITS DE DÉMONSTRATION ──────────────────────────────────────
  const productsData = [
    {
      name: 'App Demo Android v1.0',
      slug: 'app-demo-android-v1',
      shortDescription: 'Application Android de démonstration pour tester la plateforme.',
      description:
        '<h2>App Demo Android</h2><p>Cette application est un produit de démonstration pour tester le flux complet de BlackStore : ajout au panier, paiement CinetPay, et téléchargement sécurisé.</p><h3>Fonctionnalités</h3><ul><li>Interface Material Design</li><li>Mode hors-ligne</li><li>Notifications push</li></ul>',
      price: 5000,
      originalPrice: 7500,
      categoryId: categories[0].id,
      tags: ['android', 'demo', 'test'],
      version: '1.0.0',
      fileSizeMb: 45.5,
      platform: Platform.android,
      minRequirements: {
        os: 'Android 8.0+',
        ram: '2 GB',
        storage: '100 MB',
      },
      changelog: [
        { version: '1.0.0', date: '2026-01-15', changes: ['Version initiale', 'Support Android 8+'] },
      ],
      maxDownloads: 3,
      downloadExpiryHours: 72,
      isActive: false,
      isFeatured: true,
      seoTitle: 'App Demo Android — BlackStore',
      seoDescription: 'Téléchargez App Demo Android v1.0 sur BlackStore. Application de démonstration sécurisée.',
    },
    {
      name: 'Logiciel Demo Desktop v2.1',
      slug: 'logiciel-demo-desktop-v2',
      shortDescription: 'Logiciel Desktop de démonstration multi-plateforme.',
      description:
        '<h2>Logiciel Demo Desktop</h2><p>Logiciel de démonstration pour Windows et macOS. Permet de tester le téléchargement sécurisé de fichiers volumineux.</p><h3>Fonctionnalités</h3><ul><li>Interface moderne</li><li>Auto-update intégré</li><li>Support multi-langues</li></ul>',
      price: 15000,
      originalPrice: 20000,
      categoryId: categories[1].id,
      tags: ['desktop', 'windows', 'macos', 'demo'],
      version: '2.1.0',
      fileSizeMb: 120.0,
      platform: Platform.desktop,
      minRequirements: {
        os: 'Windows 10+ / macOS 12+',
        ram: '4 GB',
        storage: '500 MB',
        processor: 'Intel i3 / Apple M1',
      },
      changelog: [
        { version: '2.1.0', date: '2026-01-20', changes: ['Correction de bugs', 'Support macOS Ventura'] },
        { version: '2.0.0', date: '2025-11-01', changes: ['Refonte complète de l\'interface', 'Auto-update'] },
      ],
      maxDownloads: 3,
      downloadExpiryHours: 72,
      isActive: false,
      isFeatured: false,
      seoTitle: 'Logiciel Demo Desktop — BlackStore',
      seoDescription: 'Téléchargez Logiciel Demo Desktop v2.1 sur BlackStore. Compatible Windows et macOS.',
    },
  ];

  for (const prod of productsData) {
    const product = await prisma.product.upsert({
      where: { slug: prod.slug },
      update: {},
      create: prod,
    });
    console.log(`✅ Produit créé : ${product.name} — ${product.price} FCFA`);
  }

  console.log('\n🎉 Seed terminé avec succès !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur seed :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
