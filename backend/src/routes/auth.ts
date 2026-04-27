import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET!;

// POST /api/auth/anonymous
// Body: { deviceId: string }
// deviceId 由前端生成并存在 localStorage，作为唯一标识
authRouter.post('/anonymous', async (req: Request, res: Response): Promise<void> => {
  const { deviceId } = req.body;
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length < 8) {
    res.status(400).json({ error: 'deviceId required' });
    return;
  }

  // 把 deviceId hash 成固定长度，作为 telegramId 的替代（用负数避免和真实 Telegram ID 冲突）
  const hash = crypto.createHash('sha256').update(deviceId).digest('hex');
  const anonId = BigInt('0x' + hash.slice(0, 12)) * BigInt(-1);

  const user = await prisma.user.upsert({
    where: { telegramId: anonId },
    update: {},
    create: {
      telegramId: anonId,
      username: `anon_${hash.slice(0, 8)}`,
      firstName: '匿名用户',
    },
  });

  const token = jwt.sign(
    { userId: user.id, telegramId: user.telegramId.toString() },
    JWT_SECRET,
    { expiresIn: '90d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      freeCredits: user.freeCredits,
      paidCredits: user.paidCredits,
    },
  });
});

// 保留 Telegram 登录作为备用（以后可以做绑定功能）
import { validateTelegramInitData, getOrCreateUser } from '../middleware/auth';

authRouter.post('/telegram', async (req: Request, res: Response): Promise<void> => {
  const { initData } = req.body;
  if (!initData) { res.status(400).json({ error: 'initData required' }); return; }

  const data = validateTelegramInitData(initData);
  if (!data) { res.status(401).json({ error: 'Invalid Telegram initData' }); return; }

  const telegramUser = JSON.parse(data.user || '{}');
  if (!telegramUser.id) { res.status(400).json({ error: 'No user in initData' }); return; }

  const user = await getOrCreateUser(telegramUser);
  const token = jwt.sign(
    { userId: user.id, telegramId: user.telegramId.toString() },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      freeCredits: user.freeCredits,
      paidCredits: user.paidCredits,
    },
  });
});
