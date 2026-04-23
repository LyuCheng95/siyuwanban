import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { validateTelegramInitData, getOrCreateUser } from '../middleware/auth';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET!;

// POST /api/auth/telegram
// Body: { initData: string }  (Telegram.WebApp.initData)
authRouter.post('/telegram', async (req: Request, res: Response): Promise<void> => {
  const { initData } = req.body;
  if (!initData) {
    res.status(400).json({ error: 'initData required' });
    return;
  }

  const data = validateTelegramInitData(initData);
  if (!data) {
    res.status(401).json({ error: 'Invalid Telegram initData' });
    return;
  }

  const telegramUser = JSON.parse(data.user || '{}');
  if (!telegramUser.id) {
    res.status(400).json({ error: 'No user in initData' });
    return;
  }

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
      lastName: user.lastName,
      photoUrl: user.photoUrl,
      freeCredits: user.freeCredits,
      paidCredits: user.paidCredits,
    },
  });
});
