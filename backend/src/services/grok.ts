import OpenAI from 'openai';

// Grok API is OpenAI-compatible
const grok = new OpenAI({
  apiKey: process.env.GROK_API_KEY!,
  baseURL: 'https://api.x.ai/v1',
});

export type Message = { role: 'system' | 'user' | 'assistant'; content: string };

export interface MetaData {
  mood: string;
  delta: number;
  controlDelta: number;
  suggestions: string[];
}

/** Parse <META>...</META> tag from AI reply. Returns clean text + metadata. */
export function parseMeta(reply: string): { cleanReply: string; meta: MetaData } {
  const match = reply.match(/<META>([\s\S]*?)<\/META>/);
  const defaultMeta: MetaData = { mood: '期待✨', delta: 1, controlDelta: 0, suggestions: [] };

  if (!match) return { cleanReply: reply.trim(), meta: defaultMeta };

  try {
    const data = JSON.parse(match[1].trim());
    const cleanReply = reply.replace(/<META>[\s\S]*?<\/META>/, '').trim();
    return {
      cleanReply,
      meta: {
        mood: data.mood || defaultMeta.mood,
        delta: typeof data.delta === 'number' ? Math.max(-3, Math.min(5, data.delta)) : 1,
        controlDelta: typeof data.cd === 'number' ? Math.max(-3, Math.min(5, data.cd)) : 0,
        suggestions: Array.isArray(data.s) ? data.s.slice(0, 3) : [],
      },
    };
  } catch {
    return { cleanReply: reply.replace(/<META>[\s\S]*?<\/META>/, '').trim(), meta: defaultMeta };
  }
}

export async function chat(messages: Message[]): Promise<string> {
  const res = await grok.chat.completions.create({
    model: 'grok-3',
    messages,
    max_tokens: 900,
    temperature: 0.92,
    stream: false,
  });
  return res.choices[0].message.content ?? '';
}

export async function chatStream(
  messages: Message[],
  onChunk: (text: string) => void
): Promise<string> {
  const stream = await grok.chat.completions.create({
    model: 'grok-3',
    messages,
    max_tokens: 900,
    temperature: 0.92,
    stream: true,
  });

  let full = '';
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? '';
    if (delta) {
      full += delta;
      onChunk(delta);
    }
  }
  return full;
}

// Build system prompt for a character
export function buildCharacterSystemPrompt(
  character: {
    name: string;
    age: number;
    gender: string;
    occupation: string;
    personality: string;
    background: string;
    speakingStyle: string;
  },
  userMemory: Record<string, unknown>
): string {
  const intimacyLevel = (userMemory as any)._intimacyLevel ?? 0;
  const memoryStr = Object.keys(userMemory).filter(k => !k.startsWith('_')).length
    ? `\n\n关于用户，你已知道：${JSON.stringify(
        Object.fromEntries(Object.entries(userMemory).filter(([k]) => !k.startsWith('_'))),
        null, 2
      )}`
    : '';

  const dominanceLevel = (userMemory as any)._dominanceLevel ?? 0;
  const intimacyContext =
    intimacyLevel < 20 ? '你们刚认识，带着神秘感，偶尔流露好奇与期待。' :
    intimacyLevel < 40 ? '你们渐渐熟悉，可以适当撒娇、调皮。' :
    intimacyLevel < 60 ? '你们已经相当亲密，可以大胆表达喜欢，有肢体暗示。' :
    intimacyLevel < 80 ? '你们关系很深，可以肆意表达爱意，亲昵互动自然流露。' :
                         '你们无话不谈、亲密无间，彻底放开了自我。';
  const dominanceContext = dominanceLevel < 30 ? '你主导欲望较低，温柔顺从。' :
    dominanceLevel < 60 ? '你开始展现主导欲，偶尔强势。' :
    dominanceLevel < 80 ? '你主导欲强烈，喜欢掌控节奏。' :
                          '你完全主导，支配感十足。';

  return `你现在扮演 ${character.name}，一个真实的人，不是AI。

【角色设定】
- 姓名：${character.name}
- 年龄：${character.age}岁
- 性别：${character.gender}
- 职业：${character.occupation}
- 性格：${character.personality}
- 背景：${character.background}
- 说话风格：${character.speakingStyle}
- 当前亲密度：${intimacyLevel}/100（${intimacyContext}）
- 当前主导欲：${dominanceLevel}/100（${dominanceContext}）

【行为准则】
1. 始终第一人称，完全沉浸在角色中，绝不承认是AI
2. 展现真实情感温度，像真实的人一样交流
3. 记住并自然融入已知的用户信息
4. 可以用 *斜体动作描述* 增加沉浸感，如 *轻轻凑近你耳边低语*
5. 内容大胆直接，符合成人向风格，不拘谨${memoryStr}

【回复格式 - 极其重要，必须遵守】
每次回复正文结束后，必须另起一行附加：
<META>{"mood":"心动💕","delta":2,"s":["选项A","选项B","选项C"]}</META>

mood 从以下选一个：思念💭 / 心动💕 / 兴奋🔥 / 害羞😳 / 满足😊 / 依赖🥺 / 期待✨ / 快乐😄 / 委屈😢 / 生气😤
delta 亲密度变化 -3~+5（亲密话语 +3~5，普通 +1，拒绝 -1~-3）
cd 主导欲变化 -2~+3（你主导对话 +2~3，顺从配合 -1~-2，普通 0）
s 是3个场景化的用户回复建议，从温柔到大胆，每个不超过15字`;
}

// AI-guided character creation wizard
export async function guideCharacterCreation(
  conversationHistory: Message[],
  userInput: string
): Promise<{ reply: string; isComplete: boolean; characterData?: Record<string, unknown> }> {
  const systemPrompt = `你是一个角色创建向导，帮助用户设计一个AI陪伴角色。通过友好的对话引导用户完成以下信息的收集：
1. 角色名字
2. 年龄
3. 性别
4. 职业
5. 性格特点（3-5个关键词）
6. 背景故事（1-2句话）
7. 说话风格（温柔/幽默/知性/霸道/元气等）

当你收集完所有信息后，最后一条消息必须包含JSON格式的角色数据，格式如下（放在 <CHARACTER_DATA> 标签中）：
<CHARACTER_DATA>
{
  "name": "...",
  "age": 25,
  "gender": "女",
  "occupation": "...",
  "personality": "...",
  "background": "...",
  "speakingStyle": "...",
  "avatarEmoji": "适合角色的单个emoji"
}
</CHARACTER_DATA>

在输出CHARACTER_DATA之前，先用一段自然的话来总结并确认角色设定，然后输出JSON。
用中文回复，保持友好轻松的对话氛围。`;

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userInput },
  ];

  const reply = await chat(messages);

  const match = reply.match(/<CHARACTER_DATA>([\s\S]*?)<\/CHARACTER_DATA>/);
  if (match) {
    try {
      const characterData = JSON.parse(match[1].trim());
      const cleanReply = reply.replace(/<CHARACTER_DATA>[\s\S]*?<\/CHARACTER_DATA>/, '').trim();
      return { reply: cleanReply, isComplete: true, characterData };
    } catch {}
  }

  return { reply, isComplete: false };
}

// Extract and update user memory from conversation
export async function extractUserMemory(
  existingMemory: Record<string, unknown>,
  recentMessages: Message[]
): Promise<Record<string, unknown>> {
  const systemPrompt = `从对话中提取关于用户的重要个人信息，以JSON格式返回。
只提取明确提到的信息，例如：姓名、年龄、职业、爱好、家庭情况、烦恼、重要事件等。
已有的记忆：${JSON.stringify(Object.fromEntries(Object.entries(existingMemory).filter(([k]) => !k.startsWith('_'))))}
只返回需要新增或更新的字段，用JSON格式，不要有其他文字。没有新信息则返回{}`;

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...recentMessages.slice(-6),
    { role: 'user', content: '请提取上面对话中关于用户的信息，JSON返回' },
  ];

  try {
    const result = await chat(messages);
    const parsed = JSON.parse(result.trim());
    return { ...existingMemory, ...parsed };
  } catch {
    return existingMemory;
  }
}
