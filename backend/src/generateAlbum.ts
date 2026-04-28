/**
 * 为单个角色生成多张封面图（album）
 * 用法：npx ts-node src/generateAlbum.ts [角色名] [张数]
 * 示例：npx ts-node src/generateAlbum.ts 林晓雅 3
 * ComfyUI 需要在本地 8188 端口运行
 */

import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const COMFYUI_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';
const SAVE_DIR = process.env.IMAGE_SAVE_DIR || 'D:/SD/siyuwanban/portraits';
const PUBLIC_BASE = process.env.FRONTEND_URL || 'https://siyuwanban.shangzongcai.com';

// ── 超高质量正面 prompt 前缀 ────────────────────────────────────────────────
const QUALITY_PREFIX = [
  '(photorealistic:1.4)', '(hyperrealistic:1.3)', 'RAW photo', '8k uhd', 'masterpiece',
  '(perfect face:1.5)', '(beautiful face:1.5)', '(stunning beauty:1.4)',
  '(perfect symmetrical face:1.3)', '(flawless skin:1.3)',
  '(gorgeous:1.3)', '(detailed eyes:1.3)', '(perfect eyes:1.3)',
  '(supermodel:1.2)', '(editorial lighting:1.2)',
  '(explicit:1.4)', '(nsfw:1.4)',
].join(', ');

const NEGATIVE = [
  '(worst quality:1.6)', '(low quality:1.6)', '(normal quality:1.4)',
  'bad anatomy', 'bad face', 'ugly face', 'asymmetrical face', 'deformed face',
  'extra limbs', 'deformed hands', 'extra fingers', 'missing fingers',
  'blurry', 'watermark', 'text', 'logo', 'signature',
  'censored bar', 'mosaic', 'pixelated genitals', 'covered genitals', 'underwear covering',
  'cross-eye', 'lazy eye', 'bad eyes',
].join(', ');

// ── 每个角色的多套场景 pose ─────────────────────────────────────────────────
// 每套包含固定外貌 + 3种不同场景/角度/姿势
const ALBUM_PROMPTS: Record<string, string[]> = {
  '林晓雅': [
    // 场景1：律所深夜，坐在办公桌上解开外套
    '1girl, 28 years old, chinese woman, lawyer, long black hair updo, sharp eyes, dark red lips, perfect oval face, office suit jacket sliding off shoulders, (bare breasts:1.6), (erect nipples:1.5), pencil skirt pushed up to waist, (pussy visible:1.5), legs slightly spread, sitting on mahogany desk, glass city lights behind, dramatic rim lighting, luxury office, 4k detail',
    // 场景2：落地窗前，红酒，俯瞰夜景，半裸
    '1girl, 28 years old, chinese woman, long black hair down loose, sharp eyes, dark red lips, perfect oval face, white unbuttoned shirt hanging off one shoulder, (bare breasts:1.6), (nipples:1.5), no underwear, (pussy peeking:1.4), leaning against floor-to-ceiling window, city skyline at night, warm amber glow, wine glass in hand, confident smirk, cinematic lighting',
    // 场景3：会议室，领带，只穿衬衫，极度暴露
    '1girl, 28 years old, chinese woman, long black hair tied loosely, sharp eyes, perfect face, wearing only unbuttoned white shirt, (large bare breasts fully exposed:1.6), (erect nipples:1.5), (shaved pussy fully visible:1.6), (spread legs:1.4), sitting wide on leather chair, conference table, meeting room, documents scattered, tie loosened around neck, dominant expression, dramatic side lighting',
  ],

  '椎名老师': [
    '1girl, 24 years old, japanese woman, black framed glasses, dark hair in bun, perfect cute face, white shirt wide open, (bare breasts:1.6), (erect nipples:1.5), short pleated skirt lifted, (panties pulled down to knees:1.5), (pussy exposed:1.6), sitting on classroom desk legs spread, piece of chalk on desk, afternoon light, empty classroom, flushed cheeks, embarrassed expression',
    '1girl, 24 years old, japanese teacher, black framed glasses, dark hair loose down, perfect cute face, only wearing open white shirt, (bare breasts:1.6), (nipples:1.5), leaning over desk showing cleavage, (pussy visible:1.5), skirt bunched up, blackboard behind with equations, soft focus background, warm classroom light, biting lip',
    '1girl, 24 years old, japanese woman, glasses removed, dark hair, beautiful face, completely nude, (large bare breasts:1.6), (erect nipples:1.5), (pussy fully exposed:1.6), sitting in teacher chair legs apart, classroom setting, golden evening light, expression mix of shame and arousal, textbook open on desk',
  ],

  '狐九': [
    '1girl, fox girl, nine fluffy white tails fanned out, fox ears, silver white long flowing hair, glowing amber eyes, beautiful ethereal face, translucent silk hanfu falling open, (bare breasts:1.6), (erect nipples:1.5), (pussy visible:1.5), sitting on ancient stone altar, full moon behind, misty forest, ethereal purple glow, magical particles floating',
    '1girl, fox girl, nine white tails, fox ears, silver white hair windswept, glowing amber eyes, perfect ethereal face, completely nude, (full breasts:1.6), (erect nipples:1.5), (pussy fully visible:1.6), lying in moonlit clearing, flower petals around, ancient tree roots, supernatural glow from skin, one tail curled between legs suggestively',
    '1girl, fox girl, fox ears, silver hair, amber slit eyes, gorgeous face, wearing only white fox fur wrap barely covering, (side breast:1.5), (nipples peeking:1.4), (pussy visible from below:1.5), standing in shrine gateway at dusk, dramatic red torii gate, atmospheric fog, supernatural beauty',
  ],

  '晓彤': [
    '1girl, 22 years old, chinese woman, athletic toned body, ponytail, beautiful face, gym crop top pulled up, (bare athletic breasts:1.6), (nipples:1.5), gym shorts pulled down to thighs, (toned abs:1.2), (pussy exposed:1.5), leaning against gym locker, gym locker room, fluorescent lighting, sweaty glistening skin, confident smirk',
    '1girl, 22 years old, chinese woman, athletic build, hair down, beautiful face, sports bra pushed up, (bare breasts:1.6), (erect nipples:1.5), sports shorts completely removed, (pussy visible:1.6), lying on gym mat doing exercise pose, modern gym background, afternoon light, toned body detail',
    '1girl, 22 years old, chinese woman, athletic body, ponytail, cute face, wearing only unbuttoned gym jacket, (nude under:1.5), (full bare breasts:1.6), (nipples:1.5), (pussy exposed:1.5), sitting on front desk, gym reception background, end of day lighting, playful expression',
  ],
};

// ── ComfyUI 工作流 ──────────────────────────────────────────────────────────
function buildWorkflow(prompt: string, seed: number) {
  const fullPrompt = `${QUALITY_PREFIX}, ${prompt}`;
  return {
    "4": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "realvisxlV50_v50LightningBakedvae.safetensors" } },
    "6": { "class_type": "CLIPTextEncode", "inputs": { "text": fullPrompt, "clip": ["4", 1] } },
    "7": { "class_type": "CLIPTextEncode", "inputs": { "text": NEGATIVE, "clip": ["4", 1] } },
    "5": { "class_type": "EmptyLatentImage", "inputs": { "width": 768, "height": 1024, "batch_size": 1 } },
    "3": {
      "class_type": "KSampler",
      "inputs": {
        "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0],
        "seed": seed, "steps": 30, "cfg": 6.5,
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
  return `${PUBLIC_BASE}/images/${saveName}`;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const charName = process.argv[2] || '林晓雅';
  const count = parseInt(process.argv[3] || '3', 10);

  const prompts = ALBUM_PROMPTS[charName];
  if (!prompts) {
    console.error(`❌ 没有找到 "${charName}" 的 prompt，可用角色:`, Object.keys(ALBUM_PROMPTS).join('、'));
    process.exit(1);
  }

  const systemUser = await prisma.user.findUnique({ where: { telegramId: BigInt(1) } });
  if (!systemUser) { console.error('System user not found'); process.exit(1); }

  const char = await prisma.character.findFirst({
    where: { name: charName, creatorId: systemUser.id }
  });
  if (!char) { console.error(`找不到角色 "${charName}"`); process.exit(1); }

  console.log(`\n🎨 开始为 ${charName} 生成 ${count} 张封面图...\n`);
  const urls: string[] = [];

  for (let i = 0; i < Math.min(count, prompts.length); i++) {
    const prompt = prompts[i];
    console.log(`  [${i + 1}/${count}] 生成中...`);
    console.log(`  Prompt: ${prompt.slice(0, 80)}...`);

    try {
      const seed = Math.floor(Math.random() * 2 ** 32);
      const workflow = buildWorkflow(prompt, seed);
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

  // 更新数据库：设置 portraitUrl（第一张）和 portraitImages（全部）
  await prisma.character.update({
    where: { id: char.id },
    data: {
      portraitUrl: urls[0],
      portraitImages: urls,
    },
  });

  console.log(`\n✨ 完成！${charName} 共生成 ${urls.length} 张封面图`);
  console.log('图片 URLs:');
  urls.forEach((u, i) => console.log(`  ${i + 1}. ${u}`));
  console.log('\n记得用 scp 把 portraits/ 目录上传到服务器！');
  console.log(`scp -r D:/SD/siyuwanban/portraits/* root@168.144.108.9:/var/www/siyuwanban/images/`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
