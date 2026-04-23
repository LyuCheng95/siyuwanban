# Soul Link — Telegram Mini App 部署指南

## 快速开始

### 1. 创建 Telegram Bot

1. 打开 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot`，按提示设置名字和用户名
3. 保存 `BOT_TOKEN`
4. 发送 `/newapp`，关联刚创建的 Bot，上传 Mini App

### 2. 获取 Grok API Key

1. 前往 [console.x.ai](https://console.x.ai)
2. 创建 API Key，保存备用

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入所有变量
```

### 4. 本地开发

```bash
# 启动数据库
docker-compose up postgres -d

# 后端
cd backend
npm install
npx prisma migrate dev --name init
npm run dev

# 前端（新终端）
cd frontend
npm install
npm run dev
```

### 5. 生产部署

```bash
docker-compose up -d --build
```

### 6. 注册 Telegram Webhook

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/api/payments/webhook",
    "secret_token": "<WEBHOOK_SECRET>",
    "allowed_updates": ["message", "pre_checkout_query"]
  }'
```

### 7. 在 BotFather 设置 Mini App URL

```
/setmenubutton → 选择你的 Bot → Web App → 填入 https://your-domain.com
```

---

## 项目结构

```
soul-link/
├── backend/
│   ├── prisma/schema.prisma     # 数据库模型
│   └── src/
│       ├── routes/
│       │   ├── auth.ts          # Telegram WebApp 登录
│       │   ├── characters.ts    # 角色 CRUD + AI向导
│       │   ├── chat.ts          # 流式聊天 (SSE)
│       │   ├── payments.ts      # Telegram Stars 支付
│       │   └── marketplace.ts   # 广场 + 评价 + 排行榜
│       └── services/grok.ts     # Grok AI 集成
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── HomePage.tsx     # 我的角色列表
│       │   ├── WizardPage.tsx   # AI引导创建角色
│       │   ├── ChatPage.tsx     # 流式聊天界面
│       │   ├── MarketplacePage  # 角色广场
│       │   ├── LeaderboardPage  # 排行榜
│       │   └── ProfilePage.tsx  # 个人 + 购买次数
│       └── api/client.ts        # API 请求封装
└── docker-compose.yml
```

## 核心功能说明

| 功能 | 实现方式 |
|------|---------|
| Telegram 登录 | 验证 `initData` HMAC，签发 JWT |
| AI 角色向导 | Grok 多轮对话，最终输出结构化 JSON |
| 流式聊天 | SSE (Server-Sent Events) 实时输出 |
| 情感记忆 | 每5轮对话提取用户信息存入 `userMemory` |
| 免费/付费 | 每用户5次免费，用 Telegram Stars 购买更多 |
| 支付 | Telegram Stars 内置支付，无需第三方 |
| 角色广场 | 公开角色按热度/评分/最新排序、搜索 |
| 排行榜 | 按使用次数和平均评分双榜 |
