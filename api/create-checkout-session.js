// api/create-checkout-session.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // Solo permitimos POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { plan, billing } = req.body;

    const priceMap = {
      pro: {
        monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
        yearly:  process.env.STRIPE_PRICE_PRO_YEARLY,
      },
      premier: {
        monthly: process.env.STRIPE_PRICE_PREMIER_MONTHLY,
        yearly:  process.env.STRIPE_PRICE_PREMIER_YEARLY,
      }
    };

    const priceId = priceMap[plan]?.[billing];

    if (!priceId) {
      return res.status(400).json({ error: 'Plan o billing no válido' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/planes`,
      metadata: { plan, billing },
    });

    return res.status(200).json({ url: session.url });

  } catch (error) {
    console.error('Stripe error:', error.message || error);
    return res.status(500).json({ 
      error: 'Error al crear la sesión de pago' 
    });
  }
}