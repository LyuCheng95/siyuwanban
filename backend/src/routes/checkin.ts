import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';

export const checkinRouter = Router();
checkinRouter.use(authMiddleware);

// Streak reward tiers
function calcReward(streak: number): { gold: number; diamonds: number; message: string } {
  if (streak >= 30) return { gold: 2000, diamonds: 5, message: '连续30天！传说级奖励 🏆' };
  if (streak >= 14) return { gold: 800,  diamonds: 2, message: '连续两周！超强奖励 💎' };
  if (streak >= 7)  return { gold: 500,  diamonds: 1, message: '连续一周！额外钻石奖励 💎' };
  if (streak >= 3)  return { gold: 200,  diamonds: 0, message: '连续3天！进度加倍 🔥' };
  // Base: 100 + 10 per streak day, cap at 300
  const gold = Math.min(300, 100 + streak * 10);
  return { gold, diamonds: 0, message: streak > 1 ? `连续${streak}天签到！` : '今日签到奖励 🌸' };
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function isYesterday(date: Date, now: Date) {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(date, yesterday);
}

// GET /api/checkin — return today's status without consuming it
checkinRouter.get('/', async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) { res.status(401).json({ error: 'Not found' }); return; }

  const now = new Date();
  const alreadyDone = user.lastCheckIn ? isSameDay(user.lastCheckIn, now) : false;
  const streak = alreadyDone ? user.checkInStreak : (
    user.lastCheckIn && isYesterday(user.lastCheckIn, now) ? user.checkInStreak : 0
  );
  const previewReward = calcReward(alreadyDone ? streak : streak + 1);

  res.json({
    alreadyDone,
    streak: user.checkInStreak,
    nextReward: previewReward,
    gold: user.freeCredits,
    diamonds: user.paidCredits,
  });
});

// POST /api/checkin — perform check-in
checkinRouter.post('/', async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) { res.status(401).json({ error: 'Not found' }); return; }

  const now = new Date();

  // Already checked in today
  if (user.lastCheckIn && isSameDay(user.lastCheckIn, now)) {
    res.json({
      alreadyDone: true,
      streak: user.checkInStreak,
      gold: user.freeCredits,
      diamonds: user.paidCredits,
    });
    return;
  }

  // Calculate new streak
  const newStreak = user.lastCheckIn && isYesterday(user.lastCheckIn, now)
    ? user.checkInStreak + 1
    : 1;

  const { gold, diamonds, message } = calcReward(newStreak);

  const updated = await prisma.user.update({
    where: { id: req.userId! },
    data: {
      lastCheckIn: now,
      checkInStreak: newStreak,
      freeCredits: { increment: gold },
      paidCredits: { increment: diamonds },
    },
  });

  res.json({
    alreadyDone: false,
    streak: newStreak,
    reward: { gold, diamonds, message },
    gold: updated.freeCredits,
    diamonds: updated.paidCredits,
  });
});
