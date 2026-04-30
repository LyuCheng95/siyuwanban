/**
 * Direct USDT TRC-20 payment — no third-party processor needed
 *
 * Flow:
 *  1. Frontend POST /api/payments/crypto/create-invoice  → { invoiceId, address, amount, diamonds }
 *  2. User sends EXACTLY that amount (unique per order) to the USDT TRC-20 address
 *  3. Background poller checks TronScan every 30 s for new transfers to our wallet
 *  4. When a transfer matches a pending invoice amount → credit diamonds
 *  5. Frontend polls /api/payments/balance until balance increases
 *
 * Uniqueness trick: each tier has a base USDT price; we add 1–99 random cents so the
 * exact amount identifies the order without ambiguity (collision risk ~1% per 100 orders).
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';

export const cryptobotRouter = Router();

// ── Config ────────────────────────────────────────────────────────────────────
const WALLET_ADDRESS = process.env.USDT_WALLET || 'TFt6Q3LoYkzVWsXNAsiz5gcR2f62h9opkr';
const USDT_CONTRACT  = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // mainnet USDT TRC-20
const TRONGRID_API   = 'https://api.trongrid.io';

// ── Tiers ─────────────────────────────────────────────────────────────────────
// base amounts (USD / USDT).  Unique invoices add 1-99 cents on top.
const TIERS = [
  { id: 0, diamonds: 30,  baseUsdt: 3.00,  label: '30颗钻石',  bonus: '',           monthly: false },
  { id: 1, diamonds: 80,  baseUsdt: 7.00,  label: '80颗钻石',  bonus: '🔥最受欢迎',  monthly: false },
  { id: 2, diamonds: 200, baseUsdt: 15.00, label: '200颗钻石', bonus: '',           monthly: false },
  { id: 3, diamonds: 450, baseUsdt: 30.00, label: '450颗钻石', bonus: '💎最划算',    monthly: false },
  { id: 4, diamonds: 150, baseUsdt: 10.00, label: '150颗钻石', bonus: '⭐月卡特惠',  monthly: true  },
];

// expose usd/usdt for frontend price display
function tierForFrontend(t: typeof TIERS[0]) {
  return { id: t.id, diamonds: t.diamonds, label: t.label, bonus: t.bonus,
           monthly: t.monthly,
           usd: t.baseUsdt.toFixed(2), usdt: t.baseUsdt.toFixed(2) };
}

// ── TronGrid helper ───────────────────────────────────────────────────────────
async function getRecentTransfers(limit = 50): Promise<any[]> {
  const url = `${TRONGRID_API}/v1/accounts/${WALLET_ADDRESS}/transactions/trc20` +
    `?limit=${limit}&contract_address=${USDT_CONTRACT}&only_to=true`;
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (process.env.TRONGRID_API_KEY) headers['TRON-PRO-API-KEY'] = process.env.TRONGRID_API_KEY;
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`TronGrid HTTP ${r.status}`);
  const j = await r.json() as any;
  return j.data ?? [];
}

// ── Background poller ─────────────────────────────────────────────────────────
// Runs on server startup; matches incoming USDT transfers to pending invoices.
let pollerStarted = false;

export function startUsdtPoller() {
  if (pollerStarted) return;
  pollerStarted = true;

  async function tick() {
    try {
      const transfers = await getRecentTransfers(50);
      for (const tx of transfers) {
        // TronGrid: transaction_id is the tx hash
        const txHash = String(tx.transaction_id ?? '');
        if (!txHash) continue;

        // Already recorded?
        const exists = await prisma.payment.findUnique({
          where: { externalId: `usdt_${txHash}` },
        });
        if (exists) continue;

        // TronGrid: value is the raw amount string (6 decimals for USDT)
        const rawAmt: string = String(tx.value ?? tx.amount ?? '0');
        const usdtAmt = parseFloat(rawAmt) / 1e6;

        // Find matching pending invoice (within $0.005 rounding tolerance)
        const pending = await prisma.payment.findFirst({
          where: {
            provider: 'usdt_trc20',
            status: 'pending',
            // amountUsd stores the exact expected amount
            amountUsd: { gte: usdtAmt - 0.005, lte: usdtAmt + 0.005 },
          },
          orderBy: { createdAt: 'asc' },
        });

        if (!pending) {
          // Could be an unrelated deposit — ignore quietly
          continue;
        }

        const baseDiamonds = pending.diamondsGranted;
        const userId       = pending.userId;

        // First purchase bonus: double the diamonds
        const prevCount = await prisma.payment.count({
          where: { userId, status: 'completed' },
        });
        const isFirstPurchase = prevCount === 0;
        const finalDiamonds = isFirstPurchase ? baseDiamonds * 2 : baseDiamonds;

        await prisma.$transaction([
          prisma.payment.update({
            where: { id: pending.id },
            data: {
              status:          'completed',
              externalId:      `usdt_${txHash}`,
              diamondsGranted: finalDiamonds,
              metadata:        {
                ...(pending.metadata as object),
                txHash,
                confirmedAt:    new Date().toISOString(),
                actualAmount:   usdtAmt,
                firstPurchase:  isFirstPurchase,
              },
            },
          }),
          prisma.user.update({
            where: { id: userId },
            data: { paidCredits: { increment: finalDiamonds } },
          }),
        ]);

        console.log(`[USDT] payment confirmed: user=${userId} +${finalDiamonds}💎` +
                    `${isFirstPurchase ? ' (🎁 first purchase x2)' : ''} ` +
                    `(${usdtAmt} USDT, tx=${txHash.slice(0, 16)}…)`);
      }
    } catch (e: any) {
      // Network blip — don't crash, just log
      console.warn('[USDT poller] tick error:', e.message);
    }

    setTimeout(tick, 30_000); // check every 30 seconds
  }

  // Slight delay so DB is ready before first tick
  setTimeout(tick, 10_000);
  console.log('[USDT] blockchain poller started (every 30 s)');
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/payments/crypto/tiers
cryptobotRouter.get('/tiers', (_req: Request, res: Response) => {
  res.json(TIERS.map(tierForFrontend));
});

// POST /api/payments/crypto/create-invoice
// Body: { tierIndex: number }
// Returns: { invoiceId, address, amount, asset, diamonds }
cryptobotRouter.post('/create-invoice', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { tierIndex } = req.body as { tierIndex: number };
  const tier = TIERS[tierIndex];
  if (!tier) { res.status(400).json({ error: 'Invalid tier' }); return; }

  // Generate a unique amount by adding 1-99 random cents
  const extraCents = Math.floor(Math.random() * 99) + 1;          // 1..99
  const uniqueUsdt = parseFloat((tier.baseUsdt + extraCents / 100).toFixed(2));

  // Cancel any previous pending invoices for this user+tier to reduce clutter
  await prisma.payment.updateMany({
    where: { userId: req.userId!, provider: 'usdt_trc20', status: 'pending' },
    data:  { status: 'expired' },
  });

  const payment = await prisma.payment.create({
    data: {
      userId:         req.userId!,
      provider:       'usdt_trc20',
      status:         'pending',
      amountUsd:      uniqueUsdt,
      currency:       'USDT',
      diamondsGranted: tier.diamonds,
      metadata: {
        tierIndex,
        tierLabel:  tier.label,
        walletAddress: WALLET_ADDRESS,
        expectedUsdt:  uniqueUsdt,
        createdAt:  new Date().toISOString(),
      },
    },
  });

  res.json({
    invoiceId: payment.id,
    address:   WALLET_ADDRESS,
    amount:    uniqueUsdt.toFixed(2),
    asset:     'USDT (TRC-20)',
    network:   'TRON',
    diamonds:  tier.diamonds,
    label:     tier.label,
  });
});

// GET /api/payments/crypto/invoice/:id — poll invoice status
cryptobotRouter.get('/invoice/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const invoiceId = String(req.params['id'] ?? '');
  const userId    = req.userId!;
  const payment = await prisma.payment.findFirst({
    where: { id: invoiceId, userId },
    select: { id: true, status: true, diamondsGranted: true, amountUsd: true },
  });
  if (!payment) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(payment);
});
