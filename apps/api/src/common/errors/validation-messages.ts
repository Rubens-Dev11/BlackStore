import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

/**
 * Messages de validation en français. Les DTO précisent souvent leur propre
 * message ; sinon class-validator en produit un en anglais (« email must be an
 * email »), remplacé ici par une phrase compréhensible par un client.
 */

/** Nom affiché de chaque champ (les noms techniques restent en anglais dans le code). */
const LABELS: Record<string, string> = {
  acceptRefund: 'accord pour le remboursement',
  acceptTerms: 'acceptation des conditions',
  accountName: 'nom du titulaire',
  action: 'action',
  amount: 'montant',
  buyerEmail: 'e-mail',
  categoryId: 'catégorie',
  certifyRights: 'certification des droits',
  comment: 'commentaire',
  commissionRate: 'commission',
  compatibility: 'compatibilité',
  consent: 'accord',
  contactEmail: 'e-mail de contact',
  contactPhone: 'téléphone de contact',
  currentPassword: 'mot de passe actuel',
  customerEmail: 'e-mail',
  customerName: 'nom',
  customerPhone: 'téléphone',
  decision: 'décision',
  demoVideoUrl: 'vidéo de présentation',
  description: 'description',
  details: 'détails',
  documentType: 'type de pièce',
  downloadExpiryHours: 'durée de validité du lien',
  downloadLimit: 'nombre de téléchargements',
  email: 'e-mail',
  facebookUrl: 'page Facebook',
  featured: 'mise en avant',
  firstName: 'prénom',
  fullName: 'nom complet',
  holdDays: 'délai de sécurité',
  hostingInfo: 'hébergeur',
  imageUrl: 'image',
  instagramUrl: 'compte Instagram',
  installGuide: "guide d'installation",
  installVideoUrl: "vidéo d'installation",
  isActive: 'activation',
  isFeatured: 'mise en avant',
  items: 'articles',
  lastName: 'nom',
  legalAddress: 'adresse',
  legalForm: 'forme juridique',
  legalName: 'raison sociale',
  limit: 'nombre par page',
  message: 'message',
  minWithdrawal: 'retrait minimum',
  name: 'nom',
  newPassword: 'nouveau mot de passe',
  niu: 'NIU',
  note: 'note',
  operator: 'opérateur',
  orderItemId: 'produit',
  orderNumber: 'numéro de commande',
  originalPrice: 'prix barré',
  page: 'page',
  password: 'mot de passe',
  phone: 'téléphone',
  platform: 'plateforme',
  price: 'prix',
  productId: 'produit',
  quantity: 'quantité',
  rating: 'note',
  rccm: 'RCCM',
  reason: 'motif',
  reference: 'référence',
  refundAccountName: 'titulaire du compte Mobile Money',
  refundOperator: 'opérateur Mobile Money',
  refundPhone: 'numéro Mobile Money',
  reply: 'réponse',
  seoDescription: 'description pour les moteurs de recherche',
  seoTitle: 'titre pour les moteurs de recherche',
  sessionId: 'session',
  shortDescription: 'accroche',
  slug: 'adresse',
  status: 'statut',
  tags: 'mots-clés',
  tiktokUrl: 'compte TikTok',
  token: 'lien',
  topic: 'sujet',
  utmMedium: 'provenance',
  utmSource: 'provenance',
  utm_campaign: 'provenance',
  utm_content: 'provenance',
  utm_medium: 'provenance',
  utm_source: 'provenance',
  referrer_url: "page d'origine",
  version: 'version',
  website: 'site web',
  whatsapp: 'WhatsApp',
};

const numbers = (message: string) => message.match(/-?\d+(?:\.\d+)?/g) ?? [];
const valuesAfterColon = (message: string) => message.split(': ').slice(1).join(': ');

type Template = (field: string, message: string) => string;

const TEMPLATES: Record<string, Template> = {
  isNotEmpty: (f) => `Le champ ${f} est obligatoire.`,
  isDefined: (f) => `Le champ ${f} est obligatoire.`,
  arrayNotEmpty: (f) => `Le champ ${f} ne doit pas être vide.`,
  isString: (f) => `Le champ ${f} doit être un texte.`,
  isEmail: (f) => `Le champ ${f} doit contenir une adresse e-mail valide.`,
  minLength: (f, m) => `Le champ ${f} doit contenir au moins ${numbers(m)[0]} caractères.`,
  maxLength: (f, m) => `Le champ ${f} doit contenir au plus ${numbers(m)[0]} caractères.`,
  isLength: (f, m) => {
    const [a, b] = numbers(m);
    return b ? `Le champ ${f} doit contenir entre ${a} et ${b} caractères.` : `Le champ ${f} n'a pas la bonne longueur.`;
  },
  min: (f, m) => `Le champ ${f} doit être supérieur ou égal à ${numbers(m)[0]}.`,
  max: (f, m) => `Le champ ${f} doit être inférieur ou égal à ${numbers(m)[0]}.`,
  isInt: (f) => `Le champ ${f} doit être un nombre entier.`,
  isNumber: (f) => `Le champ ${f} doit être un nombre.`,
  isPositive: (f) => `Le champ ${f} doit être un nombre positif.`,
  isBoolean: (f) => `Le champ ${f} doit valoir oui ou non.`,
  isUuid: (f) => `Le champ ${f} doit être un identifiant valide.`,
  isEnum: (f, m) => `Le champ ${f} n'accepte que ces valeurs : ${valuesAfterColon(m)}.`,
  isIn: (f, m) => `Le champ ${f} n'accepte que ces valeurs : ${valuesAfterColon(m)}.`,
  matches: (f) => `Le champ ${f} n'a pas le bon format.`,
  isUrl: (f) => `Le champ ${f} doit être une adresse web valide (https://…).`,
  isArray: (f) => `Le champ ${f} doit être une liste.`,
  arrayMaxSize: (f, m) => `Le champ ${f} contient trop d'éléments (${numbers(m)[0]} au maximum).`,
  arrayMinSize: (f, m) => `Le champ ${f} doit contenir au moins ${numbers(m)[0]} élément(s).`,
  isDateString: (f) => `Le champ ${f} doit être une date valide.`,
  isIso8601: (f) => `Le champ ${f} doit être une date valide.`,
  isObject: (f) => `Le champ ${f} est mal formé.`,
  nestedValidation: (f) => `Le champ ${f} est mal formé.`,
  equals: (f) => `Le champ ${f} n'a pas la valeur attendue.`,
  whitelistValidation: (f) => `Le champ ${f} n'est pas accepté.`,
  isPhoneNumber: (f) => `Le champ ${f} doit être un numéro de téléphone valide.`,
};

/** Message anglais généré par class-validator (il commence par le nom technique du champ). */
function isEnglishDefault(message: string, property: string): boolean {
  return (
    message.startsWith(`${property} `) ||
    message.startsWith(`each value in ${property} `) ||
    message.startsWith(`property ${property} `) ||
    message.startsWith(`nested property ${property} `)
  );
}

function collect(errors: ValidationError[], out: string[]): void {
  for (const error of errors) {
    const field = `« ${LABELS[error.property] ?? error.property} »`;
    for (const [constraint, message] of Object.entries(error.constraints ?? {})) {
      if (!isEnglishDefault(message, error.property)) {
        out.push(message);
        continue;
      }
      const template = TEMPLATES[constraint];
      out.push(template ? template(field, message) : `Le champ ${field} n'est pas valide.`);
    }
    if (error.children?.length) collect(error.children, out);
  }
}

/** Liste des messages en français, dans l'ordre des champs. */
export function frenchValidationMessages(errors: ValidationError[]): string[] {
  const messages: string[] = [];
  collect(errors, messages);
  return [...new Set(messages)];
}

/** Remplace l'erreur de validation de Nest : même forme (`message` = liste), textes en français. */
export const validationExceptionFactory = (errors: ValidationError[]) =>
  new BadRequestException(frenchValidationMessages(errors));
