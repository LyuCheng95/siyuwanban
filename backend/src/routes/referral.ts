/**
 * 好友推荐系统
 * GET  /api/referral          — 获取自己的推荐码 + 已推荐人数
 * POST /api/referral/claim    — 新用户认领推荐码 (一次性)
 *
 * 奖励：推荐人 +15💎，被推荐新用户 +8💎（叠加注册礼包）
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';

export const referralRouter = Router();
referralRouter.use(authMiddleware);

const REFERRER_REWARD = 15;  // 推荐人获得的钻石
const REFEREE_BONUS   = 8;   // 被推荐新用户额外获得的钻石

// 生成唯一 6 位码（去掉易混淆字符 0/O/1/I）
async function generateUniqueCode(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
    const exists = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!exists) return code;
  }
  throw new Error('Failed to generate unique referral code');
}

// GET /api/referral — 返回当前用户的推荐码、邀请链接、已推荐人数
referralRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { id: true, referralCode: true },
  });
  if (!user) { res.status(404).json({ error: 'not found' }); return; }

  // 懒生成：第一次访问时才生成推荐码
  let code = user.referralCode;
  if (!code) {
    code = await generateUniqueCode();
    await prisma.user.update({ where: { id: user.id }, data: { referralCode: code } });
  }

  const count = await prisma.user.count({ where: { referredBy: user.id } });

  res.json({
    code,
    link: `https://t.me/SiYuWanBanBot?start=ref_${code}`,
    count,
    referrerReward: REFERRER_REWARD,
    refereeBonus: REFEREE_BONUS,
  });
});

// POST /api/referral/claim — 新用户认领推荐码
// Body: { refCode: string }
referralRouter.post('/claim', async (req: AuthRequest, res: Response): Promise<void> => {
  const { refCode } = req.body as { refCode?: string };
  if (!refCode?.trim()) { res.status(400).json({ error: 'refCode required' }); return; }

  const userId = req.userId!;

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { referredBy: true, isAnonymous: true },
  });
  if (!me) { res.status(404).json({ error: 'user not found' }); return; }
  if (me.isAnonymous) { res.status(400).json({ error: 'anonymous_not_allowed' }); return; }
  if (me.referredBy) { res.status(400).json({ error: 'already_referred' }); return; }

  const code = refCode.trim().toUpperCase();
  const referrer = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true },
  });
  if (!referrer) { res.status(404).json({ error: 'invalid_code' }); return; }
  if (referrer.id === userId) { res.status(400).json({ error: 'cannot_refer_self' }); return; }

  // 事务：标记被推荐、发钻石给双方、记流水
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { referredBy: referrer.id, paidCredits: { increment: REFEREE_BONUS } },
    }),
    prisma.user.update({
      where: { id: referrer.id },
      data: { paidCredits: { increment: REFERRER_REWARD } },
    }),
    prisma.payment.create({
      data: {
        userId: referrer.id, provider: 'admin', status: 'completed',
        amountUsd: 0, diamondsGranted: REFERRER_REWARD,
        metadata: { type: 'referral_reward', referredUserId: userId },
      },
    }),
    prisma.payment.create({
      data: {
        userId, provider: 'admin', status: 'completed',
        amountUsd: 0, diamondsGranted: REFEREE_BONUS,
        metadata: { type: 'referral_bonus', referrerId: referrer.id },
      },
    }),
  ]);

  res.json({ ok: true, bonusDiamonds: REFEREE_BONUS });
});
