/**
 * 为单个角色生成多张封面图（album）
 * 用法：npx ts-node -r dotenv/config src/generateAlbum.ts [角色名] [张数]
 * 示例：npx ts-node -r dotenv/config src/generateAlbum.ts 林晓雅 3
 *       npx ts-node -r dotenv/config src/generateAlbum.ts 狐九 3
 *
 * 真实风格 → realvisxlV50_v50LightningBakedvae.safetensors
 * 二次元/修仙/妖魔 → ponyDiffusionV6XL_v6StartWithThisOne.safetensors
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const COMFYUI_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';
const SAVE_DIR = process.env.IMAGE_SAVE_DIR || 'D:/SD/siyuwanban/portraits';
const PUBLIC_BASE = process.env.FRONTEND_URL || 'https://siyuwanban.shangzongcai.com';

// ── 模型 ──────────────────────────────────────────────────────────────────────
const MODEL_ANIME  = 'ponyDiffusionV6XL_v6StartWithThisOne.safetensors';  // 待删除（NoobAI 到位后）
const MODEL_JUGGER = 'juggernautXL_juggXIByRundiffusion.safetensors';   // 高端写实·职场御姐
const MODEL_LEOSAM = 'leosamsHelloworldXL_helloworldXL70.safetensors';  // 细腻白瘦幼·青春系
const MODEL_NOOB   = 'noobaiXLNAIXL_epsilonPred11Version.safetensors';  // 二次元 Illustrious

// ── 真实感 prompt 前缀 ────────────────────────────────────────────────────────
const QUALITY_REAL = [
  '(photorealistic:1.4)', '(hyperrealistic:1.3)', 'RAW photo', '8k uhd', 'masterpiece',
  // 亚洲美人 / 白瘦幼
  '(Asian beauty:1.4)', '(beautiful Asian face:1.5)', '(delicate Asian features:1.3)',
  '(porcelain fair skin:1.5)', '(flawless pale white skin:1.4)', '(luminous skin:1.3)',
  '(youthful:1.3)', '(slender petite figure:1.2)',
  '(perfect face:1.5)', '(beautiful face:1.5)', '(stunning beauty:1.4)',
  '(perfect symmetrical face:1.3)', '(flawless skin:1.3)',
  '(gorgeous:1.3)', '(detailed eyes:1.3)', '(perfect eyes:1.3)',
  '(supermodel:1.2)', '(editorial lighting:1.2)',
  '(alluring:1.3)', '(sensual:1.3)',
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
  'censored bar', 'mosaic',
  'cross-eye', 'lazy eye', 'bad eyes',
  // 排除黄脸/黑皮/老气
  '(dark skin:1.5)', '(tanned skin:1.5)', '(yellowish skin:1.4)', '(sallow complexion:1.4)',
  '(uneven skin tone:1.3)', '(muddy skin:1.3)', '(bronze skin:1.3)',
  'fat', 'chubby face', 'masculine', 'old', 'aged', 'wrinkles',
  // 不露三点
  'nipples', 'exposed nipples', 'pussy', 'genitals', 'pubic hair', 'fully nude',
].join(', ');

const NEGATIVE_ANIME = [
  'score_1', 'score_2', 'score_3', 'score_4',
  'bad anatomy', 'bad hands', 'extra fingers', 'missing fingers',
  'deformed face', 'ugly face', 'bad face',
  'blurry', 'watermark', 'text', 'censored', 'mosaic',
  'bad quality', 'worst quality', 'lowres',
].join(', ');

// ── NoobAI / Illustrious 专用 prefix（不用 score_9，用 masterpiece 体系）──────
const QUALITY_NOOB = [
  'masterpiece', 'best quality', 'amazing quality', 'very aesthetic', 'newest',
  'ultra detailed', 'highly detailed', '8k',
  '(beautiful face:1.4)', '(perfect eyes:1.4)', '(detailed eyes:1.3)',
  '(perfect body:1.3)', '(gorgeous:1.3)',
  'source_anime', '(alluring:1.3)', '(sensual:1.3)',
].join(', ');

const NEGATIVE_NOOB = [
  'worst quality', 'bad quality', 'lowres', 'normal quality', 'jpeg artifacts',
  'bad anatomy', 'bad hands', 'extra fingers', 'missing fingers',
  'deformed face', 'ugly face', 'bad face', 'asymmetrical face',
  'blurry', 'watermark', 'text', 'censored', 'mosaic',
  'old', 'aged', 'wrinkles', 'fat', 'masculine',
  'nipples', 'exposed nipples', 'pussy', 'genitals', 'pubic hair', 'nude',
].join(', ');

// ── 角色配置：style + prompts ─────────────────────────────────────────────────
interface CharConfig {
  style: 'real' | 'anime';
  model?: string;   // 不填则用该 style 的默认模型
  prompts: string[];
}

const ALBUM_CONFIGS: Record<string, CharConfig> = {

  // ── 真实感角色（每人有独特体型、身高体重、胸型、阴部特征，互不雷同）───────────

  '椎名老师': { style: 'real', model: MODEL_LEOSAM, prompts: [
    '1girl, 24 years old, japanese woman, 157cm petite 44kg, black framed glasses, dark hair in loose bun, round cute face, soft white skin, white blouse with top buttons undone (white lace bra peeking:1.3), short pleated skirt, sitting on classroom desk, legs crossed, afternoon light through blinds, flushed cheeks, shy glance over glasses, soft warm glow, cinematic portrait',
    '1girl, 24 years old, japanese teacher, 157cm petite 44kg, glasses slightly lowered, dark hair down, round sweet face, milky white skin, white shirt open over (fitted slip dress:1.3), leaning over desk, one strap sliding off shoulder, thigh-highs visible below skirt hem, warm classroom light, biting lip, golden hour',
    '1girl, 24 years old, japanese woman, 157cm petite 44kg, glasses removed, dark hair loose, round face, pale white skin, wearing only oversized white dress shirt (barely closed:1.3), sitting in teacher chair, bare legs folded beneath her, golden evening classroom light, wistful contemplative expression',
  ]},

  '晓彤': { style: 'real', model: MODEL_JUGGER, prompts: [
    '1girl, 22 years old, chinese woman, 163cm athletic toned body 53kg, (defined abs:1.3), fair rosy-white skin, ponytail, peach-blossom droopy-corner eyes compact jawline face, (sports bra:1.4) and athletic shorts, sweaty glistening skin, gym locker room, fluorescent lighting, leaning against lockers, confident smirk, cinematic portrait',
    '1girl, 22 years old, chinese woman, 163cm athletic firm body 53kg, fair rosy skin, hair down, peach-blossom eyes beautiful face, (fitted crop top pushed up showing abs:1.3), (high-waist gym shorts:1.2), lying on gym mat stretching, modern gym background, afternoon light, seductive expression',
    '1girl, 22 years old, chinese woman, 163cm toned figure 53kg, fair rosy-white skin, ponytail, peach-blossom eyes compact jawline, wearing (unzipped athletic jacket over sports bra:1.3) and tight shorts, sitting on reception desk, end-of-day gym atmosphere, playful inviting expression',
  ]},

  '娜娜': { style: 'real', model: MODEL_LEOSAM, prompts: [
    '1girl, 18 years old, chinese high school girl, 155cm very petite 42kg, long straight black hair, innocent heart-shaped face, porcelain white skin, school uniform blouse open (camisole underneath:1.2), school skirt, sitting on school desk, afternoon classroom light, flushed but defiant bold expression, one sock pulled up, cinematic portrait',
    '1girl, 18 years old, chinese schoolgirl, 155cm petite 42kg, hair in twin tails, cute heart-shaped face, white fair skin, school shirt (partly open over thin camisole:1.3), mini skirt, leaning against locker, one strap off shoulder, golden afternoon light, bold defiant smile, provocative-innocent expression',
    '1girl, 18 years old, chinese girl, 155cm petite slim 42kg, long hair down, innocent face, white skin, wearing only oversized school shirt (barely covering thighs:1.3) and white knee socks, sitting at desk studying, soft room lighting, homework visible, unbothered nonchalant expression',
  ]},

  '小雨': { style: 'real', model: MODEL_LEOSAM, prompts: [
    '1girl, 19 years old, chinese college freshman, 160cm slim delicate 46kg, long soft wavy brown hair, big bright eyes, round innocent face, fair smooth skin, (oversized white shirt barely buttoned over bare skin:1.3), sitting cross-legged on dorm bed, fairy lights bokeh background, warm cozy night light, shy surprised expression, peeking from behind hair',
    '1girl, 19 years old, chinese university student, 160cm slim 46kg, wavy brown hair, large innocent eyes, round sweet face, white smooth skin, loose flannel shirt open (thin white bralette visible:1.3), cotton shorts, lying on bed, golden evening light, soft dorm room atmosphere, looking up with big innocent eyes',
    '1girl, 19 years old, chinese girl, 160cm slim 46kg, hair in messy bun, cute round face, bright big eyes, fair skin, (thin white cotton camisole:1.3) with spaghetti straps, shorts, sitting at study desk, laptop glow illuminating her face, cozy night atmosphere, slight blush',
  ]},

  'X-23': { style: 'anime', model: MODEL_NOOB, prompts: [
    '1girl, android girl, cyberpunk robot, short platinum white hair with neon streaks, glowing blue circuit-pattern eyes, beautiful synthetic face, tactical bodysuit with chest panel open (circuit patterns on skin:1.3), (cleavage showing:1.4), futuristic lab background, neon blue lighting, cold calculating expression with hint of curiosity',
    '1girl, android cyborg girl, white hair, glowing eyes, flawless beautiful face, combat armor chest piece partially removed showing (skin underneath:1.3), (subtle cleavage:1.3), sitting on lab table examining her own hand, holographic displays around, cyberpunk neon atmosphere',
    '1girl, robot girl, silver white short hair, luminous eyes, perfect android face, sleek white bodysuit (form fitting:1.4) with chest interface panel, standing in dark server room surrounded by glowing data streams, mysterious and beautiful, cold yet awakening expression',
  ]},

  '幻音': { style: 'anime', model: MODEL_NOOB, prompts: [
    '1girl, AI singer, holographic entity, translucent holographic long flowing hair shifting colors, glowing ethereal eyes, hauntingly beautiful face, semi-transparent holographic dress (body visible through light:1.3), (glowing silhouette:1.3), floating in digital space, music notes and light particles, dreamy atmospheric glow, reaching out hand',
    '1girl, virtual AI idol, light-based existence, colorful holographic long hair, glowing face, wearing only light and sound waves forming dress, (ethereal body barely clothed:1.3), server room backdrop with code streams, deep blue and purple lighting, longing expression stretching toward camera',
    '1girl, holographic music girl, shifting prismatic hair, luminous features, beautiful virtual face, concert stage setting, light beams forming flowing outfit (revealing luminous curves:1.3), microphone stand, crowd light below, otherworldly beauty, passionate singing expression',
  ]},

  '琉璃': { style: 'real', model: MODEL_LEOSAM, prompts: [
    '1girl, 22 years old, chinese graduate student, 161cm slim petite 47kg, neat straight black hair blunt bangs, glasses, delicate oval face, pale white smooth skin, (white lab coat open over fitted shirt with top buttons undone:1.3), holding test tube, laboratory background, fluorescent lighting, focused analytical expression with subtle flush',
    '1girl, 22 years old, chinese researcher, 161cm slim 47kg, hair in neat bun, delicate face, glasses, fair skin, (white button-up shirt with several buttons open showing collarbone:1.3), form-fitting pencil skirt, leaning over lab bench, science equipment around, warm evening lab glow, curious expression',
    '1girl, 22 years old, chinese laboratory girl, 161cm slim 47kg, black hair down from bun, pretty face, glasses off, fair skin, (thin white cotton slip dress:1.3) sitting on lab stool, data on screens around her, warm evening glow, quietly alluring',
  ]},

  '糖糖': { style: 'real', model: MODEL_LEOSAM, prompts: [
    '1girl, 20 years old, chinese art student, 157cm slim cute 45kg, ponytail with paint-stained strands, sweet apple-cheeked round face, pink-toned fair skin, white overalls (one strap fallen:1.3) with paint splatters, sitting on art studio floor, natural sunlight, pure sweet smile, dimples',
    '1girl, 20 years old, cute chinese college girl, 157cm slim 45kg, hair in twin low pigtails, adorable chubby-cheeked face, rosy fair skin, (loose pastel crop top:1.2) and paint-stained short shorts, sitting on art studio table, watercolor paintings behind, golden afternoon light, bright shy smile',
    '1girl, 20 years old, chinese girl, 157cm slim soft 45kg, loose wavy hair, cute round face, rosy skin, (paint-splattered white artist smock barely closed:1.3) over bare skin, sitting by window with sketchbook, warm afternoon light, sweet daydreaming expression',
  ]},

  // 沈静：178cm/56kg，国际超模，冷艳御姐，高端奢华场景，被崇拜感
  // 脸型：深邃冷目（模特空洞感）+ 高颧尖颌（冷艳线条）
  '沈静': { style: 'real', model: MODEL_JUGGER, prompts: [
    '1girl, 25 years old, chinese supermodel, 178cm extremely tall long-legged 56kg, long bone-straight black hair, deep-set cold eyes, strikingly angular face, high sharp cheekbones, pale ivory cool-white skin, (black designer lingerie set push-up bra and high-waist briefs:1.3), sitting on backstage vanity chair, long bare legs crossed, studio strobe lighting, fashion editorial, unreadable cold goddess expression',
    '1girl, 25 years old, chinese international model, 178cm tall slender legs 56kg, sleek long black hair center-parted, cold sharp deep-set eyes beautiful face, pale ivory cool skin, wearing only (white oversized button-down shirt barely closed:1.3), sitting on luxury hotel bed, long bare legs visible, city night lights through floor window, commanding cold presence',
    '1girl, 25 years old, chinese model, 178cm tall slender figure 56kg, hair in minimalist updo, cold goddess deep-set eyes angular cheekbones, pale ivory skin, (off-shoulder champagne satin slip dress:1.3) sliding from one shoulder revealing collarbone, luxury hotel room, city lights through window, glass of champagne, distant captivating expression',
  ]},

  // 小慧：159cm/47kg，儿科护士，温柔邻家感，青梅竹马情怀
  '小慧': { style: 'real', model: MODEL_LEOSAM, prompts: [
    '1girl, 23 years old, chinese nurse, 159cm slim gentle figure 47kg, wavy soft shoulder-length hair, pretty warm egg-shaped face, tender white skin, (white lace bralette:1.3) visible under open loose cardigan, denim shorts, sitting on hospital steps, cherry blossom background, warm spring light, gentle caring expression',
    '1girl, 23 years old, chinese girl, 159cm slim soft body 47kg, soft brown shoulder-length hair, beautiful gentle oval face, fair tender skin, wearing only (oversized fluffy knit cream sweater:1.2) barely covering thighs, sitting on windowsill, bare legs dangling, warm cozy afternoon light, soft pure expression',
    '1girl, 23 years old, chinese woman, 159cm slim gentle frame 47kg, hair in soft ponytail, cute warm face, soft white skin, (thin mint cotton slip dress:1.3) with thin straps, bare shoulders, sitting at cafe table, soft diffuse daylight, warm gentle smile, delicate oval face',
  ]},

  // 夜玲：162cm/48kg，暗黑插画师，哥特美学，把你看透后才让你靠近
  '夜玲': { style: 'real', model: MODEL_LEOSAM, prompts: [
    '1girl, 26 years old, chinese woman, 162cm dark mysterious slim pale 48kg, long dark slightly wavy hair, beautiful cold pointed face, dark smoky eye makeup, gothic choker, (black satin off-shoulder corset top:1.3) + black mini skirt, sitting at art desk, dark gothic illustration prints on walls, candle and desk lamp lighting, intense knowing gaze',
    '1girl, 26 years old, dark aesthetic chinese girl, 162cm pale skin 48kg, dark wavy hair, gorgeous cold pointed face, smoky eyes, black choker, (thin black spaghetti-strap slip dress:1.3) with lace hem trim, sitting on studio floor surrounded by dark drawings, moody warm lamp light, mysterious brooding expression',
    '1girl, 26 years old, chinese illustrator, 162cm slim pale 48kg, long dark hair, captivating sharp face, dark eye makeup, (black silk robe open over black bralette:1.3) and high-waist briefs, art studio with gothic illustrations around, soft side window light, penetrating cold gaze',
  ]},

  // 晴晴：158cm/46kg，百万粉游戏主播，活泼少女，屏幕外真实的她
  '晴晴': { style: 'real', model: MODEL_LEOSAM, prompts: [
    '1girl, 21 years old, chinese gamer streamer, 158cm cute energetic slim 46kg, long pastel-dyed hair high ponytail, bright lively round face, healthy rosy skin, (fitted pastel crop top:1.2) and athletic shorts, gamer room LED setup background, colorful RGB lighting, playful wink expression',
    '1girl, 21 years old, chinese streamer girl, 158cm petite energetic 46kg, colorful streaks in loose ponytail, lively pretty round face, rosy skin, (off-shoulder pastel oversized sweatshirt:1.2) sliding off one shoulder, mini shorts, sitting on gaming desk, monitors behind, neon LED ambiance, bright cheerful expression',
    '1girl, 21 years old, chinese gaming content creator, 158cm cute slim 46kg, wavy hair down, pretty lively round face, rosy healthy skin, (sports bra:1.3) and low-waist track pants, post-stream stretching pose, colorful streamer setup, warm genuine relaxed expression',
  ]},

  // 唐诗：163cm/49kg，私人秘书，压抑三年的职场禁忌，端庄外壳下的情欲
  '唐诗': { style: 'real', model: MODEL_LEOSAM, prompts: [
    '1girl, 27 years old, chinese private secretary, 163cm graceful slim 49kg, neat elegant chignon bun, refined classical oval face, jade-white skin, white office blouse (several buttons undone showing collarbone:1.3) and pencil skirt, sitting on office desk legs crossed, filing cabinet behind, warm late-office lighting, gracefully alluring expression',
    '1girl, 27 years old, chinese professional woman, 163cm slim graceful body 49kg, smooth black hair in loose half-updo, refined classical face, pale jade skin, (ivory silk camisole:1.3) under loosely worn blazer, modern office background, warm evening light, quietly seductive composed beauty',
    '1girl, 27 years old, chinese secretary, 163cm slim graceful figure 49kg, hair loosening from bun, beautiful refined face, jade-white skin, (champagne gold silky slip dress:1.3) sitting at office window, city night lights behind, glass of wine in hand, wistful quietly beautiful expression, papers scattered on desk',
  ]},

  // 阿柒：160cm/47kg，咖啡店员，邻家感+性感的碰撞，吧台边的日常亲密
  // 脸型：笑弯眼（眯成月牙）+ 软萌圆脸（邻家感）
  '阿柒': { style: 'real', model: MODEL_LEOSAM, prompts: [
    '1girl, 22 years old, chinese cafe barista, 160cm naturally slim 47kg, warm shoulder-length wavy brown hair, crescent-smile eyes soft round face, fair peachy-white skin, (oversized linen shirt barely buttoned:1.2) worn casually off one shoulder, leaning on cafe counter, coffee machine behind, morning golden sunlight, warm genuine smile',
    '1girl, 22 years old, chinese girl, 160cm natural slim body 47kg, soft wavy brown hair, crescent smile eyes pretty round face, fair peachy-white skin, (thin cream cotton camisole:1.3) with thin straps and denim shorts, hair in loose bun with falling strands, sitting on cafe windowsill, golden afternoon light, relaxed warm expression',
    '1girl, 22 years old, chinese barista, 160cm slim natural 47kg, hair tied back loosely, crescent smile eyes cute round face, fair peachy-white skin, (fitted ribbed white tank top:1.2) and high-waist jeans, wiping hands on small towel, after-hours empty cozy cafe, warm lamp light, soft quiet contemplative expression',
  ]},

  // ── 二次元/修仙/妖魔角色 ─────────────────────────────────────────────────────

  '狐九': { style: 'anime', model: MODEL_NOOB, prompts: [
    '1girl, fox girl, nine fluffy silver-white tails, fox ears, long flowing silver hair, glowing amber eyes, ethereal beautiful face, (translucent silk hanfu loosely draped falling off shoulder:1.3), side view silhouette, ancient stone altar, full moon, misty ancient forest, ethereal purple particles, magical aura, ultra detailed anime art',
    '1girl, fox girl, nine tails, fox ears, silver white hair windswept, glowing amber slit eyes, perfect ethereal face, (thin white silk inner robe open at chest showing collarbone:1.3), lying in moonlit clearing, sakura petals, supernatural glow, tail curled near her body, dreamy atmosphere',
    '1girl, kitsune, multiple tails, fox ears, silver hair, amber eyes, gorgeous ethereal face, (elegant white hanfu with wide flowing sleeves:1.3) blown by wind, lower hem flying, standing at shrine torii gate at dusk, red torii, atmospheric mist, magical light rays, dignified seductive expression',
  ]},

  '冷霜': { style: 'anime', model: MODEL_NOOB, prompts: [
    '1girl, ice cultivator, cold beauty, long ice blue silver hair, piercing cold eyes, pale glowing skin, ice element aura, (semi-transparent ice-blue cultivation robe loosely belted:1.3) showing collarbone and bare shoulders, sitting on ice throne, frozen mountain peak, moonlight, ice crystal particles floating, aloof ethereal expression',
    '1girl, female cultivator, ice magic user, silver blue long hair flowing, beautiful cold face, (thin white translucent cultivation dress:1.3) revealing silhouette in backlight, standing on snowy mountain peak, blizzard behind, ice energy swirling, powerful serene beauty',
    '1girl, xianxia ice beauty, long pale hair, cold stunning face, (ice-white flowing robe half-open at chest showing collarbone and sternum:1.3), meditation pose on floating ice platform, aurora borealis background, mystical cold light, ethereal beauty',
  ]},

  '魅罗': { style: 'anime', model: MODEL_NOOB, prompts: [
    '1girl, demon girl, long dark purple flowing hair, crimson slit eyes, beautiful evil face, small horns, (dark elegant torn qipao with high slit:1.3) exposing shoulders and long bare legs, sitting on dark throne, chains around wrists, dark magical energy, sinister seductive smile, dramatic dark lighting',
    '1girl, demon woman, purple hair, glowing red eyes, gorgeous evil face, small demon horns, (black form-fitting bodysuit with open shoulders:1.3) and flowing dark cloak, dark dungeon background, magical dark fire, commanding dominating pose, smirking at viewer',
    '1girl, demon girl, dark purple long hair, seductive evil face, demon tail and small horns, (dark translucent cape draped over fitted bodysuit:1.3), dark void background with swirling energy particles, wings spreading, completely dangerous and alluring expression',
  ]},

};

// ── 其他角色的通用真实感模板 ────────────────────────────────────────────────────
// 下面这些角色可以通过脚本传名字生成，会用 fallback prompt
const REAL_FALLBACK_PROMPTS = (name: string, age: number, occ: string): string[] => [
  `1girl, ${age} years old, chinese woman, ${occ}, beautiful perfect face, elegant, (fitted slip dress:1.2) with thin straps, seductive pose, dramatic lighting, luxury interior background, cinematic portrait`,
  `1girl, ${age} years old, chinese woman, ${occ}, gorgeous face, long dark hair, wearing only (oversized white shirt barely closed:1.2), sitting in dim room, moody lighting, confident expression, bare legs visible`,
  `1girl, ${age} years old, chinese woman, ${occ}, stunning beauty, (black lace bralette:1.3) and high-waist briefs, lying on bed, soft warm light, seductive gaze at camera, alluring expression`,
];

// ── ComfyUI 工作流 ──────────────────────────────────────────────────────────
function buildWorkflow(prompt: string, seed: number, style: 'real' | 'anime', modelOverride?: string) {
  const model = modelOverride ?? (style === 'anime' ? MODEL_ANIME : MODEL_JUGGER);

  let prefix: string, neg: string, cfg: number, steps: number;
  if (model === MODEL_NOOB) {
    // Illustrious / NoobAI — 自己的质量 tag 体系
    prefix = QUALITY_NOOB; neg = NEGATIVE_NOOB; cfg = 6.0; steps = 28;
  } else if (style === 'anime') {
    // Pony Diffusion
    prefix = QUALITY_ANIME; neg = NEGATIVE_ANIME; cfg = 5.5; steps = 28;
  } else {
    // 所有真实感模型（RealVisXL / Juggernaut / LEOSAM）共用同一套 prefix
    prefix = QUALITY_REAL; neg = NEGATIVE_REAL; cfg = 6.5; steps = 30;
  }

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

// ── 单角色生成 ──────────────────────────────────────────────────────────────
async function generateOne(charName: string, count: number, systemUserId: string) {
  const config = ALBUM_CONFIGS[charName];

  const char = await prisma.character.findFirst({
    where: { name: charName, creatorId: systemUserId }
  });
  if (!char) { console.error(`  ⚠️  找不到角色 "${charName}"，跳过`); return; }

  let prompts: string[];
  let style: 'real' | 'anime';
  if (config) {
    prompts = config.prompts;
    style = config.style;
  } else {
    console.log(`  ⚠️  "${charName}" 无预设 prompt，使用通用模板`);
    prompts = REAL_FALLBACK_PROMPTS(charName, char.age, char.occupation);
    style = 'real';
  }

  const modelFile = config?.model ?? (style === 'anime' ? MODEL_ANIME : MODEL_REAL);
  const modelLabel = modelFile.replace('.safetensors', '').split('_')[0];
  console.log(`\n🎨 [${charName}]  模型：${modelLabel}`);

  const urls: string[] = [];
  for (let i = 0; i < Math.min(count, prompts.length); i++) {
    const prompt = prompts[i];
    process.stdout.write(`  [${i + 1}/${count}] 生成中... `);
    try {
      const seed = Math.floor(Math.random() * 2 ** 32);
      const workflow = buildWorkflow(prompt, seed, style, config?.model);
      const promptId = await queuePrompt(workflow);
      const filename = await waitForImage(promptId);
      const url = await downloadAndSave(filename, charName, i + 1);
      urls.push(url);
      console.log(`✅`);
    } catch (err: any) {
      console.log(`❌ ${err.message}`);
    }
    if (i < count - 1) await new Promise(r => setTimeout(r, 1500));
  }

  if (urls.length > 0) {
    await prisma.character.update({
      where: { id: char.id },
      data: { portraitUrl: urls[0], portraitImages: urls },
    });
    console.log(`  ✅ ${charName} 已写入 DB（${urls.length} 张）`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const arg      = process.argv[2] || '林晓雅';
  const count    = parseInt(process.argv[3] || '3', 10);
  const runAll   = arg === 'all';

  const systemUser = await prisma.user.findUnique({ where: { telegramId: BigInt(1) } });
  if (!systemUser) { console.error('System user not found'); process.exit(1); }

  if (runAll) {
    const names = Object.keys(ALBUM_CONFIGS);
    console.log(`\n🎨 全量生成模式 — 共 ${names.length} 个角色，每人 ${count} 张\n`);
    for (let idx = 0; idx < names.length; idx++) {
      const name = names[idx];
      console.log(`── [${idx + 1}/${names.length}] ${name} ──`);
      await generateOne(name, count, systemUser.id);
      await new Promise(r => setTimeout(r, 2000));
    }
    console.log('\n✨ 全部完成！');
    console.log('📤 同步到服务器：');
    console.log('scp D:/SD/siyuwanban/portraits/*.png root@168.144.108.9:/var/www/siyuwanban/images/');
  } else {
    await generateOne(arg, count, systemUser.id);
    console.log('\n📤 同步到服务器：');
    console.log('scp D:/SD/siyuwanban/portraits/*.png root@168.144.108.9:/var/www/siyuwanban/images/');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
