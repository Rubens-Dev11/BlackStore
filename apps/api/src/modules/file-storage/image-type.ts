export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp';

/**
 * Type réel d'une image d'après ses premiers octets (JPEG, PNG, WebP), sinon null.
 * Le type annoncé par le navigateur ne prouve rien : un faux « .png » pourrait
 * contenir une page web servie ensuite depuis le domaine de l'API.
 */
export function detectImageType(buffer: Buffer): ImageType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}
