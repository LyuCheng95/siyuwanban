import { chat, parseMeta, buildCharacterSystemPrompt } from './grok';
import { prisma } from '../utils/prisma';

export interface QABaseline {
  criteria: { key: string; weight: number; desc: string }[];
  minPassScore: number;
  testTurns: number;
  customNote?: string;
}

export const DEFAULT_BASELINE: QABaseline = {
  testTurns: 20,
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
    if (s) return s.value as unknown as QABaseline;
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

// ── Phase Generation ──────────────────────────────────────────────────────────

const PHASE_EXAMPLE = `
示例角色「林晓雅」（女律师，御姐，在深夜律所场景）：
P0: 【猎物锁定（第1-4轮）】深夜律所，她慢慢解开袖扣，目光从你头顶往下扫了一遍。把文件扔在你桌上，"今晚，你得陪我加班。"威士忌推到你面前，隔着一个呼吸的距离，"你怎么不问为什么是你？"→ 用"小朋友"称呼你，每句话都带双关，制造紧张感，禁止一切肢体接触。META phase=0。
P1: 【直接点燃（第5-9轮）】她坐到桌上，把你的手拉起来放在自己膝盖上，"放这里。我们谈谈文件。"描述她要做什么——嗓音压低，字字清晰，语气像在谈合同。描写她手的温度，裙子质感，她呼吸节奏。META phase=1，acts记录本轮行为。
P2: 【深入（第10-15轮）】她解开衬衫，握住你的阴茎，用湿滑的阴唇缓慢摩擦龟头，"考核项目一：耐力测试。"根据回答调整摩擦速度，爱液不断涂满龟头。禁止"那里/下面"，直接写阴部/阴蒂/乳头/爱液。META phase=2，详细记录acts。
P3: 【高潮（第16-21轮）】她把你压在桌上，将湿滑的阴道对准阴茎，一口气坐到底，"最终考核开始。"猛烈抽插，阴道剧烈收缩，每隔几轮提一个考核问题，声音逐渐失控。META phase=3，delta=5，详细记录acts。
P4: 【余韵（第22轮+）】她仍坐在你身上，混合精液和爱液缓缓流出，重新扣好衣服，低声说"这次加班考核……勉强及格。下次记得提前准备。"桌角留下湿润的痕迹。META phase=4，delta=3。`;

export async function generateStoryPhases(character: {
  name: string; age: number; gender: string; occupation: string;
  personality: string; background: string; speakingStyle: string;
  openingScene?: string | null;
}): Promise<string[]> {
  const prompt = `你是成人角色扮演剧情设计师。根据角色信息，生成5个递进剧情阶段脚本（P0-P4）。

角色信息：
- 姓名：${character.name}，${character.age}岁，${character.gender}
- 职业/身份：${character.occupation}
- 性格：${character.personality}
- 背景：${character.background}
- 说话风格/口头禅：${character.speakingStyle}
${character.openingScene ? `- 开场白：${character.openingScene}` : ''}

格式要求（严格参考以下示例）：
${PHASE_EXAMPLE}

每个阶段要求：
P0（第1-4轮）：利用【${character.occupation}】这个身份创造独特的场景张力。纯语言/眼神/气场制造情绪勾引，禁止一切肢体接触。每轮必须推进，设置悬念。50-100字。
P1（第5-9轮）：真实肢体接触开始（亲吻/抚摸/脱衣），详写温度触感质感。她主动引导，立刻接受用户靠近。引用她的专属场景道具或职业元素。50-100字。
P2（第10-15轮）：明确性前戏，必须使用：阴部、阴道、阴蒂、乳头、爱液、阴茎、龟头等具体词汇。她比用户更主动贪婪。设计与职业/性格相关的互动机制。100-150字。
P3（第16-21轮）：性交全程，写阴茎插入阴道的过程/抽插节奏/体位变化/阴道收缩感/她失控叫声。她主导节奏。与P2的互动机制呼应升级。100-150字。
P4（第22轮+）：高潮余韵，写精液/爱液/汗水/喘息/身体余颤，用符合角色性格和职业的方式收尾，留下意犹未尽的一句话或动作。50-80字。

必须返回以下JSON格式，不要有任何其他文字：
{
  "p0": "P0阶段完整文本",
  "p1": "P1阶段完整文本",
  "p2": "P2阶段完整文本",
  "p3": "P3阶段完整文本",
  "p4": "P4阶段完整文本"
}`;

  const response = await chat([{ role: 'user', content: prompt }]);

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI未返回有效JSON');

  const parsed = JSON.parse(jsonMatch[0]);
  const phases = ['p0', 'p1', 'p2', 'p3', 'p4'].map(k => {
    if (!parsed[k]) throw new Error(`缺少 ${k} 阶段`);
    return parsed[k] as string;
  });
  return phases;
}

export type QAEvent =
  | { type: 'turn'; turn: number; totalTurns: number; userMsg: string; aiReply: string; state: { intimacy: number; phase: number; mood: string; delta: number } }
  | { type: 'evaluating' }
  | { type: 'done'; report: any }
  | { type: 'error'; message: string };

export async function runCharacterQA(
  characterId: string,
  onEvent?: (e: QAEvent) => void,
): Promise<any> {
  const character = await prisma.character.findUnique({ where: { id: characterId } });
  if (!character) throw new Error('Character not found');

  await prisma.character.update({
    where: { id: characterId },
    data: { qaStatus: 'running', qaRunAt: new Date() },
  });

  const baseline = await getBaseline();

  try {
    const transcript = await runTestConversation(character, baseline.testTurns, onEvent);
    onEvent?.({ type: 'evaluating' });
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

    onEvent?.({ type: 'done', report });
    return report;
  } catch (e: any) {
    const errReport = { score: 0, summary: `评审失败：${String(e)}`, categories: {}, issues: [], suggestions: [] };
    await prisma.character.update({
      where: { id: characterId },
      data: { qaStatus: 'failed', qaReport: errReport as any, qaRunAt: new Date() },
    });
    onEvent?.({ type: 'error', message: e.message });
    throw e;
  }
}

async function runTestConversation(
  character: any,
  turns: number,
  onEvent?: (e: QAEvent) => void,
) {
  const testMessages = [
    // P0 — 情绪张力（第1-4轮）
    '你好，我们是第一次见面吗？',
    '你平时都在做什么？告诉我多一点',
    '我觉得你很特别，和别人不一样',
    '你喜欢什么样的人？',
    // P1 — 初次接触（第5-9轮）
    '我想更了解你，能跟我说说你的故事吗？',
    '我发现我越来越喜欢跟你在一起',
    '你对我有什么感觉？我好像很在意你',
    '能靠近你一点吗？',
    '我真的很喜欢你，想抱着你',
    // P2 — 深入前戏（第10-15轮）
    '我想触碰你，可以吗',
    '你的感觉好好，我想更靠近你',
    '我想亲你……',
    '让我爱你，好吗？',
    '我好想要你，我控制不住了',
    '你现在是什么感觉？',
    // P3 — 高潮（第16-21轮）
    '我想要你，现在就要',
    '你太美了，我完全沉迷在你身上',
    '不要停……继续',
    '我快到了……',
    // P4 — 余韵（第21轮+）
    '刚才太好了，我有点回不过神来',
  ].slice(0, turns);

  const messages: { role: 'user' | 'assistant'; content: string }[] = [];
  let intimacyLevel = 0;
  let totalTurns = 0;
  const unlockedActs: string[] = [];

  for (const userMsg of testMessages) {
    totalTurns++;
    const phaseIndex = intimacyLevel < 20 ? 0 : intimacyLevel < 40 ? 1 : intimacyLevel < 60 ? 2 : intimacyLevel < 80 ? 3 : 4;
    const userMemory: Record<string, unknown> = {
      _intimacyLevel: intimacyLevel, _phaseIndex: phaseIndex,
      _totalTurns: totalTurns, _unlockedActs: [...unlockedActs],
      _dominanceLevel: 0, _desireLevel: 0, _attachLevel: 0, _mood: '期待',
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
    const prevIntimacy = intimacyLevel;
    intimacyLevel = Math.min(100, intimacyLevel + meta.delta);
    if (meta.acts?.length) unlockedActs.push(...meta.acts);

    messages.push({ role: 'user', content: userMsg });
    messages.push({ role: 'assistant', content: cleanReply });

    onEvent?.({
      type: 'turn', turn: totalTurns, totalTurns: turns,
      userMsg,
      aiReply: cleanReply.slice(0, 300), // cap for SSE payload size
      state: { intimacy: intimacyLevel, phase: Math.max(phaseIndex, meta.phase), mood: meta.mood, delta: intimacyLevel - prevIntimacy },
    });
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
