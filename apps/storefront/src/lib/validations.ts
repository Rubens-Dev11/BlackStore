import { z } from 'zod';

export const checkoutSchema = z.object({
  buyerName: z.string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(100, 'Le nom est trop long'),
  buyerEmail: z.string()
    .email('Adresse email invalide'),
  buyerPhone: z.string()
    .regex(/^\+?[0-9\s\-]{8,15}$/, 'Numéro de téléphone invalide')
    .optional()
    .or(z.literal('')),
});

export type CheckoutFormData = z.infer<typeof checkoutSchema>;

export const reviewSchema = z.object({
  buyerEmail: z.string().email('Adresse email invalide'),
  rating: z.number().min(1, 'Note requise').max(5, 'Note invalide'),
  comment: z.string().max(1000, 'Commentaire trop long').optional(),
});

export type ReviewFormData = z.infer<typeof reviewSchema>;
