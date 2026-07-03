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
