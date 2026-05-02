import { prisma } from './utils/prisma';

async function main() {
  const chars = await prisma.character.findMany({
    where: { isPublic: false },
    select: { id: true, name: true },
  });

  if (chars.length === 0) {
    console.log('没有非公开角色。');
    await prisma.$disconnect();
    return;
  }

  console.log(`找到 ${chars.length} 个非公开角色：`);
  chars.forEach(c => console.log(`  - ${c.name} (${c.id})`));

  const ids = chars.map(c => c.id);

  // 先删关联数据（对话、消息、评价等）
  const delMessages = await prisma.message.deleteMany({
    where: { conversation: { characterId: { in: ids } } },
  });
  console.log(`  删除消息：${delMessages.count} 条`);

  const delConvs = await prisma.conversation.deleteMany({
    where: { characterId: { in: ids } },
  });
  console.log(`  删除对话：${delConvs.count} 条`);

  const delReviews = await prisma.review.deleteMany({
    where: { characterId: { in: ids } },
  });
  console.log(`  删除评价：${delReviews.count} 条`);

  const delChars = await prisma.character.deleteMany({
    where: { id: { in: ids } },
  });
  console.log(`  删除角色：${delChars.count} 个`);

  console.log('\n✅ 完成');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
