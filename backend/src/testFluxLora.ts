/**
 * Flux LoRA 测试脚本 — 每个 shotKey 生 2 张，全存同一文件夹
 * 用法：node_modules\.bin\tsx src\testFluxLora.ts [角色名]
 * 输出：D:\SD\siyuwanban\library\flux_lora_test\{shotKey}_01.png ...
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { CHARACTER_FACE } from './characterFace';
import { SHOT_TYPES, type ShotKey, type SceneConfig } from './generateSceneConfig';

const prisma      = new PrismaClient();
const COMFYUI_URL = 'http://127.0.0.1:8188';
const OUTPUT_DIR  = 'D:/SD/siyuwanban/library/flux_lora_test';

const FLUX_MODEL = 'fluxedUpFluxNSFW_102BF16.safetensors';
const FLUX_CLIP1 = 't5xxl_fp8_e4m3fn.safetensors';
const FLUX_CLIP2 = 'clip_l.safetensors';
const FLUX_VAE   = 'ae.safetensors';
const FLUX_LORAS: [string, number][] = [
  ['NSFW_master_ZIT_000017532.safetensors', 0.8],
  ['Body FIX FLUX.safetensors',             0.9],
];

const SKIP_SHOTS: ShotKey[] = ['standing_sex'];
const IMGS_PER_SHOT = 2;

const CHARACTER_BASE: Record<string, string> = {
  '椎名老师': '24 year old Japanese woman, teacher, petite 157cm 44kg, round sweet face, black framed round glasses, dark black hair in loose messy bun, milky porcelain skin, soft lips',
  '晓彤':    '22 year old Chinese woman, fitness coach, 163cm athletic toned 53kg, defined abs, peach-blossom droopy eyes, jet black hair in high ponytail, fair rosy-white skin',
  '娜娜':    '18 year old Chinese high school girl, 155cm very petite slim 42kg, heart-shaped innocent face, large expressive eyes, long straight jet black hair, porcelain skin',
  '小雨':    '19 year old Chinese college girl, 160cm slim delicate 46kg, large round doe eyes, round innocent face, soft wavy chestnut brown hair to shoulders, smooth fair skin',
  '琉璃':    '22 year old Chinese graduate student, 161cm slim 47kg, neat straight black hair with sharp blunt bangs, black rectangular framed glasses, delicate oval face, pale smooth skin',
  '糖糖':    '20 year old Chinese art student, 157cm slim cute 45kg, sweet apple-cheeked round face with dimples, black hair in high ponytail, rosy fair skin',
  '沈静':    '25 year old Chinese supermodel, 178cm tall long-legged 56kg, strikingly angular face with high cheekbones, bone-straight black hair center-parted, pale ivory cool skin',
  '小慧':    '23 year old Chinese nurse, 159cm slim gentle 47kg, pretty warm face with soft dimples, soft wavy light brown hair, tender white skin',
  '夜玲':    '26 year old Chinese woman, 162cm slim pale 48kg, sharp cold face, long dark wavy hair, heavy smoky eyeshadow, dark red lips',
  '晴晴':    '21 year old Chinese gaming streamer, 158cm cute petite 46kg, round lively face with dimples, long hair with pink and lavender streaks, rosy skin',
  '唐诗':    '27 year old Chinese secretary, 163cm slim graceful 49kg, refined oval face, sleek black hair in elegant chignon, jade-white pale skin',
  '阿柒':    '22 year old Chinese cafe barista, 160cm slim 47kg, warm soft round face, wavy chestnut-brown hair loose, fair peachy skin',
};

const SHOT_PROMPTS: Partial<Record<ShotKey, string>> = {
  portrait:               'portrait photo, head and shoulders, looking at camera, soft background, beautiful face, natural expression',
  medium:                 'medium shot waist up, slightly flushed cheeks, lips slightly parted, anticipating expression',
  kiss:                   'close-up kissing, male lips pressed against her lips, tongues touching, saliva between lips, eyes half closed, deeply flushed',
  breast:                 'close-up of bare breasts, erect pink nipples, male hands groping and squeezing her breasts, aroused expression, moaning',
  pussy:                  'close-up of spread pussy, pink labia spread open, vaginal opening clearly visible, wet glistening, fingers holding labia open, fully exposed',
  handjob:                'POV handjob, female hand stroking an erect penis, fingers wrapped around the veiny shaft, cock head visible, close-up from above',
  fingering:              'fingering, two fingers inserted inside her wet vagina, love juice dripping, woman lying on back, legs naturally spread, close-up between thighs, moaning',
  blowjob:                'close-up portrait, woman giving a blowjob, erect penis in her mouth, cock head on her tongue, looking up at camera with submissive eyes, saliva dripping',
  cunnilingus:            'cunnilingus, male face buried between her thighs, tongue on her clitoris, woman moaning with eyes rolled back',
  penetration_missionary: 'missionary sex position, woman lying on back, legs naturally spread apart, vaginal penetration, penis deep inside, medium shot, moaning with eye contact',
  penetration_doggy:      'doggy style sex, rear view, vaginal penetration from behind, ass and wet pussy visible, male hands gripping her hips, back deeply arched',
  penetration_cowgirl:    'cowgirl sex position, woman riding on top, vaginal penetration, breasts bouncing, head thrown back moaning, male body visible below',
  penetration_spooning:   'spooning sex position, side angle, penetration from behind, bodies pressed together, intimate expression',
  penetration_generic:    'vaginal sex, explicit penetration clearly visible, penis deep inside her pussy, love juice dripping, legs spread wide',
  standing_sex:           'standing sex from behind, woman bent forward, penetration from behind while standing',
  ahegao:                 'close-up face, ahegao expression, eyes fully rolled back, mouth wide open drooling, tongue out, tears of pleasure, deep crimson blush, white cum on face',
  creampie:               'creampie close-up, white cum dripping from pussy, cum overflowing, swollen pink labia, post-sex exhausted, legs spread',
  cum_face:               'facial cumshot, white cum ropes on face, ahegao expression, tongue out catching cum, eyes glazed, deeply flushed',
};

const MALE_PRESENCE: Partial<Record<ShotKey, string>> = {
  kiss:                   'male lips pressing against hers',
  breast:                 'strong male hands on her breasts',
  handjob:                'erect male penis in her hand',
  fingering:              'male fingers inside her',
  blowjob:                'male thighs framing her face, hand gripping her hair',
  cunnilingus:            'male head between her legs',
  penetration_missionary: 'male body pressing down, male hips thrusting',
  penetration_doggy:      'male hands gripping her hips from behind',
  penetration_cowgirl:    'male body lying underneath her',
  penetration_spooning:   'male arm around her from behind',
  penetration_generic:    'male hands on her hips',
  standing_sex:           'male hands pinning her against wall',
  creampie:               'cum dripping from her stretched pussy',
  cum_face:               'male cock visible above her face',
};

const QUALITY = 'photorealistic, hyperrealistic, RAW photo, 8k uhd, masterpiece, beautiful Asian woman, perfect face, flawless porcelain skin, nsfw, explicit, professional photography, sharp focus, correct anatomy, natural body proportions, realistic limbs';
const NEGATIVE = 'bad anatomy, bad hands, extra fingers, missing fingers, fused fingers, extra limbs, missing limbs, deformed limbs, twisted body, impossible pose, contorted body, ugly face, blurry, watermark, text, censored, mosaic, worst quality, low quality';

function buildWorkflow(prompt: string, seed: number, width: number, height: number): object {
  const full = `${QUALITY}, ${prompt}`;
  return {
    "1": { class_type: "CheckpointLoaderSimple",  inputs: { ckpt_name: FLUX_MODEL } },
    "2": { class_type: "DualCLIPLoader",           inputs: { clip_name1: FLUX_CLIP1, clip_name2: FLUX_CLIP2, type: "flux" } },
    "3": { class_type: "VAELoader",                inputs: { vae_name: FLUX_VAE } },
    // Flux LoRA 链式叠加（LoraLoaderModelOnly 不动 CLIP）
    "10": { class_type: "LoraLoaderModelOnly", inputs: { model: ["1", 0],  lora_name: FLUX_LORAS[0][0], strength_model: FLUX_LORAS[0][1] } },
    "11": { class_type: "LoraLoaderModelOnly", inputs: { model: ["10", 0], lora_name: FLUX_LORAS[1][0], strength_model: FLUX_LORAS[1][1] } },
    "4": { class_type: "CLIPTextEncodeFlux",       inputs: { clip: ["2", 0], clip_l: full, t5xxl: full, guidance: 3.5 } },
    "5": { class_type: "CLIPTextEncode",           inputs: { clip: ["2", 0], text: NEGATIVE } },
    "6": { class_type: "EmptyLatentImage",         inputs: { width, height, batch_size: 1 } },
    "7": { class_type: "KSampler",                 inputs: { model: ["11", 0], positive: ["4", 0], negative: ["5", 0], latent_image: ["6", 0], seed, steps: 25, cfg: 1.0, sampler_name: "euler", scheduler: "beta", denoise: 1.0 } },
    "8": { class_type: "VAEDecode",                inputs: { samples: ["7", 0], vae: ["3", 0] } },
    "9": { class_type: "SaveImage",                inputs: { images: ["8", 0], filename_prefix: "flux_lora" } },
  };
}

async function queuePrompt(workflow: object): Promise<string> {
  const res = await fetch(`${COMFYUI_URL}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: workflow }) });
  if (!res.ok) throw new Error(`Queue failed: ${res.status} ${await res.text()}`);
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
  throw new Error('Timeout');
}

async function downloadImage(filename: string, savePath: string) {
  const res = await fetch(`${COMFYUI_URL}/view?filename=${filename}&type=output`);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  fs.writeFileSync(savePath, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  const characterName = process.argv[2] ?? '椎名老师';

  const configPath = path.join(__dirname, '..', 'scene_configs', `${characterName}.json`);
  if (!fs.existsSync(configPath)) { console.error(`❌ 无场景配置: ${configPath}`); process.exit(1); }
  const sceneConfig: SceneConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  const character = await prisma.character.findFirst({ where: { name: characterName } });
  if (!character) { console.error(`❌ 角色未找到: ${characterName}`); process.exit(1); }

  const faceAnchor = (character.faceAnchor as string | null) ?? CHARACTER_FACE[characterName] ?? '';
  const charBase   = CHARACTER_BASE[characterName] ?? `${character.age} year old ${character.occupation}`;

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`\n🧪 Flux LoRA 测试 — 【${characterName}】`);
  FLUX_LORAS.forEach(([name, w]) => console.log(`   LoRA: ${name}  weight=${w}`));
  console.log(`   输出: ${OUTPUT_DIR}\n`);

  let total = 0;
  for (const { key: shotKey, label } of SHOT_TYPES) {
    if (SKIP_SHOTS.includes(shotKey)) continue;

    const shotConfig = sceneConfig.shotConfigs[shotKey];
    if (!shotConfig?.scene) continue;

    console.log(`── ${shotKey} (${label})`);

    const promptParts = [
      charBase, faceAnchor, shotConfig.outfit,
      SHOT_PROMPTS[shotKey],
      MALE_PRESENCE[shotKey] ?? '',
      shotConfig.scene, shotConfig.mood,
      ...(shotConfig.extra ? [shotConfig.extra] : []),
    ].filter(Boolean);
    const basePrompt = promptParts.join(', ');

    const isPortrait = ['portrait','medium','blowjob','cum_face','ahegao','kiss','breast'].includes(shotKey);
    const [w, h] = isPortrait ? [768, 1024] : [1024, 768];

    for (let i = 1; i <= IMGS_PER_SHOT; i++) {
      const savePath = path.join(OUTPUT_DIR, `${shotKey}_${String(i).padStart(2,'0')}.png`);
      process.stdout.write(`  [${i}/${IMGS_PER_SHOT}] 生成中... `);
      try {
        const seed     = Math.floor(Math.random() * 2 ** 32);
        const workflow = buildWorkflow(basePrompt, seed, w, h);
        const promptId = await queuePrompt(workflow);
        const filename = await waitForImage(promptId);
        await downloadImage(filename, savePath);
        console.log(`✅ ${path.basename(savePath)}`);
        total++;
      } catch (err: any) {
        console.log(`❌ ${err.message}`);
      }
    }
  }

  await prisma.$disconnect();
  console.log(`\n🎉 完成！共生成 ${total} 张 → ${OUTPUT_DIR}`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
