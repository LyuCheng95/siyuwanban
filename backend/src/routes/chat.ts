import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { buildCharacterSystemPrompt, chatStream, extractUserMemory, parseMeta, Message } from '../services/grok';
import { generateSceneImage, shouldGenerateImage } from '../services/comfyui';

export const chatRouter = Router();
chatRouter.use(authMiddleware);

const CONTEXT_WINDOW = 30;

// GET /api/chat — list all conversations for current user (for chat history)
chatRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const conversations = await prisma.conversation.findMany({
    where: { userId: req.userId! },
    orderBy: { updatedAt: 'desc' },
    include: {
      character: {
        select: { id: true, name: true, nameEn: true, avatarEmoji: true, occupation: true, occupationEn: true, portraitUrl: true },
      },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  res.json(conversations.map(c => ({
    id: c.id,
    totalTurns: c.totalTurns,
    updatedAt: c.updatedAt,
    character: c.character,
    lastMessage: c.messages[0] ?? null,
    intimacy: (c.userMemory as any)?._intimacyLevel ?? 0,
    mood: (c.userMemory as any)?._mood ?? '期待✨',
  })));
});

// GET /api/chat/:characterId — get or create conversation
chatRouter.get('/:characterId', async (req: AuthRequest, res: Response): Promise<void> => {
  const { characterId } = req.params;

  const character = await prisma.character.findUnique({ where: { id: characterId as string } });
  if (!character) { res.status(404).json({ error: 'Character not found' }); return; }

  const conversation = await prisma.conversation.findUnique({
    where: { userId_characterId: { userId: req.userId!, characterId: characterId as string } },
    include: {
      messages: { orderBy: { createdAt: 'asc' }, take: 50 },
    },
  });

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  const userMemory = (conversation?.userMemory as Record<string, unknown>) ?? {};

  res.json({
    conversation: conversation ?? null,
    character,
    credits: {
      free: user?.freeCredits ?? 0,
      paid: user?.paidCredits ?? 0,
    },
    intimacy: (userMemory as any)._intimacyLevel ?? 0,
    dominance: (userMemory as any)._dominanceLevel ?? 0,
    desire: (userMemory as any)._desireLevel ?? 0,
    attach: (userMemory as any)._attachLevel ?? 0,
    mood: (userMemory as any)._mood ?? '期待✨',
    openingScene:   character.openingScene   ?? null,
    openingSceneEn: character.openingSceneEn ?? null,
    phase: (userMemory as any)._phaseIndex ?? 0,
    questionCount: (userMemory as any)._questionCount ?? 0,
    albumImages: (userMemory as any)._albumImages ?? [],
  });
});

// POST /api/chat/:characterId/save-image — save a generated image URL to the user's album
chatRouter.post('/:characterId/save-image', async (req: AuthRequest, res: Response): Promise<void> => {
  const { imageUrl } = req.body as { imageUrl: string };
  if (!imageUrl) { res.status(400).json({ error: 'imageUrl required' }); return; }

  const conv = await prisma.conversation.findUnique({
    where: { userId_characterId: { userId: req.userId!, characterId: req.params.characterId as string } },
  });
  if (!conv) { res.status(404).json({ error: 'conversation not found' }); return; }

  const userMemory = (conv.userMemory as Record<string, unknown>) ?? {};
  const existing: string[] = (userMemory as any)._albumImages ?? [];
  if (!existing.includes(imageUrl)) {
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { userMemory: { ...userMemory, _albumImages: [...existing, imageUrl] } as object },
    });
  }
  res.json({ ok: true, total: existing.length + (existing.includes(imageUrl) ? 0 : 1) });
});

// POST /api/chat/:characterId — send a message (SSE streaming)
chatRouter.post('/:characterId', async (req: AuthRequest, res: Response): Promise<void> => {
  const { characterId } = req.params;
  const { message } = req.body;

  if (!message?.trim()) { res.status(400).json({ error: 'message required' }); return; }

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) { res.status(401).json({ error: 'User not found' }); return; }

  if (user.paidCredits <= 0) {
    res.status(402).json({ error: 'insufficient_diamonds', diamonds: 0 }); return;
  }

  const character = await prisma.character.findUnique({ where: { id: characterId as string } });
  if (!character) { res.status(404).json({ error: 'Character not found' }); return; }
  if (!character.isPublic && character.creatorId !== req.userId!) {
    res.status(403).json({ error: 'Private character' }); return;
  }

  const conversation = await prisma.conversation.findUnique({
    where: { userId_characterId: { userId: req.userId!, characterId: characterId as string } },
  });

  const existingContext = (conversation?.contextJson as Message[]) ?? [];
  const userMemory = (conversation?.userMemory as Record<string, unknown>) ?? {};

  // Build messages for Grok
  const recentAiReplies = existingContext
    .filter(m => m.role === 'assistant')
    .slice(-3)
    .reverse()
    .map(m => m.content);
  const userLang = ((user as any).language ?? 'zh') as 'zh' | 'en';
  const systemPrompt = buildCharacterSystemPrompt(character as any, userMemory, recentAiReplies, user.nickname, userLang);
  const contextWindow = existingContext.slice(-CONTEXT_WINDOW);
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...contextWindow,
    { role: 'user', content: message },
  ];

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Stream chunks to client — client hides <META> from display in real time
  let fullReply = '';
  try {
    fullReply = await chatStream(messages, (chunk) => {
      res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
    });
  } catch {
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'AI error' })}\n\n`);
    res.end();
    return;
  }

  // Parse META from full reply
  const { cleanReply, meta } = parseMeta(fullReply);

  // Update all status levels (clamped 0-100)
  const prevIntimacy = (userMemory as any)._intimacyLevel ?? 0;
  const newIntimacy = Math.max(0, Math.min(100, prevIntimacy + meta.delta));
  const prevDominance = (userMemory as any)._dominanceLevel ?? 0;
  const newDominance = Math.max(0, Math.min(100, prevDominance + meta.controlDelta));
  const prevDesire = (userMemory as any)._desireLevel ?? 0;
  const newDesire = Math.max(0, Math.min(100, prevDesire + meta.desireDelta));
  const prevAttach = (userMemory as any)._attachLevel ?? 0;
  const newAttach = Math.max(0, Math.min(100, prevAttach + meta.attachDelta));

  // Ratchet: merge unlocked acts (append-only, dedup)
  const existingActs: string[] = (userMemory as any)._unlockedActs ?? [];
  const newUnlockedActs = Array.from(new Set([...existingActs, ...meta.acts]));

  // Ratchet: phase index only moves forward
  const existingPhase: number = (userMemory as any)._phaseIndex ?? 0;
  const newPhaseIndex = Math.max(existingPhase, meta.phase);

  // Ratchet: question count for 椎名老师 only moves forward
  const existingQn: number = (userMemory as any)._questionCount ?? 0;
  const newQuestionCount = meta.qn !== null ? Math.max(existingQn, meta.qn) : existingQn;

  // Send replace event so frontend shows clean text
  res.write(`data: ${JSON.stringify({ type: 'replace', text: cleanReply })}\n\n`);

  // Persist conversation with clean reply
  const newContext: Message[] = [
    ...existingContext,
    { role: 'user', content: message },
    { role: 'assistant', content: cleanReply },
  ];

  const updatedUserMemory = {
    ...userMemory,
    _intimacyLevel: newIntimacy,
    _dominanceLevel: newDominance,
    _desireLevel: newDesire,
    _attachLevel: newAttach,
    _mood: meta.mood,
    _unlockedActs: newUnlockedActs,
    _phaseIndex: newPhaseIndex,
    _questionCount: newQuestionCount,
    _totalTurns: ((userMemory as any)._totalTurns ?? 0) + 1,
  };

  // Persist conversation + check image scene concurrently
  const recentForImage = [
    { role: 'user' as const, content: message },
    { role: 'assistant' as const, content: cleanReply },
  ];

  const [imageDecision, [updatedConversation, updatedUser]] = await Promise.all([
    (meta.genImg && meta.imgPrompt)
      ? Promise.resolve({ generate: true, prompt: meta.imgPrompt, twoShot: newPhaseIndex >= 2 })
      : shouldGenerateImage(character.name, recentForImage, character, newIntimacy, newUnlockedActs) as Promise<{ generate: boolean; prompt?: string; twoShot?: boolean }>,
    Promise.all([
      conversation
        ? prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              contextJson: newContext as object[],
              totalTurns: { increment: 1 },
              userMemory: updatedUserMemory as object,
            },
          })
        : prisma.conversation.create({
            data: {
              userId: req.userId!,
              characterId: characterId as string,
              contextJson: newContext as object[],
              totalTurns: 1,
              userMemory: updatedUserMemory as object,
            },
          }),
      prisma.user.update({
        where: { id: req.userId!, paidCredits: { gt: 0 } },
        data: { paidCredits: { decrement: 1 } },
      }),
      prisma.character.update({
        where: { id: characterId as string },
        data: { usageCount: { increment: 1 } },
      }),
    ] as const),
  ]);

  // Send meta event — include imagePrompt if scene is spicy
  res.write(`data: ${JSON.stringify({
    type: 'meta',
    mood: meta.mood,
    suggestions: meta.suggestions,
    intimacy: newIntimacy,
    dominance: newDominance,
    desire: newDesire,
    attach: newAttach,
    imagePrompt: imageDecision.generate ? imageDecision.prompt : null,
    imageTwoShot: imageDecision.generate ? (imageDecision.twoShot ?? false) : false,
    phase: newPhaseIndex,
    questionCount: newQuestionCount,
  })}\n\n`);

  // Save messages to DB (fire and forget)
  prisma.message.createMany({
    data: [
      { conversationId: updatedConversation.id, role: 'user', content: message },
      { conversationId: updatedConversation.id, role: 'assistant', content: cleanReply },
    ],
  }).catch(() => {});

  // Send done event
  res.write(`data: ${JSON.stringify({
    type: 'done',
    credits: { free: updatedUser.freeCredits, paid: updatedUser.paidCredits },
  })}\n\n`);

  // Periodically extract user memory (every 5 turns)
  if (updatedConversation.totalTurns % 5 === 0) {
    const recentMessages = newContext.slice(-10) as Message[];
    extractUserMemory(userMemory, recentMessages).then((newMemory) => {
      prisma.conversation.update({
        where: { id: updatedConversation.id },
        data: { userMemory: {
          ...newMemory,
          _intimacyLevel: newIntimacy,
          _dominanceLevel: newDominance,
          _desireLevel: newDesire,
          _attachLevel: newAttach,
          _mood: meta.mood,
        } as object },
      }).catch(() => {});
    });
  }

  res.end();
});
