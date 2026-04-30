import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';

export const redeemRouter = Router();
redeemRouter.use(authMiddleware);

// POST /api/redeem  { code: "XXXX-XXXX" }
redeemRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { code } = req.body as { code?: string };
  if (!code?.trim()) {
    res.status(400).json({ error: '请输入兑换码' });
    return;
  }

  const normalized = code.trim().toUpperCase();

  const record = await prisma.redeemCode.findUnique({ where: { code: normalized } });
  if (!record) {
    res.status(404).json({ error: '兑换码无效' });
    return;
  }
  if (record.isUsed) {
    res.status(409).json({ error: '该兑换码已被使用' });
    return;
  }

  const [, user] = await prisma.$transaction([
    prisma.redeemCode.update({
      where: { code: normalized },
      data: { isUsed: true, usedById: req.userId, usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: req.userId },
      data: { paidCredits: { increment: record.diamondsGranted } },
    }),
  ]);

  res.json({ ok: true, diamondsGranted: record.diamondsGranted, newBalance: user.paidCredits });
});
