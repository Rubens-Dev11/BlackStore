import { Transform } from 'class-transformer';

// Règles communes aux formulaires vendeur.

/** 8 à 72 caractères (limite de bcrypt), avec au moins une lettre et un chiffre. */
export const SELLER_PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
export const SELLER_PASSWORD_MESSAGE =
  'Le mot de passe doit faire 8 à 72 caractères, avec au moins une lettre et un chiffre';

/** Chiffres, espaces, +, tirets, points et parenthèses ; normalisé ensuite en +237… */
export const SELLER_PHONE_PATTERN = /^\+?[\d\s().-]{8,20}$/;
export const SELLER_PHONE_MESSAGE = 'Numéro de téléphone invalide';

export const Trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export const NormalizeEmail = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

/** Champ facultatif : une chaîne vide (champ effacé dans le formulaire) vaut « aucune valeur ». */
export const EmptyToNull = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  });
