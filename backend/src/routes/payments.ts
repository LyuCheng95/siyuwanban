import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';

export const paymentRouter = Router();

// Telegram Stars pricing tiers
const TIERS = [
  { stars: 50,  turns: 30,  label: '30次对话' },
  { stars: 100, turns: 70,  label: '70次对话' },
  { stars: 200, turns: 160, label: '160次对话' },
];

// GET /api/payments/tiers
paymentRouter.get('/tiers', (_req: Request, res: Response) => {
  res.json(TIERS);
});

// POST /api/payments/create-invoice
// Returns a Telegram invoice link via Bot API
paymentRouter.post('/create-invoice', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { tierIndex } = req.body;
  const tier = TIERS[tierIndex];
  if (!tier) { res.status(400).json({ error: 'Invalid tier' }); return; }

  // Call Telegram Bot API to create invoice
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
  const payload = JSON.stringify({ userId: req.userId!, tier: tierIndex });

  const invoiceRes = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '购买对话次数',
        description: `获得 ${tier.turns} 次AI角色对话机会`,
        payload,
        currency: 'XTR',         // Telegram Stars
        prices: [{ label: tier.label, amount: tier.stars }],
        provider_token: '',       // empty for Stars
      }),
    }
  );

  const invoiceData = await invoiceRes.json() as { ok: boolean; result: string };
  if (!invoiceData.ok) {
    res.status(500).json({ error: 'Failed to create invoice' }); return;
  }
  res.json({ invoiceLink: invoiceData.result, tier });
});

// POST /api/payments/webhook — Telegram Bot webhook for successful payments
// This endpoint receives updates from Telegram (no auth required, verify secret)
paymentRouter.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  const secretToken = req.headers['x-telegram-bot-api-secret-token'];
  if (secretToken !== process.env.WEBHOOK_SECRET) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }

  const update = req.body;

  // Handle pre_checkout_query — must answer within 10s
  if (update.pre_checkout_query) {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pre_checkout_query_id: update.pre_checkout_query.id,
        ok: true,
      }),
    });
    res.json({ ok: true });
    return;
  }

  // Handle successful_payment
  const payment = update.message?.successful_payment;
  if (!payment) { res.json({ ok: true }); return; }

  try {
    const { userId, tier: tierIndex } = JSON.parse(payment.invoice_payload);
    const tier = TIERS[tierIndex];
    if (!tier) { res.json({ ok: true }); return; }

    await prisma.$transaction([
      prisma.payment.create({
        data: {
          userId,
          telegramPayload: payment,
          turnsGranted: tier.turns,
          stars: tier.stars,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { paidCredits: { increment: tier.turns } },
      }),
    ]);
  } catch (err) {
    console.error('Payment processing error:', err);
  }

  res.json({ ok: true });
});
