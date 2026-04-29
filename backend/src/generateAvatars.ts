/**
 * 为所有角色生成专属头像（面部特写，适合作为 chat 头像）
 * 生成 512x512 的方形头像图，存为 faceUrl
 *
 * 用法：npx ts-node -r dotenv/config src/generateAvatars.ts [角色名]
 * 不传角色名则生成所有真实感角色
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { CHARACTER_FACE } from './characterFace';

const prisma = new PrismaClient();
const COMFYUI_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';
const SAVE_DIR = process.env.IMAGE_SAVE_DIR || '/var/www/siyuwanban/images';
const BASE_URL = 'https://siyuwanban.shangzongcai.com/images';
const MODEL_ANIME  = 'ponyDiffusionV6XL_v6StartWithThisOne.safetensors';  // 待 NoobAI 后删除
const MODEL_JUGGER = 'juggernautXL_juggXIByRundiffusion.safetensors';
const MODEL_LEOSAM = 'leosamsHelloworldXL_helloworldXL70.safetensors';
const MODEL_NOOB   = 'noobaiXLNAIXL_epsilonPred11Version.safetensors';

const QUALITY_FACE = [
  '(photorealistic:1.4)', '(hyperrealistic:1.3)', 'RAW photo', '8k uhd', 'masterpiece',
  // 亚洲美人 / 白瘦幼核心
  '(Asian beauty:1.5)', '(beautiful Asian face:1.5)', '(delicate Asian features:1.4)',
  '(porcelain fair skin:1.6)', '(flawless pale white skin:1.5)', '(luminous translucent skin:1.3)',
  '(youthful:1.3)', '(slender petite:1.2)',
  '(perfect face:1.5)', '(beautiful delicate face:1.5)',
  '(detailed eyes:1.4)', '(perfect double eyelids:1.3)',
  '(studio portrait:1.3)', 'close-up portrait', 'face and shoulders only',
].join(', ');

const QUALITY_ANIME_FACE = [
  'score_9', 'score_8_up', 'score_7_up', 'masterpiece', 'best quality',
  'ultra detailed', 'highly detailed', '8k',
  '(beautiful face:1.5)', '(perfect eyes:1.5)', '(detailed eyes:1.4)',
  'source_anime', 'close-up portrait', 'face and upper body',
].join(', ');

const NEGATIVE_FACE = [
  '(worst quality:1.6)', '(low quality:1.6)', '(normal quality:1.4)',
  'bad anatomy', 'bad face', 'ugly face', 'asymmetrical face', 'deformed face',
  'extra limbs', 'blurry', 'watermark', 'text', 'logo', 'signature',
  'cross-eye', 'lazy eye', 'bad eyes',
  // 排除黑黄/老气/粗犷
  '(dark skin:1.5)', '(tanned skin:1.5)', '(yellowish skin:1.4)', '(sallow complexion:1.4)',
  '(uneven skin tone:1.3)', '(muddy skin:1.3)', '(bronze skin:1.3)',
  '(old:1.3)', '(aged:1.3)', 'wrinkles', 'pores', 'freckles',
  'fat face', 'chubby face', 'wide jaw', 'masculine features',
  'full body', 'nude', 'nsfw', 'explicit', 'cleavage', 'underwear',
].join(', ');

const NEGATIVE_ANIME_FACE = [
  'score_1', 'score_2', 'score_3', 'score_4',
  'bad anatomy', 'bad hands', 'deformed face', 'ugly face', 'bad face',
  'blurry', 'watermark', 'text', 'bad quality', 'worst quality',
  'full body', 'nude', 'nsfw',
].join(', ');

// ── NoobAI / Illustrious 头像专用 ─────────────────────────────────────────────
const QUALITY_NOOB_FACE = [
  'masterpiece', 'best quality', 'amazing quality', 'very aesthetic', 'newest',
  'ultra detailed', 'highly detailed',
  '(beautiful face:1.5)', '(perfect eyes:1.5)', '(detailed eyes:1.4)',
  'source_anime', 'close-up portrait', 'face and upper body',
].join(', ');

const NEGATIVE_NOOB_FACE = [
  'worst quality', 'bad quality', 'lowres', 'normal quality',
  'bad anatomy', 'deformed face', 'ugly face', 'bad face', 'asymmetrical face',
  'blurry', 'watermark', 'text', 'bad quality',
  'full body', 'nude', 'nsfw', 'explicit',
].join(', ');

// ── 专属头像 Prompt（面部特写，非 NSFW）──────────────────────────────────────
// 每个角色独立设计【眼型 + 脸型】，统一白瘦幼亚洲美人风格
const FACE_PROMPTS: Record<string, { style: 'real' | 'anime'; model?: string; prompt: string }> = {
  // 眼型：大圆杏眼（放大无辜眼）  脸型：软圆脸（蓬松脸颊）
  '椎名老师': { style: 'real', model: MODEL_LEOSAM, prompt: '1girl, 24 years old, japanese woman, teacher, close-up face portrait, dark hair in loose messy bun with stray strands, large round apricot eyes magnified behind black-frame glasses, gentle double eyelids, luminous milky-white skin, soft round innocent face with full cheeks, tiny cute nose, natural pink lips, flushed rosy cheeks, white blouse collar, warm afternoon classroom window light bokeh, shy flustered expression, slightly parted lips' },
  // 眼型：桃花眼（微下垂外眼角）  脸型：小方脸（紧实下颌线）
  '晓彤': { style: 'real', model: MODEL_JUGGER, prompt: '1girl, 22 years old, chinese woman, gym trainer, close-up face portrait, black hair in tight high ponytail, charming slightly droopy outer-corner peach-blossom eyes, fair rosy-white skin with healthy pink flush on cheeks, compact petite defined jawline face, sporty tank top strap, gym mirror bright bokeh, bright confident playful smirk, energetic lively expression' },
  // 眼型：猫眼（上挑逆反）  脸型：心形脸（额宽尖下巴）
  '娜娜': { style: 'real', model: MODEL_LEOSAM, prompt: '1girl, 18 years old, chinese high school girl, close-up face portrait, long straight black hair with pink-dyed streaks, sharp upturned cat-eye shape with subtle liner, snow-white pale skin, pretty heart-shaped face wide forehead small pointy chin, soft baby cheeks, school uniform collar, rooftop afternoon soft light bokeh, bold rebellious smirk with mischievous sparkle in eyes' },
  // 眼型：水汪大眼（圆亮无辜）  脸型：婴儿圆脸（饱满脸颊）
  '小雨': { style: 'real', model: MODEL_LEOSAM, prompt: '1girl, 19 years old, chinese college girl, close-up face portrait, long wavy chestnut-brown hair loose, huge round dewy innocent eyes with natural shine and slight tremble, luminous snow-fair skin, soft baby-round face with full cheeks, small button nose, pale pink petal lips, oversized knit sweater collar, fairy lights bokeh, pure innocent wide-eyed surprised expression' },
  // 眼型：柳叶眼+眼镜（文静内敛）  脸型：精致小脸（清秀小巧）
  '琉璃': { style: 'real', model: MODEL_LEOSAM, prompt: '1girl, 22 years old, chinese graduate student, close-up face portrait, neat straight black hair with precise blunt bangs, delicate elongated willow-leaf eyes behind thin silver-frame glasses, cold pale-white porcelain skin, small fine-featured delicate face, straight bridge nose, pale blush lips, white lab coat collar, cool fluorescent lab bokeh, focused quietly analytical expression' },
  // 眼型：深邃冷目（模特空洞感）  脸型：高颧尖颌（冷艳线条）
  '沈静': { style: 'real', model: MODEL_JUGGER, prompt: '1girl, 25 years old, chinese supermodel, close-up face portrait, long bone-straight sleek black hair center-parted, deep-set heavily-lashed cold gaze eyes, pale ivory cool-white skin, sharp prominent cheekbones angular model face with v-line chin, black turtleneck collar, professional studio strobe lighting backstage bokeh, distant untouchable expression, cold goddess aura' },
  // 眼型：温柔圆眼（大而善良）  脸型：软圆甜脸（苹果肌饱满）
  '小慧': { style: 'real', model: MODEL_LEOSAM, prompt: '1girl, 23 years old, chinese nurse, close-up face portrait, soft wavy shoulder-length light-brown hair, gentle large warm round eyes with kind soft gaze, tender pale-white skin with natural rosy blush, soft round sweet face with apple cheeks, white nurse uniform collar, warm hospital interior bokeh, gentle caring warm smile, nurturing soft expression' },
  // 眼型：烟熏勾魂眼（暗黑摄魄）  脸型：V尖脸（下颌线锋利）
  '夜玲': { style: 'real', model: MODEL_LEOSAM, prompt: '1girl, 26 years old, chinese artist, close-up face portrait, long dark slightly wavy hair with loose strand across face, soul-capturing heavy dark smoky eye makeup with smudged liner, snow-white almost translucent pale skin, sharp pointed v-line chin face defined bone structure, black choker, dark atmospheric bokeh with single candle light, intense mysterious piercing gaze, dark seductive expression' },
  // 眼型：圆眼内双（元气少女）  脸型：圆苹果脸（元气感）
  '晴晴': { style: 'real', model: MODEL_LEOSAM, prompt: '1girl, 21 years old, chinese game streamer, close-up face portrait, long pastel lavender-pink dyed hair half-up ponytail, bright round sparkling eyes with cute aegyo-sal under-eye fat, fair white skin with rosy apple cheeks, round cute face with full cheeks, streamer graphic hoodie collar, colorful RGB LED bokeh, bright energetic cheerful expression with playful wink' },
  // 眼型：古典杏眼（端庄秀气）  脸型：古典鹅蛋（大家闺秀）
  '唐诗': { style: 'real', model: MODEL_LEOSAM, prompt: '1girl, 27 years old, chinese secretary, close-up face portrait, elegant black hair in graceful chignon bun, soft classic almond eyes with natural double eyelid refined brow, jade cool-white skin, refined classical oval face gentle proportions, pale pink lips, silk work blouse collar, warm amber office bokeh, quietly composed graceful expression with hidden warmth' },
  // 眼型：笑弯眼（眯成月牙）  脸型：软萌圆脸（邻家感）
  '阿柒': { style: 'real', model: MODEL_LEOSAM, prompt: '1girl, 22 years old, chinese barista, close-up face portrait, warm light-brown wavy shoulder-length hair loose, eyes that curve into crescent moons when smiling, fair peachy-white skin, soft round approachable face with natural blush dimple, cafe apron collar, warm golden morning cafe sunlight bokeh, genuine warm sweet smile, charming girl-next-door beauty' },
  // 眼型：兔眼（水灵圆翘）  脸型：娃娃脸（圆润童颜）
  '糖糖': { style: 'real', model: MODEL_LEOSAM, prompt: '1girl, 20 years old, chinese art student, close-up face portrait, paint-flecked loose ponytail, round doe-eyes with slight natural upturn and sparkling look, fair rosy-white skin, full round doll-face with cute visible dimples, small mouth, paint-stained overalls collar, sunlit art studio bokeh, sweet pure beaming smile, innocent adorable expression' },
  // 二次元角色（NoobAI XL Illustrious）
  'X-23': { style: 'anime', model: MODEL_NOOB, prompt: '1girl, android girl, close-up face portrait, short platinum white hair with neon streaks, glowing blue circuit-pattern eyes, beautiful synthetic face, tactical collar, neon blue lab lighting bokeh, cold calculating expression with awakening curiosity' },
  '幻音': { style: 'anime', model: MODEL_NOOB, prompt: '1girl, AI singer holographic entity, close-up face portrait, translucent holographic long hair shifting colors, glowing ethereal luminous eyes, hauntingly beautiful face, digital space background bokeh, music notes particles, longing dreamy expression' },
  '狐九': { style: 'anime', model: MODEL_NOOB, prompt: '1girl, fox girl, close-up face portrait, fox ears, silver white long flowing hair, glowing amber slit eyes, beautiful ethereal face, moonlit ancient forest bokeh, purple particles, dignified seductive expression' },
  '冷霜': { style: 'anime', model: MODEL_NOOB, prompt: '1girl, ice cultivator, close-up face portrait, silver blue long hair, piercing cold eyes, pale glowing skin, ice-blue cultivation collar, snowy mountain bokeh, cold breath frost, aloof beautiful expression' },
  '魅罗': { style: 'anime', model: MODEL_NOOB, prompt: '1girl, demon girl, close-up face portrait, long dark purple flowing hair, crimson slit eyes, beautiful evil face, small horns, dark throne bokeh, sinister seductive smirk' },
};

function buildFaceWorkflow(prompt: string, style: 'real' | 'anime', modelOverride?: string) {
  const model = modelOverride ?? (style === 'anime' ? MODEL_ANIME : MODEL_JUGGER);

  let prefix: string, neg: string, cfg: number, steps: number;
  if (model === MODEL_NOOB) {
    prefix = QUALITY_NOOB_FACE; neg = NEGATIVE_NOOB_FACE; cfg = 6.0; steps = 26;
  } else if (style === 'anime') {
    prefix = QUALITY_ANIME_FACE; neg = NEGATIVE_ANIME_FACE; cfg = 5.0; steps = 26;
  } else {
    prefix = QUALITY_FACE; neg = NEGATIVE_FACE; cfg = 6.0; steps = 28;
  }

  const fullPrompt = `${prefix}, ${prompt}`;

  return {
    "4": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": model } },
    "6": { "class_type": "CLIPTextEncode", "inputs": { "text": fullPrompt, "clip": ["4", 1] } },
    "7": { "class_type": "CLIPTextEncode", "inputs": { "text": neg, "clip": ["4", 1] } },
    // 512x512 square — perfect for circular avatar
    "5": { "class_type": "EmptyLatentImage", "inputs": { "width": 512, "height": 512, "batch_size": 1 } },
    "3": {
      "class_type": "KSampler",
      "inputs": {
        "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0],
        "seed": Math.floor(Math.random() * 2 ** 32),
        "steps": steps, "cfg": cfg,
        "sampler_name": "dpm_2_ancestral", "scheduler": "karras", "denoise": 1.0,
      },
    },
    "8": { "class_type": "VAEDecode", "inputs": { "samples": ["3", 0], "vae": ["4", 2] } },
    "9": { "class_type": "SaveImage", "inputs": { "images": ["8", 0], "filename_prefix": "face" } },
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

const CHAR_SLUG: Record<string, string> = {
  '椎名老师': 'zhui', '晓彤': 'tong', '娜娜': 'nana', '小雨': 'yu',
  '琉璃': 'luli', '糖糖': 'tang', '沈静': 'shen', '小慧': 'hui',
  '夜玲': 'ling', '晴晴': 'qing', '唐诗': 'shi', '阿柒': 'qi',
  'X-23': 'x23', '幻音': 'huan', '狐九': 'hujiu', '冷霜': 'shuang', '魅罗': 'mei',
};

async function downloadAndSave(filename: string, charName: string): Promise<string> {
  const res = await fetch(`${COMFYUI_URL}/view?filename=${filename}&type=output`);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const buffer = await res.buffer();
  fs.mkdirSync(SAVE_DIR, { recursive: true });
  const slug = CHAR_SLUG[charName] ?? charName.replace(/[^a-zA-Z0-9]/g, '_');
  const saveName = `face_${slug}_${Date.now()}.png`;
  const savePath = path.join(SAVE_DIR, saveName);
  fs.writeFileSync(savePath, buffer);
  return `${BASE_URL}/${saveName}`;
}

async function main() {
  const targetChar = process.argv[2];
  const chars = targetChar ? [targetChar] : Object.keys(FACE_PROMPTS);

  const systemUser = await prisma.user.findUnique({ where: { telegramId: BigInt(1) } });
  if (!systemUser) { console.error('System user not found'); process.exit(1); }

  console.log(`\n🎨 开始为 ${chars.length} 个角色生成头像\n`);

  for (const charName of chars) {
    const config = FACE_PROMPTS[charName];
    if (!config) { console.log(`⚠  跳过（无配置）: ${charName}`); continue; }

    const char = await prisma.character.findFirst({
      where: { name: charName, creatorId: systemUser.id },
    });
    if (!char) { console.log(`⚠  跳过（DB 无此角色）: ${charName}`); continue; }

    console.log(`  [${charName}] 生成中...`);
    try {
      const faceAnchor = CHARACTER_FACE[charName];
      const finalPrompt = faceAnchor ? `${faceAnchor}, ${config.prompt}` : config.prompt;
      const workflow = buildFaceWorkflow(finalPrompt, config.style, config.model);
      const promptId = await queuePrompt(workflow);
      const filename = await waitForImage(promptId);
      const url = await downloadAndSave(filename, charName);

      await prisma.character.update({
        where: { id: char.id },
        data: { faceUrl: url } as any,
      });

      console.log(`  ✅ ${charName}: ${url}`);
    } catch (err: any) {
      console.error(`  ❌ ${charName} 失败: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\n✨ 全部完成！');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
