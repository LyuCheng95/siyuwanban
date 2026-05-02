import { prisma } from './utils/prisma';

async function main() {
  const chars = await prisma.character.findMany({
    where: { NOT: [{ storyPhases: null as any }] },
    select: { name: true, storyPhases: true },
    orderBy: { name: 'asc' },
  });
  console.log(`\n已有细化剧情的角色：${chars.length} 个\n`);
  for (const c of chars) {
    const phases = c.storyPhases as string[];
    const nodeCount = phases.map(p => (p.match(/节点 P\d/g) ?? []).length);
    const total = nodeCount.reduce((a, b) => a + b, 0);
    console.log(`【${c.name}】 总节点: ${total}  各阶段: ${nodeCount.join('-')}`);
    console.log(`  P0: ${phases[0].slice(0, 180).replace(/\n/g, ' ')}...`);
    console.log('');
  }
  await prisma.$disconnect();
}
main();
