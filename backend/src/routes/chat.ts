import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { buildCharacterSystemPrompt, chatStream, extractUserMemory, Message } from '../services/grok';

export const chatRouter = Router();
chatRouter.use(authMiddleware);

const FREE_TURNS = 5;
const CONTEXT_WINDOW = 30; // keep last N messages in context

// GET /api/chat/:characterId — get or create conversation
chatRouter.get('/:characterId', async (req: AuthRequest, res: Response): Promise<void> => {
  const { characterId } = req.params;

  const character = await prisma.character.findUnique({ where: { id: characterId } });
  if (!character) { res.status(404).json({ error: 'Character not found' }); return; }

  const conversation = await prisma.conversation.findUnique({
    where: { userId_characterId: { userId: req.userId!, characterId } },
    include: {
      messages: { orderBy: { createdAt: 'asc' }, take: 50 },
    },
  });

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });

  res.json({
    conversation: conversation ?? null,
    character,
    credits: {
      free: user?.freeCredits ?? 0,
      paid: user?.paidCredits ?? 0,
    },
  });
});

// POST /api/chat/:characterId — send a message (SSE streaming)
chatRouter.post('/:characterId', async (req: AuthRequest, res: Response): Promise<void> => {
  const { characterId } = req.params;
  const { message } = req.body;

  if (!message?.trim()) { res.status(400).json({ error: 'message required' }); return; }

  // Load user and check credits
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) { res.status(401).json({ error: 'User not found' }); return; }

  if (user.freeCredits <= 0 && user.paidCredits <= 0) {
    res.status(402).json({ error: 'No credits', needPayment: true });
    return;
  }

  // Load character
  const character = await prisma.character.findUnique({ where: { id: characterId } });
  if (!character) { res.status(404).json({ error: 'Character not found' }); return; }
  if (!character.isPublic && character.creatorId !== req.userId!) {
    res.status(403).json({ error: 'Private character' }); return;
  }

  // Get or create conversation
  let conversation = await prisma.conversation.findUnique({
    where: { userId_characterId: { userId: req.userId!, characterId } },
  });

  const existingContext = (conversation?.contextJson as Message[]) ?? [];
  const userMemory = (conversation?.userMemory as Record<string, unknown>) ?? {};

  // Build messages for Grok
  const systemPrompt = buildCharacterSystemPrompt(character, userMemory);
  const contextWindow = existingContext.slice(-CONTEXT_WINDOW);
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...contextWindow,
    { role: 'user', content: message },
  ];

  // SSE streaming response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullReply = '';
  try {
    fullReply = await chatStream(messages, (chunk) => {
      res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
    });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'AI error' })}\n\n`);
    res.end();
    return;
  }

  // Persist conversation
  const newContext: Message[] = [
    ...existingContext,
    { role: 'user', content: message },
    { role: 'assistant', content: fullReply },
  ];

  // Deduct credit (free first, then paid)
  const creditUpdate = user.freeCredits > 0
    ? { freeCredits: { decrement: 1 } }
    : { paidCredits: { decrement: 1 } };

  const [updatedConversation, updatedUser] = await Promise.all([
    conversation
      ? prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            contextJson: newContext as object[],
            totalTurns: { increment: 1 },
          },
        })
      : prisma.conversation.create({
          data: {
            userId: req.userId!,
            characterId,
            contextJson: newContext as object[],
            totalTurns: 1,
            userMemory: {},
          },
        }),
    prisma.user.update({
      where: { id: req.userId! },
      data: creditUpdate,
    }),
    prisma.character.update({
      where: { id: characterId },
      data: { usageCount: { increment: 1 } },
    }),
    prisma.message.create({
      data: {
        conversationId: conversation?.id ?? '',  // will be updated after create
        role: 'user',
        content: message,
      },
    }).catch(() => {}), // non-critical
  ]);

  // Save assistant message
  await prisma.message.create({
    data: {
      conversationId: updatedConversation.id,
      role: 'assistant',
      content: fullReply,
    },
  }).catch(() => {});

  // Periodically extract user memory (every 5 turns)
  if (updatedConversation.totalTurns % 5 === 0) {
    const recentMessages = newContext.slice(-10) as Message[];
    extractUserMemory(userMemory, recentMessages).then((newMemory) => {
      prisma.conversation.update({
        where: { id: updatedConversation.id },
        data: { userMemory: newMemory as object },
      }).catch(() => {});
    });
  }

  res.write(`data: ${JSON.stringify({
    type: 'done',
    credits: { free: updatedUser.freeCredits, paid: updatedUser.paidCredits },
  })}\n\n`);
  res.end();
});
