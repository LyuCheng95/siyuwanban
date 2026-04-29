/**
 * Admin / debug endpoints — 只需要 ADMIN_KEY 环境变量，不需要用户 token
 * 用法: GET /api/admin/stats?key=YOUR_ADMIN_KEY
 */
import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from '../utils/prisma';
import { chat, parseMeta, buildCharacterSystemPrompt, type Message } from '../services/grok';
import { generateSceneImage, shouldGenerateImage } from '../services/comfyui';

export const adminRouter = Router();

const ADMIN_KEY = process.env.ADMIN_KEY || 'sywb-admin-2026';

function checkKey(req: Request, res: Response): boolean {
  const key = req.query.key as string || req.headers['x-admin-key'] as string;
  if (key !== ADMIN_KEY) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

// GET /api/admin/stats?key=... — 整体统计
adminRouter.get('/stats', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;

  const [userCount, charCount, msgCount, convCount] = await Promise.all([
    prisma.user.count(),
    prisma.character.count(),
    prisma.message.count(),
    prisma.conversation.count(),
  ]);

  const topChars = await prisma.character.findMany({
    orderBy: { usageCount: 'desc' },
    take: 10,
    select: { name: true, usageCount: true, avgRating: true, portraitUrl: true,
              portraitImages: true, age: true, occupation: true },
  });

  const recentUsers = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { telegramId: true, firstName: true, username: true,
              freeCredits: true, paidCredits: true, createdAt: true },
  });

  res.json({
    counts: { users: userCount, characters: charCount, conversations: convCount, messages: msgCount },
    topChars: topChars.map(c => ({
      ...c,
      portraitImages: Array.isArray(c.portraitImages) ? (c.portraitImages as string[]).length : 0,
      hasPortrait: !!c.portraitUrl,
    })),
    recentUsers: recentUsers.map(u => ({
      ...u,
      telegramId: u.telegramId.toString(),
    })),
  });
});

// GET /api/admin/characters?key=...&name=林晓雅 — 查某个角色详情
adminRouter.get('/characters', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;

  const name = req.query.name as string;
  const where = name ? { name: { contains: name } } : {};

  const chars = await prisma.character.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true, name: true, age: true, occupation: true,
      portraitUrl: true, portraitImages: true,
      usageCount: true, avgRating: true, reviewCount: true,
      isPublic: true, createdAt: true,
    },
  });

  res.json(chars.map(c => ({
    ...c,
    portraitImages: c.portraitImages as string[],
  })));
});

// GET /api/admin/logs?key=...&userId=... — 查某用户的最近对话
adminRouter.get('/logs', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;

  const telegramId = req.query.telegramId as string;
  const convId = req.query.convId as string;

  if (convId) {
    const msgs = await prisma.message.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    res.json(msgs);
    return;
  }

  const user = telegramId
    ? await prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } })
    : await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });

  if (!user) { res.json({ error: 'User not found' }); return; }

  const convs = await prisma.conversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    take: 10,
    include: {
      character: { select: { name: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 3 },
    },
  });

  res.json({
    user: { id: user.id, telegramId: user.telegramId.toString(), firstName: user.firstName,
            freeCredits: user.freeCredits, paidCredits: user.paidCredits },
    conversations: convs.map(c => ({
      id: c.id,
      character: c.character.name,
      totalTurns: c.totalTurns,
      updatedAt: c.updatedAt,
      lastMessages: c.messages.map(m => ({ role: m.role, content: m.content.slice(0, 100) })),
    })),
  });
});

// GET /api/admin/payments?key=...&page=1&limit=50 — 充值流水
adminRouter.get('/payments', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;
  const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit as string || '50', 10));
  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: { select: { username: true, firstName: true, telegramId: true, paidCredits: true } },
      },
    }),
    prisma.payment.count(),
  ]);

  res.json({
    total,
    page,
    pages: Math.ceil(total / limit),
    payments: payments.map(p => ({
      id: p.id,
      provider: p.provider,
      status: p.status,
      amountUsd: p.amountUsd,
      currency: p.currency,
      diamondsGranted: p.diamondsGranted,
      createdAt: p.createdAt,
      externalId: p.externalId,
      user: {
        telegramId: p.user.telegramId.toString(),
        username: p.user.username,
        firstName: p.user.firstName,
        currentDiamonds: p.user.paidCredits,
      },
    })),
  });
});

// POST /api/admin/add-diamonds?key=... — 手动给用户加钻石
adminRouter.post('/add-diamonds', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;
  const { telegramId, amount, note } = req.body as { telegramId: string; amount: number; note?: string };
  if (!telegramId || !amount || amount <= 0) {
    res.status(400).json({ error: 'telegramId and amount required' }); return;
  }

  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const [payment, updated] = await prisma.$transaction([
    prisma.payment.create({
      data: {
        userId: user.id,
        provider: 'admin',
        status: 'completed',
        amountUsd: 0,
        diamondsGranted: amount,
        metadata: { note: note || 'manual top-up', adminKey: 'used' },
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { paidCredits: { increment: amount } },
    }),
  ]);

  res.json({ ok: true, diamondsAdded: amount, newBalance: updated.paidCredits, paymentId: payment.id });
});

// GET /api/admin/users?key=... — 用户列表
adminRouter.get('/users', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true, telegramId: true, username: true, firstName: true,
      freeCredits: true, paidCredits: true, isAnonymous: true,
      checkInStreak: true, createdAt: true,
      _count: { select: { conversations: true } },
    },
  });
  res.json(users.map(u => ({ ...u, telegramId: u.telegramId.toString() })));
});

// DELETE /api/admin/character/:id?key=... — 删除角色（级联清理关联数据）
adminRouter.delete('/character/:id', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;
  const id = req.params.id as string;
  try {
    // 先删 Message（通过 Conversation），再删 Conversation、Review，最后删 Character
    const convIds = (await prisma.conversation.findMany({ where: { characterId: id }, select: { id: true } }))
      .map(c => c.id);
    if (convIds.length) await prisma.message.deleteMany({ where: { conversationId: { in: convIds as string[] } } });
    await prisma.conversation.deleteMany({ where: { characterId: id } });
    await prisma.review.deleteMany({ where: { characterId: id } });
    await prisma.character.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/admin/character/:id/remove-images?key=... — 批量删除角色图片
adminRouter.post('/character/:id/remove-images', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;
  const { imageUrls } = req.body as { imageUrls: string[] };
  if (!Array.isArray(imageUrls) || !imageUrls.length) { res.status(400).json({ error: 'imageUrls required' }); return; }
  const charRouteId = req.params.id as string;
  const char = await prisma.character.findUnique({
    where: { id: charRouteId },
    select: { portraitImages: true, portraitUrl: true },
  });
  if (!char) { res.status(404).json({ error: 'not found' }); return; }
  const toRemove = new Set(imageUrls);
  const remaining = (char.portraitImages as string[]).filter(u => !toRemove.has(u));
  const newPortraitUrl = char.portraitUrl && toRemove.has(char.portraitUrl) ? (remaining[0] ?? null) : char.portraitUrl;
  const updated = await prisma.character.update({
    where: { id: charRouteId },
    data: { portraitImages: remaining, portraitUrl: newPortraitUrl },
    select: { id: true, name: true, portraitImages: true, portraitUrl: true },
  });
  res.json({ ok: true, remaining: (updated.portraitImages as string[]).length, portraitUrl: updated.portraitUrl });
});

// ── Regen queue (in-memory; clears on server restart) ────────────────────────
interface RegenJob {
  id: string;
  charId: string;
  charName: string;
  count: number;
  status: 'pending' | 'processing' | 'done' | 'failed';
  createdAt: string;
  error?: string;
  completedImages?: number;
}
const regenQueue: RegenJob[] = [];

// GET /api/admin/regen-queue?key=...
adminRouter.get('/regen-queue', (req: Request, res: Response): void => {
  if (!checkKey(req, res)) return;
  res.json(regenQueue);
});

// POST /api/admin/regen-queue?key=... — { charName, count?, charId? }
adminRouter.post('/regen-queue', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;
  let { charId, charName, count } = req.body as { charId?: string; charName?: string; count?: number };
  if (!charName && !charId) { res.status(400).json({ error: 'charName or charId required' }); return; }
  if (!charId && charName) {
    const char = await prisma.character.findFirst({ where: { name: charName }, select: { id: true } });
    if (char) charId = char.id;
  }
  if (!charId) { res.status(404).json({ error: 'character not found' }); return; }
  const job: RegenJob = {
    id: randomUUID(), charId, charName: charName || charId,
    count: count || 3, status: 'pending', createdAt: new Date().toISOString(),
  };
  regenQueue.push(job);
  res.json(job);
});

// PATCH /api/admin/regen-queue/:id?key=... — worker updates status/progress
adminRouter.patch('/regen-queue/:id', (req: Request, res: Response): void => {
  if (!checkKey(req, res)) return;
  const job = regenQueue.find(j => j.id === req.params.id);
  if (!job) { res.status(404).json({ error: 'job not found' }); return; }
  const allowed = ['status', 'error', 'completedImages'] as const;
  for (const k of allowed) if (req.body[k] !== undefined) (job as any)[k] = req.body[k];
  res.json(job);
});

// DELETE /api/admin/regen-queue/:id?key=...
adminRouter.delete('/regen-queue/:id', (req: Request, res: Response): void => {
  if (!checkKey(req, res)) return;
  const idx = regenQueue.findIndex(j => j.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: 'job not found' }); return; }
  regenQueue.splice(idx, 1);
  res.json({ ok: true });
});

// POST /api/admin/regen-upload?key=... — worker uploads generated image
adminRouter.post('/regen-upload', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;
  const { filename, imageBase64, charId } = req.body as { filename: string; imageBase64: string; charId?: string };
  if (!filename || !imageBase64) { res.status(400).json({ error: 'filename and imageBase64 required' }); return; }

  const SAVE_DIR = process.env.IMAGE_SAVE_DIR || '/var/www/siyuwanban/images';
  const safeName = path.basename(filename); // no path traversal
  const savePath = path.join(SAVE_DIR, safeName);

  try {
    const buffer = Buffer.from(imageBase64, 'base64');
    fs.mkdirSync(SAVE_DIR, { recursive: true });
    fs.writeFileSync(savePath, buffer);
    res.json({ ok: true, savedTo: savePath });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/admin/set-portrait?key=... — 手动设置角色图片
adminRouter.post('/set-portrait', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;
  const { characterId, portraitUrl, portraitImages } = req.body;
  if (!characterId) { res.status(400).json({ error: 'characterId required' }); return; }

  const updated = await prisma.character.update({
    where: { id: characterId },
    data: {
      ...(portraitUrl ? { portraitUrl } : {}),
      ...(portraitImages ? { portraitImages } : {}),
    },
    select: { id: true, name: true, portraitUrl: true, portraitImages: true },
  });
  res.json(updated);
});

// ── Conversation Simulator ────────────────────────────────────────────────────

async function generateUserMessage(
  context: Message[],
  intimacy: number,
  turn: number,
  characterName: string,
): Promise<string> {
  const lastAiMsg = context.filter(m => m.role === 'assistant').slice(-1)[0]?.content ?? '';

  const hintByTurn =
    turn < 5  ? '回应角色刚才说的话，轻松好奇，可以轻微调情，但不要每次都问"今天咋样"' :
    turn < 10 ? '对角色明显有好感，直接回应她的动作或暗示，主动靠近、触碰或挑逗' :
    turn < 16 ? '大胆邀请更亲密的接触，回应她的肢体动作，要求更进一步' :
    turn < 22 ? '直接要求性行为，回应她的状态，沉浸且主动' :
                '高潮后余韵，温柔低语，依偎';

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROK_API_KEY}` },
    body: JSON.stringify({
      model: 'grok-3',
      messages: [
        {
          role: 'system',
          content: `你在扮演一个正在用AI陪伴App的男性玩家，对象是角色"${characterName}"。
当前第${turn + 1}轮，亲密度${intimacy}/100。
【角色刚才说】：${lastAiMsg.slice(0, 200)}
【任务】直接回应角色刚才说的话或做的动作，风格：${hintByTurn}。
要求：必须呼应角色最后一句话，不要自顾自问"今天咋样"——回应她，推进对话。中文，10-30字，只返回消息文本。`,
        },
      ],
      max_tokens: 60,
      temperature: 0.9,
    }),
  });
  const data = await res.json() as any;
  return (data.choices?.[0]?.message?.content ?? '你好').trim().slice(0, 60);
}

// POST /api/admin/simulate-chat?key=... — 模拟对话用于测试（SSE）
adminRouter.post('/simulate-chat', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;

  const { characterId, turns = 20, startingIntimacy = 0, startingPhase = 0 } = req.body as {
    characterId: string; turns?: number; startingIntimacy?: number; startingPhase?: number;
  };

  const character = await prisma.character.findUnique({ where: { id: characterId } });
  if (!character) { res.status(404).json({ error: 'Character not found' }); return; }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  let intimacy = Math.max(0, Math.min(100, startingIntimacy));
  let phase = Math.max(0, Math.min(4, startingPhase));
  let dominance = 0, desire = 0, attach = 0;
  let mood = '期待';
  const context: Message[] = [];
  const userMemory: Record<string, unknown> = {
    _intimacyLevel: intimacy, _phaseIndex: phase, _mood: mood,
    _dominanceLevel: 0, _desireLevel: 0, _attachLevel: 0, _unlockedActs: [],
    _totalTurns: 0,
  };

  send({ type: 'start', character: character.name, turns, startingIntimacy });

  for (let i = 0; i < turns; i++) {
    // Generate user message
    let userMsg: string;
    try {
      userMsg = context.length === 0 ? '你好' : await generateUserMessage(context, intimacy, i, character.name);
    } catch { userMsg = '继续'; }

    // Build messages and call character AI
    const recentAiReplies = context
      .filter(m => m.role === 'assistant')
      .slice(-3)
      .reverse()
      .map(m => m.content);
    const systemPrompt = buildCharacterSystemPrompt(character, userMemory, recentAiReplies);
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...context.slice(-20),
      { role: 'user', content: userMsg },
    ];

    let aiReply: string;
    try {
      aiReply = await chat(messages);
    } catch (e: any) {
      send({ type: 'error', turn: i + 1, error: e.message });
      break;
    }

    const { cleanReply, meta } = parseMeta(aiReply);

    // Update state
    const prevIntimacy = intimacy;
    intimacy    = Math.max(0, Math.min(100, intimacy + meta.delta));
    dominance   = Math.max(0, Math.min(100, dominance + meta.controlDelta));
    desire      = Math.max(0, Math.min(100, desire + meta.desireDelta));
    attach      = Math.max(0, Math.min(100, attach + meta.attachDelta));
    phase       = Math.max(phase, meta.phase);
    mood        = meta.mood;

    userMemory._intimacyLevel  = intimacy;
    userMemory._phaseIndex     = phase;
    userMemory._mood           = mood;
    userMemory._dominanceLevel = dominance;
    userMemory._desireLevel    = desire;
    userMemory._attachLevel    = attach;
    userMemory._totalTurns     = i + 1;

    context.push({ role: 'user', content: userMsg });
    context.push({ role: 'assistant', content: cleanReply });

    send({
      type: 'turn',
      turn: i + 1,
      userMsg,
      aiReply: cleanReply,
      suggestions: meta.suggestions,
      state: { intimacy, phase, mood, dominance, desire, attach },
      delta: { intimacy: intimacy - prevIntimacy },
    });

    // Generate image every 5 turns
    if ((i + 1) % 5 === 0) {
      try {
        const recentForImage = [
          { role: 'user' as const, content: userMsg },
          { role: 'assistant' as const, content: cleanReply },
        ];
        const imgDecision = await shouldGenerateImage(character.name, recentForImage, character, intimacy, meta.acts) as { generate: boolean; prompt?: string; twoShot?: boolean };
        if (imgDecision.generate && imgDecision.prompt) {
          send({ type: 'image_pending', turn: i + 1, prompt: imgDecision.prompt });
          const imgUrl = await generateSceneImage(imgDecision.prompt, '', character.name);
          send({ type: 'image', turn: i + 1, url: imgUrl });
        } else {
          send({ type: 'image_skipped', turn: i + 1 });
        }
      } catch (e: any) {
        send({ type: 'image_error', turn: i + 1, error: e.message });
      }
    }
  }

  send({ type: 'done', finalState: { intimacy, phase, mood, dominance, desire, attach } });
  res.end();
});
