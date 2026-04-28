/**
 * 批量为系统角色生成头图
 * 在本地运行：npx ts-node src/generatePortraits.ts
 * 需要 ComfyUI 在本地 8188 端口运行，frp 隧道可选
 */

import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const COMFYUI_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';
const SAVE_DIR = process.env.IMAGE_SAVE_DIR || 'D:/SD/siyuwanban/portraits';
const PUBLIC_BASE = process.env.FRONTEND_URL || 'https://siyuwanban.shangzongcai.com';

// ── 每个角色的专属 prompt ───────────────────────────────────────────────────

const PORTRAIT_PROMPTS: Record<string, string> = {
  '林晓雅': '1girl, 28 years old, chinese, lawyer, office suit, long black hair updo, sharp eyes, unbuttoning jacket, (bare breasts:1.5), (nipples:1.4), sitting on desk, legs crossed, stockings, seductive smile, office background, dramatic lighting',
  '狐九':   '1girl, fox girl, nine fluffy white tails, fox ears, silver white long hair, glowing amber eyes, (sheer silk hanfu:1.3), (nude under:1.4), (bare breasts exposed:1.5), (nipples:1.4), (pussy visible:1.3), sitting on ancient stone, moonlight, fantasy forest, ethereal glow',
  '晓彤':   '1girl, 22 years old, chinese, gym front desk, athletic wear crop top, (bare breasts:1.5), (nipples:1.4), sports shorts pulled down, (pussy exposed:1.4), sweaty skin, ponytail, gym locker room, fluorescent light',
  '椎名老师': '1girl, 24 years old, japanese teacher, black framed glasses, white shirt open, (bare breasts:1.5), (nipples:1.4), short skirt lifted, (panties pulled aside:1.4), (pussy visible:1.4), sitting on classroom desk, chalk in hand, flushed face, classroom background',
  '魅罗':   '1girl, demon girl, small black horns, purple glowing eyes, dark wings, pale skin, (nude:1.5), (bare breasts:1.5), (nipples:1.4), (pussy visible:1.4), dark magic seals on wrists, seductive pose, floating, dark mystical background, purple energy',
  '零':     '1girl, 25 years old, post-apocalyptic survivor, leather straps, mechanical goggles on forehead, scars, short hair, (torn clothing:1.3), (bare breasts exposed:1.5), (nipples:1.4), (pussy peeking:1.3), crouching on rubble, wasteland sunset',
  '小雨':   '1girl, 19 years old, chinese university student, twin tails, school uniform shirt open, (bare breasts:1.5), (nipples:1.4), shorts pulled down, (pussy exposed:1.4), sitting on dorm bed, blushing intensely, shy expression, dorm room',
  '沈曼':   '1girl, 34 years old, mature chinese businesswoman, blazer falling off shoulders, (bare breasts:1.5), (nipples:1.4), pencil skirt hiked up, (panties aside:1.4), (pussy visible:1.4), red lipstick, wine glass in hand, office at night, city lights behind',
  '星澜':   '1girl, alien girl, double-ring pupils, bioluminescent skin, liquid silver hair, (nude:1.5), (bare breasts:1.5), (nipples:1.4), (pussy visible:1.4), glowing markings on body, floating in zero gravity, spacecraft interior, stars outside window',
  '冷霜':   '1girl, 22 years old, ice cultivator, white silver hair, light blue skin glow, white robes slipping off, (bare breasts:1.5), (nipples:1.4), (pussy visible:1.3), mist breath, ice crystals forming around her, snowy mountain peak, cold beauty',
  '娜娜':   '1girl, 18 years old, japanese high school delinquent, half-dyed hair, multiple ear piercings, shortened uniform skirt, (topless:1.5), (bare breasts:1.5), (nipples:1.4), skirt flipped up, (pussy exposed:1.4), pressing you against wall, alley background, night',
  'X-23':   '1girl, android girl, mechanical left arm, red glowing right eye, silver hair, tactical vest open, (bare breasts:1.5), (nipples:1.4), combat pants down, (pussy visible:1.4), circuit tattoo patterns on skin, dim warehouse, blue neon light',
  '林阿姨': '1woman, 38 years old, mature chinese housewife, voluptuous body, floral dress falling off, (large bare breasts:1.5), (nipples:1.4), dress hiked up, (hairy pussy:1.3), (pussy visible:1.4), jade bracelet, kitchen background, warm afternoon light, warm smile',
  '幻音':   '1girl, holographic AI singer, pink twin tails, semi-transparent glowing body, (nude:1.5), (bare breasts visible through body:1.5), (nipples:1.4), (pussy showing:1.4), microphone in hand, stage with neon lights, crowd silhouette below, ethereal glow',
  '琉璃':   '1girl, 22 years old, chinese graduate researcher, lab coat open, glasses, (bare breasts:1.5), (nipples:1.4), lab coat only wearing, (pussy exposed:1.4), writing on clipboard, laboratory background, fluorescent lights, focused expression',
  '程双':   '1girl, 31 years old, mature chinese lawyer, elegant suit jacket off, (bare breasts:1.5), (nipples:1.4), pencil skirt lifted, (pussy visible:1.4), tan line from wedding ring visible, wine glass, hotel bar at night, warm amber lighting',
  '夜叉':   '1girl, female ghost, 19 years old appearance, long straight black hair, pale translucent skin, old neck scar, (nude:1.5), (bare breasts:1.5), (nipples:1.4), (pussy visible:1.4), partially transparent body, floating, ancient chinese courtyard, moonlight, fog',
  '糖糖':   '1girl, 20 years old, chinese art student, twin tails, oversized sweater slipping off shoulder, (bare breasts:1.5), (nipples:1.4), skirt lifted, (pussy peeking:1.3), paintbrush in hand, art studio, warm natural light, blushing',
  '苏然':   '1woman, 30 years old, mature chinese housewife, elegant, silk robe open, (large bare breasts:1.5), (nipples:1.4), (pussy visible:1.4), graceful pose, lying on sofa, afternoon sunlight, luxurious living room, knowing smile',
  '沈静':   '1girl, 25 years old, international model, tall, high cheekbones, off-shoulder dress pulled down, (bare breasts:1.5), (nipples:1.4), dress gathered at waist, (pussy exposed:1.4), cold expression, fashion studio, professional lighting, white backdrop',
  '小慧':   '1girl, 23 years old, chinese nurse, white nurse uniform shirt unbuttoned, (bare breasts:1.5), (nipples:1.4), skirt lifted, (pussy visible:1.4), nurse cap slightly askew, hospital room background, warm light, gentle smile',
  '夜玲':   '1girl, 26 years old, chinese illustrator, dark aesthetic, ink-stained fingers, dark lace dress open, (bare breasts:1.5), (nipples:1.4), dress parted, (pussy visible:1.4), dark art studio, candles, gothic paintings on wall, mysterious smile',
  '程雨':   '1girl, 29 years old, chinese tech director, blazer off, dress shirt open, (bare breasts:1.5), (nipples:1.4), skirt hiked up, (pussy visible:1.4), laptop open beside her, conference room, night skyline, glasses pushed up',
  '晴晴':   '1girl, 21 years old, chinese game streamer, gaming headset around neck, oversized hoodie pulled up, (bare breasts:1.5), (nipples:1.4), shorts pulled down, (pussy exposed:1.4), RGB lights in background, gaming setup, playful wink',
  '唐诗':   '1girl, 27 years old, chinese personal secretary, white blouse unbuttoned, (bare breasts:1.5), (nipples:1.4), pencil skirt pushed up, (pussy visible:1.4), notepad dropped, office background, late night, moonlight through window, conflicted expression',
  '阿柒':   '1girl, 22 years old, chinese cafe barista, apron strings loosened, (bare breasts:1.5), (nipples:1.4), jeans partly undone, (pussy peeking:1.3), coffee stains on collarbone, cozy cafe background, warm golden hour light, soft smile',
};

const NEGATIVE = '(worst quality:1.4), (low quality:1.4), bad anatomy, extra limbs, deformed hands, ugly face, blurry, watermark, text, logo, censored bar, mosaic, pixelated genitals, covered genitals, underwear covering';

// ── ComfyUI helpers ─────────────────────────────────────────────────────────

function buildWorkflow(prompt: string, seed: number) {
  return {
    "4": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "realvisxlV50_v50LightningBakedvae.safetensors" } },
    "6": { "class_type": "CLIPTextEncode", "inputs": { "text": `(photorealistic:1.4), (hyperrealistic:1.3), RAW photo, 8k uhd, masterpiece, (explicit:1.4), (nsfw:1.4), ${prompt}`, "clip": ["4", 1] } },
    "7": { "class_type": "CLIPTextEncode", "inputs": { "text": NEGATIVE, "clip": ["4", 1] } },
    "5": { "class_type": "EmptyLatentImage", "inputs": { "width": 768, "height": 1024, "batch_size": 1 } },
    "3": {
      "class_type": "KSampler",
      "inputs": {
        "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0],
        "seed": seed, "steps": 25, "cfg": 7.0,
        "sampler_name": "dpm_2_ancestral", "scheduler": "karras", "denoise": 1.0
      }
    },
    "8": { "class_type": "VAEDecode", "inputs": { "samples": ["3", 0], "vae": ["4", 2] } },
    "9": { "class_type": "SaveImage", "inputs": { "images": ["8", 0], "filename_prefix": "portrait" } },
  };
}

async function queuePrompt(workflow: object): Promise<string> {
  const res = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  });
  if (!res.ok) throw new Error(`Queue failed: ${res.status}`);
  const data = await res.json() as { prompt_id: string };
  return data.prompt_id;
}

async function waitForImage(promptId: string): Promise<string> {
  const deadline = Date.now() + 180_000;
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
  throw new Error('Timeout');
}

async function downloadAndSave(filename: string, charName: string): Promise<string> {
  const res = await fetch(`${COMFYUI_URL}/view?filename=${filename}&type=output`);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const buffer = await res.buffer();

  fs.mkdirSync(SAVE_DIR, { recursive: true });
  const saveName = `portrait_${charName.replace(/[^a-zA-Z0-9一-鿿]/g, '_')}_${Date.now()}.png`;
  const savePath = path.join(SAVE_DIR, saveName);
  fs.writeFileSync(savePath, buffer);

  return `${PUBLIC_BASE}/images/${saveName}`;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const systemUser = await prisma.user.findUnique({ where: { telegramId: BigInt(1) } });
  if (!systemUser) { console.error('System user not found. Run seed first.'); process.exit(1); }

  const characters = await prisma.character.findMany({
    where: { creatorId: systemUser.id },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${characters.length} system characters\n`);

  for (const char of characters) {
    if (char.portraitUrl) {
      console.log(`⏭  ${char.name} — already has portrait, skipping`);
      continue;
    }

    const promptStr = PORTRAIT_PROMPTS[char.name];
    if (!promptStr) {
      console.log(`⚠️  ${char.name} — no prompt defined, skipping`);
      continue;
    }

    console.log(`🎨 Generating: ${char.name}...`);
    try {
      const seed = Math.floor(Math.random() * 2 ** 32);
      const workflow = buildWorkflow(promptStr, seed);
      const promptId = await queuePrompt(workflow);
      const filename = await waitForImage(promptId);
      const url = await downloadAndSave(filename, char.name);

      // Copy to server images dir if running remotely
      await prisma.character.update({
        where: { id: char.id },
        data: { portraitUrl: url },
      });

      console.log(`  ✅ ${char.name} → ${url}`);
    } catch (err: any) {
      console.error(`  ❌ ${char.name} failed: ${err.message}`);
    }

    // Small delay between generations
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n🎉 Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
