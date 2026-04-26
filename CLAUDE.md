# 私欲玩伴 — Telegram Mini App

## 项目简介
一个 Telegram Mini App，主打 AI 情感陪伴。用户可以通过 AI 向导创建多个角色（含年龄、性格、职业、背景），与角色对话，前5次免费，之后用 Telegram Stars 付费购买对话次数。角色可公开到广场供其他用户使用，支持评价和排行榜。

---

## 技术栈
- **前端**：React + TypeScript + Vite（Telegram Mini App）
- **后端**：Node.js + Express + TypeScript
- **数据库**：PostgreSQL + Prisma ORM
- **AI**：Grok API（xAI，OpenAI 兼容接口）
- **支付**：Telegram Stars（内置支付）
- **部署**：DigitalOcean Droplet（新加坡）+ Nginx + PM2

---

## 项目结构
```
soul-link/
├── backend/
│   ├── prisma/schema.prisma       # 数据库模型
│   └── src/
│       ├── routes/auth.ts         # Telegram WebApp 登录（HMAC验证）
│       ├── routes/characters.ts   # 角色 CRUD + AI向导（wizard）
│       ├── routes/chat.ts         # SSE 流式聊天
│       ├── routes/payments.ts     # Telegram Stars 支付 + Webhook
│       ├── routes/marketplace.ts  # 角色广场 + 评价 + 排行榜
│       ├── services/grok.ts       # Grok API 调用 + prompt 构建
│       ├── middleware/auth.ts     # JWT 验证中间件
│       └── utils/prisma.ts        # Prisma client 单例
└── frontend/
    └── src/
        ├── pages/HomePage.tsx     # 我的角色列表
        ├── pages/WizardPage.tsx   # AI 引导创建角色
        ├── pages/ChatPage.tsx     # SSE 流式聊天界面
        ├── pages/MarketplacePage  # 角色广场（搜索/排序）
        ├── pages/LeaderboardPage  # 排行榜（热度/评分）
        ├── pages/ProfilePage.tsx  # 个人中心 + 购买次数
        ├── api/client.ts          # API 请求封装
        ├── hooks/useAuth.ts       # Telegram WebApp 登录 hook
        └── styles/theme.css       # Telegram 主题变量 CSS
```

---

## 服务器信息
- **IP**：168.144.108.9
- **平台**：DigitalOcean 新加坡，Ubuntu 24.04
- **SSH**：`ssh root@168.144.108.9`（已配置 SSH key）
- **应用目录**：`/app`
- **前端静态文件**：`/var/www/siyuwanban`
- **进程管理**：PM2，进程名 `siyuwanban`
- **Nginx 配置**：`/etc/nginx/sites-available/siyuwanban`

### 常用服务器命令
```bash
# 查看后端日志
ssh root@168.144.108.9 "pm2 logs siyuwanban"

# 重启后端
ssh root@168.144.108.9 "pm2 restart siyuwanban"

# 部署更新（改完代码后）
ssh root@168.144.108.9 "cd /app && git pull && cd backend && npm run build && pm2 restart siyuwanban && cp -r /app/frontend/dist /var/www/siyuwanban"
```

---

## 域名
- **主域名**：https://www.shangzongcai.com
- **注意**：`shangzongcai.com`（不带www）还被 GoDaddy Website Builder 拦截，用 `www` 版本
- **SSL**：Let's Encrypt，自动续期

---

## Telegram Bot
- **Bot 用户名**：@SiYuWanBanBot（待确认）
- **Mini App URL**：https://www.shangzongcai.com
- **Webhook URL**：https://www.shangzongcai.com/api/payments/webhook

---

## 环境变量
实际值保存在本地 `/Users/chenglyu/Desktop/soul-link/.env` 和服务器 `/app/backend/.env`。
参考 `.env.example` 了解所需变量：
```
DATABASE_URL=
TELEGRAM_BOT_TOKEN=      # @BotFather 获取
WEBHOOK_SECRET=           # 随机字符串
GROK_API_KEY=             # console.x.ai 获取
JWT_SECRET=               # 随机字符串
FRONTEND_URL=https://www.shangzongcai.com
PORT=3001
```

---

## GitHub
- **仓库**：https://github.com/LyuCheng95/siyuwanban
- **分支**：main

---

## 当前状态（2026-04-26）
- ✅ 后端运行中（PM2）
- ✅ 前端部署完成
- ✅ HTTPS 证书配置完成
- ✅ Telegram Webhook 注册完成
- ✅ 数据库迁移完成
- ⚠️ BotFather Mini App URL 需确认已改为 `https://www.shangzongcai.com`（之前误填了 shangzhongcai）
- ⚠️ `shangzongcai.com`（不带www）仍被 GoDaddy 拦截，待解决（建议迁移到 Cloudflare）

---

## 待办事项
- [ ] 在 BotFather 确认 Mini App URL 为 `https://www.shangzongcai.com`
- [ ] 将域名 DNS 迁移到 Cloudflare（解决裸域名被 GoDaddy 拦截问题）
- [ ] 在 Telegram 实测完整聊天流程
- [ ] 测试 Telegram Stars 支付流程
