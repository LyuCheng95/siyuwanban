import fetch from 'node-fetch';
import { CHARACTER_FACE } from '../characterFace';
import { MODEL_FILES, ImageModel } from './generatePortraitPrompts';

// All image generation is routed through the local Worker (SSH tunnel → local ComfyUI)
const WORKER_URL = process.env.WORKER_URL || 'http://localhost:7080';
const WORKER_KEY = process.env.WORKER_KEY || '';

// ── Clothing state system ─────────────────────────────────────────────────────
// Stored in userMemory._clothingState as a ratchet (only escalates, never drops)

export type ClothingState = 'fully_clothed' | 'disheveled' | 'topless' | 'bottomless' | 'naked';

export const CLOTHING_STATE_RANK: Record<ClothingState, number> = {
  fully_clothed: 0,
  disheveled:    1,
  topless:       2,
  bottomless:    2,
  naked:         3,
};

/** Derive clothing state from cumulative act list (code-driven, no AI inference) */
export function deriveClothingState(acts: string[]): ClothingState {
  if (acts.length === 0) return 'fully_clothed';
  const str = acts.join(' ');

  const sexKws    = ['插入', '性交', '抽插', '骑乘', '后入', '传教士', '侧入', '射精', '高潮', '潮吹', '阴道', '阴茎插入', 'penetration', 'intercourse', 'cowgirl', 'doggy', 'missionary'];
  const topKws    = ['脱上衣', '脱内衣', '解胸罩', '脱胸罩', '裸胸', '露出胸部', '乳头', '乳房', '口交', 'topless', 'bare breasts', 'bra removed'];
  const bottomKws = ['脱裤', '脱内裤', '脱裙', '阴部', '阴蒂', '手指刺激', '潮吹', 'bottomless', 'pussy', 'fingering', 'panties removed'];
  const dishKws   = ['接吻', '拥抱', '抚摸', '脱', '解开', '掀起', '撩起', '露出', 'kissing', 'touching', 'caressing', 'undress'];

  const hasSex      = sexKws.some(k => str.includes(k));
  const isTopless   = hasSex || topKws.some(k => str.includes(k));
  const isBottomless= hasSex || bottomKws.some(k => str.includes(k));
  const isDish      = dishKws.some(k => str.includes(k));

  if (hasSex || (isTopless && isBottomless)) return 'naked';
  if (isTopless)    return 'topless';
  if (isBottomless) return 'bottomless';
  if (isDish || acts.length > 0) return 'disheveled';
  return 'fully_clothed';
}

// ── Shot focus system ─────────────────────────────────────────────────────────
// Code decides the shot type — Grok never controls composition.

type ShotFocus =
  | 'portrait'
  | 'medium'
  | 'breast'
  | 'pussy'
  | 'fingering'
  | 'blowjob'
  | 'cunnilingus'
  | 'penetration_cowgirl'
  | 'penetration_doggy'
  | 'penetration_missionary'
  | 'penetration_spooning'
  | 'penetration_generic'
  | 'ahegao'
  | 'creampie';

/**
 * Hardcoded ComfyUI shot prefixes — weights ensure these dominate the final image.
 * Prepended to the front of the prompt so they take highest priority.
 */
const SHOT_PREFIXES: Record<ShotFocus, string> = {
  portrait:
    'portrait shot, head and shoulders, looking at viewer',
  medium:
    'medium shot waist up, slight lean forward, flushed cheeks',
  breast:
    '(chest close-up:1.5), (bare breasts:1.8), (erect nipples:1.7), hands cupping or squeezing, camera angle slightly down',
  pussy:
    '(between spread thighs close-up:1.5), (wet pussy:1.8), (glistening labia:1.6), fingers spreading or touching, inner thighs trembling',
  fingering:
    '(fingering close-up:1.6), (fingers inside pussy:1.7), (wet:1.6), (love juice:1.4), thighs trembling, moaning',
  blowjob:
    '(POV close-up:1.4), face looking up at camera, (penis in mouth:1.8), (blowjob:1.7), saliva dripping, flushed teary eyes',
  cunnilingus:
    '(cunnilingus close-up:1.7), (tongue on clit:1.6), fingers spreading labia, moaning expression, thighs pressing inward',
  penetration_cowgirl:
    '(cowgirl position:1.7), (vaginal penetration:1.8), riding motion, (breasts bouncing:1.5), (pussy gripping cock:1.6), love juice dripping',
  penetration_doggy:
    '(doggy style:1.8), rear close-up, (vaginal penetration:1.8), ass and wet pussy clearly visible from behind, back arched deeply',
  penetration_missionary:
    '(missionary position:1.7), overhead close-up, (vaginal penetration:1.8), legs spread wide, penis deep inside, intense eye contact',
  penetration_spooning:
    '(spooning sex:1.7), side-angle close-up, (vaginal penetration:1.8), entry from behind, bodies pressed together',
  penetration_generic:
    '(vaginal penetration:1.9), (penis deep inside pussy:1.8), explicit penetration close-up, (love juice:1.5)',
  ahegao:
    '(face close-up:1.5), (ahegao:1.9), (eyes rolled back:1.8), mouth wide open, drooling, tears of pleasure, deep red blush',
  creampie:
    '(pussy close-up:1.5), (creampie:1.8), (cum dripping from pussy:1.7), swollen lips, satisfied exhausted expression',
};

/** Select shot focus based on clothing state + acts — fully deterministic, no AI */
function selectShotFocus(
  clothingState: ClothingState,
  allActs: string[],
  intimacy: number,
  lastFocus: string,
): ShotFocus {
  const str = allActs.join(' ');

  // ① Climax / post-climax
  const hasClimax = /射精|高潮|潮吹|creampie|ahegao|orgasm|squirt/i.test(str);
  if (hasClimax) {
    // Alternate ahegao ↔ creampie for variety
    return lastFocus === 'ahegao' ? 'creampie' : 'ahegao';
  }

  // ② Active sex — position-specific
  const hasSex = /插入|性交|抽插|penetration|intercourse/i.test(str);
  if (hasSex) {
    if (/骑乘|cowgirl|riding on top/i.test(str))   return 'penetration_cowgirl';
    if (/后入|doggy|from behind/i.test(str))        return 'penetration_doggy';
    if (/传教士|missionary/i.test(str))             return 'penetration_missionary';
    if (/侧入|spooning/i.test(str))                 return 'penetration_spooning';
    return 'penetration_generic';
  }

  // ③ Oral
  const hasBlowjob = /口交.*阴茎|口含.*阴茎|blowjob|penis in mouth/i.test(str);
  const hasCunni   = /口交.*阴蒂|cunnilingus|舔.*阴蒂|lick.*clit/i.test(str);
  if (hasBlowjob) return 'blowjob';
  if (hasCunni)   return 'cunnilingus';

  // ④ Fingering
  const hasFingering = /手指.*阴|阴蒂.*手指|fingering|finger.*pussy/i.test(str);
  if (hasFingering && (clothingState === 'bottomless' || clothingState === 'naked')) {
    return 'fingering';
  }

  // ⑤ Based on clothing state
  if (clothingState === 'naked') {
    // Alternate breast ↔ pussy for visual variety
    return lastFocus === 'breast' ? 'pussy' : 'breast';
  }
  if (clothingState === 'bottomless') return 'pussy';
  if (clothingState === 'topless')    return 'breast';

  // ⑥ Clothed states
  if (intimacy < 20) return 'portrait';
  return 'medium';
}

// ── Physical anchors ──────────────────────────────────────────────────────────

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

// ── Main entry: generate image ────────────────────────────────────────────────

export async function generateSceneImage(
  scenePrompt: string,
  negative = '',
  characterName = '',
  _dbImageModel?: string | null,
  dbFaceFeatures?: string | null
): Promise<string> {
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

// ── shouldGenerateImage ───────────────────────────────────────────────────────
// Decides whether to generate an image and builds the final prompt.
//
// Architecture:
//   Code  →  shot focus (deterministic)
//   Code  →  shot prefix (hardcoded ComfyUI weights)
//   Grok  →  content details only (action + expression, 10-20 words)
//   Code  →  assembles final prompt: anchor + shotPrefix + grokDetails + scene

export async function shouldGenerateImage(
  characterName: string,
  recentMessages: Array<{ role: string; content: string }>,
  character?: {
    occupation: string; personality: string;
    faceAnchor?: string | null; faceFeatures?: string | null; defaultOutfit?: string | null;
  },
  intimacyLevel = 0,
  recentActs: string[] = [],
  sceneContext = '',
  clothingState: ClothingState = 'fully_clothed',
  lastShotFocus = 'none',
): Promise<{ generate: boolean; prompt?: string; twoShot?: boolean; shotFocus?: string }> {

  // Body anchor (face + build, no clothing)
  const bodyAnchor    = character?.faceFeatures || CHARACTER_BODY[characterName] || `1girl`;
  const defaultOutfit = character?.defaultOutfit || CHARACTER_DEFAULT_OUTFIT[characterName] || 'casual clothes';
  const faceAnchor    = character?.faceAnchor    || CHARACTER_FACE[characterName];
  const fullBodyAnchor= faceAnchor ? `${faceAnchor}, ${bodyAnchor}` : bodyAnchor;

  // ── Step 1: Code selects shot focus ─────────────────────────────────────────
  const shotFocus  = selectShotFocus(clothingState, recentActs, intimacyLevel, lastShotFocus);
  const shotPrefix = SHOT_PREFIXES[shotFocus];

  // ── Step 2: Decide whether to generate ──────────────────────────────────────
  // Exposed body parts → always generate.
  // Clothed → only if there's a strong visual moment (left to Grok).
  const isExposed = clothingState !== 'fully_clothed' && clothingState !== 'disheveled';
  const forceGenerate = isExposed;

  // ── Step 3: Build clothing state string for Grok content prompt ─────────────
  const clothingDesc =
    clothingState === 'naked'     ? 'completely naked, (bare breasts:1.7), (pussy visible:1.6), no clothing'  :
    clothingState === 'topless'   ? 'topless, (bare breasts:1.7), (erect nipples:1.6), bottom clothing on'    :
    clothingState === 'bottomless'? 'bottomless, (pussy visible:1.6), (wet:1.4), top clothing on'             :
    clothingState === 'disheveled'? 'disheveled clothes, exposed shoulders/collarbone, partially undressed'    :
    `wearing ${defaultOutfit}`;

  // twoShot: show partner when sex/oral acts
  const hasSexOrOral = /插入|性交|抽插|口交|penetration|blowjob|cunnilingus/i.test(recentActs.join(' '));
  const twoShot = hasSexOrOral;

  // ── Step 4: Ask Grok for content details ONLY (not composition) ──────────────
  const actsStr = recentActs.length > 0 ? recentActs.join(', ') : 'none yet';
  const sceneStr = sceneContext || character?.occupation || 'indoor setting';

  const systemContent = `You are a content-detail extractor for an adult image prompt system.
The framing and shot composition are already determined by the system — do NOT describe them.

Your ONLY task: extract the specific content happening RIGHT NOW from the recent dialogue.

Output strict JSON (no markdown, no extra text):
{"generate": true/false, "details": "10-20 English words: current action + expression only"}

Rules:
- generate=true if: explicit body parts are involved, intimate contact is happening, or clothing state is exposed
- generate=false if: only non-visual emotional dialogue, no intimacy
- details: describe ONLY what's physically happening and the expression — NO framing/angle/composition words
- details examples:
    "nipple teasing, moaning softly, eyes half-closed, biting lip"
    "cowgirl riding motion, breasts bouncing, ahegao, love juice dripping"
    "fingers spreading labia, trembling thighs, whimpering, flushed red"
    "sitting close, fingers intertwined, shy smile, flushed cheeks"

Current state:
- Clothing: ${clothingDesc}
- Shot (system-determined, do not describe): ${shotFocus}
- Scene: ${sceneStr}
- Acts so far: ${actsStr}
- Intimacy: ${intimacyLevel}/100`;

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
        ...recentMessages.slice(-4),
      ],
      max_tokens: 120,
      temperature: 0.15,
    }),
  });

  try {
    const data = await res.json() as any;
    const content = data.choices?.[0]?.message?.content ?? '{}';
    const cleaned = content.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed  = JSON.parse(cleaned) as { generate?: boolean; details?: string };

    const shouldGen = forceGenerate || (parsed.generate === true);
    if (!shouldGen) return { generate: false, shotFocus };

    // ── Step 5: Assemble final prompt ───────────────────────────────────────────
    // Structure: [bodyAnchor], [shotPrefix], [details], [scene], [twoShot flag]
    const details   = (parsed.details || '').trim();
    const scenePart = sceneContext || '';
    const twoShotTag= twoShot ? ', 1boy 1girl' : '';

    const finalPrompt = [
      fullBodyAnchor,
      shotPrefix,
      details,
      scenePart,
      twoShotTag,
    ].filter(Boolean).join(', ');

    console.log(`[ImageGen] shot=${shotFocus} clothing=${clothingState} prompt=${finalPrompt.slice(0, 150)}`);

    return { generate: true, prompt: finalPrompt, twoShot, shotFocus };

  } catch {
    // On parse error: if exposed, still generate with shot prefix + minimal details
    if (forceGenerate) {
      const fallback = `${fullBodyAnchor}, ${shotPrefix}, ${clothingDesc}${sceneContext ? ', ' + sceneContext : ''}`;
      return { generate: true, prompt: fallback, twoShot, shotFocus };
    }
    return { generate: false, shotFocus };
  }
}
