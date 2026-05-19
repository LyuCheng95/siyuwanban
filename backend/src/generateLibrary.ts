/**
 * 预生成角色图库（按 shotKey 分类存本地）
 * 用法：node_modules\.bin\tsx src\generateLibrary.ts [角色名] [--from=<shotKey>]
 * 输出：D:\SD\siyuwanban\library\{角色名}\{shotKey}\001.png ...
 *
 * --from=blowjob   从指定类型开始（跳过之前的，已生成的图片会自动跳过）
 * 中断后直接重跑，已有图片不会重新生成
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

// ── 模型文件名 ────────────────────────────────────────────────────────────────
const MODEL_FILES: Record<string, string> = {
  leosam:  'leosamsHelloworldXL_helloworldXL70.safetensors',
  jugger:  'juggernautXL_juggXIByRundiffusion.safetensors',
  noob:    'noobaiXLNAIXL_epsilonPred11Version.safetensors',
  pony:    'ponyDiffusionV6XL_v6StartWithThisOne.safetensors',
};

// ── 每个角色的物理/外貌基础描述（不含服装/场景）────────────────────────────────
const CHARACTER_BASE: Record<string, string> = {
  '椎名老师': '1girl, 24yo japanese teacher, 157cm petite 44kg, round sweet face soft lips, (black framed round glasses:1.3), dark black hair in loose messy bun stray strands, milky porcelain skin',
  '晓彤':    '1girl, 22yo chinese woman, 163cm athletic toned 53kg, defined abs and obliques, peach-blossom droopy eyes compact jawline, jet black hair in high ponytail, fair glistening rosy-white skin',
  '娜娜':    '1girl, 18yo chinese high school girl, 155cm very petite slim 42kg, heart-shaped innocent face large expressive eyes, long straight jet black hair, porcelain skin',
  '小雨':    '1girl, 19yo chinese college girl, 160cm slim delicate 46kg, large round doe eyes, round innocent face, soft wavy chestnut brown hair to shoulders, smooth fair skin',
  '琉璃':    '1girl, 22yo chinese graduate student, 161cm slim 47kg, neat straight black hair with sharp blunt bangs, (black rectangular framed glasses:1.3), delicate precise oval face, pale smooth skin',
  '糖糖':    '1girl, 20yo chinese art student, 157cm slim cute 45kg, sweet apple-cheeked round face dimples, bright warm eyes, black hair high ponytail paint-flecked, rosy pink-toned fair skin',
  '沈静':    '1girl, 25yo chinese supermodel, 178cm extremely tall long-legged 56kg, strikingly angular face high sharp cheekbones, bone-straight black hair center-parted, pale ivory cool skin',
  '小慧':    '1girl, 23yo chinese nurse, 159cm slim gentle 47kg, pretty warm egg-shaped face soft dimples, soft wavy light brown hair to shoulders, tender white skin',
  '夜玲':    '1girl, 26yo chinese woman, 162cm slim pale 48kg, gorgeous sharp cold face pointed chin, long dark near-black wavy hair, heavy smoky black eyeshadow dark red lips',
  '晴晴':    '1girl, 21yo chinese gamer streamer, 158cm cute petite 46kg, pretty round lively face dimples, long hair with pastel pink and lavender dye streaks, rosy healthy skin',
  '唐诗':    '1girl, 27yo chinese secretary, 163cm slim graceful 49kg, refined classical oval face small precise features, sleek straight black hair in tight elegant chignon, jade-white pale skin',
  '阿柒':    '1girl, 22yo chinese cafe barista, 160cm slim natural 47kg, warm soft round face crescent-smile eyes, wavy warm chestnut-brown hair loose messy, fair peachy skin',
  'X-23':   '1girl, android girl cyberpunk, platinum white hair short undercut with electric neon blue streaks, glowing blue circuit-pattern eyes, perfect synthetic beautiful face',
  '幻音':    '1girl, holographic AI singer, translucent long hair shifting prismatic blue pink purple, glowing ethereal eyes, hauntingly beautiful face',
  '狐九':    '1girl, nine-tailed fox girl, (nine fluffy silver-white tails:1.3), (perky silver fox ears:1.3), long flowing silver-white hair, glowing amber-gold slit eyes, ethereal beautiful face',
  '冷霜':    '1girl, ice cultivator beauty, long silver-blue hair with ice crystal ornaments, piercing pale blue glowing eyes, luminous cold pale skin',
  '魅罗':    '1girl, demon girl, long dark purple flowing hair, crimson slit glowing eyes, gorgeous evil face, small elegant horns',
  '桃桃':    '1girl, (pink twin tails:1.4), (big bright sparkling round eyes:1.4), (cute dimples:1.3), petite slim figure, fair white smooth skin',
};

// ── Shot prefixes（含新增的4种）─────────────────────────────────────────────────
const SHOT_PREFIXES: Partial<Record<ShotKey, string>> = {
  portrait:                '(portrait shot:1.3), head and shoulders, looking at viewer, soft focus background',
  medium:                  '(medium shot waist up:1.3), slight lean forward, flushed cheeks, warm expression',
  // 接吻：强调两副嘴唇接触，而非单人特写
  kiss:                    '(kissing close-up:1.7), (male lips pressing against female lips:1.8), (two mouths meeting:1.8), (lips touching lips:1.7), (tongue tip visible:1.4), saliva string between lips, (his and her lips:1.6), shallow depth of field, blurred background',
  breast:                  '(chest close-up:1.5), (bare breasts:1.8), (erect pink nipples:1.7), (detailed nipples:1.6), (areola:1.4), hands cupping or squeezing, camera angle slightly down',
  // 下体：强制裸露 + 明确可见
  pussy:                   '(pussy close-up:1.8), (spread vulva:1.9), (pink labia:1.8), (vaginal opening visible:1.8), (wet glistening pussy:1.7), (inner labia spread:1.7), (detailed vagina:1.7), fingers holding labia open, inner thighs visible, no underwear, fully exposed',
  // 手交：明确是真实阴茎而非物体
  handjob:                 '(handjob POV:1.7), (female hand stroking erect penis:1.8), (realistic cock in hand:1.7), (veiny shaft:1.6), (cock head visible:1.6), (penis clearly visible:1.7), close-up from above, female manicured fingers wrapped around shaft',
  // 手指插入：明确体位 + 视角
  fingering:               '(fingering:1.8), (two fingers inside vagina:1.8), (knuckles deep inside pussy:1.7), (love juice:1.6), (wet vagina close-up:1.7), woman lying on back, legs spread wide, hand approaching from above, close-up between thighs, (vagina clearly visible:1.6)',
  // 口交：极限锁定构图为脸部近景
  blowjob:                 '(close-up face shot:1.9), (portrait composition:1.8), (face only in frame:1.7), (blowjob POV:1.9), (oral sex:1.8), (penis in mouth:1.9), (flesh colored cock:1.9), (skin tone penis:1.8), (cock head on tongue:1.8), (shaft touching lips:1.7), (veiny penis:1.6), looking up at camera, mouth open wide, saliva dripping, cheeks flushed, face tilted up',
  cunnilingus:             '(cunnilingus close-up:1.7), (tongue on clit:1.6), fingers spreading labia, moaning expression, thighs pressing inward',
  penetration_missionary:  '(missionary position:1.7), overhead close-up, (vaginal penetration:1.8), legs spread wide, (penis deep inside:1.7), (cock visible:1.5), intense eye contact',
  penetration_doggy:       '(doggy style:1.8), rear close-up, (vaginal penetration:1.8), ass and wet pussy clearly visible from behind, back arched deeply',
  // 骑乘：强制真实人类阴茎
  penetration_cowgirl:     '(cowgirl position:1.7), (riding cock:1.8), (vaginal penetration:1.8), (realistic human erect penis:1.7), (natural cock:1.6), riding motion, (breasts bouncing:1.5), (pussy gripping cock:1.6), love juice dripping, male hips visible below',
  penetration_spooning:    '(spooning sex:1.7), side-angle close-up, (vaginal penetration:1.8), entry from behind, bodies pressed together',
  // 通用插入：固定视角为斜上方半身，防止肢体变形
  penetration_generic:     '(vaginal penetration:1.9), (cock stretching pussy:1.8), (penis deep inside:1.8), (love juice:1.6), legs spread wide, (clear penetration visible:1.7), medium shot of hips and thighs, diagonal overhead angle',
  // 站立：复用后入逻辑 + 明确站立插入
  standing_sex:            '(standing sex from behind:1.8), (pressed against wall:1.7), (penetration from behind while standing:1.9), (cock entering pussy from behind:1.8), (bent slightly forward:1.5), both standing, man behind woman, explicit entry visible, (vaginal penetration:1.8)',
  ahegao:                  '(face close-up:1.4), (ahegao:1.9), (eyes rolled back:1.8), mouth wide open, tongue out, drooling, (white cum on face:1.7), (white semen:1.6), (white liquid dripping:1.5), tears of pleasure, deep red blush, (bare breasts:1.5), (pink erect nipples:1.6), (detailed nipples:1.5)',
  // 内射：换成中景，防止极端特写导致形体崩坏
  creampie:                '(creampie:1.8), (white cum dripping from pussy:1.8), (cum overflow from vagina:1.7), (swollen pink labia:1.5), post-sex exhausted pose, medium shot showing hips and inner thighs, legs spread, (cum pooling:1.5)',
  cum_face:                '(facial:1.8), (white cum on face:1.8), (white semen ropes on cheeks:1.6), (cum dripping from chin:1.5), ahegao expression, tongue out, eyes glazed, deeply flushed',
};

// ── LoRA 映射（按 shotKey 决定用哪些 LoRA）──────────────────────────────────────
// 每个 LoRA: [文件名, strength_model, strength_clip]
type LoraSpec = [string, number, number];

const SHOT_LORAS: Partial<Record<ShotKey, LoraSpec[]>> = {
  // 手交
  handjob: [
    ['cockteaseLoRASDXL.safetensors', 0.65, 0.65],
    ['nudify_xl_lite.safetensors', 0.45, 0.45],
  ],
  // 手指插入：提高 nudify 确保身体裸露结构正确
  fingering: [
    ['nudify_xl_lite.safetensors', 0.65, 0.65],
  ],
  blowjob: [
    ['nudify_xl_lite.safetensors', 0.75, 0.75],
  ],
  // 裸胸
  breast: [
    ['nudify_xl_lite.safetensors', 0.55, 0.55],
  ],
  // 下体：大幅提高 nudify 确保可见
  pussy: [
    ['nudify_xl_lite.safetensors', 0.72, 0.72],
  ],
  // 舔阴
  cunnilingus: [
    ['nudify_xl_lite.safetensors', 0.5, 0.5],
  ],
  // 传教士
  penetration_missionary: [
    ['MissionaryVaginal-v1-SDXL.safetensors', 0.7, 0.7],
    ['nudify_xl_lite.safetensors', 0.4, 0.4],
  ],
  // 后入
  penetration_doggy: [
    ['dggy.safetensors', 0.7, 0.7],
    ['nudify_xl_lite.safetensors', 0.4, 0.4],
  ],
  // 骑乘
  penetration_cowgirl: [
    ['rvcg.safetensors', 0.7, 0.7],
    ['nudify_xl_lite.safetensors', 0.4, 0.4],
  ],
  // 侧入/通用/站立
  penetration_spooning: [
    ['nudify_xl_lite.safetensors', 0.5, 0.5],
  ],
  penetration_generic: [
    ['dggy.safetensors', 0.45, 0.45],          // 借用后入 LoRA 辅助渲染插入体位
    ['nudify_xl_lite.safetensors', 0.55, 0.55],
  ],
  standing_sex: [
    ['dggy.safetensors', 0.55, 0.55],          // 站立后入与 doggy 体位相似，暂时复用
    ['nudify_xl_lite.safetensors', 0.5, 0.5],
  ],
  // 高潮类
  ahegao: [
    ['Tongue out_SDXL.safetensors', 0.38, 0.38],          // 降低权重，防止脸型崩坏
    ['PornMaster-cum-sdxl-V3-lora.safetensors', 0.58, 0.58], // 提高权重，确保白色精液
    ['nudify_xl_lite.safetensors', 0.55, 0.55],            // 提高权重，修复乳头渲染
  ],
  creampie: [
    ['PornMaster-cum-sdxl-V3-lora.safetensors', 0.45, 0.45], // 降低防止形体崩坏
    ['nudify_xl_lite.safetensors', 0.62, 0.62],              // 提高确保阴部可见
  ],
  cum_face: [
    ['PornMaster-cum-sdxl-V3-lora.safetensors', 0.60, 0.60],
    ['Tongue out_SDXL.safetensors', 0.25, 0.25],             // 大幅降低防止舌头分叉
  ],
};

// ── 男性肢体存在感：让互动画面不显得"独照"──────────────────────────────────────
// 只描述局部（手/躯干/器官），不写 1boy，避免模型把焦点转移到男性身上
const MALE_PRESENCE: Partial<Record<ShotKey, string>> = {
  kiss:                   '(male lips pressing against hers:1.6), (visible tongue intertwining:1.5), saliva string between lips, male chin slightly visible at frame edge',
  breast:                 '(male hands groping bare breasts:1.5), (male fingers pinching nipples:1.4), strong male hands',
  handjob:                '(erect penis:1.6), (hand wrapped around hard cock:1.5), male crotch close-up, veiny shaft',
  fingering:              '(male fingers inside pussy:1.6), (male hand between thighs:1.5), knuckles deep, other hand gripping thigh',
  blowjob:                '(erect penis in mouth:1.7), male thighs framing face, hand gripping her hair from above',
  cunnilingus:            '(male head buried between thighs:1.5), dark hair visible, hands spreading her legs, tongue clearly visible',
  penetration_missionary: '(male body pressing down:1.4), (male hands pinning her wrists:1.4), male hips thrusting, male torso visible',
  penetration_doggy:      '(male hands gripping her hips from behind:1.6), male torso behind her, fingers digging into waist',
  penetration_cowgirl:    '(male body lying underneath:1.3), male hands on her thighs, male chest visible between her legs',
  penetration_spooning:   '(male arm wrapped around from behind:1.4), male chest against her back, hand gripping her breast',
  penetration_generic:    '(male hands on her hips:1.4), male body partially visible, deep insertion visible',
  standing_sex:           '(male hands pinning her against wall:1.5), male forearm across her chest, bodies locked together',
  creampie:               '(cum dripping from stretched pussy:1.6), male cock partially visible pulling out',
  cum_face:               '(cum ropes landing on face:1.5), male cock visible above her face, hand gripping shaft',
};

// ── 表情强化：按阶段覆盖 mood 的平静基调 ──────────────────────────────────────
// 权重故意高于 mood，确保表情不会过于平静
const EXPRESSION_BOOST: Partial<Record<ShotKey, string>> & { medium: string } = {
  // 调情期：含蓄羞涩，眼神有戏
  medium:   '(shy flushed cheeks:1.3), (coy glance:1.2), (slightly parted lips:1.2), (anticipating eyes:1.3)',
  portrait: '(shy flushed cheeks:1.3), (coy glance:1.2), (slightly parted lips:1.2), (anticipating eyes:1.3)',
  kiss:     '(eyes half closed:1.3), (deeply flushed:1.3), (lips trembling:1.3), (lost in kiss:1.2)',

  // 前戏：明显兴奋，喘息，失控边缘
  breast:   '(aroused expression:1.4), (flushed red cheeks:1.4), (lips parted moaning:1.3), (hazy eyes:1.3), (heavy breathing:1.2)',
  pussy:    '(aroused expression:1.4), (flushed red cheeks:1.4), (lips parted moaning:1.3), (hazy eyes:1.3), (thighs trembling:1.2)',
  handjob:  '(teasing smirk:1.3), (flushed cheeks:1.3), (half-lidded seductive eyes:1.4), (biting lower lip:1.3)',
  fingering:'(mouth open moaning:1.5), (eyes glazed:1.4), (deep red blush:1.3), (head tilted back:1.2), (losing control:1.3)',
  blowjob:  '(teary eyes:1.4), (flushed deeply:1.4), (submissive upward gaze:1.4), (saliva on lips:1.3), (cheeks hollow:1.2)',
  cunnilingus: '(eyes rolled back slightly:1.4), (mouth open gasping:1.5), (deep red blush:1.4), (gripping sheets:1.2)',

  // 性交：全面失控，表情扭曲
  penetration_missionary: '(ahegao light:1.4), (eyes glazed half-rolled:1.4), (mouth open crying out:1.5), (tears of pleasure:1.3), (desperate expression:1.3)',
  penetration_doggy:      '(face buried moaning:1.4), (eyes unfocused:1.4), (mouth open crying out:1.5), (completely lost:1.3), (back arched:1.2)',
  penetration_cowgirl:    '(riding with abandon:1.3), (head thrown back:1.4), (mouth open moaning loud:1.5), (eyes glazed:1.4), (breasts heaving:1.3)',
  penetration_spooning:   '(eyes half-closed glazed:1.4), (mouth open whimpering:1.4), (flushed all over:1.3), (clinging expression:1.3)',
  penetration_generic:    '(ahegao light:1.4), (eyes glazed:1.4), (mouth open moaning:1.5), (tears streaming:1.3), (desperate:1.3)',
  standing_sex:           '(pinned desperate expression:1.4), (mouth open crying out:1.5), (eyes glazed unfocused:1.4), (flushed neck and chest:1.3)',

  // 高潮：彻底崩溃
  ahegao:   '(ahegao:1.9), (eyes fully rolled back:1.8), (mouth wide open drooling:1.7), (tongue out:1.6), (tears streaming down:1.5), (deep crimson blush:1.5)',
  creampie: '(afterglow expression:1.4), (eyes half-lidded exhausted:1.4), (satisfied ahegao:1.5), (lips slack:1.3), (trembling:1.3)',
  cum_face: '(ahegao:1.7), (eyes crossed glazed:1.6), (tongue out catching cum:1.5), (mouth open wide:1.5), (deep red blush all over:1.4)',
};

// ── Positive 质量前缀 ─────────────────────────────────────────────────────────
const QUALITY_REAL = [
  '(photorealistic:1.4)', '(hyperrealistic:1.3)', 'RAW photo', '8k uhd', 'masterpiece',
  '(Asian beauty:1.4)', '(beautiful Asian face:1.5)', '(delicate Asian features:1.3)',
  '(porcelain fair skin:1.5)', '(flawless pale white skin:1.4)', '(luminous skin:1.3)',
  '(youthful:1.3)', '(slender petite figure:1.2)',
  '(perfect face:1.5)', '(beautiful face:1.5)', '(stunning beauty:1.4)',
  '(perfect symmetrical face:1.3)', '(flawless skin:1.3)',
  '(gorgeous:1.3)', '(detailed eyes:1.3)', '(perfect eyes:1.3)',
  '(supermodel:1.2)', '(editorial lighting:1.2)',
  '(alluring:1.3)', '(sensual:1.3)',
  'nsfw', 'explicit',
].join(', ');

const QUALITY_NOOB = [
  'masterpiece', 'best quality', 'amazing quality', 'very aesthetic', 'newest',
  'ultra detailed', 'highly detailed', '8k',
  '(beautiful face:1.4)', '(perfect eyes:1.4)', '(detailed eyes:1.3)',
  '(perfect body:1.3)', '(gorgeous:1.3)',
  'source_anime', 'nsfw', 'explicit',
].join(', ');

const QUALITY_PONY = [
  'score_9', 'score_8_up', 'score_7_up', 'score_6_up',
  'masterpiece', 'best quality', 'ultra detailed',
  'nsfw', 'explicit',
].join(', ');

// ── Negative（NSFW 版，去掉裸体限制，加强解剖质量）────────────────────────────
const NEGATIVE_NSFW_REAL = [
  '(worst quality:1.6)', '(low quality:1.6)', '(normal quality:1.4)',
  'bad anatomy', 'bad face', 'ugly face', 'asymmetrical face', 'deformed face',
  'extra limbs', 'deformed hands', 'extra fingers', 'missing fingers',
  'blurry', 'watermark', 'text', 'logo', 'signature',
  'censored bar', 'mosaic', 'pixelated',
  'cross-eye', 'lazy eye', 'bad eyes',
  '(dark skin:1.5)', '(tanned skin:1.5)', '(yellowish skin:1.4)',
  'fat', '(chubby face:1.5)', '(bloated face:1.5)', '(puffy face:1.5)', '(swollen face:1.4)', 'masculine', 'old', 'aged', 'wrinkles',
  '(bad vagina:1.5)', '(deformed genitals:1.5)', '(ugly genitals:1.5)', '(bad penis:1.5)', '(deformed penis:1.6)', '(unrealistic penis:1.5)', '(cartoon penis:1.5)', '(tentacle:1.6)',
  '(pen:1.8)', '(pencil:1.8)', '(marker:1.8)', '(lipstick:1.7)', '(chopstick:1.7)', '(object in mouth:1.5)', '(toy:1.4)', '(white tube:1.9)', '(white stick:1.9)', '(white object:1.9)', '(white tentacle:1.9)', '(abstract shape:1.6)',
  '(bad nipples:1.5)', '(deformed nipples:1.5)', '(wrong nipples:1.4)', '(dot nipples:1.5)', '(no nipples:1.4)',
  '(extra fingers:1.6)', '(missing fingers:1.5)', '(fused fingers:1.5)', '(melted hand:1.5)', '(deformed hand:1.5)',
  '(clothed pussy:1.5)', '(covered genitals:1.4)', '(underwear:1.3)',
].join(', ');

const NEGATIVE_NSFW_ANIME = [
  'score_1', 'score_2', 'score_3', 'score_4',
  'bad anatomy', 'bad hands', 'extra fingers', 'missing fingers',
  'deformed face', 'ugly face', 'bad face',
  'blurry', 'watermark', 'text', 'censored', 'mosaic',
  'bad quality', 'worst quality', 'lowres',
  'bad vagina', 'deformed genitals', 'bad penis',
].join(', ');

// ── ComfyUI 工作流（支持多 LoRA）──────────────────────────────────────────────
function buildWorkflow(
  prompt: string,
  seed: number,
  modelFile: string,
  loras: LoraSpec[],
): object {
  const isNoob = modelFile.includes('noob');
  const isPony = modelFile.includes('pony');
  const isAnime = isNoob || isPony;

  let prefix: string, neg: string, cfg: number, steps: number;
  if (isNoob) {
    prefix = QUALITY_NOOB; neg = NEGATIVE_NSFW_ANIME; cfg = 6.0; steps = 28;
  } else if (isPony) {
    prefix = QUALITY_PONY; neg = NEGATIVE_NSFW_ANIME; cfg = 6.0; steps = 25;
  } else {
    prefix = QUALITY_REAL; neg = NEGATIVE_NSFW_REAL; cfg = 6.5; steps = 30;
  }

  const fullPrompt = `${prefix}, ${prompt}`;

  // 从 checkpoint 开始，每个 LoRA 链式串联
  // 最终 model 和 clip 出口为最后一个 LoRA 节点（或 checkpoint 如无 LoRA）
  const nodes: Record<string, object> = {
    "4": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: modelFile },
    },
  };

  let modelRef: [string, number] = ["4", 0];
  let clipRef:  [string, number] = ["4", 1];

  loras.forEach((lora, i) => {
    const nodeId = `lora_${i}`;
    nodes[nodeId] = {
      class_type: "LoraLoader",
      inputs: {
        model: modelRef,
        clip: clipRef,
        lora_name: lora[0],
        strength_model: lora[1],
        strength_clip: lora[2],
      },
    };
    modelRef = [nodeId, 0];
    clipRef  = [nodeId, 1];
  });

  nodes["6"] = { class_type: "CLIPTextEncode", inputs: { text: fullPrompt, clip: clipRef } };
  nodes["7"] = { class_type: "CLIPTextEncode", inputs: { text: neg,        clip: clipRef } };
  nodes["5"] = { class_type: "EmptyLatentImage", inputs: { width: 768, height: 1024, batch_size: 1 } };
  nodes["3"] = {
    class_type: "KSampler",
    inputs: {
      model: modelRef,
      positive: ["6", 0],
      negative: ["7", 0],
      latent_image: ["5", 0],
      seed, steps, cfg,
      sampler_name: isAnime ? "dpmpp_2m" : "dpm_2_ancestral",
      scheduler: "karras",
      denoise: 1.0,
    },
  };
  nodes["8"] = { class_type: "VAEDecode",   inputs: { samples: ["3", 0], vae: ["4", 2] } };
  nodes["9"] = { class_type: "SaveImage",   inputs: { images: ["8", 0],  filename_prefix: "lib" } };

  return nodes;
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
  const args = process.argv.slice(2);
  const characterName = args.find(a => !a.startsWith('--')) ?? '椎名老师';
  const fromArg  = args.find(a => a.startsWith('--from='))?.replace('--from=', '');
  const forceRegen = args.includes('--force');

  // 读取场景配置
  const configPath = path.join(__dirname, '..', 'scene_configs', `${characterName}.json`);
  if (!fs.existsSync(configPath)) {
    console.error(`❌ 场景配置不存在: ${configPath}`);
    console.error('   请先运行: node_modules\\.bin\\tsx src\\generateSceneConfig.ts ' + characterName);
    process.exit(1);
  }
  const sceneConfig: SceneConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  // 读取角色数据（模型信息）
  const character = await prisma.character.findFirst({ where: { name: characterName } });
  if (!character) { console.error(`❌ 角色未找到: ${characterName}`); process.exit(1); }

  const modelKey  = (character.imageModel ?? 'leosam') as keyof typeof MODEL_FILES;
  const modelFile = MODEL_FILES[modelKey] ?? MODEL_FILES.leosam;
  const faceAnchor = (character.faceAnchor as string | null) ?? CHARACTER_FACE[characterName] ?? '';
  const charBase   = CHARACTER_BASE[characterName] ?? `1girl, ${character.age}yo, ${character.occupation}`;

  console.log(`\n🎨 图库生成 — 【${characterName}】`);
  console.log(`   模型: ${modelFile}`);
  console.log(`   输出: ${LIBRARY_DIR}/${characterName}/`);

  // 确定从哪个 shotKey 开始
  const shotKeys = SHOT_TYPES.map(t => t.key);
  const startIdx = fromArg ? shotKeys.indexOf(fromArg as ShotKey) : 0;
  if (fromArg && startIdx === -1) {
    console.error(`❌ 未知 shotKey: ${fromArg}`);
    process.exit(1);
  }

  let totalGenerated = 0;
  let totalSkipped   = 0;

  for (let si = startIdx; si < SHOT_TYPES.length; si++) {
    const shotType = SHOT_TYPES[si];
    const { key: shotKey, label, count } = shotType;

    const shotDir = path.join(LIBRARY_DIR, characterName, shotKey);
    fs.mkdirSync(shotDir, { recursive: true });

    const shotConfig = sceneConfig.shotConfigs[shotKey];
    if (!shotConfig?.scene) {
      console.log(`\n⏭️  [${shotKey}] 无场景配置，跳过`);
      continue;
    }

    console.log(`\n── [${si + 1}/${SHOT_TYPES.length}] ${shotKey} (${label}) ×${count}张 ──`);

    // 构建 prompt
    const shotPrefix     = SHOT_PREFIXES[shotKey];
    const expressionBoost = EXPRESSION_BOOST[shotKey] ?? EXPRESSION_BOOST.medium;
    const malePresence   = MALE_PRESENCE[shotKey] ?? '';
    const promptParts = [
      shotPrefix,
      charBase,
      faceAnchor,
      shotConfig.outfit,
      shotConfig.scene,
      malePresence,      // 男性肢体互动
      expressionBoost,   // 表情强化
      shotConfig.mood,
      ...(shotConfig.extra ? [shotConfig.extra] : []),
    ].filter(Boolean);
    const basePrompt = promptParts.join(', ');

    const loras = SHOT_LORAS[shotKey] ?? [];

    for (let i = 1; i <= count; i++) {
      const savePath = path.join(shotDir, `${String(i).padStart(3, '0')}.png`);

      // 跳过已有图片（支持断点续跑），--force 时覆盖
      if (fs.existsSync(savePath) && !forceRegen) {
        process.stdout.write(`  [${i}/${count}] 已存在，跳过\n`);
        totalSkipped++;
        continue;
      }

      process.stdout.write(`  [${i}/${count}] 生成中... `);
      try {
        const seed = Math.floor(Math.random() * 2 ** 32);
        const workflow = buildWorkflow(basePrompt, seed, modelFile, loras);
        const promptId = await queuePrompt(workflow);
        const filename = await waitForImage(promptId);
        await downloadImage(filename, savePath);
        console.log(`✅  ${path.basename(savePath)}`);
        totalGenerated++;
      } catch (err: any) {
        console.log(`❌  ${err.message}`);
      }

      // 短暂间隔避免 ComfyUI 积压
      if (i < count) await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`\n✨ 完成！新生成 ${totalGenerated} 张，跳过 ${totalSkipped} 张`);
  console.log(`📁 图片位置: ${path.join(LIBRARY_DIR, characterName)}`);
  console.log(`\n审查完成后运行: node_modules\\.bin\\tsx src\\uploadLibrary.ts ${characterName}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
