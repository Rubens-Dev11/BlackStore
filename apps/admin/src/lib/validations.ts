import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(2, 'Nom requis (min 2 caractères)'),
  slug: z.string()
    .min(2, 'Slug requis')
    .regex(/^[a-z0-9-]+$/, 'Slug : lettres minuscules, chiffres et tirets uniquement'),
  shortDescription: z.string()
    .min(10, 'Description courte requise (min 10 caractères)')
    .max(200, 'Description courte trop longue (max 200)'),
  price: z.coerce.number({ message: 'Le prix doit être un nombre' })
    .min(0, 'Le prix ne peut pas être négatif'),
  categoryId: z.string().min(1, 'Catégorie requise'),
  platform: z.enum(['android', 'desktop', 'multiplatform'],
    { message: 'Plateforme invalide' }).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

export type ProductFormSchema = z.infer<typeof productSchema>;

export const categorySchema = z.object({
  name: z.string().min(2, 'Nom requis (min 2 caractères)'),
  slug: z.string()
    .min(2, 'Slug requis')
    .regex(/^[a-z0-9-]+$/, 'Slug invalide'),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export type CategoryFormSchema = z.infer<typeof categorySchema>;

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe requis (min 6 caractères)'),
});

export type LoginFormSchema = z.infer<typeof loginSchema>;

// ── Vendeurs (mêmes règles que l'API) ──────────────────────────────

const sellerPassword = z.string().regex(
  /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/,
  'Le mot de passe doit faire 8 à 72 caractères, avec au moins une lettre et un chiffre',
);
const sellerPhone = z.string().trim().regex(/^\+?[\d\s().-]{8,20}$/, 'Numéro de téléphone invalide');
const sellerName = (label: string) =>
  z.string().trim().min(2, `${label} requis (2 caractères minimum)`).max(80, `${label} trop long (80 caractères maximum)`);
const sellerEmail = z.string().trim().email('E-mail invalide');
const passwordsMatch = (data: { newPassword: string; confirmPassword: string }) =>
  data.newPassword === data.confirmPassword;
const MISMATCH = 'Les deux mots de passe ne correspondent pas';

export const sellerRegisterSchema = z.object({
  firstName: sellerName('Prénom'),
  lastName: sellerName('Nom'),
  email: sellerEmail,
  phone: sellerPhone,
  password: sellerPassword,
  confirmPassword: z.string(),
})
  .refine((data) => data.password === data.confirmPassword, { message: MISMATCH, path: ['confirmPassword'] });

export const sellerLoginSchema = z.object({
  email: sellerEmail,
  password: z.string().min(1, 'Mot de passe requis'),
});

export const sellerEmailSchema = z.object({ email: sellerEmail });

export const sellerResetPasswordSchema = z.object({
  newPassword: sellerPassword,
  confirmPassword: z.string(),
})
  .refine(passwordsMatch, { message: MISMATCH, path: ['confirmPassword'] });

export const sellerProfileSchema = z.object({
  firstName: sellerName('Prénom'),
  lastName: sellerName('Nom'),
  phone: sellerPhone,
});

export const sellerChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: sellerPassword,
  confirmPassword: z.string(),
})
  .refine(passwordsMatch, { message: MISMATCH, path: ['confirmPassword'] })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "Le nouveau mot de passe doit être différent de l'actuel",
    path: ['newPassword'],
  });

const optionalHttps = (label: string) =>
  z.string().trim().refine((value) => value === '' || /^https:\/\/\S+$/.test(value), {
    message: `Le lien ${label} doit être une adresse complète commençant par https://`,
  });

export const sellerStoreSchema = z.object({
  name: z.string().trim().min(2, 'Nom de la boutique requis (2 caractères minimum)').max(60, 'Nom trop long (60 caractères maximum)'),
  slug: z.string()
    .min(3, "L'adresse doit faire au moins 3 caractères")
    .max(40, "L'adresse doit faire au plus 40 caractères")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "L'adresse ne peut contenir que des lettres minuscules sans accent, des chiffres et des tirets"),
  description: z.string().max(1000, 'La description doit faire au plus 1 000 caractères'),
  facebookUrl: optionalHttps('Facebook'),
  instagramUrl: optionalHttps('Instagram'),
  tiktokUrl: optionalHttps('TikTok'),
  whatsapp: z.string().trim().refine((value) => value === '' || /^\+?[\d\s().-]{8,20}$/.test(value), {
    message: 'Numéro WhatsApp invalide',
  }),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: z.string()
    .min(12, 'Le nouveau mot de passe doit faire au moins 12 caractères')
    .max(72, 'Le nouveau mot de passe doit faire au plus 72 caractères'),
  confirmPassword: z.string(),
})
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'La confirmation ne correspond pas au nouveau mot de passe',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "Le nouveau mot de passe doit être différent de l'actuel",
    path: ['newPassword'],
  });
