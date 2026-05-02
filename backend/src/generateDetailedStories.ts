/**
 * generateDetailedStories.ts
 *
 * 把每个角色现有的 5 段粗略剧情脚本，发给 Grok，重写成
 * 更细粒度的节点版本（每节点 1-2 轮对话）。
 * 生成结果直接写入 DB 的 character.storyPhases 字段。
 *
 * 用法：
 *   npx tsx src/generateDetailedStories.ts          # 处理所有角色
 *   npx tsx src/generateDetailedStories.ts 椎名老师  # 只处理指定角色
 *   npx tsx src/generateDetailedStories.ts --dry     # 只打印不写 DB
 */

import OpenAI from 'openai';
import { prisma } from './utils/prisma';
import { STORY_PHASES } from './services/storyPhases';
import { CHARACTER_SPEECH_HABITS } from './services/characterScripts';
import * as dotenv from 'dotenv';
dotenv.config();

const grok = new OpenAI({
  apiKey: process.env.GROK_API_KEY!,
  baseURL: 'https://api.x.ai/v1',
});

const args = process.argv.slice(2);
const dryRun = args.includes('--dry');
const targetName = args.filter(a => a !== '--dry')[0];

// ── 故事重写 prompt ─────────────────────────────────────────────────────────
function buildRewritePrompt(char: {
  name: string;
  age: number;
  occupation: string;
  personality: string;
  speakingStyle: string;
  background: string;
}, currentPhases: string[]): string {
  const habits = CHARACTER_SPEECH_HABITS[char.name] ?? '（无特殊口癖）';

  const phaseNames = ['P0·开场', 'P1·点燃', 'P2·深入', 'P3·高潮', 'P4·余韵'];

  const phasesText = currentPhases.map((p, i) =>
    `=== 【${phaseNames[i] ?? `P${i}`}】原始版本 ===\n${p.trim()}`
  ).join('\n\n');

  return `你是专业的互动成人剧情编剧，正在为一个 AI 角色扮演应用优化故事脚本。

## 角色信息
- 姓名：${char.name}，${char.age}岁，${char.occupation}
- 性格：${char.personality}
- 背景：${char.background}
- 说话风格：${char.speakingStyle}
- 口癖：${habits}

## 当前 5 阶段故事（需要优化）
${phasesText}

---

## 你的任务

把上面 5 个阶段（P0-P4）分别重写为【更细粒度的节点版本】。

**核心要求：**
- 每个阶段拆分成 **2-4 个子节点**，每个子节点对应 **1-2 轮对话**
- 每个子节点有独特的**场景变化 / 推进触发点 / 新的行为**，绝不与前后节点重复
- 节点内要有**具体的台词方向**（角色会说/做什么），而不只是笼统指令
- **保留角色口癖和性格**，每个节点都能读出这是这个角色特有的风格
- P0 节点：**纯眼神/语言张力**，零肢体接触，但每个节点营造感不同
- P1 节点：**肢体接触必须发生**，描写具体的温度/质感/她的呼吸变化
- P2 节点：**直接用具体部位名称**（阴部/乳头/阴茎等），写前戏细节和湿润程度
- P3 节点：**写性交**，不同节点切换体位，写阴道收缩/爱液声/她的叫声变化
- P4 节点：**高潮余韵**，写精液流出/喘息/依偎，然后欲望重燃的伏笔
- 每个节点末尾有一个**勾住用户的悬念或未完成动作**

**节点格式（严格遵守）：**

\`\`\`
【节点 P0-1 · 标题（第1-2轮）】
场景锚点：[具体在哪里、发生了什么事、她的状态]
本节核心：[这1-2轮的主要张力或推进]
她的开场行为/台词方向：[具体描写，包含肢体语言和说话方式]
感官细节（必须有）：[气味/温度/声音/视觉中至少2种]
节点收尾悬念：[用什么行为或台词让用户无法停下来]
META提示：phase=0，delta范围X~X
\`\`\`

用同样格式写完所有 P0-P4 的全部子节点。

## 输出格式

用以下分隔符包裹每个大阶段的完整内容：

<PHASE_0>
[P0 的所有子节点，合并成一个完整文本块]
</PHASE_0>

<PHASE_1>
[P1 的所有子节点]
</PHASE_1>

<PHASE_2>
[P2 的所有子节点]
</PHASE_2>

<PHASE_3>
[P3 的所有子节点]
</PHASE_3>

<PHASE_4>
[P4 的所有子节点]
</PHASE_4>

每个阶段内部，子节点之间用空行分隔即可。节点越具体越好。`;
}

// ── 解析 Grok 输出 ───────────────────────────────────────────────────────────
function parsePhases(output: string): string[] | null {
  const result: string[] = [];
  for (let i = 0; i < 5; i++) {
    const match = output.match(new RegExp(`<PHASE_${i}>([\\s\\S]*?)</PHASE_${i}>`));
    if (!match) {
      console.error(`  ✗ 缺少 PHASE_${i} 标签`);
      return null;
    }
    result.push(match[1].trim());
  }
  return result;
}

// ── 单个角色处理 ─────────────────────────────────────────────────────────────
async function processCharacter(name: string, char: {
  id: string;
  name: string;
  age: number;
  occupation: string;
  personality: string;
  speakingStyle: string;
  background: string;
}) {
  const currentPhases = (STORY_PHASES as any)[name];
  if (!currentPhases) {
    console.log(`  ⚠ ${name}: 无 hardcoded 剧情，跳过`);
    return;
  }

  console.log(`\n🖊  处理角色：${name}`);
  const prompt = buildRewritePrompt(char, currentPhases);

  let output: string;
  try {
    const res = await grok.chat.completions.create({
      model: 'grok-3',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.85,
    });
    output = res.choices[0].message.content ?? '';
  } catch (e: any) {
    console.error(`  ✗ Grok API 错误：${e.message}`);
    return;
  }

  const phases = parsePhases(output);
  if (!phases) {
    console.error(`  ✗ 解析失败，跳过写入`);
    console.log('--- 原始输出 ---\n', output.slice(0, 500));
    return;
  }

  console.log(`  ✓ 解析成功，5个阶段，总长度 ${phases.reduce((a, p) => a + p.length, 0)} 字`);
  phases.forEach((p, i) => {
    const nodes = (p.match(/【节点 P\d/g) ?? []).length;
    console.log(`    P${i}: ${nodes} 个节点，${p.length} 字`);
  });

  if (dryRun) {
    console.log('\n--- DRY RUN: 不写入 DB ---');
    phases.forEach((p, i) => {
      console.log(`\n=== PHASE ${i} ===`);
      console.log(p.slice(0, 400) + (p.length > 400 ? '...' : ''));
    });
    return;
  }

  await prisma.character.update({
    where: { id: char.id },
    data: { storyPhases: phases as any },
  });
  console.log(`  ✓ 已写入数据库`);
}

// ── 主流程 ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 generateDetailedStories 启动');
  if (dryRun) console.log('   模式：DRY RUN（不写入数据库）');
  if (targetName) console.log(`   目标角色：${targetName}`);

  // 获取所有有 hardcoded 故事的角色
  const characterNames = targetName
    ? [targetName]
    : Object.keys(STORY_PHASES);

  console.log(`   处理角色数：${characterNames.length}`);

  // dry run 时允许用假 ID，跳过 DB 连接
  let charMap: Record<string, { id: string; name: string; age: number; occupation: string; personality: string; speakingStyle: string; background: string }>;
  if (dryRun) {
    const chars = await prisma.character.findMany({
      where: { name: { in: characterNames } },
      select: { id: true, name: true, age: true, occupation: true, personality: true, speakingStyle: true, background: true },
    }).catch(() => [] as any[]);
    charMap = Object.fromEntries(chars.map((c: any) => [c.name, c]));
    // 对于 dry run，缺失的角色用 fallback 数据
    for (const name of characterNames) {
      if (!charMap[name]) {
        charMap[name] = { id: 'dry-run-id', name, age: 25, occupation: '未知', personality: '未知', speakingStyle: '未知', background: '未知' };
      }
    }
  } else {
    const chars = await prisma.character.findMany({
      where: { name: { in: characterNames } },
      select: { id: true, name: true, age: true, occupation: true, personality: true, speakingStyle: true, background: true },
    });
    charMap = Object.fromEntries(chars.map(c => [c.name, c]));
  }

  let success = 0, fail = 0;
  for (const name of characterNames) {
    const char = charMap[name];
    if (!char) {
      console.log(`  ⚠ 数据库中找不到角色：${name}，跳过`);
      fail++;
      continue;
    }
    try {
      await processCharacter(name, char);
      success++;
      // 避免 API 限速
      await new Promise(r => setTimeout(r, 2000));
    } catch (e: any) {
      console.error(`  ✗ ${name} 处理失败：${e.message}`);
      fail++;
    }
  }

  console.log(`\n✅ 完成。成功：${success}，失败：${fail}`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
