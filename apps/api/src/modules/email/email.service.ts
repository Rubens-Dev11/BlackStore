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
   * Lien personnel de téléchargement : il ouvre la page du lien sur la boutique, où le client appuie sur
   * « Télécharger ». Les messageries qui ouvrent les liens pour les analyser ne consomment donc pas les
   * téléchargements (seul le bouton les compte).
   */
  private downloadUrl(token: string): string {
    return `${this.storefrontUrl()}/telechargement/${token}`;
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
              <strong>${EmailService.escapeHtml(item.name)}</strong><br>
              <a href="${this.downloadUrl(item.token)}">Télécharger</a>
              (${item.maxDownloads} téléchargements, jusqu'au ${EmailService.formatExpiry(item.expiresAt)})
            </li>
          `,
        )
        .join('');

      const html = `
        <h2>Bonjour ${EmailService.escapeHtml(customerName)},</h2>
        <p>Merci pour votre achat ! Voici vos liens de téléchargement :</p>
        <ul>${productList}</ul>
        <p>Retrouvez tous vos achats à tout moment dans <a href="${this.storefrontUrl()}/mon-espace">votre espace client</a>.</p>
        <p>Un problème avec un fichier ? <a href="${this.storefrontUrl()}/contact?sujet=order">Écrivez-nous</a>.
          Produit inutilisable ou non conforme ? <a href="${this.storefrontUrl()}/remboursements/demande">Demandez un remboursement</a> dans les 7 jours.</p>
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
          <td style="padding:8px;border:1px solid #333;">${EmailService.escapeHtml(item.productName)}</td>
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
            <h2>Merci ${EmailService.escapeHtml(data.buyerName)} !</h2>
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
              Ces liens sont personnels : ne les partagez pas. Retrouvez tous vos achats dans
              <a href="${this.storefrontUrl()}/mon-espace" style="color:#f97316;">votre espace client</a>.
            </p>
            <p style="color:#999;font-size:12px;">
              Un problème avec votre commande ?
              <a href="${this.storefrontUrl()}/contact?sujet=order&amp;commande=${encodeURIComponent(data.orderNumber)}" style="color:#f97316;">Écrivez-nous</a>.
              Produit inutilisable ou non conforme ?
              <a href="${this.storefrontUrl()}/remboursements/demande?commande=${encodeURIComponent(data.orderNumber)}" style="color:#f97316;">Demandez un remboursement</a>
              dans les 7 jours (voir la <a href="${this.storefrontUrl()}/remboursements" style="color:#f97316;">politique de remboursement</a>).
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

  /** Résultat de la vérification d'identité d'un vendeur. */
  async sendSellerIdentityReview(to: string, firstName: string, decision: 'approved' | 'rejected', note?: string | null): Promise<void> {
    const appUrl = this.configService.get<string>('SELLER_APP_URL', 'http://localhost:3002').replace(/\/+$/, '');
    const hello = `Bonjour ${EmailService.escapeHtml(firstName)},`;
    if (decision === 'approved') {
      await this.sendSellerMail(
        to,
        'Votre identité est vérifiée — BlackStore',
        EmailService.sellerLayout({
          lines: [hello, 'Votre identité est vérifiée : vous pourrez retirer vos gains vers Mobile Money.'],
          button: { label: 'Accéder à mon espace vendeur', url: `${appUrl}/vendeur` },
        }),
      );
      return;
    }
    await this.sendSellerMail(
      to,
      'Vérification d’identité à refaire — BlackStore',
      EmailService.sellerLayout({
        lines: [
          hello,
          'Nous n’avons pas pu vérifier votre identité. Motif :',
          `<em>${EmailService.escapeHtml(note ?? '')}</em>`,
          'Vos photos ont été effacées. Envoyez de nouvelles photos depuis votre espace vendeur.',
        ],
        button: { label: 'Refaire ma vérification', url: `${appUrl}/vendeur/identite` },
      }),
    );
  }

  // ── Portefeuille des vendeurs ───────────────────────────────────────

  private static fcfa(amount: number): string {
    return `${amount.toLocaleString('fr-FR')} FCFA`;
  }

  private storefrontUrl(): string {
    return this.configService.get<string>('STOREFRONT_URL', 'http://localhost:3001').replace(/\/+$/, '');
  }

  private sellerAppUrl(): string {
    return this.configService.get<string>('SELLER_APP_URL', 'http://localhost:3002').replace(/\/+$/, '');
  }

  /** Nouvelle vente : montant crédité (commission déduite) et date à laquelle il devient retirable. */
  async sendSellerSale(to: string, firstName: string, productName: string, amount: number, availableAt: Date): Promise<void> {
    const date = availableAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Douala' });
    await this.sendSellerMail(
      to,
      `Nouvelle vente : ${productName} — BlackStore`,
      EmailService.sellerLayout({
        lines: [
          `Bonjour ${EmailService.escapeHtml(firstName)},`,
          `Bonne nouvelle : « ${EmailService.escapeHtml(productName)} » vient d'être acheté.`,
          `<strong>${EmailService.fcfa(amount)}</strong> ont été ajoutés à votre solde (commission BlackStore déduite). Ils seront retirables à partir du ${date}.`,
        ],
        button: { label: 'Voir mes gains', url: `${this.sellerAppUrl()}/vendeur/gains` },
      }),
    );
  }

  /** Reçu d'un retrait payé. */
  async sendSellerWithdrawalPaid(
    to: string,
    firstName: string,
    withdrawal: { id: string; amount: number; operator: string; phone: string; accountName: string; transferReference: string | null; processedAt: Date | null },
  ): Promise<void> {
    const operator = withdrawal.operator === 'orange' ? 'Orange Money' : 'MTN Mobile Money';
    const date = (withdrawal.processedAt ?? new Date()).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Douala' });
    await this.sendSellerMail(
      to,
      `Retrait de ${EmailService.fcfa(withdrawal.amount)} envoyé — BlackStore`,
      EmailService.sellerLayout({
        lines: [
          `Bonjour ${EmailService.escapeHtml(firstName)},`,
          `Votre retrait de <strong>${EmailService.fcfa(withdrawal.amount)}</strong> a été envoyé sur votre compte ${operator}.`,
          `Numéro : ${EmailService.escapeHtml(withdrawal.phone)} (${EmailService.escapeHtml(withdrawal.accountName)})<br>` +
            `Référence de la transaction : ${EmailService.escapeHtml(withdrawal.transferReference ?? '')}<br>` +
            `Date : ${date}<br>Reçu n° ${withdrawal.id.slice(0, 8).toUpperCase()}`,
          'Gardez cet e-mail comme reçu. Vous pouvez aussi l’imprimer depuis votre espace vendeur.',
        ],
        button: { label: 'Voir le reçu', url: `${this.sellerAppUrl()}/vendeur/gains/recus/${withdrawal.id}` },
      }),
    );
  }

  /** Retrait refusé : l'argent est revenu dans le solde. */
  async sendSellerWithdrawalRejected(to: string, firstName: string, amount: number, note: string): Promise<void> {
    await this.sendSellerMail(
      to,
      'Retrait refusé — BlackStore',
      EmailService.sellerLayout({
        lines: [
          `Bonjour ${EmailService.escapeHtml(firstName)},`,
          `Votre demande de retrait de ${EmailService.fcfa(amount)} n'a pas pu être payée. Motif :`,
          `<em>${EmailService.escapeHtml(note)}</em>`,
          'Le montant est revenu dans votre solde : vous pouvez faire une nouvelle demande.',
        ],
        button: { label: 'Voir mes gains', url: `${this.sellerAppUrl()}/vendeur/gains` },
      }),
    );
  }

  // ─────────────────────────────────────────────
  // Espace client
  // ─────────────────────────────────────────────

  /** Lien de connexion à l'espace client (sans mot de passe). */
  async sendClientLoginLink(to: string, link: string, minutes: number): Promise<void> {
    await this.sendBuyerMail(
      to,
      'Votre lien de connexion à votre espace — BlackStore',
      EmailService.sellerLayout({
        lines: [
          'Bonjour,',
          'Voici votre lien pour ouvrir votre espace client : vous y retrouvez tous vos achats, vos liens de téléchargement et vos demandes de remboursement.',
        ],
        button: { label: 'Ouvrir mon espace', url: link },
        note: `Ce lien est valable ${minutes} minutes et ne sert qu'une fois. Vous n'avez rien demandé ? Ignorez cet e-mail : personne ne peut ouvrir votre espace sans ce lien.`,
      }),
    );
  }

  // ─────────────────────────────────────────────
  // Litiges (demandes de remboursement)
  // ─────────────────────────────────────────────

  private async sendBuyerMail(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.fromAddress, to, subject, html });
      this.logger.log(`E-mail client « ${subject} » envoyé à ${to}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Échec envoi e-mail client à ${to}: ${message}`);
    }
  }

  private static multiline(value: string): string {
    return EmailService.escapeHtml(value).replace(/\n/g, '<br>');
  }

  private static frenchDate(date: Date): string {
    return date.toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Douala' });
  }

  /** « +237699001234 » → « +2376•••••234 ». */
  private static maskPhone(phone: string): string {
    return phone.length > 8 ? `${phone.slice(0, 5)}•••••${phone.slice(-3)}` : phone;
  }

  /** Accusé de réception d'une demande de remboursement, avec sa référence. */
  async sendDisputeReceived(
    to: string,
    name: string,
    dispute: { reference: string; productName: string; reasonLabel: string; sellerDeadline: Date | null },
  ): Promise<void> {
    await this.sendBuyerMail(
      to,
      `Demande de remboursement ${dispute.reference} enregistrée — BlackStore`,
      EmailService.sellerLayout({
        lines: [
          `Bonjour ${EmailService.escapeHtml(name)},`,
          `Nous avons bien reçu votre demande de remboursement pour « ${EmailService.escapeHtml(dispute.productName)} » (${EmailService.escapeHtml(dispute.reasonLabel)}).`,
          `Référence : <strong>${dispute.reference}</strong>`,
          dispute.sellerDeadline
            ? `Le vendeur a jusqu'au ${EmailService.frenchDate(dispute.sellerDeadline)} pour vous répondre ou corriger son produit. Notre équipe prend ensuite la décision et vous écrit, en général sous 5 jours ouvrés.`
            : 'Notre équipe examine votre demande et vous répond par e-mail, en général sous 5 jours ouvrés.',
          'Si la demande est acceptée, le montant vous est renvoyé par Mobile Money sous 10 jours ouvrés.',
        ],
        note: `Gardez cette référence : indiquez-la si vous nous écrivez (${this.storefrontUrl()}/contact).`,
      }),
    );
  }

  /** Le vendeur est prévenu d'un litige sur son produit et du délai pour répondre. */
  async sendSellerDisputeOpened(
    to: string,
    firstName: string,
    dispute: { reference: string; productName: string; reasonLabel: string; description: string; deadline: Date },
  ): Promise<void> {
    await this.sendSellerMail(
      to,
      `Litige ${dispute.reference} sur « ${dispute.productName} » : répondez sous 5 jours — BlackStore`,
      EmailService.sellerLayout({
        lines: [
          `Bonjour ${EmailService.escapeHtml(firstName)},`,
          `Un acheteur demande le remboursement de « ${EmailService.escapeHtml(dispute.productName)} ». Motif : ${EmailService.escapeHtml(dispute.reasonLabel)}.`,
          `<em>${EmailService.multiline(dispute.description)}</em>`,
          `Répondez avant le <strong>${EmailService.frenchDate(dispute.deadline)}</strong> : expliquez la situation, corrigez votre produit si besoin (le nouveau fichier est analysé puis livré), ou acceptez le remboursement. Sans réponse, notre équipe décidera seule.`,
          'Pendant le litige, le montant de cette vente reste bloqué dans votre solde.',
        ],
        button: { label: 'Répondre au litige', url: `${this.sellerAppUrl()}/vendeur/litiges` },
      }),
    );
  }

  /** Décision sur la demande : remboursement accordé (montant, compte) ou refus (motif). */
  async sendDisputeDecision(
    to: string,
    name: string,
    decision: {
      reference: string;
      productName: string;
      accepted: boolean;
      amount: number;
      operatorLabel: string;
      phone: string;
      note: string | null;
    },
  ): Promise<void> {
    const product = `« ${EmailService.escapeHtml(decision.productName)} »`;
    const note = decision.note ? [`<em>${EmailService.multiline(decision.note)}</em>`] : [];
    const html = decision.accepted
      ? EmailService.sellerLayout({
          lines: [
            `Bonjour ${EmailService.escapeHtml(name)},`,
            `Votre demande ${decision.reference} concernant ${product} est <strong>acceptée</strong>.`,
            ...note,
            `Nous vous renvoyons <strong>${EmailService.fcfa(decision.amount)}</strong> sur votre compte ${EmailService.escapeHtml(decision.operatorLabel)} (${EmailService.maskPhone(decision.phone)}) sous 10 jours ouvrés. Vous recevrez un e-mail avec la référence de l'envoi.`,
            'Les liens de téléchargement de ce produit ne fonctionnent plus.',
          ],
        })
      : EmailService.sellerLayout({
          lines: [
            `Bonjour ${EmailService.escapeHtml(name)},`,
            `Après examen, votre demande ${decision.reference} concernant ${product} n'est pas acceptée. Motif :`,
            ...note,
            "Vos liens de téléchargement restent valables jusqu'à leur date d'expiration.",
          ],
          note: `Une question ? Écrivez-nous en indiquant la référence ${decision.reference} : ${this.storefrontUrl()}/contact`,
        });
    await this.sendBuyerMail(
      to,
      decision.accepted ? `Remboursement accordé (${decision.reference}) — BlackStore` : `Demande de remboursement ${decision.reference} refusée — BlackStore`,
      html,
    );
  }

  /** Issue du litige pour le vendeur : vente retirée de son solde, ou montant débloqué. */
  async sendSellerDisputeDecision(
    to: string,
    firstName: string,
    decision: { reference: string; productName: string; accepted: boolean; sellerAmount: number | null; note: string | null },
  ): Promise<void> {
    const product = `« ${EmailService.escapeHtml(decision.productName)} »`;
    const amount = decision.sellerAmount !== null ? ` (${EmailService.fcfa(decision.sellerAmount)})` : '';
    const note = decision.note ? [`<em>${EmailService.multiline(decision.note)}</em>`] : [];
    await this.sendSellerMail(
      to,
      decision.accepted ? `Litige ${decision.reference} : acheteur remboursé — BlackStore` : `Litige ${decision.reference} clos sans remboursement — BlackStore`,
      EmailService.sellerLayout({
        lines: decision.accepted
          ? [
              `Bonjour ${EmailService.escapeHtml(firstName)},`,
              `Le litige ${decision.reference} sur ${product} s'est conclu par le remboursement de l'acheteur.`,
              ...note,
              `La vente${amount} est retirée de votre solde, comme le prévoient les conditions vendeurs.`,
            ]
          : [
              `Bonjour ${EmailService.escapeHtml(firstName)},`,
              `Le litige ${decision.reference} sur ${product} est clos : l'acheteur n'est pas remboursé.`,
              ...note,
              `Le montant de la vente${amount} n'est plus bloqué : il devient retirable selon le délai de sécurité habituel.`,
            ],
        button: { label: 'Voir mes litiges', url: `${this.sellerAppUrl()}/vendeur/litiges` },
      }),
    );
  }

  /** Reçu : l'argent du remboursement a été envoyé. */
  async sendDisputeRefunded(
    to: string,
    name: string,
    refund: { reference: string; productName: string; amount: number; operatorLabel: string; phone: string; transferReference: string },
  ): Promise<void> {
    await this.sendBuyerMail(
      to,
      `Remboursement envoyé (${refund.reference}) — BlackStore`,
      EmailService.sellerLayout({
        lines: [
          `Bonjour ${EmailService.escapeHtml(name)},`,
          `Nous vous avons renvoyé <strong>${EmailService.fcfa(refund.amount)}</strong> pour « ${EmailService.escapeHtml(refund.productName)} » (demande ${refund.reference}).`,
          `Compte : ${EmailService.escapeHtml(refund.operatorLabel)} (${EmailService.maskPhone(refund.phone)})<br>` +
            `Référence de l'envoi : <strong>${EmailService.escapeHtml(refund.transferReference)}</strong>`,
          "Vous ne voyez pas l'argent sous 48 heures ? Écrivez-nous en indiquant ces références.",
        ],
        note: `${this.storefrontUrl()}/contact`,
      }),
    );
  }

  // ─────────────────────────────────────────────
  // Sauvegardes
  // ─────────────────────────────────────────────

  /** Alerte : une sauvegarde automatique a échoué. */
  async sendBackupAlert(to: string, what: string, reason: string, adminUrl: string): Promise<void> {
    await this.sendSellerMail(
      to,
      'Sauvegarde en échec — BlackStore',
      EmailService.sellerLayout({
        lines: [
          `La sauvegarde automatique de cette nuit n'a pas fonctionné : échec de ${EmailService.escapeHtml(what)}.`,
          `Motif : <em>${EmailService.escapeHtml(reason)}</em>`,
          'Le site continue de fonctionner, mais les données ne sont plus copiées tant que le problème dure.',
        ],
        button: { label: 'Voir les sauvegardes', url: adminUrl },
      }),
    );
  }

  // ─────────────────────────────────────────────
  // Formulaire de contact
  // ─────────────────────────────────────────────

  /**
   * Réponse de l'équipe à un message du formulaire de contact, avec le message d'origine en rappel.
   * Renvoie false si l'envoi échoue, pour que l'administrateur le sache.
   */
  async sendSupportReply(params: {
    to: string;
    name: string;
    topicLabel: string;
    message: string;
    reply: string;
    replyTo: string | null;
    contactUrl: string;
  }): Promise<boolean> {
    const text = (value: string) => EmailService.escapeHtml(value).replace(/\n/g, '<br>');
    const html = EmailService.sellerLayout({
      lines: [
        `Bonjour ${EmailService.escapeHtml(params.name)},`,
        text(params.reply),
        `<span style="color:#999;">Votre message (${EmailService.escapeHtml(params.topicLabel)}) :</span><br>` +
          `<span style="color:#bbb;">${text(params.message)}</span>`,
      ],
      note: params.replyTo
        ? 'Vous pouvez répondre directement à cet e-mail.'
        : `Pour nous écrire à nouveau, utilisez le formulaire de contact : ${EmailService.escapeHtml(params.contactUrl)}`,
    });
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: params.to,
        subject: 'Réponse à votre message — BlackStore',
        html,
        ...(params.replyTo ? { replyTo: params.replyTo } : {}),
      });
      this.logger.log(`Réponse au message de contact envoyée à ${params.to}`);
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Échec envoi de la réponse de contact à ${params.to}: ${message}`);
      return false;
    }
  }
}
