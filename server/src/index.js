import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = Number(process.env.PORT || 8787);
const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5180',
  'http://127.0.0.1:5180',
  'https://impact-bridge-ai-eta.vercel.app',
]);

app.use(
  cors({
    origin: (origin, callback) => {
      console.log('CORS request origin:', origin);
      const isVercelPreview =
        typeof origin === 'string' &&
        /^https:\/\/impact-bridge-ai-[a-z0-9-]+\.vercel\.app$/i.test(origin);

      if (!origin || allowedOrigins.has(origin) || isVercelPreview) {
        return callback(null, true);
      }

      return callback(new Error('Origin not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '1mb' }));
const initiatives = [
  {
    id: 'school-kits',
    category: 'Education',
    title: 'School Essentials for Every Child',
    description:
      'Help provide learning materials such as exercise books, pencils and school bags for children who need them.',
    amount: 25,
    impact:
      'Illustrative estimate: helps fund school essentials for a learner.',
  },
  {
    id: 'women-skills',
    category: 'Livelihoods',
    title: 'Skills for Women & Youth',
    description:
      'Support practical skills training that can help participants explore sustainable income opportunities.',
    amount: 40,
    impact:
      'Illustrative estimate: contributes to training materials and practice sessions.',
  },
  {
    id: 'community-health',
    category: 'Healthcare',
    title: 'Community Health Access',
    description:
      'Help community teams share basic health education and connect people with local support.',
    amount: 30,
    impact:
      'Illustrative estimate: contributes to outreach and health education resources.',
  },
];
// Read initiatives from Supabase
app.get('/api/initiatives', async (_req, res) => {
  if (!supabase) {
    return res.status(503).json({
      error: 'Supabase is not configured.',
    });
  }
  try {
    const { data, error } = await supabase
      .from('initiatives')
      .select('id, title, category, description, goal_amount, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Supabase initiatives error:', error.message);
      return res.status(500).json({
        error: 'Could not load initiatives.',
      });
    }
    return res.json({ initiatives: data });
  } catch (error) {
    console.error('Initiatives API error:', error.message);
    return res.status(500).json({
      error: 'An unexpected error occurred.',
    });
  }
});
// Health check
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    name: 'ImpactBridge AI API',
    paypalConfigured: Boolean(
      process.env.PAYPAL_CLIENT_ID &&
      process.env.PAYPAL_CLIENT_SECRET
    ),
    aiConfigured: Boolean(
      process.env.AI_API_URL && process.env.AI_API_KEY
    ),
  });
});
// AI giving guide
app.post('/api/assistant', async (req, res) => {
  const message =
    typeof req.body?.message === 'string'
      ? req.body.message.trim().slice(0, 2000)
      : '';
  if (!message) {
    return res.status(400).json({
      error: 'Please enter a question.',
    });
  }
  const list = Array.isArray(req.body?.initiatives)
    ? req.body.initiatives.slice(0, 10)
    : initiatives;
  if (process.env.AI_API_URL && process.env.AI_API_KEY) {
    try {
      const response = await fetch(process.env.AI_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.AI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are ImpactBridge AI, a careful giving guide. Only use the initiative data provided. Do not claim outcomes, funding, legitimacy, or impact are verified. Explain that estimates are illustrative and advise donors to verify organizers before paying. Never process payments or request payment credentials.',
            },
            {
              role: 'user',
              content: `Initiative data: ${JSON.stringify(list)}\nUser question: ${message}`,
            },
          ],
          temperature: 0.4,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data?.error?.message || 'AI provider request failed'
        );
      }
      const answer = data?.choices?.[0]?.message?.content;
      if (typeof answer !== 'string' || !answer.trim()) {
        throw new Error('AI provider returned no answer');
      }
      return res.json({
        answer: answer.trim(),
        mode: 'model',
      });
    } catch (error) {
      console.error('AI provider error:', error.message);
    }
  }
  // Built-in demonstration fallback when no AI provider is configured.
  const q = message.toLowerCase();
  let found = list.find((item) =>
    q.includes(String(item.category || '').toLowerCase())
  );
  if (!found) {
    found = list.find((item) =>
      String(item.title || '')
        .toLowerCase()
        .split(/\s+/)
        .some((word) => word.length > 5 && q.includes(word))
    );
  }
  if (
    !found &&
    /(women|youth|skill|livelihood|business|income)/.test(q)
  ) {
    found = list.find((item) => item.id === 'women-skills');
  }
  if (!found && /(health|medical|wellbeing|clinic)/.test(q)) {
    found = list.find((item) => item.id === 'community-health');
  }
  if (!found) {
    found = list.find((item) => item.id === 'school-kits') || list[0];
  }
  if (!found) {
    return res.json({
      answer:
        'I could not find a matching initiative in the available information. Please try again after initiatives have been configured.',
      mode: 'demo',
    });
  }
  return res.json({
    answer: `A useful starting point is "${found.title}" (${found.category}). ${found.description} Suggested example contribution: $${Number(found.amount || 25)}. ${found.impact || 'Any impact estimate is illustrative.'} This is demo guidance based on the supplied initiative data, not verification of the organizer or a guarantee of outcomes.`,
    mode: 'demo',
  });
});
// PayPal configuration check
function paypalConfig(res) {
  if (
    !process.env.PAYPAL_CLIENT_ID ||
    !process.env.PAYPAL_CLIENT_SECRET
  ) {
    res.status(503).json({
      error:
        'PayPal is not configured. Check the credentials in server/.env.',
    });
    return false;
  }
  return true;
}
// Allow only the official PayPal API hosts.
function paypalBase() {
  const base = (
    process.env.PAYPAL_BASE_URL ||
    'https://api-m.sandbox.paypal.com'
  ).replace(/\/+$/, '');
  const allowedBases = [
    'https://api-m.paypal.com',
    'https://api-m.sandbox.paypal.com',
  ];
  if (!allowedBases.includes(base)) {
    throw new Error('Invalid PayPal API base URL configuration.');
  }
  return base;
}
// Request a PayPal OAuth access token.
async function paypalAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');
  const response = await fetch(
    `${paypalBase()}/v1/oauth2/token`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description ||
      data.message ||
      `PayPal authentication failed (${response.status}).`
    );
  }
  return data.access_token;
}
// Send requests to PayPal.
async function paypalRequest(path, token, body) {
  const response = await fetch(`${paypalBase()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': randomUUID(),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data.message ||
      data.details?.[0]?.description ||
      `PayPal request failed (${response.status}).`
    );
  }
  return data;
}
// Temporary PayPal authentication test — no payment is created.
app.get('/api/paypal/connection-test', async (_req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found.' });
  }
  if (!paypalConfig(res)) return;
  try {
    await paypalAccessToken();
    return res.json({
      ok: true,
      authenticated: true,
      message:
        'PayPal authentication successful. No order or payment was created.',
    });
  } catch (error) {
    console.error(
      'PayPal authentication test failed:',
      error.message
    );
    return res.status(502).json({
      ok: false,
      authenticated: false,
      message:
        'PayPal authentication failed. Check the backend terminal for the error. No payment was created.',
    });
  }
});
// Create a PayPal order.
app.post('/api/paypal/create-order', async (req, res) => {
  if (!paypalConfig(res)) return;
  const amount = Number(req.body?.amount);
  const initiativeId = String(req.body?.initiativeId || '');
  if (
    !Number.isFinite(amount) ||
    amount < 1 ||
    amount > 10000 ||
    Math.round(amount * 100) !== amount * 100
  ) {
    return res.status(400).json({
      error:
        'Enter an amount between $1 and $10,000 with at most two decimal places.',
    });
  }
  const initiative = initiatives.find(
    (item) => item.id === initiativeId
  );
  if (!initiative) {
    return res.status(400).json({
      error: 'Select a valid initiative.',
    });
  }
  try {
    const token = await paypalAccessToken();
    const order = await paypalRequest(
      '/v2/checkout/orders',
      token,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            description: `ImpactBridge AI: ${initiative.title}`.slice(
              0,
              127
            ),
            amount: {
              currency_code: 'USD',
              value: amount.toFixed(2),
            },
            custom_id: initiativeId,
          },
        ],
        application_context: {
          brand_name: 'ImpactBridge AI',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
        },
      }
    );
    if (!order.id) {
      throw new Error('PayPal did not return an order ID.');
    }
    return res.json({ id: order.id });
  } catch (error) {
    console.error('PayPal create order error:', error.message);
    return res.status(502).json({
      error:
        'Could not create a PayPal order. Check the server credentials, environment and PayPal account eligibility.',
    });
  }
});
// Capture and verify a PayPal order.
app.post('/api/paypal/capture-order', async (req, res) => {
  if (!paypalConfig(res)) return;
  const orderID = String(req.body?.orderID || '');
  const initiativeId = String(req.body?.initiativeId || '');
  if (!/^[A-Z0-9-]{8,80}$/i.test(orderID)) {
    return res.status(400).json({
      error: 'Invalid PayPal order ID.',
    });
  }
  if (!initiatives.some((item) => item.id === initiativeId)) {
    return res.status(400).json({
      error: 'Select a valid initiative.',
    });
  }
  try {
    const token = await paypalAccessToken();
    const data = await paypalRequest(
      `/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`,
      token,
      {}
    );
    const purchaseUnit = data.purchase_units?.[0];
    const capture = purchaseUnit?.payments?.captures?.[0];
    const capturedAmount = capture?.amount?.value;
    const capturedCurrency = capture?.amount?.currency_code;
    if (
      data.status !== 'COMPLETED' ||
      capture?.status !== 'COMPLETED' ||
      !capture.id ||
      capturedAmount == null ||
      capturedCurrency !== 'USD' ||
      purchaseUnit?.custom_id !== initiativeId
    ) {
      return res.status(409).json({
        error:
          'PayPal has not confirmed a completed payment matching this initiative.',
        status: data.status || 'UNKNOWN',
      });
    }
    return res.json({
      status: 'COMPLETED',
      orderID: data.id,
      captureID: capture.id,
      amount: capturedAmount,
      currency: capturedCurrency,
      initiativeId,
    });
  } catch (error) {
    console.error('PayPal capture error:', error.message);
    return res.status(502).json({
      error:
        'Could not verify or capture this PayPal order. Check PayPal configuration and server logs.',
    });
  }
});
// Handle unknown routes.
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});
// Start the API server.
app.listen(PORT, () => {
  console.log(`ImpactBridge AI API listening on port ${PORT}`);
});