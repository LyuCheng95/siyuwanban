/**
 * 一次性修复：将服务器上中文文件名改为 ASCII slug，并同步更新数据库 URL
 * 用法：node_modules\.bin\tsx src\fixImageSlugs.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const IMAGE_DIR = process.env.IMAGE_SAVE_DIR || '/var/www/siyuwanban/images';
const PUBLIC_BASE = process.env.FRONTEND_URL || 'https://siyuwanban.shangzongcai.com';

const SLUG_MAP: Record<string, string> = {
  '椎名老师': 'zhui', '晓彤': 'tong',  '娜娜':  'nana',  '小雨':  'yu',
  '琉璃':    'luli',  '糖糖': 'tang',  '沈静':  'shen',  '小慧':  'hui',
  '夜玲':    'ling',  '晴晴': 'qing',  '唐诗':  'shi',   '阿柒':  'qi',
  'X-23':    'x23',   '幻音': 'huan',  '狐九':  'hujiu', '冷霜':  'shuang', '魅罗': 'mei',
};

// 把 DB 里的旧 URL 换成新的 ASCII URL
function remapUrl(oldUrl: string): string {
  // 先 decode（旧代码用了 encodeURIComponent，文件名里可能有 %XX）
  let decoded: string;
  try { decoded = decodeURIComponent(oldUrl); } catch { decoded = oldUrl; }

  for (const [chinese, slug] of Object.entries(SLUG_MAP)) {
    if (decoded.includes(`album_${chinese}_`) || decoded.includes(`face_${chinese}_`)) {
      return decoded
        .replace(`album_${chinese}_`, `album_${slug}_`)
        .replace(`face_${chinese}_`,  `face_${slug}_`);
    }
  }
  return oldUrl;
}

// 重命名磁盘上的文件
function renameFiles() {
  if (!fs.existsSync(IMAGE_DIR)) {
    console.log(`⚠  IMAGE_DIR 不存在: ${IMAGE_DIR}，跳过文件重命名`);
    return;
  }

  let count = 0;
  const files = fs.readdirSync(IMAGE_DIR);
  for (const fname of files) {
    if (!fname.startsWith('album_') && !fname.startsWith('face_')) continue;
    for (const [chinese, slug] of Object.entries(SLUG_MAP)) {
      if (fname.includes(chinese)) {
        const newName = fname.replace(chinese, slug);
        fs.renameSync(path.join(IMAGE_DIR, fname), path.join(IMAGE_DIR, newName));
        console.log(`  ${fname} → ${newName}`);
        count++;
        break;
      }
    }
  }
  console.log(`✅ 文件重命名完成：${count} 个\n`);
}

async function updateDatabase() {
  const chars = await prisma.character.findMany({
    select: { id: true, name: true, portraitUrl: true, portraitImages: true, faceUrl: true },
  });

  let updated = 0;
  for (const char of chars) {
    const newPortraitUrl   = char.portraitUrl  ? remapUrl(char.portraitUrl)  : null;
    const newFaceUrl       = char.faceUrl      ? remapUrl(char.faceUrl as string) : null;
    const oldImages        = (char.portraitImages as string[]) ?? [];
    const newImages        = oldImages.map(remapUrl);

    const changed =
      newPortraitUrl !== char.portraitUrl ||
      newFaceUrl !== char.faceUrl ||
      JSON.stringify(newImages) !== JSON.stringify(oldImages);

    if (changed) {
      await prisma.character.update({
        where: { id: char.id },
        data: {
          portraitUrl:    newPortraitUrl,
          faceUrl:        newFaceUrl as any,
          portraitImages: newImages,
        },
      });
      console.log(`  DB 更新: ${char.name}`);
      updated++;
    }
  }
  console.log(`✅ 数据库更新完成：${updated} 个角色\n`);
}

async function main() {
  console.log('\n📁 重命名文件...');
  renameFiles();

  console.log('🗄  更新数据库 URL...');
  await updateDatabase();

  console.log('🎉 全部完成！');
}

main().catch(console.error).finally(() => prisma.$disconnect());
