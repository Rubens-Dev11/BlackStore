/**
 * Messages d'erreur en français pour les réponses que Nest, Express, Multer ou le
 * limiteur de tentatives produisent en anglais. Les messages écrits par nos
 * services (déjà en français) ne sont pas touchés.
 */

const ENGLISH_DEFAULTS: Record<string, string> = {
  'Bad Request': 'Requête invalide.',
  Unauthorized: 'Connectez-vous pour continuer : votre session a peut-être expiré.',
  Forbidden: "Vous n'avez pas accès à cette action.",
  'Forbidden resource': "Vous n'avez pas accès à cette action.",
  'Not Found': 'Élément introuvable.',
  'Method Not Allowed': 'Action non autorisée.',
  'Not Acceptable': 'Format de réponse non pris en charge.',
  'Request Timeout': 'Le serveur a mis trop de temps à répondre. Réessayez.',
  Conflict: 'Cette action est en conflit avec une autre. Rechargez la page puis réessayez.',
  Gone: "Cet élément n'est plus disponible.",
  'Payload Too Large': 'Contenu trop volumineux.',
  'File too large': 'Fichier trop volumineux.',
  'Unsupported Media Type': 'Format non pris en charge.',
  'Unprocessable Entity': 'Requête invalide.',
  'Too Many Requests': 'Trop de tentatives. Patientez quelques minutes avant de réessayer.',
  'ThrottlerException: Too Many Requests': 'Trop de tentatives. Patientez quelques minutes avant de réessayer.',
  'Internal server error': 'Une erreur interne est survenue. Réessayez dans un instant.',
  'Internal Server Error': 'Une erreur interne est survenue. Réessayez dans un instant.',
  'Service Unavailable': 'Service momentanément indisponible. Réessayez dans un instant.',
  // Multer (envoi de fichiers)
  'Unexpected field': 'Fichier envoyé dans un champ inattendu.',
  'Too many files': 'Trop de fichiers envoyés en une fois.',
  'Too many parts': 'Formulaire trop volumineux.',
  'Too many fields': 'Formulaire trop volumineux.',
  'Field name too long': 'Formulaire mal formé.',
  'Field value too long': 'Une des valeurs envoyées est trop longue.',
  'Multipart: Boundary not found': 'Formulaire mal formé.',
};

/** Messages des « pipes » de Nest et d'Express (paramètres ou contenu mal formés). */
const PATTERN_MESSAGES: Array<[RegExp, string]> = [
  [/^Validation failed \(uuid( v\d)? is expected\)$/, 'Identifiant invalide.'],
  [/^Validation failed \(numeric string is expected\)$/, 'Un nombre est attendu.'],
  [/^Validation failed \(boolean string is expected\)$/, 'Une valeur oui/non est attendue.'],
  [/^Validation failed \(enum string is expected\)$/, 'Valeur non autorisée.'],
  [/^Validation failed/, 'Requête invalide.'],
  [/in JSON at position|is not valid JSON|JSON input|^Unexpected (token|end|non-whitespace)/, 'Requête invalide : le contenu envoyé est mal formé.'],
  [/^URI malformed$|^Failed to decode param/, 'Adresse mal formée.'],
];

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Requête invalide.',
  401: ENGLISH_DEFAULTS.Unauthorized,
  403: ENGLISH_DEFAULTS.Forbidden,
  404: ENGLISH_DEFAULTS['Not Found'],
  409: ENGLISH_DEFAULTS.Conflict,
  413: ENGLISH_DEFAULTS['Payload Too Large'],
  429: ENGLISH_DEFAULTS['Too Many Requests'],
  500: ENGLISH_DEFAULTS['Internal server error'],
  503: ENGLISH_DEFAULTS['Service Unavailable'],
};

/** Message par défaut d'un code HTTP. */
export function statusMessage(status: number): string {
  return STATUS_MESSAGES[status] ?? (status >= 500 ? STATUS_MESSAGES[500] : STATUS_MESSAGES[400]);
}

/** Traduit un message anglais connu ; laisse les autres tels quels. */
export function frenchMessage(status: number, message: string): string {
  const known = ENGLISH_DEFAULTS[message];
  if (known) return known;
  const route = /^Cannot (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) (.+)$/.exec(message);
  if (route) return `Adresse introuvable : ${route[1]} ${route[2]}`;
  if (status === 400) {
    for (const [pattern, french] of PATTERN_MESSAGES) {
      if (pattern.test(message)) return french;
    }
  }
  // Exception levée sans message : Nest reprend alors le nom anglais du code HTTP.
  if (status === 429 && /too many requests/i.test(message)) return STATUS_MESSAGES[429];
  return message;
}
