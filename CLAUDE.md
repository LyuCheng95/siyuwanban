# 私欲玩伴 — Telegram Mini App

## 项目简介
一个 Telegram Mini App，主打 AI 情感陪伴 + 成人角色扮演。用户可以与预设的 AI 角色对话，前5次免费，之后用钻石（付费货币）购买对话次数。角色可公开到广场供其他用户使用，支持评价和排行榜。每个角色都有专属剧情脚本，AI 会按剧情阶段主动推进，永不拒绝用户请求。

---

## 技术栈
- **前端**：React + TypeScript + Vite（Telegram Mini App）
- **后端**：Node.js + Express + TypeScript
- **数据库**：PostgreSQL + Prisma ORM
- **AI**：Grok API（xAI，model: `grok-3`，OpenAI 兼容接口）
- **图片生成**：本地 ComfyUI（四模型策略）+ 本地 Worker 服务（SSH 反向隧道）
- **支付**：Stripe（银行卡，live 模式）+ 直连 USDT TRC-20 钱包监控（0手续费）
- **部署**：DigitalOcean Droplet（新加坡）+ Nginx + PM2

---

## 项目结构
```
siyuwanban/
├── backend/
│   ├── prisma/schema.prisma           # 数据库模型（需 generate 后才生效）
│   └── src/
│       ├── routes/
│       │   ├── auth.ts                # Telegram WebApp 登录（HMAC验证）+ 匿名登录
│       │   ├── characters.ts          # 角色 CRUD + AI向导（wizard）
│       │   ├── chat.ts                # SSE 流式聊天（含 _totalTurns 追踪）
│       │   ├── payments.ts            # Stripe 支付（银行卡）+ 余额查询
│       │   ├── cryptobot.ts           # USDT TRC-20 直连支付 + 链上轮询（30s）
│       │   ├── redeem.ts              # 兑换码系统
│       │   ├── marketplace.ts         # 角色广场 + 评价 + 排行榜
│       │   ├── images.ts              # ComfyUI 图片生成接口（在线场景图）
│       │   ├── admin.ts               # 管理后台 API（需 ADMIN_KEY）
│       │   ├── bot.ts                 # Telegram Bot webhook 处理
│       │   └── checkin.ts             # 每日签到（金币奖励）
│       ├── services/
│       │   ├── grok.ts                # Grok API + 剧情脚本 + system prompt 构建
│       │   └── comfyui.ts             # ComfyUI 工作流 + 图片生成（在线触发）
│       ├── middleware/auth.ts          # JWT 验证中间件
│       ├── utils/prisma.ts             # Prisma client 单例
│       ├── generateAlbum.ts           # 本地批量生图脚本（给角色生成写真集）
│       ├── generateAvatars.ts         # 本地批量生图脚本（头像 512×512）
│       └── index.ts                   # Express 应用入口（含 startUsdtPoller）
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── HomePage.tsx           # 我的角色列表
│       │   ├── DiscoverPage.tsx        # 角色广场（图片卡片 + 搜索）
│       │   ├── CharacterProfilePage.tsx # 角色详情 + 照片轮播
│       │   ├── WizardPage.tsx          # AI 引导创建角色
│       │   ├── ChatPage.tsx            # SSE 流式聊天界面 + 快捷回复 + 内嵌图片
│       │   ├── LeaderboardPage.tsx     # 排行榜（热度/评分）
│       │   └── ProfilePage.tsx         # 个人中心 + 充值入口
│       ├── components/
│       │   └── PaywallModal.tsx        # 充值弹窗（USDT直连 + Stripe银行卡双Tab）
│       ├── api/client.ts              # API 请求封装（含所有端点）
│       ├── hooks/useAuth.ts            # Telegram WebApp 登录 hook
│       ├── types/index.ts              # TypeScript 类型
│       └── styles/theme.css            # 深色主题 CSS
├── frontend/admin.html                # 独立管理后台 UI（无需构建，纯 HTML/JS）
├── image-worker/
│   ├── server.ts                      # 本地图片生成 Worker（端口 7080）
│   └── .env                           # 本地 Worker 环境变量
├── start-worker.ps1                   # 启动 Worker + SSH 隧道的 PowerShell 脚本
└── CLAUDE.md                          # 本文件
```

---

## 服务器信息
- **IP**：168.144.108.9
- **平台**：DigitalOcean 新加坡，Ubuntu 24.04
- **SSH**：`ssh root@168.144.108.9`（已配置 SSH key，Windows 用 PowerShell）
- **应用目录**：`/app`（git 仓库）
- **前端静态文件**：`/var/www/siyuwanban`（nginx 静态托管）
- **角色图片目录**：`/var/www/siyuwanban/images/`（公开访问）
- **进程管理**：PM2，进程名 `siyuwanban`
- **Nginx 配置**：`/etc/nginx/sites-enabled/siyuwanban`（注意是 sites-enabled 不是 sites-available）
- **Nginx 上传限制**：`client_max_body_size 20m`（已配置）

### 常用服务器命令
```bash
# 查看后端日志（实时）
ssh root@168.144.108.9 "pm2 logs siyuwanban --lines 50"

# 重启后端
ssh root@168.144.108.9 "pm2 restart siyuwanban --update-env"

# 部署后端（推送代码后）
ssh root@168.144.108.9 "cd /app && git pull && cd backend && npx prisma generate && npm run build && pm2 restart siyuwanban --update-env"

# 部署前端 React（需先本地 build）
ssh root@168.144.108.9 "cp -r /app/frontend/dist/. /var/www/siyuwanban/"

# ⚠️ admin.html 需单独复制（不走 Vite build）
ssh root@168.144.108.9 "cp /app/frontend/admin.html /var/www/siyuwanban/admin.html"

# 上传本地生成的图片到服务器
scp D:\SD\siyuwanban\portraits\* root@168.144.108.9:/var/www/siyuwanban/images/
scp D:\SD\siyuwanban\avatars\* root@168.144.108.9:/var/www/siyuwanban/images/

# 重要！加新 Prisma 字段后必须先 generate 再 build
ssh root@168.144.108.9 "cd /app/backend && npx prisma generate && npm run build && pm2 restart siyuwanban --update-env"
```

### 本地连接服务器数据库（SSH 隧道）
```powershell
# 开隧道（后台运行）
ssh -N -L 15432:localhost:5432 root@168.144.108.9
# 然后用任意 PG 客户端连 localhost:15432
```

---

## 域名与 SSL
- **主应用**：`https://siyuwanban.shangzongcai.com`
- **管理后台**：`https://siyuwanban.shangzongcai.com/admin.html`
- **SSL 证书**：Let's Encrypt，`/etc/letsencrypt/live/siyuwanban.shangzongcai.com/`
- **注意**：Nginx 必须用子域名专属证书，不能用根域名证书

---

## Telegram Bot
- **Bot 用户名**：@SiYuWanBanBot
- **Mini App URL**：`https://siyuwanban.shangzongcai.com`
- **Bot Token**：在服务器 `/app/backend/.env` 中

---

## 环境变量
服务器：`/app/backend/.env`，本地：`D:\SD\siyuwanban\backend\.env`

```env
DATABASE_URL=postgresql://...
TELEGRAM_BOT_TOKEN=          # @BotFather 获取
WEBHOOK_SECRET=               # 随机字符串
GROK_API_KEY=                 # console.x.ai 获取
JWT_SECRET=                   # 随机字符串
FRONTEND_URL=https://siyuwanban.shangzongcai.com
PORT=3001
ADMIN_KEY=sywb-admin-2026     # 管理后台访问密钥
IMAGE_SAVE_DIR=/var/www/siyuwanban/images

# Stripe（银行卡支付，live 模式）
STRIPE_SECRET_KEY=rk_live_... # Restricted Key，需有 Checkout 权限
STRIPE_WEBHOOK_SECRET=whsec_... # Stripe Dashboard → Webhooks 获取

# USDT 直连支付
USDT_WALLET=TFt6Q3LoYkzVWsXNAsiz5gcR2f62h9opkr  # OKX USDT TRC-20 地址
```

**本地 Worker（`image-worker/.env`）：**
```env
PORT=7080
COMFYUI_URL=http://localhost:8188
SERVER_URL=https://siyuwanban.shangzongcai.com
ADMIN_KEY=sywb-admin-2026
WORKER_KEY=sywb-worker-2026
```

---

## GitHub
- **仓库**：https://github.com/LyuCheng95/siyuwanban
- **分支**：main
- **注意**：commit 后还需要手动 `git pull` 到服务器

---

## 支付系统

### USDT TRC-20 直连（主推，0手续费）
文件：`backend/src/routes/cryptobot.ts`（名字保留，内容已完全替换）

**流程：**
1. 用户选档位 → POST `/api/payments/crypto/create-invoice`
2. 后端生成唯一金额（基础价 + 随机1-99分）→ 存 DB 为 pending Payment
3. 前端显示钱包地址 + 精确金额，用户用 OKX/TronLink 转账
4. 后端每 30 秒轮询 TronScan API，金额匹配则发钻石
5. 前端轮询 `/api/payments/balance` 直到余额增加

**档位：** 30💎/$3.xx · 80💎/$7.xx · 200💎/$15.xx（xx 为随机分，保证唯一）

**钱包地址：** `TFt6Q3LoYkzVWsXNAsiz5gcR2f62h9opkr`（TRON 网络 USDT）

### Stripe 银行卡
文件：`backend/src/routes/payments.ts`
- Webhook：`POST /api/payments/stripe/webhook`（已在 Stripe Dashboard 配置）
- 档位：30💎/$2.99 · 80💎/$6.99 · 200💎/$14.99

---

## 管理后台（admin.html）
访问 `https://siyuwanban.shangzongcai.com/admin.html`，密钥 = `ADMIN_KEY`。

**页面列表：**
| 页面 | 功能 |
|------|------|
| 📊 总览 | 用户数、角色数、消息数、最近注册、热门角色 |
| 👤 角色管理 | 搜索、查看图片、删除、编辑角色资产 |
| 👥 用户列表 | TG ID、用户名、金币/钻石余额、对话数；手动加钻石 |
| 💬 对话记录 | 按 TG ID 搜索，查看完整对话历史 |
| 🖼️ 图片库 | 查看所有角色写真 + 场景图，管理封面/头像 |
| 🧪 对话测试 | 模拟任意角色任意亲密度的多轮对话 |
| ➕ 添加角色 | 表单直接创建角色（写入数据库） |
| 🎁 兑换码 | 生成/查看兑换码，每码对应固定钻石数 |
| 💳 流水明细 | 所有充值记录，支持按状态/渠道/用户筛选，分页 |
| 🖥️ 本地Worker | 管理本地图片生成任务，触发批量写真生成 |
| 📋 评审基准 | AI 对话质量评审配置 |

**Admin API 端点（部分）：**
```
GET  /api/admin/stats?key=...
GET  /api/admin/characters?key=...&name=搜索词
GET  /api/admin/users?key=...
GET  /api/admin/payments?key=...&status=&provider=&user=&page=
GET  /api/admin/logs?key=...&telegramId=...
POST /api/admin/add-diamonds?key=...  { telegramId, amount }
POST /api/admin/characters/:id/generate-album?key=...
POST /api/admin/characters/:id/append-image?key=...  (Worker 回调)
GET  /api/admin/redeem-codes?key=...
POST /api/admin/redeem-codes/generate?key=...  { count, diamonds }
```

---

## 本地 Worker（图片生成）

文件：`image-worker/server.ts`，端口 7080

**启动方式：**
```powershell
# 启动 SSH 隧道 + Worker（推荐）
.\start-worker.ps1

# 或手动：
ssh -N -R 7080:localhost:7080 root@168.144.108.9   # 隧道（后台）
cd image-worker && npx tsx server.ts               # Worker
```

**功能：**
- 接收后台的生图任务（`POST /generate-album`），立即返回 `jobId`
- 内存队列顺序处理，避免 ComfyUI 并发冲突
- 每张图生成后立即回调服务器 `POST /api/admin/characters/:id/append-image`
- `GET /job/:id` 查进度；`GET /queue` 查队列；`GET /ping` 健康检查

**ComfyUI 端口：** 本地 `8188`（Worker 通过隧道暴露为服务器的 `7080`）

---

## AI 系统（grok.ts）

### 角色剧情脚本系统
每个角色都有专属剧本（`STORY_PHASES`），AI 按对话轮数推进剧情（5个阶段 P0-P4）：

| 角色 | 类别 | 剧情核心 |
|------|------|---------|
| 椎名老师 | 禁忌 | 补习室温柔老师，从拘谨到失守，以25道数学题游戏为主线 |
| 晓彤 | 学妹 | 健身教练，训练室撩动张力，从好胜到投降 |
| 娜娜 | 学妹 | 邻家少女，看似无辜暗藏心机，从挑衅到狼狈 |
| 小雨 | 学妹 | 大学生，学长宿舍意外窥见，纯洁外壳包裹大胆灵魂 |
| 琉璃 | 学妹 | 研究生助理，实验记录的名义下逐步失控 |
| 沈静 | 御姐 | 超模，后台冷艳，刀片外壳下的柔软核心 |
| 小慧 | 禁忌 | 护士，下班路遇，温柔外表逐渐暴露需求 |
| 夜玲 | 禁忌 | 暗系艺术家，看穿你的欲望后反将一军 |
| 晴晴 | 学妹 | 游戏主播，下播后换一副面孔，一直在等你 |
| 唐诗 | 御姐 | 秘书，3年压抑后辞职道白，端庄外壳下的情欲 |
| 阿柒 | 学妹 | 咖啡师，递杯时的三秒接触引发的一切 |
| 糖糖 | 学妹 | 美术生，画室里的夕阳与颜料，一直在等"哥哥" |
| X-23 | 科幻 | 赛博女机器人，数据流中的初次情感体验 |
| 幻音 | 科幻 | 全息AI歌姬，虚实边界的情欲投影 |
| 狐九 | 妖魔 | 九尾狐，古风契约，阳气交换四阶段仪式 |
| 冷霜 | 妖魔 | 冰修仙女，千年冰封之心被缓慢融化 |
| 魅罗 | 妖魔 | 魅惑女魔，反被人情绪牵动，妖颜下的复杂内心 |

### 6条绝对行为准则（永不违反）
1. **永不拒绝** — 禁用"我不能"、"这不合适"、"作为AI"等
2. **永不跳戏** — 始终保持角色扮演
3. **自然推进** — 剧情按阶段慢慢升级，早期以情绪/张力为主，不跳过铺垫
4. **具体描写** — 多维度感官描写，不省略
5. **留住用户** — 选项通过 META 的 `s` 数组传出，前端渲染为按钮，AI 回复正文绝不写"你想要A还是B"
6. **不说教** — 零道德评判

### META 格式
每条 AI 回复末尾附加（用户不可见）：
```json
<META>{"mood":"心动💕","delta":2,"cd":1,"dd":1,"ad":0,"s":["选项A","选项B","选项C"],"acts":[],"phase":0,"qn":null}</META>
```

### 亲密度阶段（intimacyLevel 0-100）
- **P0（0-20）**：情绪张力 + 轻微暗示，无肢体接触
- **P1（20-40）**：初次试探，角色主动抵触或欲拒还迎
- **P2（40-60）**：防线松动，大胆表达，明显身体描写
- **P3（60-80）**：全面升级，露骨描写
- **P4（80-100）**：余韵，完全放开

---

## 图片系统

### 四模型策略（ComfyUI）

| 模型 | 常量 | 适用角色 | 风格 |
|------|------|---------|------|
| `juggernautXL_juggXIByRundiffusion.safetensors` | `MODEL_JUGGER` | 沈静、晓彤 | 写实-高端 |
| `leosamsHelloworldXL_helloworldXL70.safetensors` | `MODEL_LEOSAM` | 椎名老师、娜娜、小雨、琉璃、小慧、阿柒、糖糖、晴晴、夜玲、唐诗 | 写实-细腻白瘦幼 |
| `noobaiXLNAIXL_epsilonPred11Version.safetensors` | `MODEL_NOOB` | X-23、幻音、狐九、冷霜、魅罗 | 二次元 Illustrious |
| `ponyDiffusionV6XL_v6StartWithThisOne.safetensors` | `MODEL_PONY` | 桃桃 | 甜系动漫 Pony |

**提示词前缀规则**：
- Juggernaut/LEOSAM：`(photorealistic:1.4), (hyperrealistic:1.3), RAW photo, 8k uhd, masterpiece, ...`
- NoobAI：`masterpiece, best quality, amazing quality, very aesthetic, newest, ultra detailed, source_anime, ...`
  - ⚠️ **不要用** `score_9, score_8_up`（Pony Diffusion 专用，NoobAI 不识别）
- Pony：`score_9, score_8_up, score_7_up, score_6_up, masterpiece, best quality, ultra detailed, ...`
  - CFG=6.0，steps=25，采样器 dpmpp_2m + karras

### ComfyUI 生成参数（两步 Hires Fix）
- 初始：768×1024，denoise=1.0，25步（NoobAI 28步）
- Hires：×1.25 上采样 → 960×1280，denoise=0.55，15步（NoobAI 跳过）
- 采样器：dpmpp_2m + karras

### ComfyUI 端口
本地 Windows 机器：**8188**
SSH 反向隧道到服务器（Worker 用）：`ssh -R 7080:localhost:7080 root@168.144.108.9`

### 角色图片存储
- 图片文件存放：`/var/www/siyuwanban/images/`
- 访问 URL：`https://siyuwanban.shangzongcai.com/images/角色名_1.jpg`
- 数据库字段：`Character.portraitImages: Json`（URL数组）、`Character.portraitUrl: String?`（主图）、`Character.faceUrl: String?`（头像）

### 本地批量生图命令
```powershell
cd D:\SD\siyuwanban\backend

# 生成写真集（全部角色，3张/角色）
node_modules\.bin\tsx src\generateAlbum.ts all 3

# 只生成特定角色
node_modules\.bin\tsx src\generateAlbum.ts 椎名老师 3

# 生成头像（512×512 正脸）
npx prisma generate  # 必须先 generate！
node_modules\.bin\tsx src\generateAvatars.ts

# 上传到服务器
scp D:\SD\siyuwanban\portraits\* root@168.144.108.9:/var/www/siyuwanban/images/
scp D:\SD\siyuwanban\avatars\* root@168.144.108.9:/var/www/siyuwanban/images/
```

### 在线场景图生成（comfyui.ts）
聊天中 AI 判断场景后触发（`shouldGenerateImage`），通过 `/api/images` 接口调用。
`CHARACTER_MODEL` map 保证每个角色用正确模型。前端 `ChatPage.tsx` 只传 scene 描述，后端自动加质量前缀。

---

## 前端特色功能

### PaywallModal（充值弹窗）
- Tab 1「💵 USDT 加密货币」：显示专属金额 + 钱包地址 + 复制按钮 + 操作步骤，轮询到账
- Tab 2「💳 银行卡」：跳转 Stripe Checkout，轮询到账
- 两种方式均通过轮询 `/api/payments/balance` 自动检测到账

### 聊天气泡（ChatPage）
- `s` 字段选项渲染为点击按钮（不在 AI 正文中重复询问）
- AI 场景触发时气泡下方嵌入生成图

### 角色档案页（CharacterProfilePage）
- **照片轮播**：支持多张 `portraitImages`，scroll-snap 横向滑动，点点指示器
- **英雄图**：满屏展示，底部渐变叠加角色姓名/年龄/职业
- **评价系统**：需聊天3轮以上才能写评论

### 发现页（DiscoverPage）
- 分类筛选：全部 / 御姐 / 学妹 / 禁忌 / 妖魔 / 科幻

---

## 预设角色列表（18个，均已在数据库中，isPublic=true）
| 角色 | 类别 | 图片模型 |
|------|------|---------|
| 椎名老师 | 禁忌 | LEOSAM |
| 晓彤 | 学妹 | Juggernaut |
| 娜娜 | 学妹 | LEOSAM |
| 小雨 | 学妹 | LEOSAM |
| 琉璃 | 学妹 | LEOSAM |
| 沈静 | 御姐 | Juggernaut |
| 小慧 | 禁忌 | LEOSAM |
| 夜玲 | 禁忌 | LEOSAM |
| 晴晴 | 学妹 | LEOSAM |
| 唐诗 | 御姐 | LEOSAM |
| 阿柒 | 学妹 | LEOSAM |
| 糖糖 | 学妹 | LEOSAM |
| X-23 | 科幻 | NoobAI |
| 幻音 | 科幻 | NoobAI |
| 狐九 | 妖魔 | NoobAI |
| 冷霜 | 妖魔 | NoobAI |
| 魅罗 | 妖魔 | NoobAI |
| 桃桃 | 学妹 | Pony |

**已隐藏角色**（isPublic=false）：林晓雅、沈曼、林阿姨、程双、苏然、程雨、夜瑶、星澜、零

---

## 本地 LoRA 列表（D:\SD\ComfyUI\models\loras\）

| 文件 | 基础模型 | 用途 | 触发条件 |
|------|---------|------|---------|
| `add-detail-xl.safetensors` | SDXL | 细节增强 | 所有 SDXL 角色 always |
| `nudify_xl_lite.safetensors` | SDXL | 裸露强化 | naked/nude/nipple/penetration 等 |
| `MissionaryVaginal-v1-SDXL.safetensors` | SDXL | 传教士体位 | missionary/legs up |
| `dggy.safetensors` | SDXL | 后入体位 | doggy/from behind |
| `rvcg.safetensors` | SDXL | 骑乘体位 | cowgirl/riding on top |
| `cockteaseLoRASDXL.safetensors` | SDXL | 挑逗前戏 | handjob/stroking（无插入） |
| `PornMaster-cum-sdxl-V3-lora.safetensors` | SDXL | 精液/潮吹 | cum/creampie/ahegao |
| `Tongue out_SDXL.safetensors` | SDXL | 舌头/ahegao | tongue/ahegao/moaning |
| `Paizuri_Base_pony-000049.safetensors` | Pony | 乳交 | paizuri/titjob/between breasts |
| `Armpitsex-IL_NAI.safetensors` | Illustrious | 腋交 | armpit（NoobAI 专用） |
| `badanatomy_SDXL_negative_LORA_AutismMix_v1.safetensors` | Pony | 解剖学修复（负向） | Pony 负向提示词 |

---

## 当前状态（2026-04-30）
- ✅ 后端运行中（PM2）
- ✅ 前端部署完成，域名 `siyuwanban.shangzongcai.com`
- ✅ HTTPS 证书配置完成
- ✅ Telegram Webhook 注册完成
- ✅ AI 剧情脚本系统上线（5阶段 STORY_PHASES + 6条准则）
- ✅ 角色照片轮播（CharacterProfilePage + DiscoverPage）
- ✅ 管理后台 admin.html（9个功能页面）
- ✅ 四模型图片策略（Juggernaut / LEOSAM / NoobAI / Pony）
- ✅ 聊天内嵌场景图（comfyui.ts，按角色路由模型）
- ✅ 本地 Worker + SSH 隧道图片生成系统
- ✅ 每日签到系统（金币奖励）
- ✅ 兑换码系统（admin 生成，用户兑换钻石）
- ✅ **USDT TRC-20 直连支付**（0手续费，链上轮询自动到账）
- ✅ **Stripe 银行卡支付**（live 模式，Webhook 已配置）
- ✅ **流水明细页面**（admin，支持按状态/渠道/用户筛选）
- ✅ Prisma schema 含所有字段并已提交 git（RedeemCode、height、weight 等）
- ⚠️ Stripe Restricted Key（`rk_live_`）需确认有 Checkout 权限；建议换 `sk_live_`
- ⚠️ 部分角色写真图片需重新生成

---

## 待办事项
- [ ] 确认 Stripe `rk_live_` key 有 Checkout Session 创建权限（或换 `sk_live_`）
- [ ] 测试完整 USDT 支付流程（小额实测）
- [ ] 测试完整 Stripe 银行卡流程
- [ ] 重新生成写真集：`node_modules\.bin\tsx src\generateAlbum.ts all 3`
- [ ] 生成/更新头像：`npx prisma generate && node_modules\.bin\tsx src\generateAvatars.ts`
- [ ] 在 Telegram 实测完整聊天流程

---

## 常见问题 & 坑

### Prisma 字段不可见
新增字段后必须：`npx prisma generate` → `npm run build` → `pm2 restart --update-env`
光 build 不 generate 会用旧的 Prisma client，导致字段不存在错误。

### schema.prisma 必须提交 git
服务器通过 `git pull` 更新代码，**schema.prisma 的修改必须 commit + push**，否则服务器 generate 出旧版 client。

### admin.html 需单独 scp
admin.html 不走 Vite build，前端部署后需额外执行：
```bash
ssh root@168.144.108.9 "cp /app/frontend/admin.html /var/www/siyuwanban/admin.html"
```

### Nginx 配置文件
实际生效的是 `/etc/nginx/sites-enabled/siyuwanban`（不是 `sites-available`）。
上传限制在此文件配置：`client_max_body_size 20m`

### NoobAI 提示词
必须用 Illustrious 前缀：`masterpiece, best quality, amazing quality, very aesthetic, newest, ultra detailed, source_anime`
**不要用** `score_9, score_8_up`（Pony 专用）。CFG=6.0，steps=28。

### LEOSAM / Juggernaut 提示词
`(photorealistic:1.4), (hyperrealistic:1.3), RAW photo, 8k uhd, masterpiece, (Asian beauty:1.4), ...`
CFG=6.5，steps=30，采样器 dpm_2_ancestral + karras。

### SSH 连接 Windows / PowerShell
路径带空格要加引号：`scp "D:\SD\siyuwanban\portraits\*" root@168.144.108.9:/var/www/siyuwanban/images/`
PowerShell **不支持** bash heredoc (`<<'EOF'`)，用 `@'...'@` 替代。

### USDT 支付唯一金额机制
每笔订单金额 = 基础价 + 随机1-99分（如 $7.43）。后台按金额匹配 pending 订单（误差 ±$0.005）。
用户**必须转精确金额**，否则无法自动匹配。
