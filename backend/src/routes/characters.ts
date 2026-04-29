import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { guideCharacterCreation } from '../services/grok';
import { z } from 'zod';

export const characterRouter = Router();
characterRouter.use(authMiddleware);

// In-memory wizard sessions (per user)
const wizardSessions = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>();

// POST /api/characters/wizard — AI-guided character creation chat
characterRouter.post('/wizard', async (req: AuthRequest, res: Response): Promise<void> => {
  const { message } = req.body;
  if (!message) { res.status(400).json({ error: 'message required' }); return; }

  const sessionKey = req.userId!;
  const history = wizardSessions.get(sessionKey) ?? [];

  // First message: add a welcome context
  const userInput = history.length === 0
    ? `我想创建一个AI陪伴角色。${message}`
    : message;

  const { reply, isComplete, characterData } = await guideCharacterCreation(history, userInput);

  history.push({ role: 'user', content: userInput });
  history.push({ role: 'assistant', content: reply });
  wizardSessions.set(sessionKey, history);

  if (isComplete && characterData) {
    wizardSessions.delete(sessionKey);
    res.json({ reply, isComplete: true, characterData });
    return;
  }

  res.json({ reply, isComplete: false });
});

// POST /api/characters/wizard/reset
characterRouter.post('/wizard/reset', (req: AuthRequest, res: Response) => {
  wizardSessions.delete(req.userId!);
  res.json({ ok: true });
});

const createSchema = z.object({
  name: z.string().min(1).max(50),
  age: z.number().int().min(1).max(120),
  gender: z.string().max(10),
  occupation: z.string().max(100),
  personality: z.string().max(500),
  background: z.string().max(1000),
  speakingStyle: z.string().max(300),
  avatarEmoji: z.string().max(8).default('🤖'),
  isPublic: z.boolean().default(true),
});

// POST /api/characters — save a character
characterRouter.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const character = await prisma.character.create({
    data: { ...parsed.data, creatorId: req.userId! },
  });
  res.status(201).json(character);
});

// GET /api/characters/mine — user's own characters
characterRouter.get('/mine', async (req: AuthRequest, res: Response): Promise<void> => {
  const characters = await prisma.character.findMany({
    where: { creatorId: req.userId! },
    orderBy: { createdAt: 'desc' },
  });
  res.json(characters);
});

// GET /api/characters/:id
characterRouter.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const character = await prisma.character.findUnique({
    where: { id: req.params.id as string },
    include: {
      creator: { select: { username: true, firstName: true } },
      reviews: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { username: true, firstName: true } } },
      },
    },
  });
  if (!character) { res.status(404).json({ error: 'Not found' }); return; }
  if (!character.isPublic && character.creatorId !== req.userId!) {
    res.status(403).json({ error: 'Private character' }); return;
  }
  res.json(character);
});

// PATCH /api/characters/:id
characterRouter.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const character = await prisma.character.findUnique({ where: { id: req.params.id as string } });
  if (!character || character.creatorId !== req.userId!) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }
  const updated = await prisma.character.update({
    where: { id: req.params.id as string },
    data: req.body,
  });
  res.json(updated);
});

// DELETE /api/characters/:id
characterRouter.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const character = await prisma.character.findUnique({ where: { id: req.params.id as string } });
  if (!character || character.creatorId !== req.userId!) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }
  await prisma.character.delete({ where: { id: req.params.id as string } });
  res.json({ ok: true });
});
