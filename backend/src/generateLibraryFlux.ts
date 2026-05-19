/**
 * Flux 版图库生成（替代 generateLibrary.ts）
 * 用法：node_modules\.bin\tsx src\generateLibraryFlux.ts [角色名] [--from=<shotKey>] [--force]
 * 输出：D:\SD\siyuwanban\library\{角色名}\{shotKey}\001.png ...
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { CHARACTER_FACE } from './characterFace';
import { SHOT_TYPES, type ShotKey, type SceneConfig } from './generateSceneConfig';

const prisma = new PrismaClient();
const COMFYUI_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';
const LIBRARY_DIR = process.env.LIBRARY_DIR || 'D:/SD/siyuwanban/library';

const FLUX_MODEL = 'fluxedUpFluxNSFW_102BF16.safetensors';
const FLUX_CLIP1 = 't5xxl_fp8_e4m3fn.safetensors';
const FLUX_CLIP2 = 'clip_l.safetensors';
const FLUX_VAE   = 'ae.safetensors';

// ── 角色基础描述 ─────────────────────────────────────────────────────────────
const CHARACTER_BASE: Record<string, string> = {
  '椎名老师': '24 year old Japanese woman, teacher, petite 157cm 44kg, round sweet face, black framed round glasses, dark black hair in loose messy bun, milky porcelain skin, soft lips',
  '晓彤':    '22 year old Chinese woman, fitness coach, 163cm athletic toned 53kg, defined abs, peach-blossom droopy eyes, jet black hair in high ponytail, fair rosy-white skin',
  '娜娜':    '18 year old Chinese high school girl, 155cm very petite slim 42kg, heart-shaped innocent face, large expressive eyes, long straight jet black hair, porcelain skin',
  '小雨':    '19 year old Chinese college girl, 160cm slim delicate 46kg, large round doe eyes, round innocent face, soft wavy chestnut brown hair to shoulders, smooth fair skin',
  '琉璃':    '22 year old Chinese graduate student, 161cm slim 47kg, neat straight black hair with sharp blunt bangs, black rectangular framed glasses, delicate oval face, pale smooth skin',
  '糖糖':    '20 year old Chinese art student, 157cm slim cute 45kg, sweet apple-cheeked round face with dimples, bright warm eyes, black hair in high ponytail, rosy pink-toned fair skin',
  '沈静':    '25 year old Chinese supermodel, 178cm extremely tall long-legged 56kg, strikingly angular face with high sharp cheekbones, bone-straight black hair center-parted, pale ivory cool skin',
  '小慧':    '23 year old Chinese nurse, 159cm slim gentle 47kg, pretty warm face with soft dimples, soft wavy light brown hair to shoulders, tender white skin',
  '夜玲':    '26 year old Chinese woman, 162cm slim pale 48kg, gorgeous sharp cold face with pointed chin, long dark near-black wavy hair, heavy smoky eyeshadow, dark red lips',
  '晴晴':    '21 year old Chinese gaming streamer, 158cm cute petite 46kg, pretty round lively face with dimples, long hair with pastel pink and lavender dye streaks, rosy healthy skin',
  '唐诗':    '27 year old Chinese secretary, 163cm slim graceful 49kg, refined classical oval face, sleek straight black hair in tight elegant chignon, jade-white pale skin',
  '阿柒':    '22 year old Chinese cafe barista, 160cm slim natural 47kg, warm soft round face with crescent-smile eyes, wavy warm chestnut-brown hair loose messy, fair peachy skin',
  'X-23':   'android girl cyberpunk, platinum white hair short undercut with electric neon blue streaks, glowing blue circuit-pattern eyes, perfect synthetic beautiful face',
  '幻音':    'holographic AI singer, translucent long hair shifting prismatic blue pink purple, glowing ethereal eyes, hauntingly beautiful face',
  '狐九':    'nine-tailed fox girl, nine fluffy silver-white tails, perky silver fox ears, long flowing silver-white hair, glowing amber-gold slit eyes, ethereal beautiful face',
  '冷霜':    'ice cultivator beauty, long silver-blue hair with ice crystal ornaments, piercing pale blue glowing eyes, luminous cold pale skin',
  '魅罗':    'demon girl, long dark purple flowing hair, crimson slit glowing eyes, gorgeous evil face, small elegant horns',
  '桃桃':    '18 year old girl, pink twin tails, big bright sparkling round eyes, cute dimples, petite slim figure, fair white smooth skin',
};

// ── Flux 版 shot 描述（自然语言，无权重符号）────────────────────────────────
const SHOT_PROMPTS: Partial<Record<ShotKey, string>> = {
  portrait:               'portrait photo, head and shoulders, looking at camera, soft background, beautiful face, natural expression',
  medium:                 'medium shot waist up, slightly flushed cheeks, lips slightly parted, anticipating expression, warm soft lighting',
  kiss:                   'close-up kissing, male lips pressed against her lips, their mouths meeting, tongues touching, saliva between lips, eyes half closed, deeply flushed, intimate',
  breast:                 'close-up of bare breasts, erect pink nipples, areola visible, male hands groping and squeezing her breasts, fingers pinching nipples, aroused expression, moaning',
  pussy:                  'close-up of spread pussy, pink labia spread open, vaginal opening clearly visible, wet glistening, fingers holding labia open, fully exposed, inner thighs visible',
  handjob:                'POV handjob, female hand stroking an erect penis, fingers wrapped around the veiny shaft, cock head visible, close-up from above, teasing smirk expression',
  fingering:              'fingering close-up, two fingers inserted deep inside her wet vagina, love juice dripping, woman lying on back with legs spread wide, moaning with mouth open',
  blowjob:                'close-up portrait, woman giving a blowjob, erect penis in her mouth, cock head on her tongue, looking up at the camera with submissive eyes, saliva dripping, cheeks flushed, face tilted up',
  cunnilingus:            'cunnilingus, male face buried between her thighs, tongue on her clitoris, fingers spreading her labia, woman moaning with eyes rolled back, thighs squeezing',
  penetration_missionary: 'missionary sex position, woman lying on back with legs spread wide, vaginal penetration from above, penis deep inside, overhead view, intense eye contact, moaning',
  penetration_doggy:      'doggy style sex, rear view, vaginal penetration from behind, ass and wet pussy clearly visible, male hands gripping her hips, back deeply arched, moaning face',
  penetration_cowgirl:    'cowgirl sex position, woman riding on top, vaginal penetration, penis deep inside, breasts bouncing, riding with abandon, head thrown back moaning, male body visible below',
  penetration_spooning:   'spooning sex position, side angle, penetration from behind, bodies pressed together, male arm wrapped around her, hand gripping breast, intimate whisper expression',
  penetration_generic:    'vaginal sex, explicit penetration clearly visible, penis stretching her pussy, love juice dripping, legs spread wide, medium shot of hips and thighs, moaning',
  standing_sex:           'standing sex from behind, woman bent forward pressed against wall, penetration from behind while standing, male hands pinning her, explicit entry visible from side angle',
  ahegao:                 'close-up face, ahegao expression, eyes fully rolled back, mouth wide open drooling, tongue out, tears of pleasure streaming down, deep crimson blush, white cum on face, completely overwhelmed',
  creampie:               'creampie close-up, white cum dripping from pussy, cum overflowing from vagina, swollen pink labia, post-sex exhausted pose, legs spread, medium shot showing hips',
  cum_face:               'facial cumshot, white cum ropes on face and cheeks, cum dripping from chin, ahegao expression, tongue out catching cum, eyes glazed, deeply flushed, overwhelmed',
};

// ── 男性存在感补充 ────────────────────────────────────────────────────────────
const MALE_PRESENCE: Partial<Record<ShotKey, string>> = {
  kiss:                   'male chin slightly visible, his lips pressing against hers',
  breast:                 'strong male hands groping her breasts, male fingers pinching nipples',
  handjob:                'erect male penis, male crotch close-up',
  fingering:              'male fingers inside her, male hand between thighs',
  blowjob:                'male thighs framing her face, hand gripping her hair from above',
  cunnilingus:            'male head buried between her legs, dark hair visible',
  penetration_missionary: 'male body pressing down on her, male hips thrusting, male torso visible',
  penetration_doggy:      'male hands gripping her hips from behind, male torso visible behind her',
  penetration_cowgirl:    'male body lying underneath her, male hands on her thighs, male chest visible',
  penetration_spooning:   'male arm around her from behind, male chest against her back',
  penetration_generic:    'male hands on her hips, male body partially visible',
  standing_sex:           'male hands pinning her against wall, male forearm across her chest',
  creampie:               'cum dripping from her stretched pussy',
  cum_face:               'male cock visible above her face',
};

// ── 质量前缀 ─────────────────────────────────────────────────────────────────
const QUALITY_PREFIX = 'photorealistic, hyperrealistic, RAW photo, 8k uhd, masterpiece, beautiful Asian woman, perfect face, flawless porcelain skin, nsfw, explicit, professional photography, sharp focus, cinematic lighting';
const NEGATIVE = 'bad anatomy, bad hands, extra fingers, missing fingers, ugly face, blurry, watermark, text, logo, signature, censored, mosaic, worst quality, low quality, cartoon, 3d render, painting';

// ── ComfyUI Flux Workflow ─────────────────────────────────────────────────────
function buildWorkflow(prompt: string, seed: number, width = 768, height = 1024): object {
  const fullPrompt = `${QUALITY_PREFIX}, ${prompt}`;
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: FLUX_MODEL } },
    "2": { class_type: "DualCLIPLoader",         inputs: { clip_name1: FLUX_CLIP1, clip_name2: FLUX_CLIP2, type: "flux" } },
    "3": { class_type: "VAELoader",               inputs: { vae_name: FLUX_VAE } },
    "4": { class_type: "CLIPTextEncodeFlux",      inputs: { clip: ["2", 0], clip_l: fullPrompt, t5xxl: fullPrompt, guidance: 3.5 } },
    "5": { class_type: "CLIPTextEncode",          inputs: { clip: ["2", 0], text: NEGATIVE } },
    "6": { class_type: "EmptyLatentImage",        inputs: { width, height, batch_size: 1 } },
    "7": { class_type: "KSampler",                inputs: { model: ["1", 0], positive: ["4", 0], negative: ["5", 0], latent_image: ["6", 0], seed, steps: 25, cfg: 1.0, sampler_name: "euler", scheduler: "beta", denoise: 1.0 } },
    "8": { class_type: "VAEDecode",               inputs: { samples: ["7", 0], vae: ["3", 0] } },
    "9": { class_type: "SaveImage",               inputs: { images: ["8", 0], filename_prefix: "flux_lib" } },
  };
}

async function queuePrompt(workflow: object): Promise<string> {
  const res = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  });
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
  throw new Error('Timeout waiting for ComfyUI image');
}

async function downloadImage(filename: string, savePath: string): Promise<void> {
  const res = await fetch(`${COMFYUI_URL}/view?filename=${filename}&type=output`);
  if (!res.ok) throw new Error(`Fetch image failed: ${res.status}`);
  const buffer = await res.buffer();
  fs.writeFileSync(savePath, buffer);
}

// ── 主流程 ────────────────────────────────────────────────────────────────────
async function main() {
  const args          = process.argv.slice(2);
  const characterName = args.find(a => !a.startsWith('--')) ?? '椎名老师';
  const fromArg       = args.find(a => a.startsWith('--from='))?.replace('--from=', '');
  const forceRegen    = args.includes('--force');

  const configPath = path.join(__dirname, '..', 'scene_configs', `${characterName}.json`);
  if (!fs.existsSync(configPath)) {
    console.error(`❌ 场景配置不存在: ${configPath}`);
    console.error(`   先运行: node_modules\\.bin\\tsx src\\generateSceneConfig.ts ${characterName}`);
    process.exit(1);
  }
  const sceneConfig: SceneConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  const character = await prisma.character.findFirst({ where: { name: characterName } });
  if (!character) { console.error(`❌ 角色未找到: ${characterName}`); process.exit(1); }

  const faceAnchor = (character.faceAnchor as string | null) ?? CHARACTER_FACE[characterName] ?? '';
  const charBase   = CHARACTER_BASE[characterName] ?? `${character.age} year old ${character.occupation}`;

  console.log(`\n🎨 Flux 图库生成 — 【${characterName}】`);
  console.log(`   模型: ${FLUX_MODEL}`);
  console.log(`   输出: ${LIBRARY_DIR}/${characterName}/\n`);

  const SKIP_SHOTS: ShotKey[] = ['standing_sex'];

  const shotKeys  = SHOT_TYPES.map(t => t.key);
  const startIdx  = fromArg ? shotKeys.indexOf(fromArg as ShotKey) : 0;
  if (fromArg && startIdx === -1) { console.error(`❌ 未知 shotKey: ${fromArg}`); process.exit(1); }

  let totalGenerated = 0;
  let totalSkipped   = 0;

  for (let si = startIdx; si < SHOT_TYPES.length; si++) {
    const { key: shotKey, label, count } = SHOT_TYPES[si];
    const shotDir = path.join(LIBRARY_DIR, characterName, shotKey);
    fs.mkdirSync(shotDir, { recursive: true });

    if (SKIP_SHOTS.includes(shotKey as ShotKey)) {
      console.log(`⏭️  [${shotKey}] 已禁用，跳过`);
      continue;
    }

    const shotConfig = sceneConfig.shotConfigs[shotKey];
    if (!shotConfig?.scene) {
      console.log(`⏭️  [${shotKey}] 无场景配置，跳过`);
      continue;
    }

    console.log(`── [${si + 1}/${SHOT_TYPES.length}] ${shotKey} (${label}) ×${count}张 ──`);

    const shotPrompt  = SHOT_PROMPTS[shotKey];
    const malePresence = MALE_PRESENCE[shotKey] ?? '';
    const promptParts  = [
      charBase,
      faceAnchor,
      shotConfig.outfit,
      shotPrompt,
      malePresence,
      shotConfig.scene,
      shotConfig.mood,
      ...(shotConfig.extra ? [shotConfig.extra] : []),
    ].filter(Boolean);
    const basePrompt = promptParts.join(', ');

    // portrait/medium 竖版，其他按场景
    const isPortrait = ['portrait', 'medium', 'blowjob', 'cum_face', 'ahegao', 'kiss', 'breast'].includes(shotKey);
    const [w, h]     = isPortrait ? [768, 1024] : [1024, 768];

    for (let i = 1; i <= count; i++) {
      const savePath = path.join(shotDir, `${String(i).padStart(3, '0')}.png`);
      if (fs.existsSync(savePath) && !forceRegen) {
        process.stdout.write(`  [${i}/${count}] 已存在，跳过\n`);
        totalSkipped++;
        continue;
      }
      process.stdout.write(`  [${i}/${count}] 生成中... `);
      try {
        const seed     = Math.floor(Math.random() * 2 ** 32);
        const workflow = buildWorkflow(basePrompt, seed, w, h);
        const promptId = await queuePrompt(workflow);
        const filename = await waitForImage(promptId);
        await downloadImage(filename, savePath);
        console.log(`✅  ${path.basename(savePath)}`);
        totalGenerated++;
      } catch (err: any) {
        console.log(`❌  ${err.message}`);
      }
    }
  }

  await prisma.$disconnect();
  console.log(`\n🎉 完成！生成 ${totalGenerated} 张，跳过 ${totalSkipped} 张`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
