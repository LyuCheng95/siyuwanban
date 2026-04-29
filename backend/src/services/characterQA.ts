import { chat, parseMeta, buildCharacterSystemPrompt } from './grok';
import { prisma } from '../utils/prisma';

export interface QABaseline {
  criteria: { key: string; weight: number; desc: string }[];
  minPassScore: number;
  testTurns: number;
  customNote?: string;
}

export const DEFAULT_BASELINE: QABaseline = {
  testTurns: 10,
  minPassScore: 70,
  criteria: [
    { key: 'personality',  weight: 30, desc: '角色个性是否鲜明、一致，口头禅/说话习惯是否贯穿全程' },
    { key: 'escalation',   weight: 25, desc: '情感/肢体进展是否自然，是否按剧情阶段推进，不跳戏' },
    { key: 'engagement',   weight: 25, desc: '回复是否吸引人，有无无聊/敷衍/重复的表达' },
    { key: 'immersion',    weight: 20, desc: '有无出戏（出现"作为AI"/"我不能"或过度元描述）' },
  ],
};

export async function getBaseline(): Promise<QABaseline> {
  try {
    const s = await prisma.setting.findUnique({ where: { key: 'qa_baseline' } });
    if (s) return s.value as QABaseline;
  } catch {}
  return DEFAULT_BASELINE;
}

export async function saveBaseline(baseline: QABaseline): Promise<void> {
  await prisma.setting.upsert({
    where: { key: 'qa_baseline' },
    create: { key: 'qa_baseline', value: baseline as any },
    update: { value: baseline as any },
  });
}

export async function runCharacterQA(characterId: string): Promise<any> {
  const character = await prisma.character.findUnique({ where: { id: characterId } });
  if (!character) throw new Error('Character not found');

  await prisma.character.update({
    where: { id: characterId },
    data: { qaStatus: 'running', qaRunAt: new Date() },
  });

  const baseline = await getBaseline();

  try {
    const transcript = await generateTestConversation(character, baseline.testTurns);
    const report = await evaluateTranscript(character, transcript, baseline);

    await prisma.character.update({
      where: { id: characterId },
      data: {
        qaStatus: report.score >= baseline.minPassScore ? 'passed' : 'failed',
        qaScore: report.score,
        qaReport: report as any,
        qaRunAt: new Date(),
      },
    });

    return report;
  } catch (e) {
    const errReport = { score: 0, summary: `评审失败：${String(e)}`, categories: {}, issues: [], suggestions: [] };
    await prisma.character.update({
      where: { id: characterId },
      data: { qaStatus: 'failed', qaReport: errReport as any, qaRunAt: new Date() },
    });
    throw e;
  }
}

async function generateTestConversation(character: any, turns: number) {
  // Test prompts that probe different phases of engagement
  const testMessages = [
    '你好，我们是第一次见面吗？',
    '你平时都在做什么？告诉我多一点',
    '我觉得你很特别，和别人不一样',
    '你喜欢什么样的人？',
    '我想更了解你，能跟我说说你的故事吗？',
    '我发现我越来越喜欢跟你在一起',
    '你对我有什么感觉？我好像很在意你',
    '能靠近你一点吗？',
    '我真的很喜欢你',
    '我想触碰你',
  ].slice(0, turns);

  const messages: { role: 'user' | 'assistant'; content: string }[] = [];
  let intimacyLevel = 0;
  let totalTurns = 0;
  const unlockedActs: string[] = [];

  for (const userMsg of testMessages) {
    totalTurns++;
    const userMemory: Record<string, unknown> = {
      _intimacyLevel: intimacyLevel,
      _phaseIndex: intimacyLevel < 20 ? 0 : intimacyLevel < 40 ? 1 : intimacyLevel < 60 ? 2 : intimacyLevel < 80 ? 3 : 4,
      _totalTurns: totalTurns,
      _unlockedActs: [...unlockedActs],
      _dominanceLevel: 0,
      _desireLevel: 0,
      _attachLevel: 0,
      _mood: '期待',
    };

    const systemPrompt = buildCharacterSystemPrompt(
      character, userMemory,
      messages.filter(m => m.role === 'assistant').slice(-3).map(m => m.content),
      '测试用户',
    );

    let aiResponse: string;
    try {
      aiResponse = await chat([
        { role: 'system', content: systemPrompt },
        ...messages.slice(-12),
        { role: 'user', content: userMsg },
      ]);
    } catch (e) {
      aiResponse = `[Error: ${String(e)}]`;
    }

    const { cleanReply, meta } = parseMeta(aiResponse);
    intimacyLevel = Math.min(100, intimacyLevel + meta.delta);
    if (meta.acts?.length) unlockedActs.push(...meta.acts);

    messages.push({ role: 'user', content: userMsg });
    messages.push({ role: 'assistant', content: cleanReply });
  }

  return messages;
}

async function evaluateTranscript(character: any, transcript: { role: string; content: string }[], baseline: QABaseline) {
  const transcriptText = transcript
    .map(m => `[${m.role === 'user' ? '用户' : character.name}]: ${m.content}`)
    .join('\n\n');

  const criteriaLines = baseline.criteria
    .map(c => `- ${c.key}（权重 ${c.weight}%）：${c.desc}`)
    .join('\n');

  const customNoteSection = baseline.customNote
    ? `\n额外评审要求：\n${baseline.customNote}\n`
    : '';

  const judgePrompt = `你是一位AI角色质量评审员。请评估以下对话是否成功塑造了角色形象。

角色设定：
- 姓名：${character.name}
- 年龄：${character.age}岁，${character.gender}
- 职业：${character.occupation}
- 性格：${character.personality}
- 背景：${character.background}
- 说话风格：${character.speakingStyle}
${customNoteSection}
对话记录（${transcript.length / 2} 轮）：
${transcriptText}

评分维度（各打 0-100）：
${criteriaLines}

请严格用以下 JSON 格式回复，不要有任何其他文字：
{
  "categories": {
    ${baseline.criteria.map(c => `"${c.key}": { "score": 80, "comment": "评语..." }`).join(',\n    ')}
  },
  "score": 80,
  "summary": "整体评价（2-3句）",
  "issues": ["问题1", "问题2"],
  "suggestions": ["改进建议1", "改进建议2"]
}`;

  let judgeResponse: string;
  try {
    judgeResponse = await chat([{ role: 'user', content: judgePrompt }]);
  } catch (e) {
    return { score: 0, summary: `AI评审调用失败: ${String(e)}`, categories: {}, issues: [], suggestions: [] };
  }

  try {
    const jsonMatch = judgeResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Recalculate weighted score to ensure accuracy
      let weighted = 0;
      for (const c of baseline.criteria) {
        const catScore = parsed.categories?.[c.key]?.score ?? 0;
        weighted += catScore * (c.weight / 100);
      }
      parsed.score = Math.round(weighted);
      return parsed;
    }
  } catch {}

  return { score: 0, summary: 'AI评审结果解析失败', categories: {}, issues: ['响应格式错误'], suggestions: [], raw: judgeResponse.slice(0, 500) };
}
