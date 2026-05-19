import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authRouter } from './routes/auth';
import { characterRouter } from './routes/characters';
import { chatRouter } from './routes/chat';
import { paymentRouter } from './routes/payments';
import { marketplaceRouter } from './routes/marketplace';
import { imagesRouter } from './routes/images';
import { botRouter } from './routes/bot';
import { checkinRouter } from './routes/checkin';
import { adminRouter } from './routes/admin';
import { redeemRouter } from './routes/redeem';
import { cryptobotRouter, startUsdtPoller } from './routes/cryptobot';
import { startDailyPush } from './services/dailyPush';
import { buildLibraryIndex, reserveLibraryImages } from './services/libraryImage';
import { prisma } from './utils/prisma';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));

// Webhooks need raw body — must be registered BEFORE express.json()
app.use('/api/payments/stripe/webhook',    express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({ windowMs: 60_000, max: 60 });
app.use('/api/', limiter);

app.use('/api/auth', authRouter);
app.use('/api/characters', characterRouter);
app.use('/api/chat', chatRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/marketplace', marketplaceRouter);
app.use('/api/images', imagesRouter);
app.use('/api/bot', botRouter);
app.use('/api/checkin', checkinRouter);
app.use('/api/redeem', redeemRouter);
app.use('/api/payments/crypto', cryptobotRouter);

app.use('/api/admin', adminRouter);
app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, async () => {
  console.log(`私欲玩伴 backend running on port ${PORT}`);
  startUsdtPoller();
  startDailyPush();

  // Build library image index, then mark profile/album images as reserved
  buildLibraryIndex();
  try {
    const chars = await prisma.character.findMany({
      select: { faceUrl: true, portraitUrl: true, portraitImages: true },
    });
    const profileUrls: string[] = [];
    for (const c of chars) {
      if (c.faceUrl)    profileUrls.push(c.faceUrl);
      if (c.portraitUrl && c.portraitUrl !== c.faceUrl) profileUrls.push(c.portraitUrl);
      if (Array.isArray(c.portraitImages)) profileUrls.push(...(c.portraitImages as string[]));
    }
    reserveLibraryImages(profileUrls.filter(Boolean));
  } catch (err: any) {
    console.error('[Library] Failed to load reservations:', err.message);
  }
});
