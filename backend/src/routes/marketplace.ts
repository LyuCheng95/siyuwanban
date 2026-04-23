import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { z } from 'zod';

export const marketplaceRouter = Router();
marketplaceRouter.use(authMiddleware);

// GET /api/marketplace?sort=popular|rating|newest&page=1&search=...
marketplaceRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const sort = (req.query.sort as string) || 'popular';
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const search = (req.query.search as string)?.trim();
  const pageSize = 20;

  const orderBy =
    sort === 'rating' ? { avgRating: 'desc' as const } :
    sort === 'newest' ? { createdAt: 'desc' as const } :
    { usageCount: 'desc' as const };

  const where = {
    isPublic: true,
    ...(search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { occupation: { contains: search, mode: 'insensitive' as const } },
        { personality: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
  };

  const [characters, total] = await Promise.all([
    prisma.character.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        age: true,
        gender: true,
        occupation: true,
        personality: true,
        avatarEmoji: true,
        usageCount: true,
        avgRating: true,
        reviewCount: true,
        createdAt: true,
        creator: { select: { username: true, firstName: true } },
      },
    }),
    prisma.character.count({ where }),
  ]);

  res.json({ characters, total, page, pageSize });
});

// GET /api/marketplace/leaderboard
marketplaceRouter.get('/leaderboard', async (_req: AuthRequest, res: Response): Promise<void> => {
  const [byUsage, byRating] = await Promise.all([
    prisma.character.findMany({
      where: { isPublic: true },
      orderBy: { usageCount: 'desc' },
      take: 10,
      select: {
        id: true, name: true, avatarEmoji: true, occupation: true,
        usageCount: true, avgRating: true, reviewCount: true,
        creator: { select: { username: true, firstName: true } },
      },
    }),
    prisma.character.findMany({
      where: { isPublic: true, reviewCount: { gte: 3 } },
      orderBy: { avgRating: 'desc' },
      take: 10,
      select: {
        id: true, name: true, avatarEmoji: true, occupation: true,
        usageCount: true, avgRating: true, reviewCount: true,
        creator: { select: { username: true, firstName: true } },
      },
    }),
  ]);
  res.json({ byUsage, byRating });
});

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

// POST /api/marketplace/:characterId/review
marketplaceRouter.post('/:characterId/review', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { characterId } = req.params;

  // Must have had a conversation
  const conversation = await prisma.conversation.findUnique({
    where: { userId_characterId: { userId: req.userId!, characterId } },
  });
  if (!conversation || conversation.totalTurns < 3) {
    res.status(403).json({ error: '需要至少3次对话才能评价' }); return;
  }

  await prisma.$transaction(async (tx) => {
    const review = await tx.review.upsert({
      where: { userId_characterId: { userId: req.userId!, characterId } },
      create: { userId: req.userId!, characterId, ...parsed.data },
      update: parsed.data,
    });

    // Recalculate average rating
    const agg = await tx.review.aggregate({
      where: { characterId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await tx.character.update({
      where: { id: characterId },
      data: {
        avgRating: agg._avg.rating ?? 0,
        reviewCount: agg._count.rating,
      },
    });

    return review;
  });

  res.json({ ok: true });
});
