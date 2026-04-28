/**
 * Admin / debug endpoints — 只需要 ADMIN_KEY 环境变量，不需要用户 token
 * 用法: GET /api/admin/stats?key=YOUR_ADMIN_KEY
 */
import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from '../utils/prisma';

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

// DELETE /api/admin/character/:id?key=... — 删除角色（级联清理关联数据）
adminRouter.delete('/character/:id', async (req: Request, res: Response): Promise<void> => {
  if (!checkKey(req, res)) return;
  const { id } = req.params;
  try {
    // 先删 Message（通过 Conversation），再删 Conversation、Review，最后删 Character
    const convIds = (await prisma.conversation.findMany({ where: { characterId: id }, select: { id: true } }))
      .map(c => c.id);
    if (convIds.length) await prisma.message.deleteMany({ where: { conversationId: { in: convIds } } });
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
  const char = await prisma.character.findUnique({
    where: { id: req.params.id },
    select: { portraitImages: true, portraitUrl: true },
  });
  if (!char) { res.status(404).json({ error: 'not found' }); return; }
  const toRemove = new Set(imageUrls);
  const remaining = (char.portraitImages as string[]).filter(u => !toRemove.has(u));
  const newPortraitUrl = char.portraitUrl && toRemove.has(char.portraitUrl) ? (remaining[0] ?? null) : char.portraitUrl;
  const updated = await prisma.character.update({
    where: { id: req.params.id },
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
