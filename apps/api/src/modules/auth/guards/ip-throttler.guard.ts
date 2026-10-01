import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Limiteur de tentatives par adresse IP du visiteur. Derrière Nginx, l'API ne
 * voit que l'adresse du proxy : on lit X-Real-IP, posé par Nginx. L'API n'étant
 * joignable qu'en local sur le serveur, cet en-tête ne peut pas être forgé.
 */
@Injectable()
export class IpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const realIp = req.headers?.['x-real-ip'];
    return (Array.isArray(realIp) ? realIp[0] : realIp) || req.ip;
  }
}
