import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://localhost:7188';
const IMAGE_SAVE_DIR = process.env.IMAGE_SAVE_DIR || '/var/www/siyuwanban/images';
const IMAGE_PUBLIC_URL = process.env.FRONTEND_URL || 'https://www.shangzongcai.com';

// Build a RealVisXL NSFW workflow for ComfyUI API
function buildWorkflow(prompt: string, negativePrompt: string, seed: number): object {
  return {
    "4": {
      "class_type": "CheckpointLoaderSimple",
      "inputs": { "ckpt_name": "realvisxlV50_v50LightningBakedvae.safetensors" }
    },
    "10": {
      "class_type": "VAELoader",
      "inputs": { "vae_name": "sdxl_vae.safetensors" }
    },
    "6": {
      "class_type": "CLIPTextEncode",
      "inputs": { "text": prompt, "clip": ["4", 1] }
    },
    "7": {
      "class_type": "CLIPTextEncode",
      "inputs": { "text": negativePrompt, "clip": ["4", 1] }
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
        "steps": 20,
        "cfg": 5.0,
        "sampler_name": "euler_ancestral",
        "scheduler": "karras",
        "denoise": 1.0
      }
    },
    "8": {
      "class_type": "VAEDecode",
      "inputs": { "samples": ["3", 0], "vae": ["10", 0] }
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
  negative = ''
): Promise<string> {
  const seed = Math.floor(Math.random() * 2 ** 32);
  const fullPrompt = `(photorealistic:1.3), (hyperrealistic:1.2), RAW photo, 8k uhd, masterpiece, ${scenePrompt}`;
  const fullNegative = `ugly, deformed, bad anatomy, watermark, text, censored, cartoon, anime, ${negative}`;

  const workflow = buildWorkflow(fullPrompt, fullNegative, seed);
  const promptId = await queuePrompt(workflow);
  const filename = await waitForImage(promptId);
  const url = await downloadImage(filename);
  return url;
}

// Character appearance anchors — keeps the same person across all generated images
const CHARACTER_APPEARANCE: Record<string, string> = {
  '林晓雅': '28 years old chinese woman, lawyer, long black hair updo, sharp eyes, office suit',
  '狐九':   'fox girl, nine white fluffy tails, fox ears, silver white long hair, glowing amber eyes',
  '晓彤':   '22 years old chinese woman, athletic build, ponytail, gym wear',
  '椎名老师': '24 years old japanese woman, black framed glasses, teacher, white shirt, short skirt',
  '魅罗':   'demon girl, small black horns, purple glowing eyes, dark wings, pale skin',
  '零':     '25 years old woman, post-apocalyptic, leather straps, goggles, short hair, scars',
  '小雨':   '19 years old chinese girl, twin tails, school uniform, innocent face',
  '沈曼':   '34 years old mature chinese woman, businesswoman, blazer, red lipstick',
  '星澜':   'alien girl, double-ring pupils, bioluminescent skin, silver liquid hair',
  '冷霜':   '22 years old woman, white silver hair, light blue skin glow, white robes',
  '娜娜':   '18 years old japanese girl, half-dyed hair, ear piercings, shortened uniform skirt',
  'X-23':   'android girl, mechanical left arm, red glowing right eye, silver hair, tactical vest',
  '林阿姨': '38 years old mature chinese woman, voluptuous, floral dress, jade bracelet',
  '幻音':   'holographic AI girl, pink twin tails, semi-transparent glowing body',
  '琉璃':   '22 years old chinese woman, researcher, lab coat, glasses',
  '程双':   '31 years old mature chinese woman, elegant lawyer, suit, sophisticated',
  '夜叉':   'female ghost, 19 years old appearance, long black straight hair, pale translucent skin, neck scar',
  '糖糖':   '20 years old chinese girl, twin tails, art student, oversized sweater',
  '苏然':   '30 years old mature chinese woman, elegant housewife, silk robe',
  '沈静':   '25 years old tall chinese model, high cheekbones, off-shoulder dress',
  '小慧':   '23 years old chinese woman, nurse uniform, gentle smile',
  '夜玲':   '26 years old chinese woman, dark aesthetic, ink-stained fingers, dark lace dress',
  '程雨':   '29 years old chinese woman, tech director, blazer, glasses',
  '晴晴':   '21 years old chinese girl, gaming headset, oversized hoodie, streamer',
  '唐诗':   '27 years old chinese woman, personal secretary, white blouse, hair bun',
  '阿柒':   '22 years old chinese girl, barista apron, casual jeans, warm smile',
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
