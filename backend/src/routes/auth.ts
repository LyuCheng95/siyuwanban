import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + process.env.JWT_SECRET).digest('hex');
}

function makeUserResponse(user: any, isAnon = false) {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    nickname: user.nickname ?? null,
    email: user.email ?? null,
    freeCredits: user.freeCredits,
    paidCredits: user.paidCredits,
    isAnonymous: isAnon || user.isAnonymous,
    language: user.language ?? 'zh',
  };
}

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
      isAnonymous: true,
      paidCredits: 0,
      freeCredits: 0,
    },
  });

  const token = jwt.sign(
    { userId: user.id, telegramId: user.telegramId.toString(), isAnon: true },
    JWT_SECRET,
    { expiresIn: '90d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      nickname: user.nickname ?? null,
      freeCredits: user.freeCredits,
      paidCredits: user.paidCredits,
      isAnonymous: true,
      language: (user as any).language ?? 'zh',
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

  // Detect language from Telegram user profile
  const tgLang = telegramUser.language_code as string | undefined;
  const language = tgLang && !tgLang.startsWith('zh') ? 'en' : 'zh';

  const user = await getOrCreateUser(telegramUser);

  // Update language if Telegram tells us (non-destructive — user can override later)
  await prisma.user.update({ where: { id: user.id }, data: { language } });

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
      nickname: user.nickname ?? null,
      freeCredits: user.freeCredits,
      paidCredits: user.paidCredits,
      isAnonymous: false,
      language,
    },
  });
});

// POST /api/auth/register — email + password 注册
authRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'invalid_email', message: '请输入有效的邮箱地址' }); return;
  }
  if (!password || password.length < 6) {
    res.status(400).json({ error: 'weak_password', message: '密码至少6位' }); return;
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    res.status(409).json({ error: 'email_taken', message: '该邮箱已被注册' }); return;
  }

  // telegramId for email users: hash email to a positive BigInt range
  const hash = crypto.createHash('sha256').update('email:' + email.toLowerCase()).digest('hex');
  const emailId = BigInt('0x' + hash.slice(0, 14));

  const user = await prisma.user.create({
    data: {
      telegramId: emailId,
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      username: email.split('@')[0],
      firstName: email.split('@')[0],
      isAnonymous: false,
      paidCredits: 0,
      freeCredits: 3, // 注册赠送3金币免费体验
    },
  });

  const token = jwt.sign(
    { userId: user.id, telegramId: user.telegramId.toString(), isAnon: false },
    JWT_SECRET,
    { expiresIn: '90d' }
  );

  res.json({ token, user: makeUserResponse(user) });
});

// POST /api/auth/login — email + password 登录
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'missing_fields', message: '请输入邮箱和密码' }); return;
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.passwordHash) {
    res.status(401).json({ error: 'invalid_credentials', message: '邮箱或密码错误' }); return;
  }

  if (user.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: 'invalid_credentials', message: '邮箱或密码错误' }); return;
  }

  const token = jwt.sign(
    { userId: user.id, telegramId: user.telegramId.toString(), isAnon: false },
    JWT_SECRET,
    { expiresIn: '90d' }
  );

  res.json({ token, user: makeUserResponse(user) });
});

// PATCH /api/auth/language — save user language preference
authRouter.patch('/language', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { language } = req.body as { language: string };
  if (language !== 'zh' && language !== 'en') {
    res.status(400).json({ error: 'language must be zh or en' }); return;
  }
  await prisma.user.update({ where: { id: req.userId! }, data: { language } });
  res.json({ ok: true, language });
});

// PATCH /api/auth/nickname — save user's chosen in-app nickname
authRouter.patch('/nickname', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { nickname } = req.body as { nickname: string };
  if (!nickname?.trim() || nickname.trim().length > 20) {
    res.status(400).json({ error: 'nickname must be 1-20 chars' }); return;
  }
  await prisma.user.update({
    where: { id: req.userId! },
    data: { nickname: nickname.trim() },
  });
  res.json({ ok: true, nickname: nickname.trim() });
});
