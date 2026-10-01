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

  // ─────────────────────────────────────────────
  // E-mails des vendeurs
  // ─────────────────────────────────────────────

  private static escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Mise en page commune : message + bouton d'action + note de bas de page. */
  private static sellerLayout(parts: { lines: string[]; button?: { label: string; url: string }; note?: string }): string {
    const paragraphs = parts.lines.map((line) => `<p>${line}</p>`).join('');
    const button = parts.button
      ? `<p style="margin:24px 0;"><a href="${parts.button.url}" style="background:#f97316;color:#fff;
          padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">${parts.button.label}</a></p>`
      : '';
    const note = parts.note ? `<p style="color:#999;font-size:12px;">${parts.note}</p>` : '';
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;
        background:#0a0a0a;color:#fff;padding:32px;border-radius:8px;">
        <h1 style="color:#f97316;">BlackStore</h1>
        ${paragraphs}${button}${note}
        <p style="color:#999;font-size:12px;">© 2026 BlackStore — Produits Numériques</p>
      </div>`;
  }

  private async sendSellerMail(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.fromAddress, to, subject, html });
      this.logger.log(`E-mail vendeur « ${subject} » envoyé à ${to}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Échec envoi e-mail vendeur à ${to}: ${message}`);
    }
  }

  async sendSellerVerification(to: string, firstName: string, link: string): Promise<void> {
    await this.sendSellerMail(
      to,
      'Confirmez votre adresse e-mail — BlackStore Vendeurs',
      EmailService.sellerLayout({
        lines: [
          `Bonjour ${EmailService.escapeHtml(firstName)},`,
          'Merci pour votre inscription comme vendeur sur BlackStore. Confirmez votre adresse e-mail pour activer votre compte : ce lien est valable 48 heures.',
        ],
        button: { label: 'Confirmer mon adresse', url: link },
        note: "Si vous n'êtes pas à l'origine de cette inscription, ignorez cet e-mail.",
      }),
    );
  }

  async sendSellerPasswordReset(to: string, firstName: string, link: string): Promise<void> {
    await this.sendSellerMail(
      to,
      'Réinitialisation de votre mot de passe — BlackStore Vendeurs',
      EmailService.sellerLayout({
        lines: [
          `Bonjour ${EmailService.escapeHtml(firstName)},`,
          'Vous avez demandé à changer le mot de passe de votre compte vendeur. Ce lien est valable 1 heure.',
        ],
        button: { label: 'Choisir un nouveau mot de passe', url: link },
        note: "Si vous n'avez rien demandé, ignorez cet e-mail : votre mot de passe reste inchangé.",
      }),
    );
  }

  async sendSellerStatus(to: string, firstName: string, status: 'approved' | 'suspended'): Promise<void> {
    const appUrl = this.configService.get<string>('SELLER_APP_URL', 'http://localhost:3002').replace(/\/+$/, '');
    const hello = `Bonjour ${EmailService.escapeHtml(firstName)},`;
    if (status === 'approved') {
      await this.sendSellerMail(
        to,
        'Votre compte vendeur est validé — BlackStore',
        EmailService.sellerLayout({
          lines: [hello, 'Bonne nouvelle : votre compte vendeur BlackStore est validé. Vous pouvez préparer votre boutique.'],
          button: { label: 'Accéder à mon espace vendeur', url: `${appUrl}/vendeur` },
        }),
      );
      return;
    }
    await this.sendSellerMail(
      to,
      'Votre compte vendeur est suspendu — BlackStore',
      EmailService.sellerLayout({
        lines: [hello, 'Votre compte vendeur BlackStore a été suspendu. Contactez le support BlackStore pour en savoir plus.'],
      }),
    );
  }

  /** Décision de l'administrateur sur un produit soumis par un vendeur. */
  async sendSellerProductReview(
    to: string,
    firstName: string,
    productName: string,
    decision: 'approved' | 'rejected',
    note?: string | null,
  ): Promise<void> {
    const appUrl = this.configService.get<string>('SELLER_APP_URL', 'http://localhost:3002').replace(/\/+$/, '');
    const hello = `Bonjour ${EmailService.escapeHtml(firstName)},`;
    const product = `« ${EmailService.escapeHtml(productName)} »`;
    if (decision === 'approved') {
      await this.sendSellerMail(
        to,
        'Votre produit est validé — BlackStore',
        EmailService.sellerLayout({
          lines: [
            hello,
            `Bonne nouvelle : votre produit ${product} est validé. Il est visible dans votre boutique dès que votre compte vendeur est validé.`,
            'Vos prochains produits seront publiés directement, sans attendre de validation.',
          ],
          button: { label: 'Voir mes produits', url: `${appUrl}/vendeur/produits` },
        }),
      );
      return;
    }
    await this.sendSellerMail(
      to,
      'Votre produit doit être modifié — BlackStore',
      EmailService.sellerLayout({
        lines: [
          hello,
          `Votre produit ${product} n'a pas été validé. Motif :`,
          `<em>${EmailService.escapeHtml(note ?? '')}</em>`,
          'Corrigez-le depuis votre espace vendeur, puis soumettez-le à nouveau.',
        ],
        button: { label: 'Modifier mon produit', url: `${appUrl}/vendeur/produits` },
      }),
    );
  }

  /** Fichier refusé par l'antivirus (il a déjà été supprimé). */
  async sendSellerFileInfected(to: string, firstName: string, productName: string, threat: string): Promise<void> {
    const appUrl = this.configService.get<string>('SELLER_APP_URL', 'http://localhost:3002').replace(/\/+$/, '');
    await this.sendSellerMail(
      to,
      'Fichier refusé par l’antivirus — BlackStore',
      EmailService.sellerLayout({
        lines: [
          `Bonjour ${EmailService.escapeHtml(firstName)},`,
          `L'antivirus a détecté une menace (${EmailService.escapeHtml(threat)}) dans le fichier de votre produit « ${EmailService.escapeHtml(productName)} ». Le fichier a été supprimé et le produit n'est pas visible.`,
          'Vérifiez votre fichier avec un antivirus à jour, puis envoyez une version saine depuis votre espace vendeur.',
        ],
        button: { label: 'Mes produits', url: `${appUrl}/vendeur/produits` },
      }),
    );
  }
}
