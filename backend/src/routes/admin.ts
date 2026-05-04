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
import { runCharacterQA, generateStoryPhases, getBaseline, saveBaseline, DEFAULT_BASELINE } from '../services/characterQA';
import { STORY_PHASES } from '../services/storyPhases';
import { genericPhases } from '../services/characterScripts';

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
      qaStatus: true, qaScore: true, qaRunAt: true,
      storyPhases: true,
      imageModel: true, height: true, weight: true,
      faceFeatures: true, faceAnchor: true, defaultOutfit: true, portraitPrompts: true,
    },
  });

  res.json(chars.map(c => {
    // storyPhases: DB value (AI-generated) → hardcoded STORY_PHASES → null
    const phases = (c.storyPhases as string[] | null)
      ?? (STORY_PHASES[c.name] as string[] | undefined)
      ?? null;
    return {
      ...c,
      portraitImages: c.portraitImages as string[],
      storyPhases: phases,
    };
  }));
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

// GET /api/admin/payments?key=...&page=1&limit=50&status=&provider=&user= — 充值流水
adminRouter.get('/payments', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;
  const page     = Math.max(1, parseInt(req.query.page as string || '1', 10));
  const limit    = Math.min(100, parseInt(req.query.limit as string || '50', 10));
  const skip     = (page - 1) * limit;
  const status   = req.query.status   as string | undefined;
  const provider = req.query.provider as string | undefined;
  const userQ    = req.query.user     as string | undefined;

  // Build where clause
  const where: any = {};
  if (status)   where.status   = status;
  if (provider) where.provider = provider;
  if (userQ) {
    where.user = {
      OR: [
        { username:  { contains: userQ, mode: 'insensitive' } },
        { firstName: { contains: userQ, mode: 'insensitive' } },
        // If numeric, also match telegramId
        ...(isNaN(Number(userQ)) ? [] : [{ telegramId: BigInt(userQ) }]),
      ],
    };
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: { select: { username: true, firstName: true, telegramId: true, paidCredits: true } },
      },
    }),
    prisma.payment.count({ where }),
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

// ── Character Creation (admin) ────────────────────────────────────────────────

// POST /api/admin/characters/create?key=... — 创建官方角色
adminRouter.post('/characters/create', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;

  const {
    name, age, gender, occupation, personality, background,
    speakingStyle, avatarEmoji, openingScene, isPublic, imageModel,
  } = req.body as {
    name: string; age: number; gender: string; occupation: string;
    personality: string; background: string; speakingStyle: string;
    avatarEmoji?: string; openingScene?: string; isPublic?: boolean; imageModel?: string;
  };

  if (!name || !age || !gender || !occupation || !personality || !background || !speakingStyle) {
    res.status(400).json({ error: '缺少必填字段: name, age, gender, occupation, personality, background, speakingStyle' });
    return;
  }

  // Get or create system user (telegramId=1)
  const systemUser = await prisma.user.upsert({
    where: { telegramId: BigInt(1) },
    update: {},
    create: {
      telegramId: BigInt(1), username: 'system', firstName: '系统账号',
      freeCredits: 0, paidCredits: 0,
    },
  });

  const character = await prisma.character.create({
    data: {
      creatorId: systemUser.id,
      name, age: Number(age), gender, occupation,
      personality, background, speakingStyle,
      avatarEmoji: avatarEmoji || '🌸',
      openingScene: openingScene || null,
      isPublic: isPublic !== false,
      imageModel: imageModel || null,
    },
  });

  res.json({ ok: true, character });
});

// ── Character Visual Assets ────────────────────────────────────────────────────

// PATCH /api/admin/characters/:id/assets — update physical/visual attributes
adminRouter.patch('/characters/:id/assets', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;
  const id = req.params.id as string;
  const { height, weight, imageModel, faceFeatures, faceAnchor, defaultOutfit, portraitPrompts } = req.body;

  const updated = await prisma.character.update({
    where: { id },
    data: {
      ...(height !== undefined ? { height: height ? Number(height) : null } : {}),
      ...(weight !== undefined ? { weight: weight ? Number(weight) : null } : {}),
      ...(imageModel !== undefined ? { imageModel: imageModel || null } : {}),
      ...(faceFeatures !== undefined ? { faceFeatures: faceFeatures || null } : {}),
      ...(faceAnchor !== undefined ? { faceAnchor: faceAnchor || null } : {}),
      ...(defaultOutfit !== undefined ? { defaultOutfit: defaultOutfit || null } : {}),
      ...(portraitPrompts !== undefined ? { portraitPrompts: portraitPrompts ?? [] } : {}),
    },
    select: { id: true, name: true },
  });
  res.json({ ok: true, id: updated.id, name: updated.name });
});

// ── Redeem Codes ──────────────────────────────────────────────────────────────

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusable I/O/0/1
  const rand = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${rand(4)}-${rand(4)}-${rand(4)}`;
}

// POST /api/admin/redeem-codes/generate  { count?: number, diamonds?: number }
adminRouter.post('/redeem-codes/generate', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;
  const count = Math.min(parseInt(req.body.count || '1', 10), 100);
  const diamonds = parseInt(req.body.diamonds || '100', 10);

  const codes = Array.from({ length: count }, () => ({
    code: generateCode(),
    diamondsGranted: diamonds,
  }));

  await prisma.redeemCode.createMany({ data: codes, skipDuplicates: true });
  res.json({ ok: true, codes: codes.map(c => c.code) });
});

// GET /api/admin/redeem-codes
adminRouter.get('/redeem-codes', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;
  const codes = await prisma.redeemCode.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { usedBy: { select: { username: true, firstName: true, telegramId: true } } },
  });
  res.json(codes.map(c => ({
    ...c,
    usedBy: c.usedBy ? { ...c.usedBy, telegramId: c.usedBy.telegramId.toString() } : null,
  })));
});

// POST /api/admin/characters/:id/qa?key=... — 触发角色自检（SSE，逐轮可视化）
adminRouter.post('/characters/:id/qa', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;

  const id = req.params.id as string;
  const character = await prisma.character.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!character) { res.status(404).json({ error: 'Character not found' }); return; }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  send({ type: 'start', characterName: character.name });

  try {
    await runCharacterQA(id, (e) => send(e));
  } catch (e: any) {
    send({ type: 'error', message: e.message });
  }

  res.end();
});

// POST /api/admin/characters/:id/generate-phases?key=... — 生成剧情脚本
adminRouter.post('/characters/:id/generate-phases', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;

  const charId = req.params.id as string;
  const character = await prisma.character.findUnique({ where: { id: charId } });
  if (!character) { res.status(404).json({ error: 'Character not found' }); return; }

  try {
    const phases = await generateStoryPhases(character as any);
    await prisma.character.update({ where: { id: charId }, data: { storyPhases: phases } });
    res.json({ ok: true, phases });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/admin/characters/:id/save-phases?key=... — 手动保存/修改剧情脚本
adminRouter.post('/characters/:id/save-phases', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;
  const { phases } = req.body as { phases: string[] };
  if (!Array.isArray(phases) || phases.length !== 5) {
    res.status(400).json({ error: 'phases must be array of 5 strings' }); return;
  }
  await prisma.character.update({ where: { id: req.params.id as string }, data: { storyPhases: phases } });
  res.json({ ok: true });
});

// POST /api/admin/characters/:id/setup?key=... — 全流程 SSE：生成剧本 + 排队生图 + QA自检
adminRouter.post('/characters/:id/setup', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;

  const character = await prisma.character.findUnique({ where: { id: req.params.id as string } });
  if (!character) { res.status(404).json({ error: 'Character not found' }); return; }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  // Step 1: Generate story phases
  send({ type: 'step', step: 'phases', status: 'start', message: '正在生成5段剧情脚本…' });
  try {
    const phases = await generateStoryPhases(character as any);
    await prisma.character.update({ where: { id: character.id }, data: { storyPhases: phases } });
    send({ type: 'step', step: 'phases', status: 'done', phases });
  } catch (e: any) {
    send({ type: 'step', step: 'phases', status: 'error', message: e.message });
    res.end(); return;
  }

  // Step 2: Queue album generation (requires local ComfyUI worker)
  const { randomUUID } = await import('crypto');
  const albumJob = { id: randomUUID(), charId: character.id, charName: character.name, count: 3, status: 'pending' as const, createdAt: new Date().toISOString() };
  regenQueue.push(albumJob);
  send({ type: 'step', step: 'album', status: 'queued', jobId: albumJob.id, message: '已加入写真生成队列（需本地 Worker 运行）' });

  // Step 3: QA self-check
  send({ type: 'step', step: 'qa', status: 'start', message: '开始运行自检对话…' });
  try {
    await runCharacterQA(character.id, (e) => send(e));
  } catch (e: any) {
    send({ type: 'step', step: 'qa', status: 'error', message: e.message });
  }

  send({ type: 'setup_done' });
  res.end();
});

// GET /api/admin/characters/:id/qa?key=... — 获取已有QA报告
adminRouter.get('/characters/:id/qa', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;
  const char = await prisma.character.findUnique({
    where: { id: req.params.id as string },
    select: { id: true, name: true, qaStatus: true, qaScore: true, qaReport: true, qaRunAt: true },
  });
  if (!char) { res.status(404).json({ error: 'not found' }); return; }
  res.json(char);
});

// GET /api/admin/baseline?key=... — 获取评审基准
adminRouter.get('/baseline', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;
  const baseline = await getBaseline();
  res.json(baseline);
});

// PUT /api/admin/baseline?key=... — 更新评审基准
adminRouter.put('/baseline', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;
  const baseline = req.body;
  if (!baseline.criteria || !Array.isArray(baseline.criteria)) {
    res.status(400).json({ error: 'criteria array required' }); return;
  }
  await saveBaseline(baseline);
  res.json({ ok: true });
});

// GET /api/admin/baseline/default?key=... — 获取默认基准（重置用）
adminRouter.get('/baseline/default', (req: Request, res: Response): void => {
  if (!checkKey(req, res)) return;
  res.json(DEFAULT_BASELINE);
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
    const systemPrompt = buildCharacterSystemPrompt(character as any, userMemory, recentAiReplies);
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
        const imgDecision = await shouldGenerateImage(character.name, recentForImage, character, intimacy, meta.acts, meta.scene || character.occupation || '') as { generate: boolean; prompt?: string; twoShot?: boolean };
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

// ── Worker: Image Upload ──────────────────────────────────────────────────────

// POST /api/admin/images/upload?key=... — multipart upload from local worker
// Returns: { url: string }
adminRouter.post('/images/upload', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;

  const SAVE_DIR = process.env.IMAGE_SAVE_DIR || '/var/www/siyuwanban/images';
  const FRONTEND_URL = process.env.FRONTEND_URL || 'https://siyuwanban.shangzongcai.com';

  // Accept multipart/form-data (the worker sends FormData)
  // We read the raw body manually since express.json() won't parse multipart.
  // Use a simple boundary parser for the `image` field.
  try {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      res.status(400).json({ error: 'multipart/form-data required' }); return;
    }

    const boundary = contentType.split('boundary=')[1]?.trim();
    if (!boundary) { res.status(400).json({ error: 'missing boundary' }); return; }

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', resolve);
      req.on('error', reject);
    });
    const body = Buffer.concat(chunks);

    // Extract filename from Content-Disposition and the image bytes
    const boundaryBuf = Buffer.from(`--${boundary}`);
    const parts = splitBuffer(body, boundaryBuf);
    let imageBuffer: Buffer | null = null;
    let originalFilename = `upload_${Date.now()}.png`;

    for (const part of parts) {
      const headerEnd = indexOf(part, Buffer.from('\r\n\r\n'));
      if (headerEnd === -1) continue;
      const headerStr = part.slice(0, headerEnd).toString();
      if (!headerStr.includes('name="image"')) continue;
      const match = headerStr.match(/filename="([^"]+)"/);
      if (match) originalFilename = path.basename(match[1]);
      // +4 to skip \r\n\r\n, -2 to trim trailing \r\n before boundary
      imageBuffer = part.slice(headerEnd + 4, part.length - 2);
      break;
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      res.status(400).json({ error: 'no image data found' }); return;
    }

    const saveName = originalFilename.startsWith('album_') || originalFilename.startsWith('scene_') || originalFilename.startsWith('worker_')
      ? originalFilename
      : `worker_${Date.now()}_${originalFilename}`;
    const savePath = path.join(SAVE_DIR, saveName);
    fs.mkdirSync(SAVE_DIR, { recursive: true });
    fs.writeFileSync(savePath, imageBuffer);

    const url = `${FRONTEND_URL}/images/${saveName}`;
    console.log(`[admin/upload] saved ${savePath} (${imageBuffer.length} bytes)`);
    res.json({ url });
  } catch (e: any) {
    console.error('[admin/upload] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/characters/:id/generate-album?key=... — proxy to local worker
// Body: { prompts?, normalCount?, revealingCount? }
// Default: 4 normal + 1 revealing (5 total)
adminRouter.post('/characters/:id/generate-album', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;

  const charId = req.params.id as string;
  const char = await prisma.character.findUnique({
    where: { id: charId },
    select: { id: true, name: true, imageModel: true, portraitPrompts: true, faceAnchor: true, faceFeatures: true },
  });
  if (!char) { res.status(404).json({ error: 'character not found' }); return; }

  const WORKER_URL = process.env.WORKER_URL || 'http://localhost:7080';
  const WORKER_KEY = process.env.WORKER_KEY || '';

  const normalCount   = parseInt(req.body.normalCount   ?? '4', 10);
  const revealingCount = parseInt(req.body.revealingCount ?? '1', 10);

  // Normal prompts: from body override or DB portraitPrompts
  const dbPrompts: string[] = Array.isArray(char.portraitPrompts) ? (char.portraitPrompts as string[]) : [];
  const normalPrompts: string[] = (Array.isArray(req.body.prompts) && req.body.prompts.length)
    ? (req.body.prompts as string[]).slice(0, normalCount)
    : dbPrompts.slice(0, normalCount);

  if (!normalPrompts.length) {
    res.status(400).json({ error: 'no prompts — set portraitPrompts in DB or pass prompts in body' }); return;
  }

  // Build revealing prompts from character anchor fields
  const revealingPrompts: string[] = [];
  if (revealingCount > 0) {
    const anchor = [char.faceAnchor, char.faceFeatures].filter(Boolean).join(', ') || char.name;
    // Variants of revealing poses
    const revealingVariants = [
      `${anchor}, completely naked, bare breasts fully exposed, (erect nipples:1.5), (pussy visible:1.5), lying on bed, seductive pose, bedroom, soft lighting, sultry expression, legs slightly apart`,
      `${anchor}, topless, bare breasts, sitting on bed edge, hands behind back, arching back, intimate lighting, looking at viewer with desire`,
      `${anchor}, completely naked, standing by window, soft natural light, hands covering chest partially, shy seductive expression`,
    ];
    for (let i = 0; i < revealingCount; i++) {
      revealingPrompts.push(revealingVariants[i % revealingVariants.length]);
    }
  }

  const prompts = [...normalPrompts, ...revealingPrompts];
  const count   = prompts.length;

  const workerHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (WORKER_KEY) workerHeaders['X-Worker-Key'] = WORKER_KEY;

  try {
    // Submit job to worker — returns immediately with jobId
    const submitRes = await fetch(`${WORKER_URL}/generate-album`, {
      method: 'POST',
      headers: workerHeaders,
      body: JSON.stringify({ charId, characterName: char.name, modelFile: char.imageModel || undefined, prompts, count }),
    });
    if (!submitRes.ok) {
      const err = await submitRes.text();
      res.status(502).json({ error: `worker error: ${err}` }); return;
    }
    const { jobId, position, total } = await submitRes.json() as { jobId: string; position: number; total: number };
    res.json({ ok: true, jobId, position, total });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/characters/:id/job/:jobId?key=... — poll worker job status
adminRouter.get('/characters/:id/job/:jobId', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;
  const WORKER_URL = process.env.WORKER_URL || 'http://localhost:7080';
  const WORKER_KEY = process.env.WORKER_KEY || '';
  try {
    const r = await fetch(`${WORKER_URL}/job/${req.params.jobId}`, {
      signal: AbortSignal.timeout(5000),
      headers: WORKER_KEY ? { 'X-Worker-Key': WORKER_KEY } : {},
    });
    const data = await r.json();
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

// POST /api/admin/characters/:id/append-image?key=... — worker calls this per image
adminRouter.post('/characters/:id/append-image', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;
  const { url } = req.body as { url: string };
  if (!url) { res.status(400).json({ error: 'url required' }); return; }
  const charId = req.params.id as string;
  const char = await prisma.character.findUnique({ where: { id: charId }, select: { portraitImages: true, portraitUrl: true } });
  if (!char) { res.status(404).json({ error: 'not found' }); return; }
  const current = Array.isArray(char.portraitImages) ? char.portraitImages as string[] : [];
  const merged = [...current, url];
  await prisma.character.update({
    where: { id: charId },
    data: { portraitImages: merged, ...(char.portraitUrl ? {} : { portraitUrl: url }) },
  });
  console.log(`[append-image] ${charId} +1 → total ${merged.length}`);
  res.json({ ok: true, total: merged.length });
});

// GET /api/admin/worker/ping?key=... — check if local worker is reachable
adminRouter.get('/worker/ping', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;
  const WORKER_URL = process.env.WORKER_URL || 'http://localhost:7080';
  try {
    const r = await fetch(`${WORKER_URL}/ping`, { signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const data = await r.json();
      res.json({ online: true, ...data as object });
    } else {
      res.json({ online: false, status: r.status });
    }
  } catch (e: any) {
    res.json({ online: false, error: e.message });
  }
});

// ── Multipart helpers ─────────────────────────────────────────────────────────
function indexOf(buf: Buffer, search: Buffer, start = 0): number {
  for (let i = start; i <= buf.length - search.length; i++) {
    if (buf.slice(i, i + search.length).equals(search)) return i;
  }
  return -1;
}

function splitBuffer(buf: Buffer, delimiter: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  let start = 0;
  let idx = indexOf(buf, delimiter, start);
  while (idx !== -1) {
    parts.push(buf.slice(start, idx));
    start = idx + delimiter.length;
    idx = indexOf(buf, delimiter, start);
  }
  parts.push(buf.slice(start));
  return parts.filter(p => p.length > 4); // drop empty boundary lines
}

// ── Scene Image Cache ─────────────────────────────────────────────────────────

// GET /api/admin/scene-images?key=&characterId=&page=
adminRouter.get('/scene-images', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;
  const characterId = req.query.characterId as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const perPage = 30;

  const where = characterId ? { characterId } : {};
  const [items, total] = await Promise.all([
    prisma.sceneImage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { character: { select: { id: true, name: true } } },
    }),
    prisma.sceneImage.count({ where }),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / perPage) });
});

// DELETE /api/admin/scene-images/:id?key=...
adminRouter.delete('/scene-images/:id', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;
  await prisma.sceneImage.delete({ where: { id: req.params.id as string } });
  res.json({ ok: true });
});
