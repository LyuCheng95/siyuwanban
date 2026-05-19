/**
 * One-time script: set faceUrl + portraitImages for all anime characters
 * using their pre-generated library images (portrait + medium shots).
 *
 * Usage (run on server where DB is accessible):
 *   npx tsx src/updateAnimeProfiles.ts
 */
import { prisma } from './utils/prisma';
import { buildLibraryIndex, getAllShotUrls, reserveLibraryImages } from './services/libraryImage';

// Anime characters that have a library
const ANIME_CHARS = ['X-23', '幻音', '狐九', '冷霜', '魅罗'];

// These shot types become faceUrl / portraitImages; all others stay for chat
const FACE_SHOT  = 'portrait';
const ALBUM_SHOTS = ['portrait', 'medium'];

async function main() {
  buildLibraryIndex();

  const allReservedUrls: string[] = [];

  for (const name of ANIME_CHARS) {
    const char = await prisma.character.findFirst({ where: { name } });
    if (!char) { console.log(`[skip] ${name} not found in DB`); continue; }

    // faceUrl = first portrait image
    const portraitUrls = getAllShotUrls(name, FACE_SHOT);
    if (portraitUrls.length === 0) {
      console.log(`[skip] ${name} has no portrait images`);
      continue;
    }
    const faceUrl = portraitUrls[0];

    // portraitImages = all portrait + all medium (shown in character profile carousel)
    const albumUrls: string[] = [];
    for (const shot of ALBUM_SHOTS) {
      albumUrls.push(...getAllShotUrls(name, shot));
    }
    // Deduplicate (shouldn't happen, but be safe)
    const portraitImages = Array.from(new Set(albumUrls));

    await prisma.character.update({
      where: { id: char.id },
      data: {
        faceUrl,
        portraitUrl: faceUrl,
        portraitImages: portraitImages as any,
      },
    });

    allReservedUrls.push(...portraitImages);
    console.log(`✅ ${name}: faceUrl=portrait/001, album=${portraitImages.length} images`);
    portraitImages.forEach(u => console.log(`   ${u}`));
  }

  // Show reservation summary
  reserveLibraryImages(allReservedUrls);

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
