import { createHash } from 'crypto';

/**
 * Empreinte courte du hash du mot de passe, embarquée dans les jetons JWT
 * (champ `pwd`). Elle change avec le mot de passe : les jetons émis avant un
 * changement de mot de passe sont alors refusés, ce qui ferme les sessions
 * ouvertes avec l'ancien.
 */
export function passwordStamp(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
}
