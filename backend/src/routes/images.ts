import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { generateSceneImage } from '../services/comfyui';

export const imagesRouter = Router();
imagesRouter.use(authMiddleware);

// POST /api/images/generate — manually generate a scene image
imagesRouter.post('/generate', async (req: AuthRequest, res: Response): Promise<void> => {
  const { prompt, negative, characterName } = req.body;

  if (!prompt?.trim()) {
    res.status(400).json({ error: 'prompt required' });
    return;
  }

  try {
    const url = await generateSceneImage(prompt, negative ?? '', characterName ?? '');
    res.json({ url });
  } catch (err: any) {
    console.error('[ImageGen]', err.message);
    res.status(503).json({ error: 'Image generation failed', detail: err.message });
  }
});
