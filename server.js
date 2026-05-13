// ─────────────────────────────────────────────────────────
//  server.js — Habashia Nigelle · Backend Node.js / Express
//  Commandes : npm install  →  node server.js
// ─────────────────────────────────────────────────────────
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

// Initialise Stripe avec la clé secrète stockée dans .env
// Ne jamais exposer cette clé côté client
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ───────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Sert les fichiers statiques (index.html, success.html…)
app.use(express.static(path.join(__dirname)));

// ── POST /create-payment-intent ───────────────────────────
// Crée un PaymentIntent Stripe pour 9,99 € et renvoie
// le clientSecret au frontend pour confirmer le paiement.
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { email, shipping } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount:        999,   // montant en centimes d'euro (9,99 €)
      currency:      'eur',
      receipt_email: email || undefined,

      // Adresse de livraison (visible dans le dashboard Stripe)
      ...(shipping && {
        shipping: {
          name:    `${shipping.prenom} ${shipping.nom}`,
          address: {
            line1:       shipping.adresse,
            postal_code: shipping.cp,
            city:        shipping.ville,
            country:     shipping.pays,   // code ISO 2 lettres (ex. "FR")
          },
        },
      }),

      metadata: {
        product: 'Huile de Nigelle Habashia — Éthiopie 100ml',
        source:  'habashia-nigelle.fr',
        // Copie des infos de livraison dans les métadonnées Stripe
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

// ── Démarrage ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✔  Serveur démarré → http://localhost:${PORT}`);
  console.log(`   Environnement    : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Clé Stripe       : ${process.env.STRIPE_SECRET_KEY ? 'chargée ✔' : '⚠  manquante — vérifiez .env'}\n`);
});
