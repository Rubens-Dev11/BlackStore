import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import type { Request } from 'express';
import { frenchMessage, statusMessage } from './french-messages';

type ErrorBody = Record<string, unknown> & { statusCode: number; message: unknown };

/**
 * Toutes les erreurs de l'API répondent en français, avec la même forme que
 * celles de Nest ({ statusCode, message, error }) :
 * - erreurs HTTP : messages anglais par défaut traduits, le reste inchangé ;
 * - erreurs Prisma connues : élément absent (404), doublon ou lien (409) ;
 * - erreurs imprévues : 500 avec une référence, notée dans le journal, que le
 *   client peut donner au support.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Erreurs');

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.adapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse();
    const { status, body } = this.describe(exception, request);

    // Réponse déjà commencée (envoi d'un fichier interrompu) : on ne peut que la clore.
    if (httpAdapter.isHeadersSent(response)) {
      httpAdapter.end(response);
      return;
    }
    httpAdapter.reply(response, body, status);
  }

  private describe(exception: unknown, request: Request): { status: number; body: ErrorBody } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const body: ErrorBody =
        typeof raw === 'string' ? { statusCode: status, message: raw } : { statusCode: status, ...(raw as object), message: (raw as { message?: unknown }).message };
      body.message = this.translate(status, body.message);
      return { status, body };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const known = PRISMA_ERRORS[exception.code];
      if (known) {
        this.logger.warn(`${request.method} ${request.originalUrl} : Prisma ${exception.code} (${exception.message.split('\n').pop()?.trim()})`);
        return { status: known.status, body: { statusCode: known.status, message: known.message, error: known.error } };
      }
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      this.logger.warn(`${request.method} ${request.originalUrl} : requête Prisma invalide`);
      return {
        status: 400,
        body: { statusCode: 400, message: "Requête invalide : une information obligatoire manque ou n'a pas le bon format.", error: 'Bad Request' },
      };
    }

    // Erreurs du lecteur de corps de requête (Express) : contenu trop gros ou mal formé.
    const parserError = exception as { type?: string; status?: number };
    if (parserError?.type === 'entity.too.large') {
      return { status: 413, body: { statusCode: 413, message: statusMessage(413), error: 'Payload Too Large' } };
    }
    if (parserError?.type === 'entity.parse.failed') {
      return { status: 400, body: { statusCode: 400, message: 'Requête invalide : le contenu envoyé est mal formé.', error: 'Bad Request' } };
    }

    const reference = randomBytes(4).toString('hex').toUpperCase();
    const error = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(`Erreur interne ${reference} sur ${request.method} ${request.originalUrl} : ${error.message}`, error.stack);
    return {
      status: 500,
      body: {
        statusCode: 500,
        message: `Une erreur interne est survenue (référence ${reference}). Réessayez dans un instant.`,
        error: 'Internal Server Error',
        reference,
      },
    };
  }

  private translate(status: number, message: unknown): unknown {
    if (Array.isArray(message)) return message.map((m) => (typeof m === 'string' ? frenchMessage(status, m) : m));
    if (typeof message === 'string') return frenchMessage(status, message);
    return message ?? statusMessage(status);
  }
}

const PRISMA_ERRORS: Record<string, { status: number; message: string; error: string }> = {
  P2025: { status: 404, message: 'Élément introuvable : il a peut-être été supprimé entre-temps.', error: 'Not Found' },
  P2002: { status: 409, message: 'Cet élément existe déjà.', error: 'Conflict' },
  P2003: { status: 409, message: 'Opération impossible : cet élément est encore utilisé ailleurs.', error: 'Conflict' },
  P2000: { status: 400, message: 'Une des valeurs envoyées est trop longue.', error: 'Bad Request' },
};
