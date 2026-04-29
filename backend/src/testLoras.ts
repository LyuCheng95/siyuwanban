import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const COMFYUI_URL = 'http://localhost:8188';
const OUTPUT_DIR  = 'D:/SD/siyuwanban/lora_test';
const MODEL_LEOSAM = 'leosamsHelloworldXL_helloworldXL70.safetensors';
const MODEL_NOOB   = 'noobaiXLNAIXL_epsilonPred11Version.safetensors';

const QUALITY_REAL = '(photorealistic:1.4), (hyperrealistic:1.3), RAW photo, 8k uhd, masterpiece, (Asian beauty:1.4), (porcelain fair skin:1.5), (flawless pale white skin:1.4), (realistic skin texture:1.3), (skin pores:1.2), (youthful:1.3), (perfect face:1.5), (perfect body:1.3), (perfect anatomy:1.3), (clearly defined limbs:1.3), (correct body proportions:1.2), (explicit:1.4), (nsfw:1.4)';
const QUALITY_NOOB = 'masterpiece, best quality, amazing quality, very aesthetic, newest, ultra detailed, source_anime, nsfw, explicit';
const NEG_REAL = '(worst quality:1.8), (low quality:1.8), (normal quality:1.4), (bad anatomy:1.7), (bad body:1.6), bad face, ugly face, deformed face, blurry, watermark, text, censored, mosaic, (dark skin:1.5), (tanned skin:1.5), (yellowish skin:1.4), (extra limbs:1.7), (extra arms:1.7), (extra legs:1.7), (missing limbs:1.7), (fused fingers:1.6), (extra fingers:1.6), (floating limbs:1.6), (disconnected limbs:1.6), (mutated hands:1.7), (poorly drawn hands:1.7), (malformed hands:1.7), (wrong number of fingers:1.6), (bad proportions:1.5), (plastic skin:1.4), (rubber skin:1.3), (3d render:1.3), (wax figure:1.3), clothing artifact, leftover clothes, partial clothing on nude body';
const NEG_NOOB = 'worst quality, bad quality, lowres, bad anatomy, bad face, ugly face, deformed, blurry, watermark, text, censored, mosaic, extra limbs, missing limbs, fused fingers, mutated hands, floating limbs';

interface Lora { name: string; model: number; clip: number; trigger?: string; }

interface TestCase {
  label: string;
  model: string;
  loras: Lora[];
  prompt: string;
  negative?: string;
}

// ── Test cases — one per LoRA ────────────────────────────────────────────────
const TESTS: TestCase[] = [
  {
    label: '01_add-detail-xl',
    model: MODEL_LEOSAM,
    loras: [{ name: 'add-detail-xl.safetensors', model: 0.6, clip: 0.6 }],
    prompt: '1girl, 22yo japanese woman, black hair tied back, white shirt, standing, looking at viewer, soft lighting, half body portrait',
  },
  {
    label: '02_nudify_xl_lite',
    model: MODEL_LEOSAM,
    loras: [
      { name: 'add-detail-xl.safetensors', model: 0.6, clip: 0.6 },
      { name: 'nudify_xl_lite.safetensors', model: 0.5, clip: 0.5 },
    ],
    prompt: '1girl, 22yo japanese woman, black hair, naked, nude, (bare breasts:1.6), (erect nipples:1.4), standing upright, arms at sides, facing camera, full body shot, bedroom, simple pose',
  },
  {
    label: '03_missionary',
    model: MODEL_LEOSAM,
    loras: [
      { name: 'add-detail-xl.safetensors', model: 0.6, clip: 0.6 },
      { name: 'nudify_xl_lite.safetensors', model: 0.5, clip: 0.5 },
      { name: 'MissionaryVaginal-v1-SDXL.safetensors', model: 0.85, clip: 0.85 },
    ],
    prompt: '1girl, 22yo japanese woman, black hair, (completely naked:1.7), missionary position, legs up, spreading legs, (vaginal penetration:1.7), (bare breasts:1.6), moaning expression, bedroom',
  },
  {
    label: '04_doggy_style',
    model: MODEL_LEOSAM,
    loras: [
      { name: 'add-detail-xl.safetensors', model: 0.6, clip: 0.6 },
      { name: 'nudify_xl_lite.safetensors', model: 0.5, clip: 0.5 },
      { name: 'dggy.safetensors', model: 0.85, clip: 0.85 },
    ],
    prompt: '1girl, 22yo japanese woman, black hair, (completely naked:1.7), doggy style, from behind, (vaginal penetration:1.7), (bare breasts:1.5), bent over, bed',
  },
  {
    label: '05_cowgirl_riding',
    model: MODEL_LEOSAM,
    loras: [
      { name: 'add-detail-xl.safetensors', model: 0.6, clip: 0.6 },
      { name: 'nudify_xl_lite.safetensors', model: 0.5, clip: 0.5 },
      { name: 'rvcg.safetensors', model: 0.85, clip: 0.85 },
    ],
    prompt: '1girl, 22yo japanese woman, black hair, (completely naked:1.7), cowgirl position, riding on top, (vaginal penetration:1.7), (bare breasts:1.6), moaning, bedroom',
  },
  {
    label: '06_cocktease_foreplay',
    model: MODEL_LEOSAM,
    loras: [
      { name: 'add-detail-xl.safetensors', model: 0.6, clip: 0.6 },
      { name: 'nudify_xl_lite.safetensors', model: 0.5, clip: 0.5 },
      { name: 'cockteaseLoRASDXL.safetensors', model: 0.7, clip: 0.7 },
    ],
    prompt: '1girl, 22yo japanese woman, black hair, topless, (bare breasts:1.5), handjob, stroking, teasing, seductive expression, bedroom lighting',
  },
  {
    label: '07_cum_creampie',
    model: MODEL_LEOSAM,
    loras: [
      { name: 'add-detail-xl.safetensors', model: 0.6, clip: 0.6 },
      { name: 'nudify_xl_lite.safetensors', model: 0.5, clip: 0.5 },
      { name: 'PornMaster-cum-sdxl-V3-lora.safetensors', model: 0.75, clip: 0.75 },
    ],
    prompt: '1girl, 22yo japanese woman, black hair, completely naked, (creampie:1.6), (white cum dripping from pussy:1.6), (white semen:1.5), ahegao, lying on back, exhausted, bedroom',
    negative: 'black cum, dark fluid, dark semen, colored fluid',
  },
  {
    label: '08_tongue_out',
    model: MODEL_LEOSAM,
    loras: [
      { name: 'add-detail-xl.safetensors', model: 0.6, clip: 0.6 },
      { name: 'Tongue out_SDXL.safetensors', model: 0.65, clip: 0.65 },
    ],
    prompt: '1girl, 22yo japanese woman, black hair, tongue out, (ahegao:1.3), open mouth, (drool:1.2), moaning, flushed face, close up portrait, ecstasy expression',
  },
  {
    label: '10_armpitsex_noobai',
    model: MODEL_NOOB,
    loras: [
      { name: 'Armpitsex-IL_NAI.safetensors', model: 0.7, clip: 0.7 },
    ],
    prompt: '1girl, anime girl, silver hair, slim, completely naked, armpitjob, armpit sex, penis between arm and body, ecstasy expression, moaning',
  },
];

// ── Workflow builder ─────────────────────────────────────────────────────────
function buildWorkflow(prompt: string, neg: string, seed: number, modelName: string, loras: Lora[]): object {
  const isNoob     = modelName === MODEL_NOOB;
  const qPrefix    = isNoob ? QUALITY_NOOB : QUALITY_REAL;
  const nPrefix    = isNoob ? NEG_NOOB     : NEG_REAL;
  const cfg        = isNoob ? 6.0 : 7.0;
  const steps      = isNoob ? 28  : 25;
  const hiresSteps = isNoob ? 0   : 15;

  const triggers = loras.map(l => l.trigger).filter(Boolean).join(', ');
  const fullPrompt = `${qPrefix}, ${prompt}${triggers ? ', ' + triggers : ''}`;
  const fullNeg    = `${nPrefix}, ${neg}`;

  const nodes: Record<string, any> = {
    "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: modelName } },
    "5": { class_type: "EmptyLatentImage",        inputs: { width: 768, height: 1024, batch_size: 1 } },
    "9": { class_type: "SaveImage",               inputs: { images: ["8", 0], filename_prefix: "loratest" } },
  };

  let modelSrc: [string, number] = ["4", 0];
  let clipSrc:  [string, number] = ["4", 1];
  loras.forEach((lora, i) => {
    const id = String(20 + i);
    nodes[id] = {
      class_type: "LoraLoader",
      inputs: { lora_name: lora.name, strength_model: lora.model, strength_clip: lora.clip, model: modelSrc, clip: clipSrc },
    };
    modelSrc = [id, 0];
    clipSrc  = [id, 1];
  });

  nodes["6"] = { class_type: "CLIPTextEncode", inputs: { text: fullPrompt, clip: clipSrc } };
  nodes["7"] = { class_type: "CLIPTextEncode", inputs: { text: fullNeg,    clip: clipSrc } };
  nodes["3"] = {
    class_type: "KSampler",
    inputs: {
      model: modelSrc, positive: ["6", 0], negative: ["7", 0], latent_image: ["5", 0],
      seed, steps, cfg, sampler_name: "dpmpp_2m", scheduler: "karras", denoise: 1.0,
    },
  };

  if (hiresSteps > 0) {
    nodes["10"] = { class_type: "LatentUpscaleBy", inputs: { samples: ["3", 0], upscale_method: "bislerp", scale_by: 1.25 } };
    nodes["11"] = {
      class_type: "KSampler",
      inputs: {
        model: modelSrc, positive: ["6", 0], negative: ["7", 0], latent_image: ["10", 0],
        seed, steps: hiresSteps, cfg, sampler_name: "dpmpp_2m", scheduler: "karras", denoise: 0.55,
      },
    };
    nodes["8"] = { class_type: "VAEDecode", inputs: { samples: ["11", 0], vae: ["4", 2] } };
  } else {
    nodes["8"] = { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } };
  }

  return nodes;
}

async function queuePrompt(workflow: object): Promise<string> {
  const res = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  });
  if (!res.ok) throw new Error(`Queue failed: ${res.status} ${await res.text()}`);
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

async function downloadImage(filename: string, savePath: string): Promise<void> {
  const res = await fetch(`${COMFYUI_URL}/view?filename=${filename}&type=output`);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buffer = await res.buffer();
  fs.writeFileSync(savePath, buffer);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`\n🎨 LoRA Test — ${TESTS.length} images\n${'─'.repeat(50)}`);

  for (const t of TESTS) {
    process.stdout.write(`[${t.label}] generating...`);
    try {
      const seed     = Math.floor(Math.random() * 2 ** 32);
      const workflow = buildWorkflow(t.prompt, t.negative ?? '', seed, t.model, t.loras);
      const pid      = await queuePrompt(workflow);
      const filename = await waitForImage(pid);
      const savePath = path.join(OUTPUT_DIR, `${t.label}.png`);
      await downloadImage(filename, savePath);
      console.log(` ✅  saved → ${savePath}`);
    } catch (e: any) {
      console.log(` ❌  FAILED — ${e.message}`);
    }
  }

  console.log(`\n✨ Done! Open folder: ${OUTPUT_DIR}\n`);
}

main();
