/**
 * 为所有预设角色写入独特的面部特征 + 身高体重
 * 运行：tsx src/seedPhysical.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Each entry: distinctive facial features in ComfyUI-ready English + height/weight
// Designed to be genuinely different — different eye shapes, jaw lines, face shapes, skin tones
const PHYSICAL: Record<string, { height: number; weight: number; faceFeatures: string }> = {

  // ── 写实角色 ───────────────────────────────────────────────────────────────────

  '椎名老师': {
    height: 157, weight: 44,
    faceFeatures: 'round soft face, heavy-lidded single eyelids, downturned gentle wide-set eyes, soft button nose, small closed lips, milky porcelain skin, tiny beauty mark under left eye, natural light brows, (round cheeks:1.2)',
  },

  '晓彤': {
    height: 163, weight: 53,
    faceFeatures: '(peach-blossom droopy eye corners:1.3), compact sharp jawline, defined high cheekbones, straight assertive nose, full lower lip, warm golden-fair skin, strong arched brows, no excess fat on face',
  },

  '娜娜': {
    height: 155, weight: 42,
    faceFeatures: '(heart-shaped face:1.2), large wide-set double-eyelid eyes, (baby-fat cheeks:1.2), tiny upturned nose, plush round lips, smooth pale white skin, innocent wide-eyed gaze, soft thin brows',
  },

  '小雨': {
    height: 160, weight: 46,
    faceFeatures: 'round oval face, (large innocent doe eyes:1.3) single lid, soft unfocused gaze, soft rounded nose, plump natural lips with slight pout, cream white skin, light natural brows, slightly flushed cheeks',
  },

  '琉璃': {
    height: 161, weight: 47,
    faceFeatures: 'precise oval face, (narrow single-lid analytical eyes:1.2), sharp intelligent straight brows, slender straight nose bridge, thin composed lips, cool ivory skin, no smile lines, calm reserved expression',
  },

  '沈静': {
    height: 178, weight: 56,
    faceFeatures: '(angular face sharp prominent cheekbones:1.3), deep-set double eyelids, (eye corners tilted sharply upward:1.3), defined razor jawline, aquiline high nose bridge, thin cold lips, cool ivory skin, hollow temples',
  },

  '小慧': {
    height: 159, weight: 47,
    faceFeatures: '(egg-shaped face:1.2), gentle droopy single eyelids, (warm soft puppy-dog gaze:1.2), small round nose tip, naturally full lips with defined cupid bow, warm peachy-fair skin, soft rounded chin, kind expression',
  },

  '夜玲': {
    height: 162, weight: 48,
    faceFeatures: '(sharp pointed chin:1.3), angular V-face, (heavy smoky almond eyes:1.2), hollow high cheekbones, dark plum natural lip color, pale cold-white skin, sharp arched dark brows, slight under-eye shadow',
  },

  '晴晴': {
    height: 158, weight: 46,
    faceFeatures: '(round apple cheeks:1.3), bright double-eyelid crescent smile-eyes, (prominent dimples both cheeks:1.3), small slightly upturned nose, full lower lip natural pout, rosy healthy warm skin, playful arched brows',
  },

  '唐诗': {
    height: 163, weight: 49,
    faceFeatures: '(classical oval face:1.2), (long narrow phoenix eyes single lid:1.3), elegant refined arched brows, perfectly straight narrow nose, thin composed lips defined cupid bow, jade-white porcelain skin, dignified bearing',
  },

  '阿柒': {
    height: 160, weight: 47,
    faceFeatures: '(soft round face:1.2), warm crescent eyes that curve into crescents when smiling, relaxed gentle brows, soft round nose tip, (naturally full warm lips:1.2), peachy fair skin, scattered faint freckles across nose bridge',
  },

  '糖糖': {
    height: 157, weight: 45,
    faceFeatures: '(round chubby-cheeked apple face:1.2), big bright double-lid eyes, (prominent dimples both cheeks:1.4), round soft nose, full pouty lips, rosy warm fair skin, short round chin, perpetually cheerful expression',
  },

  // ── 二次元角色 ─────────────────────────────────────────────────────────────────

  'X-23': {
    height: 165, weight: 50,
    faceFeatures: '(perfect synthetic face cold and precise:1.2), (glowing electric-blue circuit-pattern irises:1.4), platinum white short hair, sharp cheekbones, expressionless composed android features, faint circuit-line tattoos at temples',
  },

  '幻音': {
    height: 162, weight: 48,
    faceFeatures: '(hauntingly beautiful ethereal face:1.2), (shifting prismatic holographic iris color:1.3), long translucent lashes, delicate features that seem slightly out of focus, faint light glow under skin, perfectly symmetrical',
  },

  '狐九': {
    height: 165, weight: 51,
    faceFeatures: '(glowing amber-gold slit fox pupils:1.4), (silver fox ears perked atop head:1.3), long silver-white flowing hair, ethereal aristocratic oval face, high elegant cheekbones, soft mysterious smile, ageless supernatural beauty',
  },

  '冷霜': {
    height: 163, weight: 49,
    faceFeatures: '(pale blue glowing ice-crystal eyes:1.4), silver-blue long hair with ice ornaments, coldly beautiful sharp features, (frost-white luminous skin:1.3), aloof expression, refined high nose bridge, thin pale lips, ice-crystal brows',
  },

  '魅罗': {
    height: 164, weight: 50,
    faceFeatures: '(crimson vertical-slit glowing eyes:1.4), (small elegant curved horns:1.3), dark purple flowing hair, devastatingly beautiful evil face, high sharp cheekbones, dark plum lips always curved in slight smirk, ivory skin with faint dark veins at temples',
  },

  '桃桃': {
    height: 155, weight: 44,
    faceFeatures: '(big sparkling round double-lid eyes:1.4), (pink twin tails:1.3), (adorable prominent dimples:1.3), small upturned nose, plump heart-shaped lips, flawless white skin with rosy flush, perpetually innocent bright expression',
  },

  // 林晚卿（如果存在）
  '林晚卿': {
    height: 162, weight: 48,
    faceFeatures: 'delicate oval face, (soft single-lid willow-leaf eyes:1.2), gentle downturned gaze, refined straight nose, naturally red lips slightly parted, translucent fair skin, graceful composed bearing',
  },
};

async function main() {
  let updated = 0;
  for (const [name, data] of Object.entries(PHYSICAL)) {
    const char = await prisma.character.findFirst({ where: { name } });
    if (!char) {
      console.log(`  ⚠️  未找到：${name}`);
      continue;
    }
    await prisma.character.update({
      where: { id: char.id },
      data,
    });
    console.log(`  ✅  ${name}  ${data.height}cm/${data.weight}kg`);
    updated++;
  }
  console.log(`\n✨ 完成，更新了 ${updated} 个角色`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
