import fetch from 'node-fetch';
import { CHARACTER_FACE } from '../characterFace';
import { MODEL_FILES, ImageModel } from './generatePortraitPrompts';

// All image generation is routed through the local Worker (SSH tunnel → local ComfyUI)
const WORKER_URL = process.env.WORKER_URL || 'http://localhost:7080';
const WORKER_KEY = process.env.WORKER_KEY || '';

// Main entry: generate image from scene description — routes through Worker (SSH tunnel → local ComfyUI)
export async function generateSceneImage(
  scenePrompt: string,
  negative = '',
  characterName = '',
  _dbImageModel?: string | null,
  dbFaceFeatures?: string | null
): Promise<string> {
  // Build face/body anchor prefix server-side (Worker doesn't have this data)
  const bodyAnchor = dbFaceFeatures || CHARACTER_BODY[characterName];
  const faceAnchor = CHARACTER_FACE[characterName];
  const anchor = faceAnchor ? `${faceAnchor}, ${bodyAnchor || ''}` : (bodyAnchor || '');
  const fullPrompt = anchor ? `${anchor}, ${scenePrompt}` : scenePrompt;

  console.log(`[ImageGen] char=${characterName} prompt=${fullPrompt.slice(0, 120)}`);

  const res = await fetch(`${WORKER_URL}/generate-scene-by-name`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(WORKER_KEY ? { 'x-worker-key': WORKER_KEY } : {}),
    },
    body: JSON.stringify({ prompt: fullPrompt, characterName, negative }),
  });
  if (!res.ok) throw new Error(`Worker error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { url: string };
  return data.url;
}

// Physical anchor — face/hair/build ONLY, no clothing (clothing comes from context)
const CHARACTER_BODY: Record<string, string> = {
  '椎名老师': '24yo japanese woman, black-framed glasses, smooth black hair tied back, slender waist, fair skin',
  '晓彤':   '22yo chinese woman, athletic toned body, ponytail, fit figure, fair skin',
  '娜娜':   '18yo chinese girl, half-dyed hair, ear piercings, cute petite face, slender',
  '小雨':   '19yo chinese girl, wavy chestnut hair, innocent doe eyes, slender petite',
  '琉璃':   '22yo chinese woman, straight black hair, oval glasses, slender fair skin',
  '沈静':   '25yo tall chinese model, high cheekbones, bone-straight black hair, long legs',
  '小慧':   '23yo chinese woman, soft round face, gentle smile, fair skin',
  '夜玲':   '26yo chinese woman, dark wavy hair, sharp eyes, slender ink-stained fingers',
  '晴晴':   '21yo chinese girl, pastel dyed hair, bright round eyes, cute face',
  '唐诗':   '27yo chinese woman, elegant hair bun, sharp refined features, slender',
  '阿柒':   '22yo chinese girl, wavy brown shoulder-length hair, warm smile, slender',
  '糖糖':   '20yo chinese girl, messy chestnut bun, dimples, slender',
  '桃桃':   '19yo cute anime girl, pink twin tails, big sparkling round eyes, petite slim figure, fair white skin, small perky chest',
  'X-23':   'android girl, platinum white hair with neon streaks, glowing blue circuit eyes, slim',
  '幻音':   'holographic AI girl, prismatic shifting long hair, glowing ethereal eyes',
  '狐九':   'fox girl, fox ears, nine white fluffy tails, silver-white flowing hair, glowing amber eyes',
  '冷霜':   'ice cultivator girl, silver-blue long hair, cold pale blue glowing eyes, luminous pale skin',
  '魅罗':   'demon girl, dark purple flowing hair, crimson slit eyes, small horns, beautiful face',
};

// Default outfit — only used when context has no clothing changes
const CHARACTER_DEFAULT_OUTFIT: Record<string, string> = {
  '椎名老师': 'white dress shirt, short pleated skirt',
  '晓彤':   'sports bra, tight yoga pants',
  '娜娜':   'shortened school uniform',
  '小雨':   'casual college student clothes',
  '琉璃':   'white lab coat over blouse',
  '沈静':   'elegant high-fashion outfit',
  '小慧':   'nurse uniform',
  '夜玲':   'dark lace dress',
  '晴晴':   'crop top, casual streamer clothes',
  '唐诗':   'white office blouse, pencil skirt',
  '阿柒':   'barista apron over casual clothes',
  '糖糖':   'paint-stained overalls',
  '桃桃':   'pink off-shoulder hoodie, white pleated mini skirt',
  'X-23':   'tactical bodysuit',
  '幻音':   'translucent holographic outfit',
  '狐九':   'flowing white hanfu robes',
  '冷霜':   'white flowing cultivation robes',
  '魅罗':   'dark revealing demonic attire',
};

// Use Grok to decide if scene warrants an image and build the image prompt
export async function shouldGenerateImage(
  characterName: string,
  recentMessages: Array<{ role: string; content: string }>,
  character?: {
    occupation: string; personality: string;
    faceAnchor?: string | null; faceFeatures?: string | null; defaultOutfit?: string | null;
  },
  intimacyLevel = 0,
  recentActs: string[] = []
): Promise<{ generate: boolean; prompt?: string; twoShot?: boolean }> {
  // DB fields take priority, fall back to hardcoded maps for legacy chars
  const bodyAnchor = character?.faceFeatures || CHARACTER_BODY[characterName] || `1girl, ${characterName}`;
  const defaultOutfit = character?.defaultOutfit || CHARACTER_DEFAULT_OUTFIT[characterName] || 'casual clothes';
  const faceAnchor = character?.faceAnchor || CHARACTER_FACE[characterName];
  const fullBodyAnchor = faceAnchor ? `${faceAnchor}, ${bodyAnchor}` : bodyAnchor;

  // ── 1. 从累积 acts 推导性行为状态 ─────────────────────────────────────────
  const sexKeywords = ['插入', '性交', '抽插', '骑乘', '后入', '传教士', '侧入', '俯卧', '射精', '高潮', '潮吹', '阴茎插入', '阴道'];
  const hasSexAct   = recentActs.some(a => sexKeywords.some(kw => a.includes(kw)));
  const hasOralAct  = recentActs.some(a => a.includes('口交'));
  const hasClimaxAct= recentActs.some(a => ['射精', '高潮', '潮吹'].some(kw => a.includes(kw)));

  // ── 2. 从累积 acts 精确推导着装状态（不靠 AI 推断，代码直接算）──────────────
  const toplessKeywords   = ['脱上衣', '脱内衣', '解胸罩', '脱胸罩', '裸胸', '露出胸部', '乳头', '乳房', '口交', ...sexKeywords];
  const bottomlessKeywords= ['脱裤', '脱内裤', '脱裙', '脱袜', '阴部', '阴蒂', '手指刺激', '插入', '性交', '抽插', '骑乘', '后入', '口交-你舔', '潮吹'];
  const partialKeywords   = ['脱', '解开', '掀起', '撩起', '露出', '拉开'];

  const isTopless    = recentActs.some(a => toplessKeywords.some(kw => a.includes(kw)));
  const isBottomless = recentActs.some(a => bottomlessKeywords.some(kw => a.includes(kw)));
  const isPartial    = !isTopless && !isBottomless && recentActs.some(a => partialKeywords.some(kw => a.includes(kw)));

  // Build a definitive clothing state string that will be injected as a hard rule
  let clothingState: string;
  if (hasSexAct || (isTopless && isBottomless)) {
    clothingState = 'completely naked, bare breasts fully exposed, lower body fully bare, no clothing remaining';
  } else if (isTopless) {
    clothingState = 'topless (bra and top fully removed, bare breasts exposed with erect nipples), still wearing bottom clothing';
  } else if (isBottomless) {
    clothingState = 'bottomless (panties/pants fully removed, bare lower body exposed), still wearing top clothing';
  } else if (isPartial) {
    clothingState = 'partially undressed — disheveled clothing, exposed shoulders/collarbone, clothes partially removed or pulled aside';
  } else {
    clothingState = `default outfit: ${defaultOutfit}`;
  }

  // ── 3. 推导体位 ──────────────────────────────────────────────────────────────
  const positionMap: Record<string, string> = {
    '骑乘': 'cowgirl position (riding on top)',
    '后入': 'doggy style position (from behind)',
    '传教士': 'missionary position',
    '侧入': 'spooning sex position (side entry)',
    '站立': 'standing sex against wall',
    '俯卧': 'prone bone position',
  };
  const detectedPosition = recentActs.reduce<string | null>((acc, a) => {
    if (acc) return acc;
    for (const [k, v] of Object.entries(positionMap)) if (a.includes(k)) return v;
    return null;
  }, null);

  // ── 4. 构建 explicitRule ──────────────────────────────────────────────────────
  let explicitRule: string;
  if (hasSexAct) {
    const posHint    = detectedPosition ? `, ${detectedPosition}` : ', sex position clearly visible';
    const climaxHint = hasClimaxAct
      ? ', (cum dripping from pussy:1.5), (ahegao:1.3), (eyes rolled back:1.4), (shaking body:1.2)'
      : ', (moaning open mouth:1.4), (flushed face:1.3), (sweat:1.2)';
    explicitRule = `【性交强制生成·最高优先级】generate=true，twoShot=true。prompt必须包含：(bare breasts:1.6), (erect nipples:1.5), (pussy visible:1.7), (penis:1.6), (vaginal penetration:1.7)${posHint}${climaxHint}。角色着装状态：${clothingState}。禁止生成任何有衣服遮挡或清纯半身图。`;
  } else if (hasOralAct) {
    explicitRule = `generate=true，twoShot=true。prompt必须包含口交画面：(penis in mouth:1.7), (blowjob:1.6), (erect penis:1.5), (saliva:1.3)，角色着装：${clothingState}。`;
  } else if (intimacyLevel < 20) {
    explicitRule = '只在有明显肢体接触或强烈视觉暗示时生成。prompt保持衣着完整，侧重氛围情绪，不含裸露。';
  } else if (intimacyLevel < 40) {
    explicitRule = `有亲密肢体接触时生成。着装状态：${clothingState}。prompt可含 crumpled clothing、exposed shoulders/collarbone、disheveled clothes。`;
  } else if (intimacyLevel < 60) {
    explicitRule = `有性暗示时生成。着装状态：${clothingState}。prompt必须含 (bare breasts:1.5), (erect nipples:1.5)。如有手指/阴部接触，加 (hand between thighs:1.4), (fingering:1.4)。`;
  } else {
    explicitRule = `generate=true。着装状态：${clothingState}。prompt必须含 (bare breasts:1.6), (erect nipples:1.5), (pussy visible:1.6), (moaning expression:1.4)。`;
  }

  const actsHint = recentActs.length > 0
    ? `\n【全对话累积已发生行为】${recentActs.join('、')}`
    : '';

  const systemContent = `你是一个专业的图片生成 prompt 构建器。

【角色固定体貌 — 必须原样保留】
${fullBodyAnchor}
${actsHint}
【着装状态 — 已由代码根据对话历史精确计算，必须原样使用，禁止推断或改变】
→ ${clothingState}

【任务：构建精确的图片 prompt，提取以下维度】

1. 着装状态：直接使用上方已给出的状态，不得根据对话内容重新推断
2. 动作/体位：从对话和已发生行为中提取（优先用 acts 里的体位词）
   - 性交场景必须使用具体体位词：cowgirl / doggy style / missionary / spooning 等
   - 非性交场景：lying on bed / sitting / standing / against wall 等
3. 神态/表情（必须匹配剧情强度）：
   - P0-P1：flushed cheeks, shy smile
   - P2：mouth open, heavy breathing, biting lip, half-closed eyes
   - P3：moaning, eyes rolled back, ahegao, face flushed red, tears of pleasure
   - 高潮：ahegao, eyes rolled back, mouth wide open, drooling, shaking
4. 双人场景：发生性行为/口交/强烈互动 → twoShot=true，必须加 1boy 1girl + 互动动作词

【亲密度】${intimacyLevel}/100
【生成规则】${explicitRule}

【输出格式】只返回 JSON，不含任何其他文字：
{"generate": true/false, "twoShot": true/false, "prompt": "完整英文 prompt"}

prompt 结构：[体貌锚] + [着装状态（必须匹配已计算结果）] + [动作体位] + [表情神态] + [场景环境] + [强度词]
⚠️ 禁止在性交场景中生成有衣服遮挡的图片；着装状态已经由代码算好，直接用。`;

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'grok-3',
      messages: [
        { role: 'system', content: systemContent },
        ...recentMessages.slice(-6),
      ],
      max_tokens: 350,
      temperature: 0.2,
    }),
  });

  try {
    const data = await res.json() as any;
    const content = data.choices?.[0]?.message?.content ?? '{}';
    // Strip markdown code fences if present
    const cleaned = content.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch {
    return { generate: false };
  }
}
