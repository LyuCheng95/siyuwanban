import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://localhost:7188';
const IMAGE_SAVE_DIR = process.env.IMAGE_SAVE_DIR || '/var/www/siyuwanban/images';
const IMAGE_PUBLIC_URL = process.env.FRONTEND_URL || 'https://www.shangzongcai.com';

// ── 模型常量 ──────────────────────────────────────────────────────────────────
const MODEL_JUGGER = 'juggernautXL_juggXIByRundiffusion.safetensors';
const MODEL_LEOSAM = 'leosamsHelloworldXL_helloworldXL70.safetensors';
const MODEL_NOOB   = 'noobaiXLNAIXL_epsilonPred11Version.safetensors';

// ── 角色 → 模型映射（与 generateAlbum.ts 保持一致）─────────────────────────
const CHARACTER_MODEL: Record<string, string> = {
  // Juggernaut XI — 高端写实
  '沈静': MODEL_JUGGER, '晓彤': MODEL_JUGGER,
  // LEOSAM — 细腻白瘦幼
  '椎名老师': MODEL_LEOSAM, '娜娜': MODEL_LEOSAM, '小雨': MODEL_LEOSAM,
  '琉璃': MODEL_LEOSAM,     '小慧': MODEL_LEOSAM, '阿柒': MODEL_LEOSAM,
  '糖糖': MODEL_LEOSAM,     '晴晴': MODEL_LEOSAM, '夜玲': MODEL_LEOSAM,
  '唐诗': MODEL_LEOSAM,
  // NoobAI — 二次元 Illustrious
  'X-23': MODEL_NOOB, '幻音': MODEL_NOOB, '狐九': MODEL_NOOB,
  '冷霜': MODEL_NOOB, '魅罗': MODEL_NOOB,
};

// ── 质量前缀 ──────────────────────────────────────────────────────────────────
const QUALITY_REAL = '(photorealistic:1.4), (hyperrealistic:1.3), RAW photo, 8k uhd, masterpiece, (Asian beauty:1.4), (porcelain fair skin:1.5), (flawless pale white skin:1.4), (youthful:1.3), (perfect face:1.5), (explicit:1.4), (nsfw:1.4)';
const QUALITY_NOOB_SCENE = 'masterpiece, best quality, amazing quality, very aesthetic, newest, ultra detailed, source_anime, nsfw, explicit';

const NEGATIVE_REAL = '(worst quality:1.6), (low quality:1.6), bad anatomy, bad face, ugly face, deformed, blurry, watermark, text, censored, mosaic, (dark skin:1.5), (tanned skin:1.5), (yellowish skin:1.4)';
const NEGATIVE_NOOB_SCENE = 'worst quality, bad quality, lowres, bad anatomy, bad face, ugly face, deformed, blurry, watermark, text, censored, mosaic';

// ── 工作流构建 ────────────────────────────────────────────────────────────────
function buildWorkflow(prompt: string, negativePrompt: string, seed: number, modelName?: string): object {
  const model = modelName ?? MODEL_JUGGER;
  const isNoob = model === MODEL_NOOB;
  const qualityPrefix = isNoob ? QUALITY_NOOB_SCENE : QUALITY_REAL;
  const negPrefix = isNoob ? NEGATIVE_NOOB_SCENE : NEGATIVE_REAL;
  const cfg   = isNoob ? 6.0 : 6.5;
  const steps = isNoob ? 28  : 30;

  const fullPrompt = `${qualityPrefix}, ${prompt}`;
  const fullNeg    = `${negPrefix}, ${negativePrompt}`;

  return {
    "4": {
      "class_type": "CheckpointLoaderSimple",
      "inputs": { "ckpt_name": model }
    },
    "6": {
      "class_type": "CLIPTextEncode",
      "inputs": { "text": fullPrompt, "clip": ["4", 1] }
    },
    "7": {
      "class_type": "CLIPTextEncode",
      "inputs": { "text": fullNeg, "clip": ["4", 1] }
    },
    "5": {
      "class_type": "EmptyLatentImage",
      "inputs": { "width": 768, "height": 1024, "batch_size": 1 }
    },
    "3": {
      "class_type": "KSampler",
      "inputs": {
        "model": ["4", 0],
        "positive": ["6", 0],
        "negative": ["7", 0],
        "latent_image": ["5", 0],
        "seed": seed,
        "steps": steps,
        "cfg": cfg,
        "sampler_name": "dpm_2_ancestral",
        "scheduler": "karras",
        "denoise": 1.0
      }
    },
    "8": {
      "class_type": "VAEDecode",
      "inputs": { "samples": ["3", 0], "vae": ["4", 2] }
    },
    "9": {
      "class_type": "SaveImage",
      "inputs": { "images": ["8", 0], "filename_prefix": "chat" }
    }
  };
}

// Queue a prompt and return prompt_id
async function queuePrompt(workflow: object): Promise<string> {
  const res = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  });
  if (!res.ok) throw new Error(`ComfyUI queue failed: ${res.status}`);
  const data = await res.json() as { prompt_id: string };
  return data.prompt_id;
}

// Poll until image is ready (max 120s)
async function waitForImage(promptId: string): Promise<string> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`${COMFYUI_URL}/history/${promptId}`);
    if (!res.ok) continue;
    const history = await res.json() as Record<string, any>;
    const entry = history[promptId];
    if (!entry?.outputs) continue;
    for (const nodeOut of Object.values(entry.outputs) as any[]) {
      if (nodeOut?.images?.length) {
        return nodeOut.images[0].filename;
      }
    }
  }
  throw new Error('ComfyUI timeout');
}

// Download image from ComfyUI and save to public directory
async function downloadImage(filename: string): Promise<string> {
  const res = await fetch(`${COMFYUI_URL}/view?filename=${filename}&type=output`);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const buffer = await res.buffer();

  const saveName = `${Date.now()}_${filename}`;
  const savePath = path.join(IMAGE_SAVE_DIR, saveName);
  fs.mkdirSync(IMAGE_SAVE_DIR, { recursive: true });
  fs.writeFileSync(savePath, buffer);

  return `${IMAGE_PUBLIC_URL}/images/${saveName}`;
}

// Main entry: generate image from scene description
export async function generateSceneImage(
  scenePrompt: string,
  negative = '',
  characterName = ''
): Promise<string> {
  const seed = Math.floor(Math.random() * 2 ** 32);
  const model = CHARACTER_MODEL[characterName] ?? MODEL_JUGGER;
  const workflow = buildWorkflow(scenePrompt, negative, seed, model);
  const promptId = await queuePrompt(workflow);
  const filename = await waitForImage(promptId);
  const url = await downloadImage(filename);
  return url;
}

// Character appearance anchors — keeps the same person across all generated images
const CHARACTER_APPEARANCE: Record<string, string> = {
  '椎名老师': '24 years old japanese woman, black framed glasses, teacher, white shirt, short skirt',
  '晓彤':   '22 years old chinese woman, athletic build, ponytail, gym wear',
  '娜娜':   '18 years old chinese girl, half-dyed hair, ear piercings, shortened uniform skirt',
  '小雨':   '19 years old chinese girl, wavy chestnut hair, innocent face, college student',
  '琉璃':   '22 years old chinese woman, researcher, lab coat, glasses',
  '沈静':   '25 years old tall chinese model, high cheekbones, bone-straight black hair',
  '小慧':   '23 years old chinese woman, nurse uniform, gentle smile',
  '夜玲':   '26 years old chinese woman, dark aesthetic, ink-stained fingers, dark lace dress',
  '晴晴':   '21 years old chinese girl, gaming headset, pastel dyed hair, streamer',
  '唐诗':   '27 years old chinese woman, personal secretary, white blouse, hair bun',
  '阿柒':   '22 years old chinese girl, barista apron, wavy brown hair, warm smile',
  '糖糖':   '20 years old chinese girl, art student, paint-stained overalls, dimples',
  'X-23':   'android girl, platinum white hair neon streaks, glowing blue circuit eyes, tactical bodysuit',
  '幻音':   'holographic AI girl, prismatic shifting long hair, glowing ethereal eyes, translucent outfit',
  '狐九':   'fox girl, fox ears nine white fluffy tails, silver white flowing hair, glowing amber eyes',
  '冷霜':   'ice cultivator, silver blue long hair, cold glowing eyes, pale luminous skin, white robes',
  '魅罗':   'demon girl, dark purple flowing hair, crimson slit eyes, small horns, beautiful evil face',
};

// Use Grok to decide if scene warrants an image and build the image prompt
export async function shouldGenerateImage(
  characterName: string,
  recentMessages: Array<{ role: string; content: string }>,
  character?: { occupation: string; personality: string }
): Promise<{ generate: boolean; prompt?: string }> {
  const appearance = CHARACTER_APPEARANCE[characterName] || `1girl, ${characterName}`;

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'grok-3',
      messages: [
        {
          role: 'system',
          content: `你是一个成人向图片生成决策器。根据聊天内容判断是否适合生成一张场景图片。
角色固定外貌描述（必须包含在prompt中保持人物一致性）：${appearance}

规则：
- 如果对话中出现了明显的性暗示场景、肢体接触、或视觉性内容，返回 generate: true
- 普通问候或无视觉性内容返回 generate: false
- 如果要生成，给出英文 prompt，必须包含：固定外貌 + 当前场景动作 + 露骨身体部位描写(bare breasts, nipples, pussy等)
- 保持人物外貌与固定描述完全一致
只返回JSON，格式：{"generate": true/false, "prompt": "...英文prompt..."}`,
        },
        ...recentMessages.slice(-4),
      ],
      max_tokens: 250,
      temperature: 0.3,
    }),
  });

  try {
    const data = await res.json() as any;
    const content = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content.trim());
    return parsed;
  } catch {
    return { generate: false };
  }
}
