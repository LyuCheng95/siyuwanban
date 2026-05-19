/**
 * Pre-generated image library service.
 * Scans /images/library/{category}/{character}/{shotKey}/ and serves images
 * in round-robin order, tracked per user via userMemory._shotIdx_{shotKey}.
 */
import fs from 'fs';
import path from 'path';

const IMAGE_SAVE_DIR = process.env.IMAGE_SAVE_DIR || '/var/www/siyuwanban/images';
const LIBRARY_DIR = path.join(IMAGE_SAVE_DIR, 'library');
const SERVER_URL = (process.env.FRONTEND_URL || 'https://siyuwanban.shangzongcai.com').replace(/\/$/, '');

interface ShotEntries {
  relPath: string;   // e.g. "anime/X-23/portrait"
  indices: number[]; // sorted list of available image numbers
}

// char name → shot key → ShotEntries
const libraryIndex = new Map<string, Map<string, ShotEntries>>();
let indexBuilt = false;

export function buildLibraryIndex(): void {
  if (!fs.existsSync(LIBRARY_DIR)) {
    console.log(`[Library] Directory not found: ${LIBRARY_DIR}`);
    return;
  }

  // categories: anime, realistic, etc.
  const categories = fs.readdirSync(LIBRARY_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const cat of categories) {
    const catDir = path.join(LIBRARY_DIR, cat);
    const chars = fs.readdirSync(catDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const char of chars) {
      const charDir = path.join(catDir, char);
      const shots = fs.readdirSync(charDir, { withFileTypes: true })
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
          charMap.set(shot, { relPath: `${cat}/${char}/${shot}`, indices });
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

/** Returns true if this character has any pre-generated library images. */
export function hasLibraryChar(characterName: string): boolean {
  if (!indexBuilt) buildLibraryIndex();
  return libraryIndex.has(characterName);
}

/**
 * Pick the next library image for a character + shotKey, cycling round-robin.
 * @param lastIdx  The index last shown (from userMemory._shotIdx_{shotKey}); 0 if first time.
 * @returns { url, index } or null if no library images exist for this combination.
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

  // Pick the next index after lastIdx; wrap around to the beginning
  const next = entry.indices.find(i => i > lastIdx) ?? entry.indices[0];
  const fileName = String(next).padStart(3, '0') + '.png';
  const url = `${SERVER_URL}/images/library/${entry.relPath}/${fileName}`;

  return { url, index: next };
}
