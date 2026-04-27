import { Router, Request, Response } from 'express';

export const botRouter = Router();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!;
const SITE_URL = process.env.SITE_URL || 'https://siyuwanban.shangzongcai.com';

const tg = (method: string, body: object) =>
  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json());

// ── Webhook: handles /start and any message from bot users ──────────────────
// POST /api/bot/webhook
botRouter.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  // Verify secret token
  if (req.headers['x-telegram-bot-api-secret-token'] !== WEBHOOK_SECRET) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const update = req.body;
  const msg = update.message;

  if (msg?.text?.startsWith('/start')) {
    await tg('sendMessage', {
      chat_id: msg.chat.id,
      text: `嗯…你来了 💋\n\n我是*私欲玩伴*，这里有等你解锁的她们～\n点击下方按钮，进入专属空间 👇`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🔥 立即进入私欲玩伴',
            url: SITE_URL,
          },
        ]],
      },
    });
  }

  res.json({ ok: true });
});

// ── Admin: set menu button (call once) ──────────────────────────────────────
// POST /api/bot/setup  (protected by WEBHOOK_SECRET in body)
botRouter.post('/setup', async (req: Request, res: Response): Promise<void> => {
  if (req.body.secret !== WEBHOOK_SECRET) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  // 1. Set menu button for all chats
  const menuRes = await tg('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: '🔥 进入私欲玩伴',
      web_app: { url: SITE_URL },
    },
  });

  // 2. Set bot description
  const descRes = await tg('setMyDescription', {
    description: '私欲玩伴 — AI 角色陪伴平台。创建或解锁专属她，随时随地深度对话 💋\n\n点击下方按钮立即体验 👇',
  });

  // 3. Set bot short description
  const shortDescRes = await tg('setMyShortDescription', {
    short_description: '🔥 AI 角色陪伴 · 成人向 · 匿名体验',
  });

  // 4. Register bot webhook (point to new bot route)
  const webhookUrl = `${SITE_URL}/api/bot/webhook`;
  const webhookRes = await tg('setWebhook', {
    url: webhookUrl,
    secret_token: WEBHOOK_SECRET,
    allowed_updates: ['message', 'callback_query'],
  });

  res.json({ menuRes, descRes, shortDescRes, webhookRes });
});

// ── Channel post helper ──────────────────────────────────────────────────────
// POST /api/bot/post  — send a promo post to your channel
// Body: { secret, channelId, text, imageUrl? }
botRouter.post('/post', async (req: Request, res: Response): Promise<void> => {
  if (req.body.secret !== WEBHOOK_SECRET) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const { channelId, text, imageUrl } = req.body;
  if (!channelId || !text) {
    res.status(400).json({ error: 'channelId and text required' });
    return;
  }

  const button = {
    inline_keyboard: [[
      { text: '🔥 立即体验', url: SITE_URL },
    ]],
  };

  let result;
  if (imageUrl) {
    result = await tg('sendPhoto', {
      chat_id: channelId,
      photo: imageUrl,
      caption: text,
      parse_mode: 'Markdown',
      reply_markup: button,
    });
  } else {
    result = await tg('sendMessage', {
      chat_id: channelId,
      text,
      parse_mode: 'Markdown',
      reply_markup: button,
    });
  }

  res.json(result);
});
