// api/create-checkout-session.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(request) {
  // Solo permitimos método POST
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método no permitido' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { plan, billing } = await request.json();

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
      return new Response(
        JSON.stringify({ error: 'Plan o billing no válido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/planes`,
      metadata: { plan, billing },
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Stripe error:', error);
    return new Response(
      JSON.stringify({ error: 'Error al crear la sesión de pago' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}