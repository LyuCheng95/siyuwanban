import { prisma } from '../utils/prisma';

const SIMILARITY_THRESHOLD = 0.35;
const MIN_KEYWORD_LEN = 4;

// Quality/model prefix words to ignore during similarity matching
const STOP_WORDS = new Set([
  'the', 'and', 'with', 'has', 'from', 'this', 'that', 'for', 'are', 'was',
  'her', 'his', 'she', 'him', 'they', 'you', 'all', 'not', 'but', 'can',
  'will', 'have', 'been', 'had', 'some', 'into', 'than', 'its', 'also',
  'photo', 'photorealistic', 'hyperrealistic', 'masterpiece', 'quality',
  'ultra', 'detailed', 'uhd', 'best', 'amazing', 'very', 'newest', 'nsfw',
  'explicit', 'aesthetic', 'source', 'anime', 'score', 'girl', 'woman',
  'fully', 'bare', 'skin', 'fair', 'body', 'face', 'eyes', 'hair',
]);

function extractKeywords(prompt: string): Set<string> {
  return new Set(
    prompt
      .toLowerCase()
      .replace(/[():\d.]+/g, ' ')
      .split(/[\s,]+/)
      .filter(w => w.length >= MIN_KEYWORD_LEN && !STOP_WORDS.has(w)),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = [...a].filter(x => b.has(x)).length;
  const unionSize = new Set([...a, ...b]).size;
  return unionSize === 0 ? 0 : intersection / unionSize;
}

export async function findCachedScene(characterId: string, prompt: string): Promise<string | null> {
  const scenes = await prisma.sceneImage.findMany({
    where: { characterId },
    orderBy: { useCount: 'desc' },
    take: 300,
    select: { id: true, prompt: true, imageUrl: true },
  });
  if (scenes.length === 0) return null;

  const queryKw = extractKeywords(prompt);
  let best: { id: string; imageUrl: string; score: number } | null = null;

  for (const s of scenes) {
    const score = jaccardSimilarity(queryKw, extractKeywords(s.prompt));
    if (score >= SIMILARITY_THRESHOLD && (!best || score > best.score)) {
      best = { id: s.id, imageUrl: s.imageUrl, score };
    }
  }

  if (best) {
    prisma.sceneImage.update({
      where: { id: best.id },
      data: { useCount: { increment: 1 } },
    }).catch(() => {});
    return best.imageUrl;
  }
  return null;
}

export async function saveSceneImage(characterId: string, prompt: string, imageUrl: string): Promise<void> {
  await prisma.sceneImage.create({ data: { characterId, prompt, imageUrl } });
}
