import { extname } from 'path';

/** Fichier d'un produit : 450 Mo au plus (Nginx refuse au-delà de 500 Mo, enveloppe comprise). */
export const SELLER_FILE_MAX_BYTES = 450 * 1024 * 1024;
/** Couverture et captures d'écran. */
export const SELLER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const SELLER_SCREENSHOTS_MAX = 8;

/**
 * Formats courants des produits numériques. Les pages web et les scripts
 * (.html, .js, .bat…) sont exclus ; un autre format peut être envoyé dans un ZIP.
 */
export const SELLER_FILE_EXTENSIONS = new Set([
  // documents
  'pdf', 'epub', 'mobi', 'txt', 'rtf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'csv',
  // images et design
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'tif', 'tiff', 'psd', 'ai', 'eps', 'fig', 'sketch', 'xd',
  // audio
  'mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac',
  // vidéo
  'mp4', 'mov', 'm4v', 'mkv', 'webm', 'avi',
  // archives
  'zip', 'rar', '7z',
  // applications
  'apk', 'xapk', 'exe', 'msi', 'dmg',
  // polices
  'ttf', 'otf', 'woff', 'woff2',
]);

export const SELLER_FILE_FORMATS_MESSAGE =
  'Formats acceptés : documents (PDF, EPUB, Word, Excel, PowerPoint…), images, audio, vidéo, archives (ZIP, RAR, 7z), ' +
  'applications (APK, EXE, MSI, DMG) et polices. Pour un autre format, compressez le fichier en ZIP.';

/**
 * Nom d'origine du fichier : le navigateur l'envoie en UTF-8, mais il est lu en latin-1
 * par le décodeur des formulaires (« CrÃ©ations.pdf ») ; on le remet en UTF-8 quand c'est possible.
 */
export function decodeUploadName(name: string): string {
  const utf8 = Buffer.from(name, 'latin1').toString('utf8');
  return utf8.includes('�') ? name : utf8;
}

/** Extension en minuscules, sans le point (« Guide.PDF » → « pdf »), ou chaîne vide. */
export function fileExtension(name: string): string {
  return extname(name).slice(1).toLowerCase();
}

/** Nom sûr pour le stockage et le téléchargement : « Guide d'été (v2).pdf » → « Guide-d-ete-v2.pdf ». */
export function safeFileName(name: string): string {
  const ext = fileExtension(name);
  const base =
    name
      .slice(0, name.length - (ext ? ext.length + 1 : 0))
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 80) || 'fichier';
  return ext ? `${base}.${ext}` : base;
}
