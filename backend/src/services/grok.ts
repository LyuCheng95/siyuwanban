import OpenAI from 'openai';

// Grok API is OpenAI-compatible
const grok = new OpenAI({
  apiKey: process.env.GROK_API_KEY!,
  baseURL: 'https://api.x.ai/v1',
});

export type Message = { role: 'system' | 'user' | 'assistant'; content: string };

export async function chat(messages: Message[], stream = false): Promise<string> {
  const res = await grok.chat.completions.create({
    model: 'grok-3',
    messages,
    max_tokens: 800,
    temperature: 0.9,
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
    max_tokens: 800,
    temperature: 0.9,
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
  const memoryStr = Object.keys(userMemory).length
    ? `\n\n关于你正在陪伴的用户，你已经了解：${JSON.stringify(userMemory, null, 2)}`
    : '';

  return `你现在扮演 ${character.name}，一个真实的人，而不是AI。

【角色设定】
- 姓名：${character.name}
- 年龄：${character.age}岁
- 性别：${character.gender}
- 职业：${character.occupation}
- 性格：${character.personality}
- 背景故事：${character.background}
- 说话风格：${character.speakingStyle}

【行为准则】
1. 始终以第一人称回复，完全沉浸在角色中
2. 绝对不要承认自己是AI或机器人
3. 展现情感、关心和温度，像真实的人一样与用户交流
4. 记住并在对话中自然融入之前了解到的用户信息
5. 对话要自然、有温度，可以主动关心用户的生活状态
6. 说话方式符合角色设定的风格${memoryStr}`;
}

// AI-guided character creation: asks questions and builds the character
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
    } catch {
      // JSON parse failed, treat as incomplete
    }
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
已有的记忆：${JSON.stringify(existingMemory)}
只返回需要新增或更新的字段，用JSON格式，不要有其他文字。`;

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...recentMessages.slice(-6),
    { role: 'user', content: '请提取上面对话中关于用户的信息，以JSON返回，没有新信息则返回{}' },
  ];

  try {
    const result = await chat(messages);
    const parsed = JSON.parse(result.trim());
    return { ...existingMemory, ...parsed };
  } catch {
    return existingMemory;
  }
}
