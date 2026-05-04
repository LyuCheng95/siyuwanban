import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { randomUUID } from 'crypto';

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT         = parseInt(process.env.PORT || '7080');
const COMFYUI_URL  = process.env.COMFYUI_URL || 'http://localhost:8188';
const SERVER_URL   = process.env.SERVER_URL   || 'http://localhost:3001';
const ADMIN_KEY    = process.env.ADMIN_KEY    || '';
const WORKER_KEY   = process.env.WORKER_KEY   || '';

// ── Auth middleware ────────────────────────────────────────────────────────────
function requireKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!WORKER_KEY) { next(); return; }
  const key = req.headers['x-worker-key'];
  if (key !== WORKER_KEY) { res.status(401).json({ error: 'unauthorized' }); return; }
  next();
}

// ── Job queue ─────────────────────────────────────────────────────────────────
interface Job {
  id: string;
  charId: string;
  characterName: string;
  modelFile?: string;
  prompts: string[];
  status: 'pending' | 'running' | 'done' | 'failed';
  done: number;    // images completed so far
  total: number;
  urls: string[];
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, Job>();
let processingJob: string | null = null; // only one job runs at a time

async function processNextJob() {
  if (processingJob) return; // already running
  const next = [...jobs.values()].find(j => j.status === 'pending');
  if (!next) return;

  processingJob = next.id;
  next.status = 'running';
  console.log(`[queue] starting job ${next.id} — ${next.characterName} (${next.total} images)`);

  try {
    for (let i = 0; i < next.prompts.length; i++) {
      const workflow = buildAlbumWorkflow(next.prompts[i], next.modelFile || CHARACTER_MODEL[next.characterName] || MODEL_JUGGER);
      const prefix   = `album_${next.characterName}_${i + 1}`;
      console.log(`[queue] ${next.characterName} ${i + 1}/${next.total}`);
      const url = await generateOne(workflow, prefix);

      // Notify server of each image as it finishes
      await notifyServer(next.charId, url).catch(e =>
        console.warn(`[queue] notify failed for ${next.id}:`, e.message)
      );

      next.urls.push(url);
      next.done = i + 1;
    }
    next.status = 'done';
    console.log(`[queue] job ${next.id} done`);
  } catch (err: any) {
    next.status = 'failed';
    next.error = err.message;
    console.error(`[queue] job ${next.id} failed:`, err.message);
  } finally {
    processingJob = null;
    // Kick off next job if any
    setImmediate(processNextJob);
  }
}

// Tell the server to append one URL to the character's portraitImages
async function notifyServer(charId: string, url: string) {
  await fetch(`${SERVER_URL}/api/admin/characters/${charId}/append-image?key=${encodeURIComponent(ADMIN_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
}

// ── ComfyUI helpers ────────────────────────────────────────────────────────────
async function queuePrompt(workflow: object): Promise<string> {
  const res = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  });
  if (!res.ok) throw new Error(`ComfyUI queue failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { prompt_id: string };
  return data.prompt_id;
}

async function waitForImage(promptId: string, timeoutMs = 300_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2500));
    const res = await fetch(`${COMFYUI_URL}/history/${promptId}`);
    if (!res.ok) continue;
    const history = await res.json() as Record<string, any>;
    const entry = history[promptId];
    if (!entry?.outputs) continue;
    for (const nodeOut of Object.values(entry.outputs) as any[]) {
      if (nodeOut?.images?.length) return nodeOut.images[0].filename;
    }
  }
  throw new Error(`ComfyUI timeout after ${timeoutMs / 1000}s`);
}

async function fetchImageBuffer(filename: string): Promise<Buffer> {
  const res = await fetch(`${COMFYUI_URL}/view?filename=${encodeURIComponent(filename)}&type=output`);
  if (!res.ok) throw new Error(`Failed to fetch image from ComfyUI: ${res.status}`);
  return res.buffer();
}

async function uploadToServer(buffer: Buffer, filename: string): Promise<string> {
  const form = new FormData();
  form.append('image', buffer, { filename, contentType: 'image/png' });
  const res = await fetch(`${SERVER_URL}/api/admin/images/upload?key=${encodeURIComponent(ADMIN_KEY)}`, {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { url: string };
  return data.url;
}

async function generateOne(workflow: object, filenamePrefix: string): Promise<string> {
  const promptId = await queuePrompt(workflow);
  const filename = await waitForImage(promptId);
  const buffer = await fetchImageBuffer(filename);
  const uploadName = `${filenamePrefix}_${Date.now()}.png`;
  return uploadToServer(buffer, uploadName);
}

// ── Workflow builder ───────────────────────────────────────────────────────────
const MODEL_JUGGER = 'juggernautXL_juggXIByRundiffusion.safetensors';
const MODEL_LEOSAM = 'leosamsHelloworldXL_helloworldXL70.safetensors';
const MODEL_NOOB   = 'noobaiXLNAIXL_epsilonPred11Version.safetensors';
const MODEL_PONY   = 'ponyDiffusionV6XL_v6StartWithThisOne.safetensors';

const QUALITY_REAL = '(photorealistic:1.4), (hyperrealistic:1.3), RAW photo, 8k uhd, masterpiece, (Asian beauty:1.4), (porcelain fair skin:1.5), (flawless pale white skin:1.4), (realistic skin texture:1.3), (youthful:1.3), (perfect face:1.5), (perfect body:1.3), (perfect anatomy:1.3), (explicit:1.4), (nsfw:1.4)';
const QUALITY_NOOB = 'masterpiece, best quality, amazing quality, very aesthetic, newest, ultra detailed, source_anime, nsfw, explicit';
const QUALITY_PONY = 'score_9, score_8_up, score_7_up, score_6_up, masterpiece, best quality, ultra detailed, nsfw, explicit';
const NEGATIVE_REAL = '(worst quality:1.8), (low quality:1.8), (normal quality:1.4), (bad anatomy:1.7), (bad body:1.6), bad face, ugly face, deformed face, blurry, watermark, text, censored, mosaic, (dark skin:1.5), (extra limbs:1.7), (mutated hands:1.7), (poorly drawn hands:1.7), (bad proportions:1.5)';
const NEGATIVE_NOOB = 'worst quality, bad quality, lowres, bad anatomy, bad face, ugly face, deformed, blurry, watermark, text, censored, mosaic, extra limbs, missing limbs, fused fingers, mutated hands';
const NEGATIVE_PONY = 'score_1, score_2, score_3, worst quality, bad quality, bad anatomy, bad face, ugly, deformed, blurry, watermark, text, censored';

interface LoraConfig { name: string; model: number; clip: number; }

function selectLoras(prompt: string, modelName: string): LoraConfig[] {
  const isNoob = modelName === MODEL_NOOB;
  const isPony = modelName === MODEL_PONY;
  const p = prompt.toLowerCase();
  const loras: LoraConfig[] = [];
  if (!isNoob && !isPony) {
    loras.push({ name: 'add-detail-xl.safetensors', model: 0.6, clip: 0.6 });
    if (/naked|nude|topless|bare breast|nipple|bottomless|no cloth|undressed|pussy|penetration|vaginal/.test(p))
      loras.push({ name: 'nudify_xl_lite.safetensors', model: 0.5, clip: 0.5 });
    if (/missionary|legs up|spreading legs/.test(p))
      loras.push({ name: 'MissionaryVaginal-v1-SDXL.safetensors', model: 0.85, clip: 0.85 });
    else if (/doggy|from behind/.test(p))
      loras.push({ name: 'dggy.safetensors', model: 0.85, clip: 0.85 });
    else if (/cowgirl|riding on top|reverse cowgirl/.test(p))
      loras.push({ name: 'rvcg.safetensors', model: 0.85, clip: 0.85 });
    if (/cum|creampie|ejaculation|ahegao|climax/.test(p))
      loras.push({ name: 'PornMaster-cum-sdxl-V3-lora.safetensors', model: 0.75, clip: 0.75 });
  } else if (isNoob) {
    if (/armpit/.test(p)) loras.push({ name: 'Armpitsex-IL_NAI.safetensors', model: 0.7, clip: 0.7 });
  }
  return loras;
}

function buildAlbumWorkflow(prompt: string, modelName: string): object {
  const isNoob = modelName === MODEL_NOOB;
  const isPony = modelName === MODEL_PONY;
  const qualityPrefix = isPony ? QUALITY_PONY : isNoob ? QUALITY_NOOB : QUALITY_REAL;
  const negativeBase  = isPony ? NEGATIVE_PONY : isNoob ? NEGATIVE_NOOB : NEGATIVE_REAL;
  const cfg        = (isNoob || isPony) ? 6.0 : 7.0;
  const steps      = isNoob ? 28 : 25;
  const hiresSteps = (isNoob || isPony) ? 0 : 15;
  const seed       = Math.floor(Math.random() * 2 ** 32);
  const loras      = selectLoras(prompt, modelName);
  const fullPrompt = `${qualityPrefix}, ${prompt}`;

  const nodes: Record<string, any> = {
    "4": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": modelName } },
    "5": { "class_type": "EmptyLatentImage", "inputs": { "width": 768, "height": 1024, "batch_size": 1 } },
    "9": { "class_type": "SaveImage", "inputs": { "images": ["8", 0], "filename_prefix": "worker" } },
  };
  let modelSrc: [string, number] = ["4", 0];
  let clipSrc:  [string, number] = ["4", 1];
  loras.forEach((lora, i) => {
    const id = String(20 + i);
    nodes[id] = { "class_type": "LoraLoader", "inputs": { "lora_name": lora.name, "strength_model": lora.model, "strength_clip": lora.clip, "model": modelSrc, "clip": clipSrc } };
    modelSrc = [id, 0]; clipSrc = [id, 1];
  });
  nodes["6"] = { "class_type": "CLIPTextEncode", "inputs": { "text": fullPrompt,   "clip": clipSrc } };
  nodes["7"] = { "class_type": "CLIPTextEncode", "inputs": { "text": negativeBase, "clip": clipSrc } };
  nodes["3"] = { "class_type": "KSampler", "inputs": { "model": modelSrc, "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0], "seed": seed, "steps": steps, "cfg": cfg, "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1.0 } };
  if (hiresSteps > 0) {
    nodes["10"] = { "class_type": "LatentUpscaleBy", "inputs": { "samples": ["3", 0], "upscale_method": "bislerp", "scale_by": 1.25 } };
    nodes["11"] = { "class_type": "KSampler", "inputs": { "model": modelSrc, "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["10", 0], "seed": seed, "steps": hiresSteps, "cfg": cfg, "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 0.55 } };
    nodes["8"] = { "class_type": "VAEDecode", "inputs": { "samples": ["11", 0], "vae": ["4", 2] } };
  } else {
    nodes["8"] = { "class_type": "VAEDecode", "inputs": { "samples": ["3", 0], "vae": ["4", 2] } };
  }
  return nodes;
}

const CHARACTER_MODEL: Record<string, string> = {
  '沈静': MODEL_JUGGER, '晓彤': MODEL_JUGGER,
  '椎名老师': MODEL_LEOSAM, '娜娜': MODEL_LEOSAM, '小雨': MODEL_LEOSAM,
  '琉璃': MODEL_LEOSAM,     '小慧': MODEL_LEOSAM, '阿柒': MODEL_LEOSAM,
  '糖糖': MODEL_LEOSAM,     '晴晴': MODEL_LEOSAM, '夜玲': MODEL_LEOSAM,
  '唐诗': MODEL_LEOSAM,
  'X-23': MODEL_NOOB, '幻音': MODEL_NOOB, '狐九': MODEL_NOOB,
  '冷霜': MODEL_NOOB, '魅罗': MODEL_NOOB,
  '桃桃': MODEL_PONY,
};

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/ping', (_req, res) => {
  const queue = [...jobs.values()].map(j => ({
    id: j.id, char: j.characterName, status: j.status, done: j.done, total: j.total,
  }));
  res.json({ ok: true, comfyui: COMFYUI_URL, server: SERVER_URL, queue });
});

// POST /generate-scene — synchronous, takes pre-built workflow
app.post('/generate-scene', requireKey, async (req, res) => {
  try {
    const { workflow, filename_prefix } = req.body as { workflow: object; filename_prefix?: string };
    if (!workflow) { res.status(400).json({ error: 'workflow required' }); return; }
    const url = await generateOne(workflow, filename_prefix || 'scene');
    res.json({ url });
  } catch (err: any) {
    console.error('[worker] generate-scene error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Scene job map — lightweight, separate from album jobs
interface SceneJob {
  id: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  url?: string;
  error?: string;
  createdAt: number;
}
const sceneJobs = new Map<string, SceneJob>();
// Clean up scene jobs older than 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [id, job] of sceneJobs) {
    if (job.createdAt < cutoff) sceneJobs.delete(id);
  }
}, 60_000);

// POST /generate-scene-by-name — async scene image for chat
// Returns { jobId } immediately; poll GET /scene-job/:id for status
app.post('/generate-scene-by-name', requireKey, (req, res) => {
  const { prompt, characterName } = req.body as {
    prompt: string; characterName?: string;
  };
  if (!prompt?.trim()) { res.status(400).json({ error: 'prompt required' }); return; }

  const jobId = randomUUID();
  const job: SceneJob = { id: jobId, status: 'pending', createdAt: Date.now() };
  sceneJobs.set(jobId, job);
  res.json({ jobId });

  // Run generation in background (non-blocking)
  (async () => {
    job.status = 'running';
    try {
      const modelName = CHARACTER_MODEL[characterName ?? ''] ?? MODEL_JUGGER;
      const workflow  = buildAlbumWorkflow(prompt, modelName);
      const prefix    = `scene_${(characterName || 'char').replace(/\s/g, '_')}`;
      job.url    = await generateOne(workflow, prefix);
      job.status = 'done';
    } catch (err: any) {
      job.status = 'failed';
      job.error  = err.message;
      console.error('[worker] generate-scene-by-name error:', err.message);
    }
  })();
});

// GET /scene-job/:id — poll for scene image completion
app.get('/scene-job/:id', requireKey, (req, res) => {
  const job = sceneJobs.get(req.params.id);
  if (!job) { res.status(404).json({ error: 'not found' }); return; }
  res.json({ status: job.status, url: job.url, error: job.error });
});

// POST /generate-album — enqueue job, return immediately
// Body: { charId, characterName, modelFile?, prompts: string[], count? }
// Response: { jobId, position }
app.post('/generate-album', requireKey, (req, res) => {
  const { charId, characterName, modelFile, prompts, count } = req.body as {
    charId: string; characterName: string; modelFile?: string;
    prompts: string[]; count?: number;
  };
  if (!characterName || !prompts?.length || !charId) {
    res.status(400).json({ error: 'charId, characterName and prompts required' }); return;
  }
  const limit = Math.min(count || prompts.length, prompts.length, 10);
  const job: Job = {
    id: randomUUID(), charId, characterName, modelFile,
    prompts: prompts.slice(0, limit),
    status: 'pending', done: 0, total: limit, urls: [],
    createdAt: Date.now(),
  };
  jobs.set(job.id, job);

  const pending = [...jobs.values()].filter(j => j.status === 'pending');
  const position = pending.findIndex(j => j.id === job.id) + 1;

  res.json({ jobId: job.id, position, total: limit });
  setImmediate(processNextJob);
});

// GET /job/:id — poll job status
app.get('/job/:id', requireKey, (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) { res.status(404).json({ error: 'job not found' }); return; }
  res.json({
    id: job.id, status: job.status, done: job.done, total: job.total,
    urls: job.urls, error: job.error,
  });
});

// GET /queue — list all jobs
app.get('/queue', requireKey, (_req, res) => {
  const list = [...jobs.values()]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(j => ({ id: j.id, char: j.characterName, status: j.status, done: j.done, total: j.total, error: j.error }));
  res.json(list);
});

app.listen(PORT, () => {
  console.log(`[worker] listening on port ${PORT}`);
  console.log(`[worker] ComfyUI → ${COMFYUI_URL}`);
  console.log(`[worker] Server  → ${SERVER_URL}`);
  console.log(`[worker] Auth    → ${WORKER_KEY ? 'enabled' : 'disabled'}`);
});
