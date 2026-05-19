/**
 * 从角色剧情脚本自动生成图库场景配置（scene config）
 * 用法：node_modules\.bin\tsx src\generateSceneConfig.ts [角色名]
 * 输出：scene_configs/{角色名}.json
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { CHARACTER_FACE } from './characterFace';
import { CHARACTER_KINKS } from './services/characterScripts';

const prisma = new PrismaClient();
const grok = new OpenAI({
  apiKey: process.env.GROK_API_KEY!,
  baseURL: 'https://api.x.ai/v1',
});

export const SHOT_TYPES = [
  { key: 'portrait',               label: '调情·正脸',  count: 3 },
  { key: 'medium',                  label: '调情·半身',  count: 3 },
  { key: 'kiss',                    label: '接吻',       count: 4 },
  { key: 'breast',                  label: '裸胸爱抚',   count: 5 },
  { key: 'pussy',                   label: '下体展示',   count: 5 },
  { key: 'handjob',                 label: '手交',       count: 5 },
  { key: 'fingering',               label: '手指插入',   count: 5 },
  { key: 'blowjob',                 label: '口交',       count: 6 },
  { key: 'cunnilingus',             label: '舔阴',       count: 5 },
  { key: 'penetration_missionary',  label: '传教士',     count: 6 },
  { key: 'penetration_doggy',       label: '后入',       count: 6 },
  { key: 'penetration_cowgirl',     label: '骑乘',       count: 6 },
  { key: 'penetration_spooning',    label: '侧入',       count: 4 },
  { key: 'penetration_generic',     label: '插入通用',   count: 5 },
  { key: 'standing_sex',            label: '站立体位',   count: 4 },
  { key: 'ahegao',                  label: '高潮表情',   count: 5 },
  { key: 'creampie',                label: '内射',       count: 5 },
  { key: 'cum_face',                label: '颜射',       count: 4 },
  { key: 'bondage',                 label: '捆绑调教',   count: 5 },
  { key: 'toy_use',                 label: '情趣玩具',   count: 5 },
  { key: 'petplay',                 label: '宠物扮演',   count: 4 },
  { key: 'spanking',                label: '惩罚打屁股', count: 4 },
  { key: 'undressing',              label: '脱衣过程',   count: 4 },
  { key: 'squirt',                  label: '潮喷',       count: 4 },
] as const;

export type ShotKey = typeof SHOT_TYPES[number]['key'];

export interface ShotConfig {
  scene:  string;  // background / setting (SD prompt, English)
  outfit: string;  // clothing state at this stage (SD prompt, English)
  mood:   string;  // facial expression / emotion (SD prompt, English)
  extra:  string;  // any extra emphasis keywords (SD prompt, English)
}

export interface SceneConfig {
  characterName: string;
  model:         string;
  shotConfigs:   Record<ShotKey, ShotConfig>;
}

const REALISTIC_CHARS = ['椎名老师','晓彤','娜娜','小雨','琉璃','糖糖','沈静','小慧','夜玲','晴晴','唐诗','阿柒'];

async function generateOne(characterName: string) {
  const character = await prisma.character.findFirst({ where: { name: characterName } });
  if (!character) { console.error(`❌ 角色未找到: ${characterName}`); return; }

  const storyPhases = (character.storyPhases as string[] | null) ?? [];
  const faceAnchor  = CHARACTER_FACE[characterName] ?? '';
  const kink        = CHARACTER_KINKS[characterName] ?? '';
  const model       = (character.imageModel ?? 'leosam');

  const shotList = SHOT_TYPES.map(t => `- ${t.key} (${t.label})`).join('\n');

  const systemPrompt = `你是专业的AI图像提示词工程师，为成人向游戏设计ComfyUI图片生成配置。
你的输出必须是严格合法的JSON，不含任何Markdown代码块包裹。`;

  const userPrompt = `角色档案：
名字：${characterName}
年龄：${character.age}岁
职业：${character.occupation}
性格：${character.personality}
背景：${character.background}
默认服装：${character.defaultOutfit ?? '未指定'}
面部锚点（SD关键词）：${faceAnchor}
专属癖好：${kink}

故事剧本（5阶段）：
${storyPhases.length
  ? storyPhases.map((p, i) => `[P${i}] ${p.slice(0, 400)}`).join('\n\n')
  : '（无专属剧本，使用职业通用场景）'}

任务：为以下24种图片类型生成场景配置，每种包含4个字段（均为英文SD提示词）：
- scene：背景/场地，15-25词，必须符合该角色故事中实际发生的场景
- outfit：服装/裸露状态，10-20词，必须与该类型的亲密程度匹配
- mood：表情/情绪关键词，5-10词
- extra：额外强调元素，5-15词（可为空字符串）

图片类型：
${shotList}

规则：
1. scene必须来自角色故事，不能是通用卧室/宾馆。例如椎名老师→补习室/书房/教室走廊
2. outfit按裸露程度递进：portrait=完整着装，blowjob=上衣解开，penetration=完全裸体或半裸
3. 椎名老师的答题癖好要体现在场景里（scattered math papers, textbook open, chalk marks）
4. 高潮类型(ahegao/creampie/cum_face)的mood要极致失控
5. bondage：场景要有束缚感（rope/cuffs/restraints），outfit半裸，mood紧张顺从；extra加 "arms bound behind back" 或 "wrists tied"
6. toy_use：场景加入道具视觉（vibrator/dildo），outfit半裸，mood失控潮红；extra加 "vibrator inserted" 或 "toy stimulation"
7. petplay：outfit加猫耳/项圈元素（cat ears headband, collar with bell），场景温馨私密，mood娇俏顺从
8. spanking：包含明显的俯卧/弯腰姿势，outfit半裸，mood羞耻泪眼；extra加 "bent over" 或 "red marks on buttocks"
9. undressing：脱衣过程的中间状态——衣物半脱/缓慢解开，体现情趣张力；outfit写"shirt half-off shoulders"/"bra just unhooked"等中间状态，mood撩拨期待
10. squirt：潮喷/潮吹，阴部正面特写，明显的液体喷出；outfit完全裸体，mood完全失控崩溃；extra加 "squirting", "clear liquid gushing"
11. 返回格式：
{
  "characterName": "${characterName}",
  "model": "${model}",
  "shotConfigs": {
    "portrait": { "scene": "...", "outfit": "...", "mood": "...", "extra": "..." },
    "medium": { ... },
    ...（共24个key，必须与上方列表完全一致）
  }
}`;

  console.log(`🔍 正在为【${characterName}】生成场景配置...`);
  console.log(`   模型: ${model} | 剧本阶段数: ${storyPhases.length}`);

  const response = await grok.chat.completions.create({
    model: 'grok-3',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
  });

  const raw = response.choices[0].message.content ?? '';

  // 从返回中提取JSON（防止Grok加了```json包裹）
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('❌ Grok未返回有效JSON，原始输出：');
    console.error(raw);
    process.exit(1);
  }

  let config: SceneConfig;
  try {
    config = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('❌ JSON解析失败：', e);
    console.error('原始输出：', raw.slice(0, 500));
    process.exit(1);
  }

  // 校验18种类型是否都有
  const missing = SHOT_TYPES.filter(t => !config.shotConfigs?.[t.key]);
  if (missing.length > 0) {
    console.warn(`⚠️  以下类型缺失，将用空配置填充: ${missing.map(t => t.key).join(', ')}`);
    for (const t of missing) {
      config.shotConfigs[t.key] = { scene: '', outfit: '', mood: '', extra: '' };
    }
  }

  const outDir = path.join(__dirname, '..', 'scene_configs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${characterName}.json`);
  fs.writeFileSync(outPath, JSON.stringify(config, null, 2), 'utf-8');

  console.log(`\n✅ 场景配置已保存: ${outPath}`);
  console.log(`\n── 预览 ──────────────────────────────────────`);
  for (const t of SHOT_TYPES) {
    const c = config.shotConfigs[t.key];
    console.log(`\n[${t.key}] (${t.label} ×${t.count}张)`);
    console.log(`  scene:  ${c?.scene}`);
    console.log(`  outfit: ${c?.outfit}`);
    console.log(`  mood:   ${c?.mood}`);
    if (c?.extra) console.log(`  extra:  ${c?.extra}`);
  }
} // end generateOne

async function main() {
  const target = process.argv[2] || '椎名老师';
  const chars  = target === 'all' ? REALISTIC_CHARS : [target];

  // 跳过已有配置的角色（除非加 --force）
  const force  = process.argv.includes('--force');
  const outDir = path.join(__dirname, '..', 'scene_configs');

  for (const name of chars) {
    const outPath = path.join(outDir, `${name}.json`);
    if (!force && fs.existsSync(outPath)) {
      console.log(`⏭️  ${name} 已有配置，跳过（--force 可强制重新生成）`);
      continue;
    }
    await generateOne(name);
  }
}

if (require.main === module) {
  main().catch(console.error).finally(() => prisma.$disconnect());
}
