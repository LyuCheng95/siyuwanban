/**
 * 为单个角色生成多张封面图（album）
 * 用法：npx ts-node -r dotenv/config src/generateAlbum.ts [角色名] [张数]
 * 示例：npx ts-node -r dotenv/config src/generateAlbum.ts 林晓雅 3
 *       npx ts-node -r dotenv/config src/generateAlbum.ts 狐九 3
 *
 * 真实风格 → realvisxlV50_v50LightningBakedvae.safetensors
 * 二次元/修仙/妖魔 → ponyDiffusionV6XL_v6StartWithThisOne.safetensors
 */

import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const COMFYUI_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';
const SAVE_DIR = process.env.IMAGE_SAVE_DIR || 'D:/SD/siyuwanban/portraits';
const PUBLIC_BASE = process.env.FRONTEND_URL || 'https://siyuwanban.shangzongcai.com';

// ── 模型 ──────────────────────────────────────────────────────────────────────
const MODEL_REAL  = 'realvisxlV50_v50LightningBakedvae.safetensors';
const MODEL_ANIME = 'ponyDiffusionV6XL_v6StartWithThisOne.safetensors';

// ── 真实感 prompt 前缀 ────────────────────────────────────────────────────────
const QUALITY_REAL = [
  '(photorealistic:1.4)', '(hyperrealistic:1.3)', 'RAW photo', '8k uhd', 'masterpiece',
  '(perfect face:1.5)', '(beautiful face:1.5)', '(stunning beauty:1.4)',
  '(perfect symmetrical face:1.3)', '(flawless skin:1.3)',
  '(gorgeous:1.3)', '(detailed eyes:1.3)', '(perfect eyes:1.3)',
  '(supermodel:1.2)', '(editorial lighting:1.2)',
  '(explicit:1.4)', '(nsfw:1.4)',
].join(', ');

// ── 二次元 prompt 前缀（Pony Diffusion 关键词）────────────────────────────────
const QUALITY_ANIME = [
  'score_9', 'score_8_up', 'score_7_up', 'masterpiece', 'best quality',
  'ultra detailed', 'highly detailed', '8k',
  '(beautiful face:1.4)', '(perfect eyes:1.4)', '(detailed eyes:1.3)',
  '(perfect body:1.3)', '(gorgeous:1.3)',
  'source_anime', 'nsfw', 'explicit',
].join(', ');

// ── Negative ──────────────────────────────────────────────────────────────────
const NEGATIVE_REAL = [
  '(worst quality:1.6)', '(low quality:1.6)', '(normal quality:1.4)',
  'bad anatomy', 'bad face', 'ugly face', 'asymmetrical face', 'deformed face',
  'extra limbs', 'deformed hands', 'extra fingers', 'missing fingers',
  'blurry', 'watermark', 'text', 'logo', 'signature',
  'censored bar', 'mosaic', 'pixelated genitals', 'covered genitals',
  'cross-eye', 'lazy eye', 'bad eyes',
].join(', ');

const NEGATIVE_ANIME = [
  'score_1', 'score_2', 'score_3', 'score_4',
  'bad anatomy', 'bad hands', 'extra fingers', 'missing fingers',
  'deformed face', 'ugly face', 'bad face',
  'blurry', 'watermark', 'text', 'censored', 'mosaic',
  'bad quality', 'worst quality', 'lowres',
].join(', ');

// ── 角色配置：style + prompts ─────────────────────────────────────────────────
interface CharConfig {
  style: 'real' | 'anime';
  prompts: string[];
}

const ALBUM_CONFIGS: Record<string, CharConfig> = {

  // ── 真实感角色 ───────────────────────────────────────────────────────────────

  '林晓雅': { style: 'real', prompts: [
    '1girl, 28 years old, chinese woman, lawyer, long black hair updo, sharp eyes, dark red lips, perfect oval face, office suit jacket sliding off shoulders, (bare breasts:1.6), (erect nipples:1.5), pencil skirt pushed up to waist, (pussy visible:1.5), legs slightly spread, sitting on mahogany desk, glass city lights behind, dramatic rim lighting, luxury office, 4k detail',
    '1girl, 28 years old, chinese woman, long black hair down loose, sharp eyes, dark red lips, perfect oval face, white unbuttoned shirt hanging off one shoulder, (bare breasts:1.6), (nipples:1.5), no underwear, (pussy peeking:1.4), leaning against floor-to-ceiling window, city skyline at night, warm amber glow, wine glass in hand, confident smirk, cinematic lighting',
    '1girl, 28 years old, chinese woman, long black hair tied loosely, sharp eyes, perfect face, wearing only unbuttoned white shirt, (large bare breasts fully exposed:1.6), (erect nipples:1.5), (shaved pussy fully visible:1.6), (spread legs:1.4), sitting wide on leather chair, conference table, meeting room, dominant expression, dramatic side lighting',
  ]},

  '椎名老师': { style: 'real', prompts: [
    '1girl, 24 years old, japanese woman, black framed glasses, dark hair in bun, perfect cute face, white shirt wide open, (bare breasts:1.6), (erect nipples:1.5), short pleated skirt lifted, (panties pulled down to knees:1.5), (pussy exposed:1.6), sitting on classroom desk legs spread, afternoon light, empty classroom, flushed cheeks, embarrassed expression',
    '1girl, 24 years old, japanese teacher, black framed glasses, dark hair loose down, perfect cute face, only wearing open white shirt, (bare breasts:1.6), (nipples:1.5), leaning over desk, (pussy visible:1.5), skirt bunched up, blackboard behind, warm classroom light, biting lip',
    '1girl, 24 years old, japanese woman, glasses removed, dark hair, beautiful face, completely nude, (large bare breasts:1.6), (erect nipples:1.5), (pussy fully exposed:1.6), sitting in teacher chair legs apart, classroom setting, golden evening light',
  ]},

  '晓彤': { style: 'real', prompts: [
    '1girl, 22 years old, chinese woman, athletic toned body, ponytail, beautiful face, gym crop top pulled up, (bare athletic breasts:1.6), (nipples:1.5), gym shorts pulled down to thighs, (toned abs:1.2), (pussy exposed:1.5), leaning against gym locker, gym locker room, fluorescent lighting, sweaty glistening skin, confident smirk',
    '1girl, 22 years old, chinese woman, athletic build, hair down, beautiful face, sports bra pushed up, (bare breasts:1.6), (erect nipples:1.5), sports shorts completely removed, (pussy visible:1.6), lying on gym mat, modern gym background, afternoon light, toned body detail',
    '1girl, 22 years old, chinese woman, athletic body, ponytail, cute face, wearing only unbuttoned gym jacket, (full bare breasts:1.6), (nipples:1.5), (pussy exposed:1.5), sitting on reception desk, gym background, end of day lighting, playful expression',
  ]},

  '沈曼': { style: 'real', prompts: [
    '1girl, 34 years old, mature chinese woman, boss, elegant short wavy hair, sharp intelligent eyes, dark red lips, silk blouse unbuttoned, (full mature breasts:1.6), (erect nipples:1.5), pencil skirt removed, (pussy exposed:1.5), sitting on executive desk, city view behind, cold confident expression, evening light, power pose',
    '1girl, 34 years old, mature chinese woman, powerful presence, wavy hair down, red lips, only wearing open blazer, (bare mature breasts:1.6), (nipples:1.5), (trimmed pussy visible:1.5), standing at floor window, city lights, glass of whiskey, dominant smirk, dramatic lighting',
    '1girl, 34 years old, mature chinese businesswoman, elegant, hair messy, slightly flushed, white dress shirt open, (large breasts fully exposed:1.6), (erect nipples:1.5), (pussy visible:1.5), sitting in boardroom chair legs apart, late night office, just finished work, sexy exhausted look',
  ]},

  '乔彦': { style: 'real', prompts: [
    '1girl, 20 years old, chinese nurse, sweet cute face, short black hair, nurse uniform top open wide, (bare breasts:1.6), (erect nipples:1.5), nurse skirt pulled up, (pussy visible:1.5), sitting on hospital bed, clean white medical room, soft fluorescent light, shy blush expression',
    '1girl, 20 years old, cute nurse, short hair, beautiful face, white nurse cap, only wearing white thigh highs and open nurse top, (full bare breasts:1.6), (nipples:1.5), (pussy exposed:1.6), lying on patient bed legs spread, hospital room, warm light, innocent aroused expression',
    '1girl, 20 years old, chinese woman nurse, hair tied up, adorable face, nurse uniform completely open, (bare breasts:1.6), (erect nipples:1.5), nurse skirt around waist, (shaved pussy fully visible:1.5), standing in hospital corridor, hands holding clipboard, looking over shoulder, shy smile',
  ]},

  '娜娜': { style: 'real', prompts: [
    '1girl, 18 years old, chinese high school girl, long straight black hair, innocent beautiful face, school uniform blouse open, (small perky breasts:1.5), (nipples:1.5), school skirt lifted, (pussy visible:1.5), sitting on school desk, afternoon classroom light, pencil in hand, flushed embarrassed look',
    '1girl, 18 years old, chinese schoolgirl, hair in twin tails, cute face, only wearing open school shirt, (bare breasts:1.6), (nipples:1.5), no underwear, (pussy peeking:1.4), leaning against school locker, golden afternoon light, shy smile',
    '1girl, 18 years old, chinese girl, long hair down, beautiful young face, school uniform removed except stockings, (nude:1.5), (bare breasts:1.5), (pussy exposed:1.5), studying at desk from behind angle, soft room lighting, homework visible, unaware expression',
  ]},

  '小雨': { style: 'real', prompts: [
    '1girl, 19 years old, chinese college freshman, long brown wavy hair, innocent sweet face, casual oversized shirt slipping off shoulders, (bare breasts:1.6), (erect nipples:1.5), denim shorts unzipped, (pussy peeking:1.4), sitting on college dorm bed, fairy lights background, cozy night lighting, playful shy expression',
    '1girl, 19 years old, chinese university girl, wavy hair messy, beautiful young face, wearing only open flannel shirt, (full bare breasts:1.6), (nipples:1.5), (pussy visible:1.5), lying on dorm bed among textbooks, soft warm light, relaxed after study expression',
    '1girl, 19 years old, chinese freshman, hair in loose bun, cute face, only wearing thigh high socks, (completely nude:1.5), (bare breasts:1.5), (pussy exposed:1.5), sitting at study desk, laptop open, college dorm room, desk lamp lighting, looking at camera with surprise',
  ]},

  // ── 二次元/修仙/妖魔角色 ─────────────────────────────────────────────────────

  '狐九': { style: 'anime', prompts: [
    '1girl, fox girl, nine fluffy white tails, fox ears, silver white long flowing hair, glowing amber eyes, beautiful ethereal anime face, translucent silk hanfu open, (bare breasts:1.6), (erect nipples:1.5), (pussy visible:1.5), sitting on ancient stone altar, full moon, misty ancient forest, ethereal purple particles, magical aura, ultra detailed anime art',
    '1girl, fox girl, 9 tails, fox ears, silver white hair windswept, glowing amber slit eyes, perfect ethereal face, completely nude, (full breasts:1.6), (erect nipples:1.5), (pussy fully visible:1.6), lying in moonlit clearing, sakura petals, supernatural glow, tail curled between legs suggestively, dreamy atmosphere',
    '1girl, kitsune, multiple tails, fox ears, silver hair, amber eyes, gorgeous ethereal face, wearing only white fox fur barely covering, (side breast:1.5), (nipples peeking:1.4), standing at shrine torii gate at dusk, red torii, atmospheric mist, magical light rays, dignified seductive expression',
  ]},

  '冷霜': { style: 'anime', prompts: [
    '1girl, ice cultivator, cold beauty, long ice blue silver hair, piercing cold eyes, pale skin with subtle glow, ice element aura, cultivation robe falling open, (bare breasts:1.6), (erect nipples:1.5), (pussy visible:1.5), sitting on ice throne, frozen mountain peak, moonlight, ice crystal particles floating, aloof seductive expression',
    '1girl, female cultivator, ice magic user, silver blue long hair flowing, beautiful cold face, translucent ice-blue cultivation robes open, (full bare breasts:1.6), (nipples:1.5), (pussy exposed:1.5), standing on snowy mountain peak, blizzard behind, ice energy swirling, powerful and seductive',
    '1girl, xianxia ice beauty, long pale hair, cold stunning face, wearing only thin ice-blue inner robe that reveals, (bare breasts:1.6), (erect nipples:1.5), (pussy visible through translucent fabric:1.4), meditation pose on floating ice platform, aurora borealis background, mystical cold beauty',
  ]},

  '魅罗': { style: 'anime', prompts: [
    '1girl, demon girl, sealed demon, long dark purple flowing hair, crimson slit eyes, beautiful evil face, horns, dark elegant torn dress falling off, (full bare breasts:1.6), (erect nipples:1.5), (pussy exposed:1.6), sitting on dark throne, chains around wrists, dark magical energy, sinister seductive smile, dramatic dark lighting',
    '1girl, demon woman, purple hair, glowing red eyes, gorgeous evil face, small demon horns, dark revealing bodysuit tearing open, (bare breasts:1.6), (nipples:1.5), (pussy visible:1.5), dark dungeon background, magical dark fire, dominating pose, smirking down at viewer',
    '1girl, demon girl, dark purple long hair loose, seductive evil face, demon tail and small horns, wearing only dark magic energy barely covering, (exposed breasts:1.6), (nipples:1.5), (pussy showing:1.5), dark void background, dark energy particles, wings spreading, completely dangerous and alluring',
  ]},

  '星澜': { style: 'anime', prompts: [
    '1girl, alien ambassador, mysterious beauty, long silver white hair with galaxy shimmer, luminous purple eyes, ethereal alien face, futuristic revealing outfit opening, (bare breasts:1.6), (erect nipples:1.5), (pussy visible:1.5), space station background, starfield, nebula colors, alien technology glowing, otherworldly seductive',
    '1girl, space alien girl, shimmering silver hair, glowing cosmic eyes, perfect alien beauty, translucent starlight bodysuit dissolving, (full bare breasts:1.6), (nipples:1.5), (pussy exposed:1.5), floating in zero gravity, planet earth visible through window, soft cosmic light',
    '1girl, alien emissary, long cosmic colored hair, star-like eyes, beautiful alien face, wearing only cosmic energy projection barely forming clothing, (bare breasts:1.6), (nipples:1.5), (pussy visible:1.5), alien spaceship interior, stars outside, mysterious and seductive expression',
  ]},

  '零': { style: 'anime', prompts: [
    '1girl, post-apocalypse survivor, combat girl, short silver white hair, sharp violet eyes, battle-worn beautiful face, torn tactical vest open, (bare athletic breasts:1.5), (nipples:1.5), combat pants torn, (pussy exposed:1.5), destroyed city ruins background, dramatic sunset, dust and debris, fierce determined expression',
    '1girl, wasteland warrior girl, short messy silver hair, violet eyes, intense beautiful face, only wearing torn bandages and open jacket, (bare breasts:1.5), (nipples:1.5), (pussy visible:1.5), sitting on ruins, post-apocalyptic sky, tired but defiant expression, scars and gear',
    '1girl, cyberpunk survivor, silver hair with neon streaks, glowing eye implant, fierce attractive face, futuristic torn armor, (bare breasts:1.6), (erect nipples:1.5), (pussy exposed:1.5), neon-lit ruined city, rain, cyberpunk aesthetic, dangerous beauty',
  ]},
};

// ── 其他角色的通用真实感模板 ────────────────────────────────────────────────────
// 下面这些角色可以通过脚本传名字生成，会用 fallback prompt
const REAL_FALLBACK_PROMPTS = (name: string, age: number, occ: string): string[] => [
  `1girl, ${age} years old, chinese woman, ${occ}, beautiful perfect face, elegant, clothes partially removed, (bare breasts:1.6), (erect nipples:1.5), (pussy visible:1.5), seductive pose, dramatic lighting, luxury interior background, cinematic`,
  `1girl, ${age} years old, chinese woman, ${occ}, gorgeous face, long dark hair, wearing only open shirt, (full bare breasts:1.6), (nipples:1.5), (pussy exposed:1.5), sitting in dim room, moody lighting, confident expression`,
  `1girl, ${age} years old, chinese woman, ${occ}, stunning beauty, perfect body, completely nude, (bare breasts:1.6), (erect nipples:1.5), (shaved pussy fully visible:1.6), lying on bed, soft warm light, seductive gaze at camera`,
];

// ── ComfyUI 工作流 ──────────────────────────────────────────────────────────
function buildWorkflow(prompt: string, seed: number, style: 'real' | 'anime') {
  const model   = style === 'anime' ? MODEL_ANIME : MODEL_REAL;
  const prefix  = style === 'anime' ? QUALITY_ANIME : QUALITY_REAL;
  const neg     = style === 'anime' ? NEGATIVE_ANIME : NEGATIVE_REAL;
  const cfg     = style === 'anime' ? 5.5 : 6.5;
  const steps   = style === 'anime' ? 28  : 30;
  const fullPrompt = `${prefix}, ${prompt}`;

  return {
    "4": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": model } },
    "6": { "class_type": "CLIPTextEncode", "inputs": { "text": fullPrompt, "clip": ["4", 1] } },
    "7": { "class_type": "CLIPTextEncode", "inputs": { "text": neg, "clip": ["4", 1] } },
    "5": { "class_type": "EmptyLatentImage", "inputs": { "width": 768, "height": 1024, "batch_size": 1 } },
    "3": {
      "class_type": "KSampler",
      "inputs": {
        "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0],
        "seed": seed, "steps": steps, "cfg": cfg,
        "sampler_name": "dpm_2_ancestral", "scheduler": "karras", "denoise": 1.0
      }
    },
    "8": { "class_type": "VAEDecode", "inputs": { "samples": ["3", 0], "vae": ["4", 2] } },
    "9": { "class_type": "SaveImage", "inputs": { "images": ["8", 0], "filename_prefix": "album" } },
  };
}

async function queuePrompt(workflow: object): Promise<string> {
  const res = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  });
  if (!res.ok) throw new Error(`Queue failed: ${res.status}`);
  return ((await res.json()) as { prompt_id: string }).prompt_id;
}

async function waitForImage(promptId: string): Promise<string> {
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000));
    const res = await fetch(`${COMFYUI_URL}/history/${promptId}`);
    if (!res.ok) continue;
    const history = await res.json() as Record<string, any>;
    const entry = history[promptId];
    if (!entry?.outputs) continue;
    for (const nodeOut of Object.values(entry.outputs) as any[]) {
      if (nodeOut?.images?.length) return nodeOut.images[0].filename;
    }
  }
  throw new Error('Timeout waiting for image');
}

async function downloadAndSave(filename: string, charName: string, idx: number): Promise<string> {
  const res = await fetch(`${COMFYUI_URL}/view?filename=${filename}&type=output`);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const buffer = await res.buffer();
  fs.mkdirSync(SAVE_DIR, { recursive: true });
  const safeName = charName.replace(/[^a-zA-Z0-9一-鿿]/g, '_');
  const saveName = `album_${safeName}_${idx}_${Date.now()}.png`;
  const savePath = path.join(SAVE_DIR, saveName);
  fs.writeFileSync(savePath, buffer);
  return `${PUBLIC_BASE}/images/${encodeURIComponent(saveName)}`;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const charName = process.argv[2] || '林晓雅';
  const count = parseInt(process.argv[3] || '3', 10);

  const config = ALBUM_CONFIGS[charName];

  const systemUser = await prisma.user.findUnique({ where: { telegramId: BigInt(1) } });
  if (!systemUser) { console.error('System user not found'); process.exit(1); }

  const char = await prisma.character.findFirst({
    where: { name: charName, creatorId: systemUser.id }
  });
  if (!char) { console.error(`找不到角色 "${charName}"`); process.exit(1); }

  // 如果没有预设 prompt，用 fallback
  let prompts: string[];
  let style: 'real' | 'anime';
  if (config) {
    prompts = config.prompts;
    style = config.style;
  } else {
    console.log(`⚠️  没有预设 prompt，使用通用模板`);
    prompts = REAL_FALLBACK_PROMPTS(charName, char.age, char.occupation);
    style = 'real';
  }

  const modelName = style === 'anime' ? 'Pony Diffusion XL (二次元)' : 'RealVisXL (真实感)';
  console.log(`\n🎨 开始为 ${charName} 生成 ${count} 张封面图`);
  console.log(`   模型：${modelName}`);
  console.log(`   风格：${style}\n`);

  const urls: string[] = [];

  for (let i = 0; i < Math.min(count, prompts.length); i++) {
    const prompt = prompts[i];
    console.log(`  [${i + 1}/${count}] 生成中...`);
    console.log(`  Prompt: ${prompt.slice(0, 80)}...`);

    try {
      const seed = Math.floor(Math.random() * 2 ** 32);
      const workflow = buildWorkflow(prompt, seed, style);
      const promptId = await queuePrompt(workflow);
      const filename = await waitForImage(promptId);
      const url = await downloadAndSave(filename, charName, i + 1);
      urls.push(url);
      console.log(`  ✅ 图片 ${i + 1}: ${url}\n`);
    } catch (err: any) {
      console.error(`  ❌ 图片 ${i + 1} 失败: ${err.message}\n`);
    }

    if (i < count - 1) await new Promise(r => setTimeout(r, 2000));
  }

  if (urls.length === 0) {
    console.error('所有图片生成失败');
    process.exit(1);
  }

  await prisma.character.update({
    where: { id: char.id },
    data: { portraitUrl: urls[0], portraitImages: urls },
  });

  console.log(`\n✨ 完成！${charName} 共生成 ${urls.length} 张封面图`);
  urls.forEach((u, i) => console.log(`  ${i + 1}. ${u}`));
  console.log('\n📤 上传到服务器：');
  console.log(`scp -r D:/SD/siyuwanban/portraits/* root@168.144.108.9:/var/www/siyuwanban/images/`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
