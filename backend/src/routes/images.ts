import { Router, Response } from 'express';
import fetch from 'node-fetch';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { saveSceneImage } from '../services/sceneCache';
import { prisma } from '../utils/prisma';

export const imagesRouter = Router();
imagesRouter.use(authMiddleware);

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:7080';
const WORKER_KEY = process.env.WORKER_KEY || '';

// POST /api/images/generate — generate or reuse a cached scene image (via local worker)
imagesRouter.post('/generate', async (req: AuthRequest, res: Response): Promise<void> => {
  const { prompt, negative, characterName, characterId } = req.body;

  if (!prompt?.trim()) {
    res.status(400).json({ error: 'prompt required' });
    return;
  }

  try {
    // Each user-triggered generation always creates a fresh image (no cache lookup)
    // Users pay 1 diamond per image and expect a new scene each time
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { paidCredits: true },
    });
    if (!user || user.paidCredits < 2) {
      res.status(402).json({ error: 'insufficient_diamonds' });
      return;
    }

    // Deduct before generating (prevents double-spend on retry)
    await prisma.user.update({
      where: { id: req.userId! },
      data: { paidCredits: { decrement: 2 } },
    });

    let url: string;
    try {
      // Route through local worker (SSH tunnel: server localhost:7080 → local worker)
      // Step 1: enqueue the job (fast, returns jobId immediately)
      const enqueueRes = await fetch(`${WORKER_URL}/generate-scene-by-name`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(WORKER_KEY ? { 'x-worker-key': WORKER_KEY } : {}),
        },
        body: JSON.stringify({ prompt, negative, characterName }),
      });
      if (!enqueueRes.ok) {
        const errText = await enqueueRes.text().catch(() => '');
        throw new Error(`Worker enqueue error ${enqueueRes.status}: ${errText}`);
      }
      const { jobId } = await enqueueRes.json() as { jobId: string };

      // Step 2: poll until done (max 150s, every 3s)
      const deadline = Date.now() + 150_000;
      url = await (async () => {
        while (Date.now() < deadline) {
          await new Promise(r => setTimeout(r, 3000));
          const pollRes = await fetch(`${WORKER_URL}/scene-job/${jobId}`, {
            headers: WORKER_KEY ? { 'x-worker-key': WORKER_KEY } : {},
          });
          if (!pollRes.ok) continue;
          const job = await pollRes.json() as { status: string; url?: string; error?: string };
          if (job.status === 'done' && job.url) return job.url;
          if (job.status === 'failed') throw new Error(`Worker job failed: ${job.error}`);
          // status === 'pending' | 'running' — keep polling
        }
        throw new Error('Image generation timed out after 150s');
      })();
    } catch (genErr: any) {
      // Refund the diamonds — generation failed (worker offline, ComfyUI down, etc.)
      await prisma.user.update({
        where: { id: req.userId! },
        data: { paidCredits: { increment: 2 } },
      }).catch(() => {});
      console.error('[ImageGen] Worker call failed:', genErr.message);
      res.status(503).json({ error: 'worker_offline', detail: genErr.message });
      return;
    }

    // Save to cache for future reuse
    if (characterId) {
      saveSceneImage(characterId, prompt, url).catch(() => {});
    }

    const updatedUser = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { paidCredits: true },
    });

    res.json({ url, paid: updatedUser?.paidCredits ?? 0 });
  } catch (err: any) {
    console.error('[ImageGen]', err.message);
    res.status(503).json({ error: 'Image generation failed', detail: err.message });
  }
});
