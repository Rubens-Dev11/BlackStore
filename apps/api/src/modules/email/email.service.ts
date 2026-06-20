import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST', 'mailhog'),
      port: this.configService.get<number>('MAIL_PORT', 1025),
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

  async sendOrderConfirmation(
    to: string,
    customerName: string,
    orderNumber: string,
    total: number,
  ): Promise<void> {
    try {
      const html = `
        <h2>Bonjour ${customerName},</h2>
        <p>Votre commande <strong>${orderNumber}</strong> a été confirmée.</p>
        <p>Montant total : <strong>${total} FCFA</strong></p>
        <p>Merci pour votre achat sur BlackStore !</p>
      `;

      await this.transporter.sendMail({
        from: 'BlackStore <noreply@blackstore.cm>',
        to,
        subject: `Confirmation commande #${orderNumber} - BlackStore`,
        html,
      });

      this.logger.log(`Email confirmation envoyé à ${to} — commande ${orderNumber}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Échec envoi confirmation à ${to}: ${message}`);
    }
  }
}
