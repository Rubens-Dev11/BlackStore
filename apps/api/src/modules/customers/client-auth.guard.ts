import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ClientSession, CustomersService } from './customers.service';

export type ClientRequest = Request & { client: ClientSession };

/** Session de l'espace client : jeton « Bearer » reçu à l'ouverture de la session. */
@Injectable()
export class ClientAuthGuard implements CanActivate {
  constructor(private readonly customersService: CustomersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ClientRequest>();
    const header = request.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const session = token ? await this.customersService.sessionFor(token) : null;
    if (!session) {
      throw new UnauthorizedException('Votre session a expiré : demandez un nouveau lien de connexion.');
    }
    request.client = session;
    return true;
  }
}
