// ─────────────────────────────────────────────────────────
//  server.js — Habashia Nigelle · Backend Node.js / Express
//  Commandes : npm install  →  node server.js
// ─────────────────────────────────────────────────────────
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const nodemailer = require('nodemailer');

// Initialise Stripe avec la clé secrète stockée dans .env
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ───────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Sert les fichiers statiques (index.html, checkout.html, success.html…)
app.use(express.static(path.join(__dirname)));

// ── Transporteur Nodemailer (Gmail) ───────────────────────
// Utilise un mot de passe d'application (pas le mot de passe Gmail principal)
// Génération : https://myaccount.google.com/apppasswords
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// ── POST /create-payment-intent ───────────────────────────
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { email, shipping } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount:        999,   // centimes (9,99 €)
      currency:      'eur',
      receipt_email: email || undefined,

      ...(shipping && {
        shipping: {
          name:    `${shipping.prenom} ${shipping.nom}`,
          address: {
            line1:       shipping.adresse,
            postal_code: shipping.cp,
            city:        shipping.ville,
            country:     shipping.pays,
          },
        },
      }),

      metadata: {
        product: 'Huile de Nigelle Habashia — Éthiopie 100ml',
        source:  'habashia-nigelle.fr',
        ...(shipping && {
          livraison_nom:   `${shipping.prenom} ${shipping.nom}`,
          livraison_rue:   shipping.adresse,
          livraison_cp:    shipping.cp,
          livraison_ville: shipping.ville,
          livraison_pays:  shipping.pays,
        }),
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /send-confirmation ───────────────────────────────
// Appelé par le frontend juste après un paiement réussi.
// Reçoit : { shipping, email, paymentIntentId }
// Envoie un e-mail récapitulatif à l'adresse de notification.
app.post('/send-confirmation', async (req, res) => {
  try {
    const { shipping, email, paymentIntentId } = req.body;

    // Validation minimale
    if (!shipping || !shipping.prenom) {
      return res.status(400).json({ error: 'Données de commande manquantes.' });
    }

    // Table ISO → nom de pays (identique au frontend)
    const countries = {
      FR: 'France',        BE: 'Belgique',       CH: 'Suisse',
      LU: 'Luxembourg',    CA: 'Canada',          MA: 'Maroc',
      DZ: 'Algérie',       TN: 'Tunisie',         SN: 'Sénégal',
      CI: "Côte d'Ivoire", CM: 'Cameroun',        DE: 'Allemagne',
      ES: 'Espagne',       IT: 'Italie',          NL: 'Pays-Bas',
      GB: 'Royaume-Uni',   PT: 'Portugal',
    };

    const paysLabel = countries[shipping.pays] || shipping.pays;

    // Date et heure de la commande (Paris)
    const now = new Date();
    const dateLabel = now.toLocaleDateString('fr-FR', {
      timeZone: 'Europe/Paris',
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const heureLabel = now.toLocaleTimeString('fr-FR', {
      timeZone: 'Europe/Paris',
      hour: '2-digit', minute: '2-digit',
    });

    // ── Corps de l'e-mail (HTML) ──────────────────────────
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Helvetica Neue',Arial,sans-serif;color:#f5f0e8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

        <!-- En-tête -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a1a,#111);border:1px solid rgba(201,168,76,.25);border-radius:10px 10px 0 0;padding:36px 40px 28px;text-align:center;">
            <div style="font-size:11px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:#c9a84c;margin-bottom:12px;">
              Nouvelle commande
            </div>
            <div style="font-size:28px;font-weight:300;color:#f5f0e8;letter-spacing:1px;">
              Habashia <em style="font-style:italic;color:rgba(245,240,232,.55);">Nigelle</em>
            </div>
            <div style="width:48px;height:1px;background:linear-gradient(90deg,transparent,#c9a84c,transparent);margin:18px auto 0;"></div>
          </td>
        </tr>

        <!-- Icône succès -->
        <tr>
          <td style="background:#131313;border-left:1px solid rgba(201,168,76,.25);border-right:1px solid rgba(201,168,76,.25);padding:28px 40px 20px;text-align:center;">
            <div style="display:inline-block;width:64px;height:64px;border-radius:50%;background:rgba(74,94,58,.2);border:1px solid rgba(74,94,58,.4);line-height:64px;font-size:28px;text-align:center;">
              ✓
            </div>
            <div style="font-size:11px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#4a5e3a;background:rgba(74,94,58,.12);border:1px solid rgba(74,94,58,.3);display:inline-block;padding:6px 16px;border-radius:50px;margin-top:14px;">
              Paiement confirmé
            </div>
          </td>
        </tr>

        <!-- Infos client -->
        <tr>
          <td style="background:#131313;border-left:1px solid rgba(201,168,76,.25);border-right:1px solid rgba(201,168,76,.25);padding:0 40px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">

              <!-- Section : Client -->
              <tr>
                <td colspan="2" style="padding:20px 0 10px;">
                  <div style="font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:rgba(201,168,76,.7);padding-bottom:8px;border-bottom:1px solid rgba(201,168,76,.15);">
                    Client
                  </div>
                </td>
              </tr>
              <tr>
                <td style="font-size:13px;color:rgba(245,240,232,.5);padding:7px 0;width:140px;">Nom complet</td>
                <td style="font-size:13px;color:#f5f0e8;font-weight:500;padding:7px 0;">${shipping.prenom} ${shipping.nom}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:rgba(245,240,232,.5);padding:7px 0;">E-mail</td>
                <td style="font-size:13px;color:#f5f0e8;padding:7px 0;">${email || '—'}</td>
              </tr>

              <!-- Section : Livraison -->
              <tr>
                <td colspan="2" style="padding:20px 0 10px;">
                  <div style="font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:rgba(201,168,76,.7);padding-bottom:8px;border-bottom:1px solid rgba(201,168,76,.15);">
                    Adresse de livraison
                  </div>
                </td>
              </tr>
              <tr>
                <td style="font-size:13px;color:rgba(245,240,232,.5);padding:7px 0;vertical-align:top;">Adresse</td>
                <td style="font-size:13px;color:#f5f0e8;padding:7px 0;line-height:1.7;">
                  ${shipping.adresse}<br>
                  ${shipping.cp} ${shipping.ville}<br>
                  <span style="color:rgba(245,240,232,.55);font-size:12px;">${paysLabel}</span>
                </td>
              </tr>

              <!-- Section : Commande -->
              <tr>
                <td colspan="2" style="padding:20px 0 10px;">
                  <div style="font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:rgba(201,168,76,.7);padding-bottom:8px;border-bottom:1px solid rgba(201,168,76,.15);">
                    Détails de la commande
                  </div>
                </td>
              </tr>
              <tr>
                <td style="font-size:13px;color:rgba(245,240,232,.5);padding:7px 0;">Produit</td>
                <td style="font-size:13px;color:#f5f0e8;padding:7px 0;">Huile de Nigelle Habashia — 100 ml</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:rgba(245,240,232,.5);padding:7px 0;">Date</td>
                <td style="font-size:13px;color:#f5f0e8;padding:7px 0;">${dateLabel}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:rgba(245,240,232,.5);padding:7px 0;">Heure</td>
                <td style="font-size:13px;color:#f5f0e8;padding:7px 0;">${heureLabel} (heure de Paris)</td>
              </tr>
              ${paymentIntentId ? `
              <tr>
                <td style="font-size:13px;color:rgba(245,240,232,.5);padding:7px 0;">Réf. Stripe</td>
                <td style="font-size:11px;color:rgba(245,240,232,.4);padding:7px 0;word-break:break-all;">${paymentIntentId}</td>
              </tr>` : ''}

            </table>
          </td>
        </tr>

        <!-- Montant total -->
        <tr>
          <td style="background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.25);border-top:none;border-radius:0;padding:20px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:13px;color:rgba(245,240,232,.6);font-weight:500;">Montant encaissé</td>
                <td align="right" style="font-size:26px;font-weight:300;color:#c9a84c;font-family:Georgia,serif;">9,99 €</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Pied de page -->
        <tr>
          <td style="background:#0d0d0d;border:1px solid rgba(201,168,76,.15);border-top:none;border-radius:0 0 10px 10px;padding:20px 40px;text-align:center;">
            <div style="font-size:11px;color:rgba(245,240,232,.25);letter-spacing:1px;">
              © 2024 Habashia Nigelle ·
              <a href="mailto:contact@habashia-nigelle.fr" style="color:#c9a84c;text-decoration:none;">contact@habashia-nigelle.fr</a>
            </div>
            <div style="font-size:10px;color:rgba(245,240,232,.15);margin-top:6px;letter-spacing:.5px;">
              E-mail généré automatiquement — ne pas répondre directement
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // ── E-mail client (confirmation de commande) ─────────
    const htmlClient = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Helvetica Neue',Arial,sans-serif;color:#f5f0e8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

        <!-- En-tête -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a1a,#111);border:1px solid rgba(201,168,76,.25);border-radius:10px 10px 0 0;padding:40px 40px 32px;text-align:center;">
            <div style="font-size:10px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:rgba(201,168,76,.65);margin-bottom:14px;">
              Huile de Nigelle · Éthiopie
            </div>
            <div style="font-size:32px;font-weight:300;color:#f5f0e8;letter-spacing:1px;line-height:1.2;">
              Habashia <em style="font-style:italic;color:rgba(245,240,232,.45);">Nigelle</em>
            </div>
            <div style="width:56px;height:1px;background:linear-gradient(90deg,transparent,#c9a84c,transparent);margin:20px auto 0;"></div>
          </td>
        </tr>

        <!-- Message de bienvenue -->
        <tr>
          <td style="background:#131313;border-left:1px solid rgba(201,168,76,.25);border-right:1px solid rgba(201,168,76,.25);padding:36px 40px 28px;text-align:center;">
            <div style="display:inline-block;width:68px;height:68px;border-radius:50%;background:rgba(74,94,58,.18);border:1px solid rgba(74,94,58,.38);line-height:68px;font-size:30px;text-align:center;margin-bottom:22px;">
              ✓
            </div>
            <div style="font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#4a5e3a;background:rgba(74,94,58,.1);border:1px solid rgba(74,94,58,.28);display:inline-block;padding:6px 18px;border-radius:50px;margin-bottom:26px;">
              Commande confirmée
            </div>
            <div style="font-size:22px;font-weight:300;color:#f5f0e8;line-height:1.45;margin-bottom:16px;">
              Merci, <strong style="font-weight:500;color:#c9a84c;">${shipping.prenom}</strong> !
            </div>
            <div style="font-size:14px;font-weight:300;color:rgba(245,240,232,.62);line-height:1.85;max-width:420px;margin:0 auto;">
              Votre commande a bien été reçue et votre paiement confirmé.
              Nous préparons votre flacon d'huile de nigelle Habashia avec le plus grand soin
              et vous le ferons parvenir dans les meilleurs délais.
            </div>
          </td>
        </tr>

        <!-- Récapitulatif de commande -->
        <tr>
          <td style="background:#131313;border-left:1px solid rgba(201,168,76,.25);border-right:1px solid rgba(201,168,76,.25);padding:0 40px 8px;">

            <!-- Titre section -->
            <div style="font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:rgba(201,168,76,.65);padding:20px 0 12px;border-bottom:1px solid rgba(201,168,76,.12);margin-bottom:4px;">
              Récapitulatif de commande
            </div>

            <!-- Ligne produit -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
              <tr>
                <!-- Pastille produit -->
                <td style="width:52px;vertical-align:middle;padding-right:14px;">
                  <div style="width:52px;height:52px;border-radius:8px;background:linear-gradient(135deg,#1e1e1e,#2a2a2a);border:1px solid rgba(201,168,76,.2);display:flex;align-items:center;justify-content:center;text-align:center;line-height:52px;font-size:22px;">
                    🫙
                  </div>
                </td>
                <td style="vertical-align:middle;">
                  <div style="font-size:14px;font-weight:500;color:#f5f0e8;margin-bottom:3px;">Huile de Nigelle Habashia</div>
                  <div style="font-size:12px;color:rgba(245,240,232,.45);line-height:1.6;">
                    Éthiopie · Hautes terres · Flacon verre ambré 100 ml<br>
                    1ère pression à froid · Non raffinée
                  </div>
                </td>
                <td style="vertical-align:middle;text-align:right;white-space:nowrap;">
                  <div style="font-size:11px;color:rgba(245,240,232,.4);margin-bottom:3px;">Qté : 1</div>
                  <div style="font-size:20px;font-weight:300;color:#c9a84c;font-family:Georgia,serif;">9,99 €</div>
                </td>
              </tr>
            </table>

            <!-- Séparateur -->
            <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,.15),transparent);margin:4px 0 12px;"></div>

            <!-- Lignes total -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:13px;color:rgba(245,240,232,.45);padding:5px 0;">Sous-total</td>
                <td align="right" style="font-size:13px;color:rgba(245,240,232,.7);padding:5px 0;">9,99 €</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:rgba(245,240,232,.45);padding:5px 0;">Livraison</td>
                <td align="right" style="font-size:13px;color:#5c7249;padding:5px 0;">Offerte</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Total -->
        <tr>
          <td style="background:rgba(201,168,76,.06);border-left:1px solid rgba(201,168,76,.25);border-right:1px solid rgba(201,168,76,.25);padding:16px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:13px;color:rgba(245,240,232,.65);font-weight:500;">Total payé</td>
                <td align="right" style="font-size:28px;font-weight:300;color:#c9a84c;font-family:Georgia,serif;">9,99 €</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Adresse de livraison -->
        <tr>
          <td style="background:#131313;border-left:1px solid rgba(201,168,76,.25);border-right:1px solid rgba(201,168,76,.25);padding:24px 40px;">
            <div style="font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:rgba(201,168,76,.65);padding-bottom:12px;border-bottom:1px solid rgba(201,168,76,.12);margin-bottom:14px;">
              Adresse de livraison
            </div>
            <div style="font-size:14px;color:rgba(245,240,232,.75);line-height:1.85;">
              <strong style="color:#f5f0e8;font-weight:500;">${shipping.prenom} ${shipping.nom}</strong><br>
              ${shipping.adresse}<br>
              ${shipping.cp} ${shipping.ville}<br>
              <span style="color:rgba(245,240,232,.45);font-size:12px;">${paysLabel}</span>
            </div>
          </td>
        </tr>

        <!-- Délai de livraison -->
        <tr>
          <td style="background:#0e0e0e;border-left:1px solid rgba(201,168,76,.25);border-right:1px solid rgba(201,168,76,.25);padding:20px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:40px;vertical-align:middle;padding-right:14px;">
                  <div style="width:40px;height:40px;border-radius:50%;background:rgba(201,168,76,.08);border:1px solid rgba(201,168,76,.2);text-align:center;line-height:40px;font-size:18px;">🚚</div>
                </td>
                <td style="vertical-align:middle;">
                  <div style="font-size:13px;font-weight:500;color:#f5f0e8;margin-bottom:2px;">Livraison estimée</div>
                  <div style="font-size:12px;color:rgba(245,240,232,.48);line-height:1.6;">
                    Expédition sous <strong style="color:#c9a84c;">48–72 h ouvrées</strong> à compter de la confirmation.<br>
                    Vous recevrez un avis d'expédition dès que votre colis sera pris en charge.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Message chaleureux -->
        <tr>
          <td style="background:#131313;border-left:1px solid rgba(201,168,76,.25);border-right:1px solid rgba(201,168,76,.25);padding:28px 40px 32px;text-align:center;">
            <div style="width:40px;height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,.3),transparent);margin:0 auto 22px;"></div>
            <div style="font-size:15px;font-style:italic;font-weight:300;color:rgba(245,240,232,.68);line-height:1.9;max-width:400px;margin:0 auto;">
              « Chaque flacon Habashia est préparé avec passion et respect du produit.
              Nous espérons que cette huile vous apportera autant de bienfaits
              qu'elle en recèle. »
            </div>
            <div style="font-size:12px;color:rgba(245,240,232,.35);margin-top:16px;letter-spacing:.5px;">
              — L'équipe Habashia Nigelle
            </div>
            <div style="width:40px;height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,.3),transparent);margin:22px auto 0;"></div>
          </td>
        </tr>

        <!-- Badges de confiance -->
        <tr>
          <td style="background:#101010;border-left:1px solid rgba(201,168,76,.25);border-right:1px solid rgba(201,168,76,.25);padding:18px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:0 8px;">
                  <div style="font-size:18px;margin-bottom:5px;">🛡️</div>
                  <div style="font-size:10px;color:rgba(245,240,232,.35);letter-spacing:.5px;">Satisfait ou remboursé<br>30 jours</div>
                </td>
                <td align="center" style="padding:0 8px;">
                  <div style="font-size:18px;margin-bottom:5px;">🔒</div>
                  <div style="font-size:10px;color:rgba(245,240,232,.35);letter-spacing:.5px;">Paiement<br>100% sécurisé</div>
                </td>
                <td align="center" style="padding:0 8px;">
                  <div style="font-size:18px;margin-bottom:5px;">🌿</div>
                  <div style="font-size:10px;color:rgba(245,240,232,.35);letter-spacing:.5px;">100% naturelle<br>sans additifs</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Pied de page -->
        <tr>
          <td style="background:#0d0d0d;border:1px solid rgba(201,168,76,.15);border-top:none;border-radius:0 0 10px 10px;padding:22px 40px;text-align:center;">
            <div style="font-size:12px;color:rgba(245,240,232,.3);line-height:1.8;">
              Une question ? Écrivez-nous à
              <a href="mailto:contact@habashia-nigelle.fr" style="color:#c9a84c;text-decoration:none;">contact@habashia-nigelle.fr</a>
            </div>
            <div style="font-size:10px;color:rgba(245,240,232,.15);margin-top:8px;letter-spacing:.5px;">
              © 2024 Habashia Nigelle · Cet e-mail a été généré automatiquement suite à votre commande.
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // ── Envoi des deux e-mails en parallèle ──────────────
    await Promise.all([
      // 1. Notification interne → vendeur
      transporter.sendMail({
        from:    `"Habashia Nigelle" <${process.env.GMAIL_USER}>`,
        to:      'byas1644@gmail.com',
        subject: `🛍️ Nouvelle commande — ${shipping.prenom} ${shipping.nom} — 9,99 €`,
        html,
        text: [
          '=== NOUVELLE COMMANDE — HABASHIA NIGELLE ===',
          '',
          `Client       : ${shipping.prenom} ${shipping.nom}`,
          `E-mail       : ${email || '—'}`,
          '',
          '--- Adresse de livraison ---',
          shipping.adresse,
          `${shipping.cp} ${shipping.ville}`,
          paysLabel,
          '',
          '--- Commande ---',
          'Produit      : Huile de Nigelle Habashia — 100 ml',
          `Date         : ${dateLabel} à ${heureLabel}`,
          `Montant      : 9,99 €`,
          paymentIntentId ? `Réf. Stripe  : ${paymentIntentId}` : '',
          '',
          '============================================',
        ].filter(Boolean).join('\n'),
      }),

      // 2. Confirmation → client (uniquement si un e-mail a été fourni)
      ...(email ? [transporter.sendMail({
        from:    `"Habashia Nigelle" <${process.env.GMAIL_USER}>`,
        to:      email,
        subject: 'Confirmation de votre commande — Habashia Nigelle',
        html:    htmlClient,
        text: [
          `Bonjour ${shipping.prenom},`,
          '',
          'Merci pour votre commande ! Votre paiement a été confirmé.',
          '',
          '--- Votre commande ---',
          'Produit  : Huile de Nigelle Habashia — Éthiopie 100 ml',
          'Quantité : 1',
          'Montant  : 9,99 €',
          'Livraison: Offerte',
          '',
          '--- Adresse de livraison ---',
          `${shipping.prenom} ${shipping.nom}`,
          shipping.adresse,
          `${shipping.cp} ${shipping.ville}`,
          paysLabel,
          '',
          'Délai de livraison : 48–72 h ouvrées après expédition.',
          'Vous recevrez un avis dès que votre colis sera pris en charge.',
          '',
          'Une question ? contact@habashia-nigelle.fr',
          '',
          '— L\'équipe Habashia Nigelle',
        ].join('\n'),
      })] : []),
    ]);

    console.log(`✉  E-mails envoyés — vendeur + client (${email || 'pas d\'e-mail client'})`);
    res.json({ sent: true });

  } catch (err) {
    console.error('Nodemailer error:', err.message);
    // On renvoie une réponse 200 quand même : l'échec e-mail
    // ne doit pas bloquer la page de succès côté client
    res.status(500).json({ error: err.message });
  }
});

// ── Démarrage ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✔  Serveur démarré → http://localhost:${PORT}`);
  console.log(`   Environnement    : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Clé Stripe       : ${process.env.STRIPE_SECRET_KEY ? 'chargée ✔' : '⚠  manquante — vérifiez .env'}`);
  console.log(`   Gmail expéditeur : ${process.env.GMAIL_USER || '⚠  manquant — vérifiez .env'}\n`);
});
