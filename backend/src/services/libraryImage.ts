/**
 * Pre-generated image library service.
 * Scans /images/library/{category}/{character}/{shotKey}/ and serves images
 * in round-robin order, tracked per user via userMemory._shotIdx_{shotKey}.
 *
 * Images that are used as faceUrl / portraitImages in the Character table are
 * "reserved" and will never be served in real-time chat.
 */
import fs from 'fs';
import path from 'path';

const IMAGE_SAVE_DIR = process.env.IMAGE_SAVE_DIR || '/var/www/siyuwanban/images';
const LIBRARY_DIR = path.join(IMAGE_SAVE_DIR, 'library');
const SERVER_URL = (process.env.FRONTEND_URL || 'https://siyuwanban.shangzongcai.com').replace(/\/$/, '');

// ── Index ──────────────────────────────────────────────────────────────────────

interface ShotEntries {
  category:  string;   // "anime"
  character: string;   // raw name e.g. "冷霜"
  shot:      string;   // "portrait"
  indices:   number[]; // sorted available image numbers
  notes:     Record<number, string>; // idx → variantNote from .json sidecar
}

// char name → shot key → ShotEntries
const libraryIndex = new Map<string, Map<string, ShotEntries>>();
let indexBuilt = false;

// ── Reservations ───────────────────────────────────────────────────────────────

// char name → shot key → Set of reserved indices (used in faceUrl / portraitImages)
const reservedImages = new Map<string, Map<string, Set<number>>>();

/**
 * Parse a library image URL and mark its index as reserved.
 * Accepts both raw Chinese characters and percent-encoded forms.
 */
export function reserveLibraryImages(urls: string[]): void {
  // Match: /images/library/{cat}/{char}/{shot}/{NNN}.png
  const pattern = /\/images\/library\/([^/]+)\/([^/]+)\/([^/]+)\/(\d+)\.png(?:[?#].*)?$/;

  for (const url of urls) {
    if (!url) continue;
    const m = url.match(pattern);
    if (!m) continue;

    const [, , charRaw, shot, idxStr] = m;
    const char = decodeURIComponent(charRaw);
    const idx  = parseInt(idxStr, 10);
    if (isNaN(idx)) continue;

    if (!reservedImages.has(char)) reservedImages.set(char, new Map());
    const charMap = reservedImages.get(char)!;
    if (!charMap.has(shot)) charMap.set(shot, new Set());
    charMap.get(shot)!.add(idx);
  }

  // Log summary
  let total = 0;
  for (const m of reservedImages.values()) for (const s of m.values()) total += s.size;
  console.log(`[Library] Reserved ${total} images for profile/album use`);
}

// ── Build index ────────────────────────────────────────────────────────────────

export function buildLibraryIndex(): void {
  libraryIndex.clear();

  if (!fs.existsSync(LIBRARY_DIR)) {
    console.log(`[Library] Directory not found: ${LIBRARY_DIR}`);
    return;
  }

  const categories = fs.readdirSync(LIBRARY_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const cat of categories) {
    const catDir = path.join(LIBRARY_DIR, cat);
    const chars  = fs.readdirSync(catDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const char of chars) {
      const charDir = path.join(catDir, char);
      const shots   = fs.readdirSync(charDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      if (!libraryIndex.has(char)) libraryIndex.set(char, new Map());
      const charMap = libraryIndex.get(char)!;

      for (const shot of shots) {
        const shotDir = path.join(charDir, shot);
        const indices = fs.readdirSync(shotDir)
          .filter(f => f.endsWith('.png'))
          .map(f => parseInt(f.replace('.png', ''), 10))
          .filter(n => !isNaN(n))
          .sort((a, b) => a - b);

        if (indices.length > 0) {
          // Load variantNote from JSON sidecars (best-effort, non-blocking)
          const notes: Record<number, string> = {};
          for (const idx of indices) {
            const jsonPath = path.join(shotDir, `${String(idx).padStart(3, '0')}.json`);
            if (fs.existsSync(jsonPath)) {
              try {
                const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
                if (typeof meta.variantNote === 'string' && meta.variantNote.length > 0) {
                  notes[idx] = meta.variantNote;
                }
              } catch { /* skip bad sidecar */ }
            }
          }
          charMap.set(shot, { category: cat, character: char, shot, indices, notes });
        }
      }
    }
  }

  indexBuilt = true;

  let totalImages = 0;
  for (const charMap of libraryIndex.values()) {
    for (const entry of charMap.values()) totalImages += entry.indices.length;
  }
  console.log(`[Library] Index built: ${libraryIndex.size} characters, ${totalImages} images`);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Returns true if this character has any pre-generated library images. */
export function hasLibraryChar(characterName: string): boolean {
  if (!indexBuilt) buildLibraryIndex();
  return libraryIndex.has(characterName);
}

/** Build the canonical URL for a library image. */
export function libraryImageUrl(cat: string, char: string, shot: string, idx: number): string {
  return `${SERVER_URL}/images/library/${cat}/${encodeURIComponent(char)}/${shot}/${String(idx).padStart(3, '0')}.png`;
}

/**
 * Pick the next library image for a character + shotKey, cycling round-robin.
 * Reserved images (faceUrl / portraitImages) are automatically skipped.
 *
 * @param lastIdx  The index last shown (from userMemory._shotIdx_{shotKey}); 0 if first time.
 * @returns { url, index } or null if no non-reserved images exist.
 */
export function pickLibraryImage(
  characterName: string,
  shotKey: string,
  lastIdx = 0,
): { url: string; index: number } | null {
  if (!indexBuilt) buildLibraryIndex();

  const charMap = libraryIndex.get(characterName);
  if (!charMap) return null;

  const entry = charMap.get(shotKey);
  if (!entry || entry.indices.length === 0) return null;

  // Filter out reserved indices; fall back to all indices if every image is reserved
  const reserved  = reservedImages.get(characterName)?.get(shotKey) ?? new Set<number>();
  const available = entry.indices.filter(i => !reserved.has(i));
  const pool      = available.length > 0 ? available : [...entry.indices];
  if (pool.length === 0) return null;

  // Round-robin: next after lastIdx, wrap around
  const next = pool.find(i => i > lastIdx) ?? pool[0];
  const url  = libraryImageUrl(entry.category, entry.character, entry.shot, next);

  return { url, index: next };
}

/**
 * Score a variantNote against a query string by keyword overlap.
 * Returns number of query words (len >= 2) found in the variantNote.
 */
function scoreNote(variantNote: string, query: string): number {
  const vnLower = variantNote.toLowerCase();
  const words = query.toLowerCase().split(/[\s,，·\-/]+/).filter(w => w.length >= 2);
  return words.filter(w => vnLower.includes(w)).length;
}

/**
 * Pick the best matching image for a shot key using keyword scoring against variantNote.
 * Falls back to round-robin when notes are absent or all tied.
 */
export function pickImageByNote(
  characterName: string,
  shotKey: string,
  note: string,
  lastIdx = 0,
): { url: string; index: number } | null {
  if (!indexBuilt) buildLibraryIndex();

  const charMap = libraryIndex.get(characterName);
  if (!charMap) return null;

  const entry = charMap.get(shotKey);
  if (!entry || entry.indices.length === 0) return null;

  const reserved  = reservedImages.get(characterName)?.get(shotKey) ?? new Set<number>();
  const available = entry.indices.filter(i => !reserved.has(i));
  const pool      = available.length > 0 ? available : [...entry.indices];
  if (pool.length === 0) return null;

  // Score each image; use lastIdx to break ties in favour of the next unseen image
  let bestIdx   = pool.find(i => i > lastIdx) ?? pool[0];
  let bestScore = -1;

  for (const idx of pool) {
    const vn    = entry.notes[idx] ?? '';
    const score = vn ? scoreNote(vn, note) : 0;
    // Tie-break: prefer images after lastIdx (round-robin continuity)
    const tieScore = score * 2 + (idx > lastIdx ? 1 : 0);
    if (tieScore > bestScore) {
      bestScore = tieScore;
      bestIdx   = idx;
    }
  }

  return { url: libraryImageUrl(entry.category, entry.character, entry.shot, bestIdx), index: bestIdx };
}

/**
 * Build a fallback chain from the preferred shot to simpler alternatives.
 * Order: preferred → content-adjacent → generic exposed → medium → portrait
 */
function buildShotFallbackChain(preferred: string): string[] {
  const seen = new Set<string>();
  const chain: string[] = [];
  const add = (s: string) => { if (!seen.has(s)) { seen.add(s); chain.push(s); } };

  add(preferred);

  // Climax / post-climax group
  if (preferred === 'ahegao' || preferred === 'squirt') {
    add('overstimulation'); add('afterglow'); add('creampie'); add('breast'); add('medium');
  } else if (preferred === 'creampie') {
    add('ahegao'); add('afterglow'); add('breast'); add('medium');
  } else if (preferred === 'overstimulation' || preferred === 'afterglow') {
    add('ahegao'); add('creampie'); add('breast'); add('medium');

  // Penetration group — try alternative positions before falling back to body shots
  } else if (preferred === 'penetration_missionary' || preferred === 'piledriver') {
    add('penetration_cowgirl'); add('penetration_generic'); add('lotus'); add('breast'); add('medium');
  } else if (preferred === 'penetration_doggy' || preferred === 'prone_bone') {
    add('penetration_cowgirl'); add('penetration_generic'); add('breast'); add('medium');
  } else if (preferred === 'penetration_cowgirl' || preferred === 'lotus') {
    add('penetration_missionary'); add('penetration_generic'); add('breast'); add('medium');
  } else if (preferred === 'penetration_spooning') {
    add('penetration_generic'); add('breast'); add('medium');
  } else if (preferred === 'penetration_generic' || preferred === 'penetration_closeup' || preferred === 'spread_pussy') {
    add('pussy'); add('breast'); add('medium');

  // Oral / manual group
  } else if (preferred === 'blowjob' || preferred === 'cunnilingus') {
    add('breast'); add('medium');
  } else if (preferred === 'fingering') {
    add('pussy'); add('spread_pussy'); add('breast'); add('medium');
  } else if (preferred === 'handjob') {
    add('medium'); add('portrait');

  // BDSM / kink group
  } else if (preferred === 'bondage' || preferred === 'spanking') {
    add('toy_use'); add('breast'); add('medium');
  } else if (preferred === 'toy_use' || preferred === 'edging') {
    add('bondage'); add('fingering'); add('breast'); add('medium');
  } else if (preferred === 'petplay') {
    add('medium'); add('portrait');

  // Body display group
  } else if (preferred === 'pussy') {
    add('spread_pussy'); add('fingering'); add('breast'); add('medium');
  } else if (preferred === 'breast') {
    add('undressing'); add('medium'); add('portrait');
  } else if (preferred === 'undressing') {
    add('breast'); add('medium'); add('portrait');
  } else if (preferred === 'ass' || preferred === 'back' || preferred === 'thighs') {
    add('undressing'); add('breast'); add('medium');
  } else if (preferred === 'massage' || preferred === 'exhibition') {
    add('medium'); add('portrait');

  // Portrait / medium group
  } else if (preferred === 'kiss') {
    add('medium'); add('portrait');
  }

  add('medium');
  add('portrait');
  return chain;
}

/**
 * Pick the best available library image for a character, trying the preferred
 * shot first, then falling back through content-adjacent alternatives.
 * Returns which shot was actually used so userMemory can be updated correctly.
 */
export function pickBestLibraryImage(
  characterName: string,
  preferredShot: string,
  lastIdxMap: Record<string, number>, // shotKey → last shown index
  note?: string,                      // optional: imgNote from AI for within-shot variant scoring
): { url: string; index: number; shotKey: string } | null {
  const chain = buildShotFallbackChain(preferredShot);
  for (const shot of chain) {
    const lastIdx = lastIdxMap[shot] ?? 0;
    // Use note-based scoring on the preferred shot; fall back to round-robin for alternatives
    const picked = (note && shot === chain[0])
      ? pickImageByNote(characterName, shot, note, lastIdx)
      : pickLibraryImage(characterName, shot, lastIdx);
    if (picked) return { ...picked, shotKey: shot };
  }
  return null;
}

/**
 * Return all image URLs for a given character + shotKey (for building album/faceUrl).
 * These are the "raw" full lists before any reservation filtering.
 */
export function getAllShotUrls(characterName: string, shotKey: string): string[] {
  if (!indexBuilt) buildLibraryIndex();

  const charMap = libraryIndex.get(characterName);
  if (!charMap) return [];

  const entry = charMap.get(shotKey);
  if (!entry) return [];

  return entry.indices.map(i => libraryImageUrl(entry.category, entry.character, entry.shot, i));
}
