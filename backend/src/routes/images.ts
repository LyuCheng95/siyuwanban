import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { generateSceneImage } from '../services/comfyui';
import { findCachedScene, saveSceneImage } from '../services/sceneCache';
import { prisma } from '../utils/prisma';

export const imagesRouter = Router();
imagesRouter.use(authMiddleware);

// POST /api/images/generate — generate or reuse a cached scene image
imagesRouter.post('/generate', async (req: AuthRequest, res: Response): Promise<void> => {
  const { prompt, negative, characterName, characterId } = req.body;

  if (!prompt?.trim()) {
    res.status(400).json({ error: 'prompt required' });
    return;
  }

  try {
    // Check cache first — cache hits are FREE (no diamond charge)
    if (characterId) {
      const cached = await findCachedScene(characterId, prompt);
      if (cached) {
        const user = await prisma.user.findUnique({
          where: { id: req.userId! },
          select: { paidCredits: true },
        });
        res.json({ url: cached, paid: user?.paidCredits ?? 0 });
        return;
      }
    }

    // New generation costs 1 diamond
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { paidCredits: true },
    });
    if (!user || user.paidCredits < 1) {
      res.status(402).json({ error: 'insufficient_diamonds' });
      return;
    }

    // Deduct before generating (prevents double-spend on retry)
    const updated = await prisma.user.update({
      where: { id: req.userId! },
      data: { paidCredits: { decrement: 1 } },
      select: { paidCredits: true },
    });

    // characterName is used by comfyui to pick the right model internally
    const url = await generateSceneImage(prompt, negative ?? '', characterName ?? '');

    // Save to cache for future reuse
    if (characterId) {
      saveSceneImage(characterId, prompt, url).catch(() => {});
    }

    res.json({ url, paid: updated.paidCredits });
  } catch (err: any) {
    console.error('[ImageGen]', err.message);
    res.status(503).json({ error: 'Image generation failed', detail: err.message });
  }
});
