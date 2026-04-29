import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';

export const paymentRouter = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// 套餐定义
const TIERS = [
  { id: 0, diamonds: 30,  usd: 2.99, label: '30颗钻石',  bonus: '' },
  { id: 1, diamonds: 80,  usd: 6.99, label: '80颗钻石',  bonus: '🔥最受欢迎' },
  { id: 2, diamonds: 200, usd: 14.99, label: '200颗钻石', bonus: '💎最划算' },
];

// GET /api/payments/tiers
paymentRouter.get('/tiers', (_req: Request, res: Response) => {
  res.json(TIERS);
});

// GET /api/payments/balance — lightweight polling target after payment
paymentRouter.get('/balance', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { paidCredits: true, freeCredits: true },
  });
  res.json({ diamonds: user?.paidCredits ?? 0, coins: user?.freeCredits ?? 0 });
});

// POST /api/payments/stripe/create-session
paymentRouter.post('/stripe/create-session', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { tierIndex } = req.body as { tierIndex: number };
  const tier = TIERS[tierIndex];
  if (!tier) { res.status(400).json({ error: 'Invalid tier' }); return; }

  const FRONTEND_URL = process.env.FRONTEND_URL || 'https://siyuwanban.shangzongcai.com';

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(tier.usd * 100),
        product_data: {
          name: `私欲玩伴 · ${tier.label}`,
          description: `购买 ${tier.diamonds} 颗钻石，用于 AI 角色对话`,
        },
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${FRONTEND_URL}?payment=success`,
    cancel_url:  `${FRONTEND_URL}?payment=cancel`,
    metadata: {
      userId: req.userId!,
      tierIndex: String(tierIndex),
      diamonds: String(tier.diamonds),
    },
  });

  res.json({ url: session.url, sessionId: session.id });
});

// POST /api/payments/stripe/webhook — Stripe sends signed events here
// Must use raw body — see index.ts for express.raw() configuration
paymentRouter.post('/stripe/webhook', async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature'] as string;
  let event: ReturnType<typeof stripe.webhooks.constructEvent>;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error('[Stripe webhook] signature verification failed:', err.message);
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    const { userId, diamonds } = session.metadata ?? {};
    if (!userId || !diamonds) { res.json({ ok: true }); return; }

    const diamondsNum = parseInt(diamonds, 10);
    const sessionId = session.id;

    // Idempotency: skip if already processed
    const existing = await prisma.payment.findUnique({ where: { externalId: sessionId } });
    if (existing) { res.json({ ok: true }); return; }

    await prisma.$transaction([
      prisma.payment.create({
        data: {
          userId,
          provider: 'stripe',
          externalId: sessionId,
          status: 'completed',
          amountUsd: (session.amount_total ?? 0) / 100,
          currency: session.currency ?? 'usd',
          diamondsGranted: diamondsNum,
          metadata: { stripeSession: session.id, customerEmail: session.customer_email },
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { paidCredits: { increment: diamondsNum } },
      }),
    ]);

    console.log(`[Payment] Stripe: user=${userId} +${diamondsNum} diamonds`);
  }

  res.json({ ok: true });
});

// POST /api/payments/exchange-coins — 10金币 = 1钻石
paymentRouter.post('/exchange-coins', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { amount } = req.body as { amount: number };
  if (!amount || amount < 10 || amount % 10 !== 0) {
    res.status(400).json({ error: '最少兑换10金币，必须是10的倍数' }); return;
  }

  const diamonds = Math.floor(amount / 10);

  try {
    const updated = await prisma.user.update({
      where: { id: req.userId!, freeCredits: { gte: amount } },
      data: {
        freeCredits: { decrement: amount },
        paidCredits: { increment: diamonds },
      },
    });
    res.json({ ok: true, coinsSpent: amount, diamondsReceived: diamonds, newCoins: updated.freeCredits, newDiamonds: updated.paidCredits });
  } catch {
    res.status(400).json({ error: '金币不足' });
  }
});
