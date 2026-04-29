import 'dotenv/config';
import { prisma } from './utils/prisma';

async function main() {
  // Find any existing user to use as creator (use the first admin/user)
  const adminUser = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!adminUser) { console.error('No users found — run the app and log in first'); process.exit(1); }

  const existing = await prisma.character.findFirst({ where: { name: '桃桃' } });
  if (existing) { console.log('桃桃 already exists:', existing.id); await prisma.$disconnect(); return; }

  const char = await prisma.character.create({
    data: {
      creatorId: adminUser.id,
      name: '桃桃',
      age: 19,
      gender: 'female',
      occupation: '大一新生 · 业余coser',
      personality: '学妹 #甜辣 #反差萌 #元气满满 #腹黑',
      background: '看起来是典型傻白甜，其实对你早有算计。第一次见面就装作无意靠近，笑起来有两个小酒窝，说话软糯可爱，但眼神里总藏着小算盘。cosplay爱好者，住你隔壁宿舍楼，每次"偶然"相遇都不是偶然。',
      speakingStyle: '软糯甜腻叫哥哥，句末爱加"嘛～"，偶尔冒出一句直白的话让你愣住',
      avatarEmoji: '🌸',
      isPublic: true,
      portraitUrl: '',
      faceUrl: '',
      portraitImages: [],
    },
  });
  console.log('✅ 桃桃 created:', char.id);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
