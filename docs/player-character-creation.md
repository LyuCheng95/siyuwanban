# 玩家创建角色功能规划文档

> 状态：规划中（2026-05-04）  
> 目标：让用户通过AI向导创建私人专属角色，支持完整的聊天/图片/剧情体验

---

## 一、产品形态

用户可以创建一个完全属于自己的AI角色，该角色：
- 仅对自己可见（私有，isPublic=false）
- 可选择公开到广场，接受其他用户评价
- 拥有和预设角色完全相同的聊天、图片、剧情进度能力
- 通过AI向导（Wizard）引导完成设定，无需手动填表

---

## 二、用户流程（UX Flow）

```
[我的角色页] → [创建角色按钮]
     ↓
[选择创建方式]
  A. AI向导（推荐）— 对话式引导，5-8轮问答自动生成角色
  B. 快速填表 — 高级用户直接填写字段
     ↓
[角色预览页] — 显示生成的角色卡、性格、背景
     ↓
[生成头像] — 用户上传参考图 或 选择预设风格 → ComfyUI生成
     ↓
[进入聊天] — 角色创建完毕，立刻开始对话
```

---

## 三、AI向导问答设计（Wizard对话流）

向导通过友好对话引导，每次只问1个问题，问完后确认。目标8轮以内完成全部收集。

| 轮次 | 引导问题 | 对应字段 |
|------|---------|---------|
| 1 | "你想创建的角色叫什么名字？" | `name` |
| 2 | "她（他）几岁？（18-40）" | `age` |
| 3 | "职业是什么？随便什么都行，比如护士、游戏主播、大学生…" | `occupation` |
| 4 | "用几个词描述她的性格？（比如：冷艳、占有欲强、外表高冷内心火热）" | `personality` |
| 5 | "她说话是什么风格？（温柔撒娇 / 霸道强势 / 知性冷静 / 元气可爱 / 神秘莫测）" | `speakingStyle` |
| 6 | "给她一个简短的背景故事？（1-2句话就够，AI会帮你丰富细节）" | `background` |
| 7 | "她有什么特别的…癖好或者令她兴奋的事情？（可以跳过）" | `kink`（新字段）|
| 8 | "最后，你想要什么外貌风格？写实 / 二次元 / 甜系动漫" | `modelStyle` → 映射到ComfyUI模型 |

向导完成后AI输出结构化JSON（`<CHARACTER_DATA>`标签），后端解析并写入DB。

---

## 四、数据库 Schema 变更

在现有 `Character` 模型基础上新增字段：

```prisma
model Character {
  // 现有字段...

  // 玩家创建角色新增字段
  createdByUser    Boolean  @default(false)   // 是否为玩家创建
  ownerId          Int?                        // 创建者用户ID（null = 预设角色）
  owner            User?    @relation("OwnedCharacters", fields: [ownerId], references: [id])
  customKink       String?  @db.Text           // 用户定义的专属癖好（明文，注入prompt）
  modelStyle       String?                     // "realistic" | "anime" | "sweet_anime"
  isPrivate        Boolean  @default(true)     // true = 仅创建者可见
  
  // User模型同步添加：
  // ownedCharacters  Character[] @relation("OwnedCharacters")
}
```

迁移命令：
```bash
ssh root@168.144.108.9 "cd /app/backend && npx prisma migrate dev --name add_player_characters && npm run build && pm2 restart siyuwanban --update-env"
```

---

## 五、API 端点设计

### 5.1 现有向导端点（已存在，需调整）
```
POST /api/characters/wizard/message   — 向导对话（已有，grok.guideCharacterCreation）
POST /api/characters/wizard/complete  — 提交向导结果创建角色（需新增或调整）
```

### 5.2 新增端点
```
GET  /api/characters/mine             — 已有，列出用户所有角色（公有+私有）
POST /api/characters                  — 已有，创建角色（需支持 ownerId + customKink）
PUT  /api/characters/:id              — 编辑自己创建的角色（仅限owner）
DELETE /api/characters/:id            — 删除自己的角色（已有）
POST /api/characters/:id/generate-avatar — 触发ComfyUI生成头像（新增）
PUT  /api/characters/:id/publish      — 设置 isPublic=true，发布到广场（新增）
```

### 5.3 图片生成逻辑
- 用户选 `modelStyle` → 映射到ComfyUI模型：
  - `realistic` → `juggernautXL_juggXIByRundiffusion.safetensors`
  - `anime` → `noobaiXLNAIXL_epsilonPred11Version.safetensors`
  - `sweet_anime` → `ponyDiffusionV6XL_v6StartWithThisOne.safetensors`
- 用户提供外貌描述 → 后端生成完整提示词 → 调用Worker → 回调存图URL

---

## 六、前端页面规划

### 6.1 新增/修改页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 创建入口 | `MyCharsPage` 新增按钮 | "创建我的角色" 按钮，链接到向导 |
| AI向导页 | `/wizard` (已有 `WizardPage.tsx`) | 需要更新为新的问答流程，支持癖好字段 |
| 角色编辑页 | `/character/:id/edit` | 新页面，仅owner可见，支持修改所有字段 |
| 头像生成页 | 向导最后一步内嵌 | 选择风格 → 生成 → 预览 → 确认 |

### 6.2 MyCharsPage 调整
- 现有：显示自己创建的角色列表
- 新增：顶部"+ 创建角色"按钮
- 角色卡上新增"编辑"按钮（仅owner可见）
- 私有角色显示🔒标记，公开角色显示🌐标记

### 6.3 角色编辑页 (`CharacterEditPage.tsx`)
字段：名字、年龄、职业、性格、说话风格、背景、癖好、外貌描述
操作：保存修改、重新生成头像、发布到广场（不可逆）、删除角色

---

## 七、Prompt 注入：用户自定义癖好

在 `grok.ts` 的 `buildCharacterSystemPrompt` 中，读取 `character.customKink`：

```typescript
// 玩家自定义癖好，P2+注入（优先级低于CHARACTER_KINKS预设，仅用于玩家创建角色）
const playerKink = scriptPhase >= 2 && character.customKink
  ? `\n━━━━━━━━━━━━━━━━━━━━━\n【${character.name}的专属癖好·P2+激活】\n${character.customKink}\n━━━━━━━━━━━━━━━━━━━━━`
  : '';
```

然后在 `activeScript` 之后插入 `${playerKink}`。

注意：预设角色用 `CHARACTER_KINKS` map，玩家创建角色用 `character.customKink` 字段，两者互不干扰。

---

## 八、内容审核策略

### 8.1 向导阶段（轻度过滤）
- 角色名：过滤明显违禁词（真实人名、政治敏感词）
- 背景/性格：允许成人内容描述，平台定位为成人内容
- 癖好字段：允许，但过滤极端内容（未成年涉及、真实人物等）

### 8.2 发布到广场（严格审核）
- 需要手动或AI审核头像图片（无未成年外貌）
- 角色名/简介过滤政治/违法内容
- 发布后审核可设为"待审核"状态，审核通过再显示

### 8.3 实现方式（MVP阶段）
- 向导完成时，后端简单关键词过滤
- 发布到广场需管理员在admin.html手动审核（设 isPublic=true）
- 后续可接入AI审核API

---

## 九、收费策略

| 操作 | 费用 |
|------|------|
| 创建角色（AI向导完成） | 免费 |
| 生成头像（ComfyUI） | 消耗 5 💎 钻石 |
| 重新生成头像 | 消耗 3 💎 钻石 |
| 发布到广场 | 免费（需审核） |
| 与自己创建的角色聊天 | 同预设角色（消耗 1 💎/轮） |

---

## 十、开发优先级 & 里程碑

### MVP（第一版，快速上线）
- [ ] DB schema 新增字段（`customKink`, `ownerId`, `modelStyle`, `isPrivate`）
- [ ] `POST /api/characters` 支持 `ownerId` + `customKink`
- [ ] `WizardPage.tsx` 更新：新增癖好问题、modelStyle选择
- [ ] `MyCharsPage` 新增"创建角色"按钮
- [ ] `grok.ts` 注入 `character.customKink`（代码已规划好，见第七节）
- [ ] admin.html 支持查看/审核玩家创建的角色

### V2（完整功能）
- [ ] 角色编辑页 `CharacterEditPage.tsx`
- [ ] 头像生成（接入Worker）
- [ ] 发布到广场流程（审核机制）
- [ ] 角色权限控制（确保非owner无法访问私有角色）

### V3（增强体验）
- [ ] 角色"剧情脚本AI生成"（根据角色设定自动生成P0-P4脚本，写入DB `storyPhases`）
- [ ] 玩家角色评价系统（公开后可评价）
- [ ] 角色模板市场（分享自己的角色设定模板）

---

## 十一、注意事项 & 已知坑

1. **`isPublic` vs `isPrivate`**：现有DB用 `isPublic`，新增 `isPrivate` 时注意语义一致，建议统一用 `isPublic`（false=私有）

2. **图片存储路径**：玩家角色图片存 `/var/www/siyuwanban/images/player_[userId]_[charId]_[timestamp].jpg`，避免与预设角色冲突

3. **向导`guideCharacterCreation`函数**：已在 `grok.ts` 中实现基础版，需要扩展支持 `customKink` 和 `modelStyle` 字段的收集

4. **角色并发保护**：用户对话中途不允许修改角色设定（`userMemory` 正在写入中），需要在编辑API中检查是否有活跃对话

5. **Prisma generate**：每次新增字段后必须 `npx prisma generate` + `npm run build` + `pm2 restart --update-env`，schema.prisma 必须 commit+push 到git

6. **storyPhases自动生成（V3）**：调用 `guideCharacterCreation` 的结构化输出，或单独写一个 `generateStoryPhases(character)` 函数，生成后存DB，之后聊天直接使用，不走 `genericPhases()`

---

*文档由 Claude 辅助创建并维护，每次feature更新后请同步更新此文档*
