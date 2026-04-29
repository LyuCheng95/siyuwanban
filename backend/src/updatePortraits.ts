/**
 * 批量更新所有角色的 portraitUrl 和 portraitImages。
 * 根据 /var/www/siyuwanban/images/ 目录里的文件名，自动匹配角色并写入数据库。
 *
 * 用法（在服务器 /app/backend 目录执行）：
 *   npx ts-node -r dotenv/config src/updatePortraits.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'https://siyuwanban.shangzongcai.com/images';
const IMAGES_DIR = process.env.IMAGE_SAVE_DIR || '/var/www/siyuwanban/images';

async function main() {
  // 读取图片目录，只看 album_ 开头的文件
  const files = fs.readdirSync(IMAGES_DIR).filter(f => f.startsWith('album_') && f.endsWith('.png'));

  // 按角色名分组：{ "林晓雅": ["album_林晓雅_1_xxx.png", ...], ... }
  const byChar: Record<string, string[]> = {};
  for (const f of files) {
    // 格式: album_{name}_{index}_{timestamp}.png
    // name 可能包含下划线（如 X_23），所以从后往前解析
    const noExt = f.replace(/\.png$/, '');
    const parts = noExt.split('_');
    // parts[0] = "album", parts[-1] = timestamp, parts[-2] = index
    // name = parts[1..-3] joined by "_"
    const nameParts = parts.slice(1, parts.length - 2);
    const name = nameParts.join('_');
    if (!byChar[name]) byChar[name] = [];
    byChar[name].push(f);
  }

  // 对每个角色，取时间戳最大的3张（最新一批）
  for (const [charName, charFiles] of Object.entries(byChar)) {
    // 按 index (1/2/3) 分组，每组取最大时间戳
    const byIndex: Record<string, string[]> = {};
    for (const f of charFiles) {
      const noExt = f.replace(/\.png$/, '');
      const parts = noExt.split('_');
      const idx = parts[parts.length - 2]; // "1", "2", "3"
      if (!byIndex[idx]) byIndex[idx] = [];
      byIndex[idx].push(f);
    }

    // 每个 index 取时间戳最大的文件
    const selected: string[] = [];
    for (const idx of ['1', '2', '3']) {
      const group = byIndex[idx];
      if (!group || group.length === 0) continue;
      // 取时间戳最大的
      const latest = group.sort((a, b) => {
        const tsA = parseInt(a.replace(/\.png$/, '').split('_').pop() || '0');
        const tsB = parseInt(b.replace(/\.png$/, '').split('_').pop() || '0');
        return tsB - tsA;
      })[0];
      selected.push(latest);
    }

    if (selected.length === 0) continue;

    const urls = selected.map(f => `${BASE_URL}/${f}`);
    const displayName = charName.replace(/_/g, ' '); // X_23 → "X 23"，数据库里可能是"X-23"

    // 尝试按名字匹配（尝试原始名和替换下划线的名字）
    const candidates = [charName, charName.replace(/_/g, '-'), charName.replace(/_/g, ' ')];
    let char = null;
    for (const cand of candidates) {
      char = await prisma.character.findFirst({ where: { name: cand } });
      if (char) break;
    }

    if (!char) {
      console.log(`⚠  未找到角色：${charName}（已跳过）`);
      continue;
    }

    await prisma.character.update({
      where: { id: char.id },
      data: {
        portraitUrl: urls[0],
        portraitImages: urls as any,
      },
    });

    console.log(`✓  ${char.name}（${urls.length} 张）`);
    urls.forEach(u => console.log(`   ${u}`));
  }

  console.log('\n全部完成！');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('出错:', e);
  prisma.$disconnect();
  process.exit(1);
});
