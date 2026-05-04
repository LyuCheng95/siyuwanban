import { chat } from './grok';

export type ImageModel = 'leosam' | 'jugger' | 'noob' | 'pony';

export const MODEL_FILES: Record<ImageModel, string> = {
  leosam: 'leosamsHelloworldXL_helloworldXL70.safetensors',
  jugger: 'juggernautXL_juggXIByRundiffusion.safetensors',
  noob:   'noobaiXLNAIXL_epsilonPred11Version.safetensors',
  pony:   'ponyDiffusionV6XL_v6StartWithThisOne.safetensors',
};

export interface CharacterForPrompt {
  name: string;
  age: number;
  gender: string;
  occupation: string;
  personality: string;
  background: string;
  speakingStyle: string;
  imageModel?: string | null;
  height?: number | null;
  weight?: number | null;
  faceFeatures?: string | null;
}

// Decide which model to use for a character
export function resolveModel(character: CharacterForPrompt): ImageModel {
  if (character.imageModel && character.imageModel in MODEL_FILES) {
    return character.imageModel as ImageModel;
  }
  // Auto-detect from occupation/personality keywords
  const text = `${character.occupation} ${character.personality} ${character.background}`.toLowerCase();
  if (/二次元|动漫|动画|猫耳|狐耳|妖|仙|机器人|ai|虚拟|全息|赛博|android|robot|virtual/.test(text)) {
    return 'noob';
  }
  if (/超模|模特|model|健身|运动员|athlete/.test(text)) {
    return 'jugger';
  }
  return 'leosam';
}

const STYLE_GUIDE: Record<ImageModel, string> = {
  leosam: '写实风格（细腻白瘦幼，日系或中式青春感），适用于学生/职员/普通女性角色',
  jugger: '写实风格（高端写真，御姐/运动/超模气质），适用于成熟职业女性或运动系角色',
  noob:   '二次元 Illustrious 风格（动漫/妖魔/科幻/仙侠），使用 masterpiece/amazing quality 前缀，不用 score_ 标签',
  pony:   '甜系动漫 Pony 风格，使用 score_9/score_8_up 前缀',
};

const REAL_PORTRAIT_EXAMPLE = `
示例（晓彤，健身教练，MODEL_JUGGER）：
[
  "1girl, 22yo chinese gym trainer, 163cm firm athletic 53kg, peach-blossom eyes, jet black hair high ponytail, (skintight sports bra very low cut:1.4) and high-waist bike shorts, leaning against mirrored gym wall arms overhead (toned underarms visible:1.3), sweaty skin, fluorescent gym light, confident smirk",
  "1girl, 22yo chinese woman, 163cm toned 53kg, peach-blossom eyes, black hair loose, (crop athletic jacket unzipped showing sports bra:1.3) and high-cut gym shorts, sitting on weight bench leaning forward, golden hour gym light, teasing inviting smirk",
  "1girl, 22yo chinese woman, 163cm toned 53kg, peach-blossom eyes sultry, black hair down, (midriff-baring deep-V crop top:1.3), arching back stretch studio mirror, powerful seductive energy"
]`;

const ANIME_PORTRAIT_EXAMPLE = `
示例（狐九，九尾狐，MODEL_NOOB）：
[
  "1girl, fox girl, (nine white fluffy tails:1.4), (fox ears:1.3), silver-white long flowing hair, glowing amber eyes, (white hanfu robes partially open:1.3), forest moonlight background, ethereal seductive expression, soft magical glow",
  "1girl, fox girl, (fox ears:1.3), silver-white disheveled hair, amber glowing eyes, (flowing white robe slipping off shoulder:1.3), sitting on ancient shrine steps, lantern light, mysterious ancient beauty",
  "1girl, fox girl, (nine tails swirling:1.3), silver-white hair flowing, glowing amber eyes half-lidded, (white robes wide open:1.3), lying on cherry blossom petals, ethereal night atmosphere, alluring ancient spirit"
]`;

export async function generatePortraitPrompts(character: CharacterForPrompt): Promise<string[]> {
  const model = resolveModel(character);
  const styleGuide = STYLE_GUIDE[model];
  const isAnime = model === 'noob' || model === 'pony';
  const example = isAnime ? ANIME_PORTRAIT_EXAMPLE : REAL_PORTRAIT_EXAMPLE;

  const physicalLine = character.faceFeatures
    ? `- 面部/体貌：${character.faceFeatures}` + (character.height ? `\n- 身材：${character.height}cm / ${character.weight ?? '?'}kg` : '')
    : character.height
      ? `- 身材：${character.height}cm / ${character.weight ?? '?'}kg`
      : '';

  const prompt = `你是专业的 AI 图片 prompt 工程师，专门为 ComfyUI 的 ${model === 'jugger' ? 'Juggernaut XL' : model === 'leosam' ? 'LEOSAM HelloWorld XL' : model === 'noob' ? 'NoobAI XL (Illustrious)' : 'Pony Diffusion V6 XL'} 模型写写真集 prompt。

【角色信息】
- 姓名：${character.name}，${character.age}岁，${character.gender}
- 职业：${character.occupation}
- 性格：${character.personality}
- 背景：${character.background}
- 说话风格：${character.speakingStyle}${physicalLine ? '\n' + physicalLine : ''}

【模型风格要求】
${styleGuide}

【任务】
写3张不同风格的写真集 prompt，要求：
1. 每张都有独特的服装/姿势/场景/光线，体现角色职业和个性
2. 服装：与职业强相关，性感但不过分（封面图标准，不露骨）
3. 姿势：多样（坐/站/倚/躺各一，或根据职业设计）
4. 场景：与职业/背景强相关的真实场景
5. 表情：体现角色性格（御姐冷艳/学妹活泼/职场专业感等）
6. ${isAnime ? '使用二次元风格描述，不加 photorealistic/RAW photo 前缀' : '用英文写实 prompt，结构：人物特征 + 服装 + 姿势 + 场景 + 光线 + 表情'}
7. 面部特征必须从【角色信息】里的面部/体貌直接提取并原样写进 prompt，禁止用 beautiful face / perfect face 等泛化词替代
7. 不要出现露骨裸露（这是封面图）
8. 每条 prompt 长度：80-160 词

${example}

必须返回纯 JSON 数组格式，不含任何其他文字：
["prompt1", "prompt2", "prompt3"]`;

  const response = await chat([{ role: 'user', content: prompt }]);

  // Extract JSON array
  const match = response.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('AI未返回有效JSON数组');

  const parsed: string[] = JSON.parse(match[0]);
  if (!Array.isArray(parsed) || parsed.length < 1) {
    throw new Error('AI返回的prompt数组无效');
  }
  return parsed.slice(0, 3);
}
