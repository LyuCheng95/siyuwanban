/**
 * One-time migration: replace _albumImages in all conversations for anime
 * characters with the new library portrait+medium images.
 *
 * Run on server:  npx tsx src/migrateAnimeAlbums.ts
 */
import { prisma } from './utils/prisma';
import { buildLibraryIndex, getAllShotUrls } from './services/libraryImage';

const ANIME_CHARS = ['X-23', '幻音', '狐九', '冷霜', '魅罗'];
const ALBUM_SHOTS = ['portrait', 'medium'];

async function main() {
  buildLibraryIndex();

  for (const charName of ANIME_CHARS) {
    // Collect new album URLs from library (portrait + medium)
    const newAlbum: string[] = [];
    for (const shot of ALBUM_SHOTS) {
      newAlbum.push(...getAllShotUrls(charName, shot));
    }
    if (newAlbum.length === 0) {
      console.log(`[skip] ${charName} — no library images found`);
      continue;
    }

    // Find the character
    const char = await prisma.character.findFirst({ where: { name: charName } });
    if (!char) { console.log(`[skip] ${charName} — not in DB`); continue; }

    // Find all conversations for this character
    const convs = await prisma.conversation.findMany({
      where: { characterId: char.id },
      select: { id: true, userMemory: true },
    });

    let updated = 0;
    for (const conv of convs) {
      const mem = (conv.userMemory as Record<string, unknown>) ?? {};
      await prisma.conversation.update({
        where: { id: conv.id },
        data: {
          userMemory: {
            ...mem,
            _albumImages: newAlbum,
          } as object,
        },
      });
      updated++;
    }

    console.log(`✅ ${charName}: updated _albumImages in ${updated} conversations (${newAlbum.length} images)`);
    newAlbum.slice(0, 3).forEach(u => console.log(`   ${u.slice(-60)}`));
    if (newAlbum.length > 3) console.log(`   ... +${newAlbum.length - 3} more`);
  }

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
