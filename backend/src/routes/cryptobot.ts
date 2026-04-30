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
const TRON_API       = 'https://apilist.tronscanapi.com/api';

// ── Tiers ─────────────────────────────────────────────────────────────────────
// base amounts (USD / USDT).  Unique invoices add 1-99 cents on top.
const TIERS = [
  { id: 0, diamonds: 30,  baseUsdt: 3.00, label: '30颗钻石',  bonus: '' },
  { id: 1, diamonds: 80,  baseUsdt: 7.00, label: '80颗钻石',  bonus: '🔥最受欢迎' },
  { id: 2, diamonds: 200, baseUsdt: 15.00, label: '200颗钻石', bonus: '💎最划算' },
];

// expose usd/usdt for frontend price display
function tierForFrontend(t: typeof TIERS[0]) {
  return { id: t.id, diamonds: t.diamonds, label: t.label, bonus: t.bonus,
           usd: t.baseUsdt.toFixed(2), usdt: t.baseUsdt.toFixed(2) };
}

// ── TronScan helper ───────────────────────────────────────────────────────────
async function getRecentTransfers(limit = 50): Promise<any[]> {
  const url = `${TRON_API}/token_trc20/transfers` +
    `?toAddress=${WALLET_ADDRESS}` +
    `&contractAddress=${USDT_CONTRACT}` +
    `&limit=${limit}&start=0&direction=in`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`TronScan HTTP ${r.status}`);
  const j = await r.json() as any;
  return j.token_transfers ?? j.data ?? [];
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
        const txHash = String(tx.transaction_id ?? tx.transactionHash ?? tx.hash ?? '');
        if (!txHash) continue;

        // Already recorded?
        const exists = await prisma.payment.findUnique({
          where: { externalId: `usdt_${txHash}` },
        });
        if (exists) continue;

        // Parse amount — USDT has 6 decimals on TRON
        const rawAmt: string = tx.quant ?? tx.amount ?? '0';
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

        const diamonds = pending.diamondsGranted;
        const userId   = pending.userId;

        await prisma.$transaction([
          prisma.payment.update({
            where: { id: pending.id },
            data: {
              status:     'completed',
              externalId: `usdt_${txHash}`,
              metadata:   {
                ...(pending.metadata as object),
                txHash,
                confirmedAt: new Date().toISOString(),
                actualAmount: usdtAmt,
              },
            },
          }),
          prisma.user.update({
            where: { id: userId },
            data: { paidCredits: { increment: diamonds } },
          }),
        ]);

        console.log(`[USDT] payment confirmed: user=${userId} +${diamonds}💎 ` +
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
