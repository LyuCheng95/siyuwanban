import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';

export const paymentRouter = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// 套餐定义
const TIERS = [
  { id: 0, diamonds: 30,  usd: 2.99,  stars: 150,  label: '30颗钻石',  bonus: '',          monthly: false },
  { id: 1, diamonds: 80,  usd: 6.99,  stars: 350,  label: '80颗钻石',  bonus: '🔥最受欢迎', monthly: false },
  { id: 2, diamonds: 200, usd: 14.99, stars: 800,  label: '200颗钻石', bonus: '',          monthly: false },
  { id: 3, diamonds: 450, usd: 29.99, stars: 1800, label: '450颗钻石', bonus: '💎最划算',   monthly: false },
  { id: 4, diamonds: 150, usd: 9.99,  stars: 500,  label: '150颗钻石', bonus: '⭐月卡特惠', monthly: true  },
];

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const tgCall = (method: string, body: object) =>
  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json());

// GET /api/payments/tiers
paymentRouter.get('/tiers', (_req: Request, res: Response) => {
  res.json(TIERS);
});

// GET /api/payments/balance — lightweight polling target after payment
paymentRouter.get('/balance', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const [user, completedCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: req.userId! },
      select: { paidCredits: true, freeCredits: true },
    }),
    prisma.payment.count({
      where: { userId: req.userId!, status: 'completed' },
    }),
  ]);
  res.json({
    diamonds: user?.paidCredits ?? 0,
    coins: user?.freeCredits ?? 0,
    isFirstPurchase: completedCount === 0,
  });
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

    // First purchase bonus: double the diamonds
    const prevCount = await prisma.payment.count({
      where: { userId, status: 'completed' },
    });
    const isFirstPurchase = prevCount === 0;
    const finalDiamonds = isFirstPurchase ? diamondsNum * 2 : diamondsNum;

    await prisma.$transaction([
      prisma.payment.create({
        data: {
          userId,
          provider: 'stripe',
          externalId: sessionId,
          status: 'completed',
          amountUsd: (session.amount_total ?? 0) / 100,
          currency: session.currency ?? 'usd',
          diamondsGranted: finalDiamonds,
          metadata: { stripeSession: session.id, customerEmail: session.customer_email, firstPurchase: isFirstPurchase },
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { paidCredits: { increment: finalDiamonds } },
      }),
    ]);

    console.log(`[Payment] Stripe: user=${userId} +${finalDiamonds} diamonds${isFirstPurchase ? ' (🎁 first purchase x2)' : ''}`);
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

// ── Telegram Stars ────────────────────────────────────────────────────────────

// POST /api/payments/stars/create-invoice — create Stars invoice link
paymentRouter.post('/stars/create-invoice', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { tierIndex } = req.body as { tierIndex: number };
  const tier = TIERS[tierIndex];
  if (!tier) { res.status(400).json({ error: 'invalid tier' }); return; }

  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { telegramId: true } });
  if (!user) { res.status(404).json({ error: 'user not found' }); return; }

  const payload = `stars_${tier.diamonds}_${req.userId}`;

  const result = await tgCall('createInvoiceLink', {
    title: `${tier.label}`,
    description: `充值 ${tier.diamonds} 颗钻石，解锁更多专属对话`,
    payload,
    currency: 'XTR',
    prices: [{ label: tier.label, amount: tier.stars }],
  }) as { ok: boolean; result?: string; description?: string };

  if (!result.ok || !result.result) {
    console.error('[Stars] createInvoiceLink failed:', result);
    res.status(500).json({ error: 'failed to create invoice', detail: result.description }); return;
  }

  res.json({ invoiceLink: result.result, stars: tier.stars, diamonds: tier.diamonds });
});

// POST /api/payments/stars/webhook — Telegram pre_checkout_query + successful_payment
// This is called from bot.ts webhook handler (not a separate HTTP route)
export async function handleStarsWebhook(update: any): Promise<void> {
  // Must answer pre_checkout_query within 10 seconds
  if (update.pre_checkout_query) {
    const pcq = update.pre_checkout_query;
    await tgCall('answerPreCheckoutQuery', {
      pre_checkout_query_id: pcq.id,
      ok: true,
    });
    return;
  }

  // successful_payment — add diamonds to user
  if (update.message?.successful_payment) {
    const payment = update.message.successful_payment;
    const payload: string = payment.invoice_payload;
    // payload format: stars_{diamonds}_{userId}
    const parts = payload.split('_');
    if (parts[0] !== 'stars' || parts.length < 3) return;
    const diamonds = parseInt(parts[1]);
    const userId = parts.slice(2).join('_'); // userId might contain underscores

    if (!diamonds || !userId) return;

    // Idempotency: skip if already processed
    const chargeId = payment.telegram_payment_charge_id;
    const existingStars = await prisma.payment.findUnique({ where: { externalId: chargeId } });
    if (existingStars) return;

    try {
      const [, completedCount] = await Promise.all([
        prisma.user.update({
          where: { id: userId },
          data: { paidCredits: { increment: diamonds } },
        }),
        prisma.payment.count({ where: { userId, status: 'completed' } }),
      ]);

      // First purchase bonus x2
      const bonus = completedCount === 0 ? diamonds : 0;
      if (bonus > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: { paidCredits: { increment: bonus } },
        });
      }

      // Record payment
      await prisma.payment.create({
        data: {
          userId,
          provider: 'stars',
          externalId: payment.telegram_payment_charge_id,
          status: 'completed',
          amountUsd: 0,
          currency: 'XTR',
          diamondsGranted: diamonds + bonus,
          metadata: { starsAmount: payment.total_amount, telegramChargeId: payment.telegram_payment_charge_id, firstPurchase: completedCount === 0 },
        },
      }).catch(() => {}); // non-critical

      console.log(`[Stars] user=${userId} +${diamonds + bonus} diamonds (telegramChargeId=${payment.telegram_payment_charge_id})`);
    } catch (err: any) {
      console.error('[Stars] failed to add diamonds:', err.message);
    }
  }
}
