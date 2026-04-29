import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { generateSceneImage } from '../services/comfyui';
import { findCachedScene, saveSceneImage } from '../services/sceneCache';

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
    // Check cache first (silent reuse, user doesn't know)
    if (characterId) {
      const cached = await findCachedScene(characterId, prompt);
      if (cached) {
        res.json({ url: cached });
        return;
      }
    }

    const url = await generateSceneImage(prompt, negative ?? '', characterName ?? '');

    // Save to cache for future reuse
    if (characterId) {
      saveSceneImage(characterId, prompt, url).catch(() => {});
    }

    res.json({ url });
  } catch (err: any) {
    console.error('[ImageGen]', err.message);
    res.status(503).json({ error: 'Image generation failed', detail: err.message });
  }
});
