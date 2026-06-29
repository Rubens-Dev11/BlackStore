import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST', 'localhost'),
      port: this.configService.get<number>('SMTP_PORT', 1026),
      secure: false,
    });
  }

  async sendDownloadEmail(
    to: string,
    customerName: string,
    products: Array<{ name: string; downloadLink: string; expiry: string }>,
    downloadLinks: string[],
  ): Promise<void> {
    try {
      const productList = products
        .map(
          (product) => `
            <li>
              <strong>${product.name}</strong><br>
              <a href="${product.downloadLink}">Télécharger</a>
              (expire le ${product.expiry})
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
        from: 'BlackStore <noreply@blackstore.cm>',
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
            <code>${item.token}</code>
          </td>
          <td style="padding:8px;border:1px solid #333;">
            ${item.maxDownloads} téléchargements
          </td>
          <td style="padding:8px;border:1px solid #333;">
            ${new Date(item.expiresAt).toLocaleDateString('fr-FR')}
          </td>
        </tr>
      `).join('');

      await this.transporter.sendMail({
        from: '"BlackStore" <noreply@blackstore.cm>',
        to: data.buyerEmail,
        subject: `✅ Commande ${data.orderNumber} confirmée — BlackStore`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;
            background:#0a0a0a;color:#fff;padding:32px;border-radius:8px;">
            <h1 style="color:#f97316;">BlackStore</h1>
            <h2>Merci ${data.buyerName} !</h2>
            <p>Votre commande <strong>${data.orderNumber}</strong> a été confirmée.</p>
            <p>Montant total : <strong>${data.totalAmount.toLocaleString('fr-FR')} FCFA</strong></p>
            <h3>Vos tokens de téléchargement :</h3>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#1a1a1a;">
                  <th style="padding:8px;border:1px solid #333;text-align:left;">Produit</th>
                  <th style="padding:8px;border:1px solid #333;text-align:left;">Token</th>
                  <th style="padding:8px;border:1px solid #333;text-align:left;">Téléchargements</th>
                  <th style="padding:8px;border:1px solid #333;text-align:left;">Expire le</th>
                </tr>
              </thead>
              <tbody>${tokenLinks}</tbody>
            </table>
            <p style="margin-top:24px;color:#999;font-size:12px;">
              Conservez précieusement ces tokens. Chaque token est unique et personnel.
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
