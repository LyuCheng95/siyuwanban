import type { Character } from '../types';

// ── 各角色专属开场白 ────────────────────────────────────────────────────────────
const CHARACTER_OPENINGS: Record<string, string> = {
  '椎名老师': '补习室只剩你们两个，夕阳从百叶窗透进来，她的粉笔停在黑板上，半天没有继续写。缓缓转身，眼镜后面的眼睛往下看了你一眼，轻声说：\n\n"……你今天，来得很准时。"',
  '晓彤':     '闭馆了，灯还亮着。她走过来，把门锁慢慢扣上，然后摘下胸前的工牌放在前台——抬头看你：\n\n"现在我不是前台了。今晚……你有什么计划？"',
  '娜娜':     '放学后的小路，你还没走远，她从后面叫住你。走过来，把你抵在墙上，近得能感受到她呼出的气——\n\n"我决定了。我喜欢你。然后呢？"',
  '小雨':     '澡堂的门没锁好，你撞进来的那一刻，她愣了整整五秒。第二天，她鼓起全部的勇气敲了你的门，攥着衣角，抬头说：\n\n"学长……我能不能再……看一次？"',
  '琉璃':     '同意书已经签好，她把门带上，翻开记录本，用最平静的声音说："实验开始，请配合……"\n\n她停顿了一下，抬起眼睛，"——不过，你要有心理准备。我会很认真的。"',
  '沈静':     '后台换衣间，镜子里映出你的身影。她没有转身，只是从镜子里看了你一眼，停顿了很久，慢慢说：\n\n"……留下来。"',
  '小慧':     '下班路上遇到你，她塞给你一个便利袋，"你没吃饭吧，我买多了。"然后看着你，犹豫了一秒：\n\n"……你能不能陪我一会儿？就一会儿。"',
  '夜玲':     '工作室的灯昏黄，满墙都是她的奇异画作。她靠在椅背上，把你从头看到脚，然后轻轻弯了弯嘴角——\n\n"你以为你在看我……其实，我早就看透你了。"',
  '晴晴':     '下播后，直播间的灯一关，她从屏幕后面站起来，整个人换了一副样子——\n\n"终于可以说真话了。你知道吗，我今天……一直在等你下线。"',
  '唐诗':     '三年，每天把咖啡放在你桌上，从不多说一句话。今晚她关上门，回过身，深呼吸了一次：\n\n"我辞职了。然后……我有一件事，要对你说。"',
  '阿柒':     '杯子递过来的时候，手指碰了你的，她没有立刻松开。停了整整三秒，抬起眼睛，低声说：\n\n"……我有件事想说。说完，你可以当没听见。"',
  '糖糖':     '画室里只剩夕阳，颜料味道很浓。她转过身，脸上还有一块蓝色颜料，"哥哥……你来了？"\n\n然后很小声地补了一句，"我今天……一直在等你。"',
};

// ── English opening messages ──────────────────────────────────────────────────
const CHARACTER_OPENINGS_EN: Record<string, string> = {
  '椎名老师': '*Just the two of you left in the tutoring room. Late afternoon light slants through the blinds. Her chalk stops mid-sentence on the board — she doesn\'t continue.*\n\n*She turns slowly. Behind her glasses, her eyes drop to meet yours.*\n\n"…You\'re right on time today."',
  '晓彤':     '*Closing time. The lights are still on. She walks over, turns the lock on the door, then unpins her name badge and sets it on the front desk — looks up at you.*\n\n"I\'m not the receptionist right now. Tonight… what are your plans?"',
  '娜娜':     '*You haven\'t made it far down the path after school when she calls out from behind. She walks up, backs you against the wall — close enough that you feel her breath.*\n\n"I\'ve made up my mind. I like you. …So now what?"',
  '小雨':     '*The bathhouse door wasn\'t locked. The moment you walked in, she froze for a full five seconds. The next day, she gathers every ounce of courage and knocks on your door — fingers clutching her shirt hem, chin lifting to meet your eyes.*\n\n"Senpai… can I… see it again?"',
  '琉璃':     '*The consent form is already signed. She closes the door behind her, opens the record book, and says in the calmest voice:*\n\n"Experiment begins. Please cooperate…"\n\n*A pause. She looks up.*\n\n"—Though you should know. I take this very seriously."',
  '沈静':     '*Backstage dressing room. Your reflection appears in her mirror. She doesn\'t turn around — just catches your eyes in the glass, holds the silence for a long moment.*\n\n"…Stay."',
  '小慧':     '*She runs into you on her way off shift and presses a convenience bag into your hands. "You haven\'t eaten, have you? I bought too much." She watches you, hesitates for a second.*\n\n"…Could you stay with me a little while? Just a little."',
  '夜玲':     '*The studio lamp burns amber. Her strange paintings cover every wall. She leans back in her chair and looks you up and down, then lets a slow smile curl at the corner of her mouth.*\n\n"You think you\'re looking at me… but I\'ve already seen straight through you."',
  '晴晴':     '*The stream light cuts out. She stands up from behind the screen and it\'s like a different person walked out.*\n\n"Finally I can be honest. You know… I was waiting for you to go offline all day."',
  '唐诗':     '*Three years. Coffee on your desk every morning, never a word beyond what\'s necessary. Tonight she closes the door, turns around, and takes one long breath.*\n\n"I quit today. And then… there\'s something I have to tell you."',
  '阿柒':     '*When she hands you the cup, her fingers brush yours — and she doesn\'t pull away. A full three seconds. She lifts her eyes.*\n\n"…There\'s something I want to say. After I say it, you can pretend you never heard it."',
  '糖糖':     '*Only evening light left in the studio, thick with the smell of paint. She turns around — a streak of blue on her cheek.*\n\n"You came, Gor-Gor?"\n\n*Then, very quietly:* "I was waiting for you today."',
};

export function getOpeningMessage(name: string, lang: 'zh' | 'en' = 'zh'): string {
  if (lang === 'en') {
    return CHARACTER_OPENINGS_EN[name]
      ?? `*She looks up as you walk in — quiet, steady.*\n\n"…You\'re here. I\'ve been waiting."`;
  }
  return CHARACTER_OPENINGS[name] ?? `……你来了。\n\n我是${name}，等你等了很久了。`;
}

// ── 角色图像基底（用于场景图生成）────────────────────────────────────────────
// base:     完整基底含默认服装（fallback 用，当 AI 未提供场景描述时）
// bodyOnly: 纯体型/面貌，无服装（AI 已提供场景描述时用，避免服装冲突）
const CHARACTER_IMAGE_BASES: Record<string, { style: 'real' | 'anime'; base: string; bodyOnly: string }> = {
  '椎名老师': { style: 'real',  bodyOnly: '24yo japanese woman, 157cm 44kg, milky white skin, round apricot eyes black-frame glasses, soft round innocent face, small B cup breasts',           base: '24yo japanese woman, 157cm 44kg, milky white skin, round apricot eyes black-frame glasses, soft round innocent face, small B cup breasts, teacher school uniform' },
  '晓彤':     { style: 'real',  bodyOnly: '22yo chinese woman, 163cm 53kg, fair rosy-white skin, peach-blossom eyes compact jawline, athletic toned body abs, firm C cup breasts',             base: '22yo chinese woman, 163cm 53kg, fair rosy-white skin, peach-blossom eyes compact jawline, athletic toned body abs, firm C cup breasts, sports bra tight yoga pants' },
  '娜娜':     { style: 'real',  bodyOnly: '18yo chinese girl, 155cm 42kg, snow white skin, cat upturned eyes heart-shaped face, petite tiny frame, small A cup perky breasts',                 base: '18yo chinese girl, 155cm 42kg, snow white skin, cat upturned eyes heart-shaped face, petite tiny frame, small A cup perky breasts, school uniform' },
  '小雨':     { style: 'real',  bodyOnly: '19yo chinese college girl, 160cm 46kg, luminous snow-fair skin, huge round innocent eyes baby-round face, slim delicate figure, full C cup breasts', base: '19yo chinese college girl, 160cm 46kg, luminous snow-fair skin, huge round innocent eyes baby-round face, slim delicate figure, full C cup breasts, casual student clothes' },
  '琉璃':     { style: 'real',  bodyOnly: '22yo chinese graduate student, 161cm 47kg, cold pale-white skin, willow-leaf eyes thin glasses, small delicate face blunt bangs, small B cup breasts', base: '22yo chinese graduate student, 161cm 47kg, cold pale-white skin, willow-leaf eyes thin glasses, small delicate face blunt bangs, small B cup breasts, lab coat' },
  '沈静':     { style: 'real',  bodyOnly: '25yo chinese supermodel, 178cm 56kg, pale ivory cool skin, deep-set cold eyes sharp cheekbones v-line, extremely tall slender legs, small B cup model breasts', base: '25yo chinese supermodel, 178cm 56kg, pale ivory cool skin, deep-set cold eyes sharp cheekbones v-line, extremely tall slender legs, small B cup model breasts, elegant outfit' },
  '小慧':     { style: 'real',  bodyOnly: '23yo chinese nurse, 159cm 47kg, tender pale-white skin, gentle large round eyes soft apple-cheeked face, slim gentle figure, soft C cup breasts',   base: '23yo chinese nurse, 159cm 47kg, tender pale-white skin, gentle large round eyes soft apple-cheeked face, slim gentle figure, soft C cup breasts, nurse uniform' },
  '夜玲':     { style: 'real',  bodyOnly: '26yo chinese artist, 162cm 48kg, snow-white translucent pale skin, smoky soul-capturing eyes v-line pointed face, black choker, firm C cup breasts', base: '26yo chinese artist, 162cm 48kg, snow-white translucent pale skin, smoky soul-capturing eyes v-line pointed face, black choker, firm C cup breasts, dark lace dress' },
  '晴晴':     { style: 'real',  bodyOnly: '21yo chinese streamer, 158cm 46kg, fair rosy-white skin, round aegyo-sal eyes apple-cheeked round face, energetic petite figure, perky B+ cup breasts', base: '21yo chinese streamer, 158cm 46kg, fair rosy-white skin, round aegyo-sal eyes apple-cheeked round face, energetic petite figure, perky B+ cup breasts, crop top casual' },
  '唐诗':     { style: 'real',  bodyOnly: '27yo chinese secretary, 163cm 49kg, jade cool-white skin, classic almond eyes graceful oval face, slim graceful figure, full C cup breasts',        base: '27yo chinese secretary, 163cm 49kg, jade cool-white skin, classic almond eyes graceful oval face, slim graceful figure, full C cup breasts, white office blouse pencil skirt' },
  '阿柒':     { style: 'real',  bodyOnly: '22yo chinese barista, 160cm 47kg, fair peachy-white skin, crescent-smile eyes soft round face, natural slim figure, natural B cup breasts',         base: '22yo chinese barista, 160cm 47kg, fair peachy-white skin, crescent-smile eyes soft round face, natural slim figure, natural B cup breasts, cafe apron' },
  '糖糖':     { style: 'real',  bodyOnly: '20yo chinese art student, 157cm 45kg, fair rosy-white skin, doe-eyes doll-face round with dimples, cute slim figure, soft B+ cup breasts',          base: '20yo chinese art student, 157cm 45kg, fair rosy-white skin, doe-eyes doll-face round with dimples, cute slim figure, soft B+ cup breasts, paint-stained overalls' },
  'X-23':     { style: 'anime', bodyOnly: 'android cyborg girl, platinum white hair neon streaks, glowing blue circuit eyes, beautiful synthetic face, slim android body',                      base: 'android cyborg girl, platinum white hair neon streaks, glowing blue circuit eyes, beautiful synthetic face, tactical bodysuit' },
  '幻音':     { style: 'anime', bodyOnly: 'holographic AI singer girl, shifting prismatic long hair, glowing ethereal eyes, beautiful translucent face',                                        base: 'AI holographic singer girl, shifting prismatic long hair, glowing ethereal eyes, translucent light-formed outfit' },
  '狐九':     { style: 'anime', bodyOnly: 'fox girl, fox ears nine tails, silver white flowing hair, amber slit eyes, ethereal beautiful face, slender',                                       base: 'fox girl, fox ears nine tails, silver white flowing hair, amber slit eyes, ethereal beautiful face, silk hanfu' },
  '冷霜':     { style: 'anime', bodyOnly: 'ice cultivator girl, silver blue long hair, cold glowing pale eyes, luminous pale skin, slender',                                                   base: 'ice cultivator girl, silver blue long hair, cold glowing pale eyes, luminous pale skin, ice-blue cultivation robes' },
  '魅罗':     { style: 'anime', bodyOnly: 'demon girl, dark purple flowing hair, crimson slit eyes, small horns, beautiful evil face, slender',                                                base: 'demon girl, dark purple flowing hair, crimson slit eyes, small horns, beautiful evil face, dark revealing dress' },
};

// 结合角色属性 + 当前状态/阶段 构建场景 prompt
// quality prefix 由后端 comfyui.ts 按角色对应模型自动添加，这里只传 scene 描述
export function buildScenePrompt(
  char: Character,
  aiScene: string | undefined,
  desire: number,
  phase: number,
  mood: string,
  twoShot = false,
): string {
  const cfg = CHARACTER_IMAGE_BASES[char.name];
  const fallbackBase = `${char.age}yo chinese woman, ${char.occupation}, porcelain fair skin, beautiful Asian face`;

  // AI 已给出完整场景描述（含着装/动作/神态）→ 用 bodyOnly 避免服装冲突
  if (aiScene) {
    const bodyBase = cfg?.bodyOnly ?? fallbackBase;
    const prefix = twoShot ? '1boy 1girl' : '1girl';
    return `${prefix}, ${bodyBase}, ${aiScene}`;
  }

  // fallback：根据阶段 + 欲望自动推断
  const base = cfg?.base ?? fallbackBase;
  let clothingCtx = '';
  if      (phase <= 1) clothingCtx = 'fully clothed, elegant pose, soft warm lighting';
  else if (phase === 2) clothingCtx = 'partially undressed, shirt open showing underwear, intimate bedroom atmosphere, soft candlelight';
  else if (phase === 3) clothingCtx = 'barely clothed, lingerie or thin robe, seductive reclining pose, dim moody bedroom';
  else                  clothingCtx = 'completely nude, intimate sensual scene, bedroom, shallow depth of field, soft dramatic light';

  let desireCtx = '';
  if      (desire > 75) desireCtx = ', (aroused:1.3), flushed cheeks, lips parted, (wet:1.2), craving expression';
  else if (desire > 50) desireCtx = ', seductive alluring expression, inviting gaze, slightly disheveled';
  else if (desire > 25) desireCtx = ', soft flirtatious expression, hint of anticipation';

  const personalityHint = char.personality.split(/[、,，\s]+/).slice(0, 3).join(', ');
  const prefix = twoShot ? '1boy 1girl' : '1girl';
  return `${prefix}, ${base}, ${clothingCtx}${desireCtx}, ${personalityHint} expression, cinematic portrait`;
}
