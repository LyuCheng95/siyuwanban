import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const JWT_SECRET = process.env.JWT_SECRET!;

export interface AuthRequest extends Request {
  userId?: string;
  telegramId?: bigint;
  isAnon?: boolean;
}

// Validate Telegram WebApp initData hash
export function validateTelegramInitData(initData: string): Record<string, string> | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  params.delete('hash');
  const sorted = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();

  const expected = crypto
    .createHmac('sha256', secretKey)
    .update(sorted)
    .digest('hex');

  if (expected !== hash) return null;

  const result: Record<string, string> = {};
  params.forEach((v, k) => { result[k] = v; });
  return result;
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }
  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; telegramId: string; isAnon?: boolean };
    req.userId = payload.userId;
    req.telegramId = BigInt(payload.telegramId);
    req.isAnon = payload.isAnon === true;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export async function getOrCreateUser(telegramUser: {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { telegramId: BigInt(telegramUser.id) } });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        photoUrl: telegramUser.photo_url,
      },
    });
  }

  // New user — grant 10 diamonds as registration bonus
  const [user] = await prisma.$transaction([
    prisma.user.create({
      data: {
        telegramId: BigInt(telegramUser.id),
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        photoUrl: telegramUser.photo_url,
        isAnonymous: false,
        paidCredits: 10,
      },
    }),
  ]);

  await prisma.payment.create({
    data: {
      userId: user.id,
      provider: 'admin',
      status: 'completed',
      amountUsd: 0,
      diamondsGranted: 10,
      metadata: { type: 'registration_bonus' },
    },
  });

  return user;
}
