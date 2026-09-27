import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST', 'localhost');
    const port = this.configService.get<number>('SMTP_PORT', 1025);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const hasAuth = Boolean(user && pass);

    this.fromAddress = this.configService.get<string>(
      'SMTP_FROM',
      'BlackStore <noreply@blackstore.cm>',
    );

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      // MailHog (dev) n'a pas de TLS ; le vrai serveur SMTP (prod) l'exige.
      requireTLS: hasAuth,
      ...(hasAuth
        ? {
            auth: { user, pass },
            tls: {
              servername: this.configService.get<string>(
                'SMTP_TLS_SERVERNAME',
                'mail.pymail.cm',
              ),
            },
          }
        : {}),
    });
  }

  /**
   * Lien personnel de téléchargement : passe par l'API, qui vérifie l'expiration
   * et le quota du jeton avant de rediriger vers le fichier.
   */
  private downloadUrl(token: string): string {
    const base = this.configService.get<string>('API_PUBLIC_URL', 'http://localhost:3000');
    return `${base.replace(/\/+$/, '')}/downloads/${token}`;
  }

  private static formatExpiry(date: Date): string {
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Douala',
    });
  }

  async sendDownloadEmail(
    to: string,
    customerName: string,
    items: Array<{ name: string; token: string; expiresAt: Date; maxDownloads: number }>,
  ): Promise<void> {
    try {
      const productList = items
        .map(
          (item) => `
            <li>
              <strong>${item.name}</strong><br>
              <a href="${this.downloadUrl(item.token)}">Télécharger</a>
              (${item.maxDownloads} téléchargements, jusqu'au ${EmailService.formatExpiry(item.expiresAt)})
            </li>
          `,
        )
        .join('');

      const html = `
        <h2>Bonjour ${customerName},</h2>
        <p>Merci pour votre achat ! Voici vos liens de téléchargement :</p>
        <ul>${productList}</ul>
        <p>Si vous avez des questions, contactez-nous.</p>
      `;

      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject: 'Vos liens de téléchargement - BlackStore',
        html,
      });

      this.logger.log(`Email de téléchargement envoyé à ${to}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Échec envoi email téléchargement à ${to}: ${message}`);
    }
  }

  async sendOrderConfirmation(data: {
    buyerName: string;
    buyerEmail: string;
    orderNumber: string;
    items: Array<{
      productName: string;
      token: string;
      expiresAt: Date;
      maxDownloads: number;
    }>;
    totalAmount: number;
  }): Promise<void> {
    try {
      const tokenLinks = data.items.map(item => `
        <tr>
          <td style="padding:8px;border:1px solid #333;">${item.productName}</td>
          <td style="padding:8px;border:1px solid #333;">
            <a href="${this.downloadUrl(item.token)}" style="color:#f97316;">Télécharger</a>
          </td>
          <td style="padding:8px;border:1px solid #333;">
            ${item.maxDownloads} téléchargements
          </td>
          <td style="padding:8px;border:1px solid #333;">
            ${EmailService.formatExpiry(new Date(item.expiresAt))}
          </td>
        </tr>
      `).join('');

      await this.transporter.sendMail({
        from: this.fromAddress,
        to: data.buyerEmail,
        subject: `✅ Commande ${data.orderNumber} confirmée — BlackStore`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;
            background:#0a0a0a;color:#fff;padding:32px;border-radius:8px;">
            <h1 style="color:#f97316;">BlackStore</h1>
            <h2>Merci ${data.buyerName} !</h2>
            <p>Votre commande <strong>${data.orderNumber}</strong> a été confirmée.</p>
            <p>Montant total : <strong>${data.totalAmount.toLocaleString('fr-FR')} FCFA</strong></p>
            <h3>Vos téléchargements :</h3>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#1a1a1a;">
                  <th style="padding:8px;border:1px solid #333;text-align:left;">Produit</th>
                  <th style="padding:8px;border:1px solid #333;text-align:left;">Lien</th>
                  <th style="padding:8px;border:1px solid #333;text-align:left;">Téléchargements</th>
                  <th style="padding:8px;border:1px solid #333;text-align:left;">Expire le</th>
                </tr>
              </thead>
              <tbody>${tokenLinks}</tbody>
            </table>
            <p style="margin-top:24px;color:#999;font-size:12px;">
              Ces liens sont personnels : ne les partagez pas.
            </p>
            <p style="color:#999;font-size:12px;">© 2026 BlackStore — Produits Numériques</p>
          </div>
        `,
      });

      this.logger.log(`Email confirmation envoyé à ${data.buyerEmail} — commande ${data.orderNumber}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Échec envoi confirmation à ${data.buyerEmail}: ${message}`);
    }
  }
}
