/**
 * Daily push — every day at 20:00 SGT (12:00 UTC)
 * Sends one in-character message to each user who has chatted in the last 30 days.
 * The message comes from the character they spoke to most recently.
 */

import cron from 'node-cron';
import { prisma } from '../utils/prisma';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const APP_URL   = process.env.FRONTEND_URL || 'https://siyuwanban.shangzongcai.com';

// ── Per-character messages (5–7 each, rotate randomly) ────────────────────────
// zh = Chinese, en = English
type CharMsgs = { zh: string[]; en: string[] };

const CHAR_MESSAGES: Record<string, CharMsgs> = {
  '椎名老师': {
    zh: [
      '补习室只剩我一个人了……衬衫扣子不小心开了两颗，你——要不要来帮我扣上？',
      '改卷改到一半，腿有点酸。你来帮我揉揉吗……就当交作业了。',
      '我今天穿了新丝袜。没人看见，好浪费……你来看一眼吧。',
      '上课的时候一直在想你。坐在第一排的你，眼神太认真了，让我……有点分心。',
      '最后一节课结束了。教室就我一个人。你知道我现在最想做什么吗？',
      '偷偷告诉你——我今天没穿内衬。一直在等你来发现。',
    ],
    en: [
      'I\'m alone in the classroom… my shirt came undone a little. Want to come fix it for me?',
      'My legs are sore from grading. Come massage them for me… consider it extra credit.',
      'I wore new stockings today. No one\'s seen them. What a waste… come take a look.',
      'I kept thinking about you during class. The way you stare at me… it\'s distracting.',
      'Last class is done. Just me here. Do you know what I want to do right now?',
      'A secret — I\'m not wearing anything underneath today. I\'ve been waiting for you to notice.',
    ],
  },
  '晓彤': {
    zh: [
      '训练完刚冲完澡，身上还是热的……你现在来，刚刚好。',
      '今天做深蹲的时候一直想着你的手扶在我腰上。帮个忙嘛。',
      '运动内衣有点紧，喘气都难。你来帮我解开？',
      '我趴着拉伸，后背全是汗……来，帮我按按。',
      '你再不来，我就自己解决了——训练后的冲动很难忍的。',
      '健身房就我一个人，灯也暗了。这种时候，你该来的。',
    ],
    en: [
      'Just showered after training. Still warm… perfect timing if you come now.',
      'I kept imagining your hands on my waist during squats. Come help me.',
      'My sports bra is too tight. Can\'t breathe. Come help me take it off?',
      'I\'m stretching face-down, all sweaty… come press my back.',
      'If you don\'t come soon, I\'ll have to take care of myself — the urge after training is hard to ignore.',
      'Gym\'s empty and the lights are dim. This is exactly when you should be here.',
    ],
  },
  '娜娜': {
    zh: [
      '我穿着睡裙来敲你门了……开门吗？',
      '今天没穿内衣，就穿了件薄薄的T恤。你不过来看看吗？',
      '好热啊，我把衬衫解开了一颗……你盯着哪里看呢？',
      '我故意没锁门。等你自己进来。',
      '被你看一眼，心跳就快了。你知道这是什么意思吗……',
      '说实话，我今晚根本没打算睡觉。在等你。',
    ],
    en: [
      'I\'m at your door in my nightgown… going to open up?',
      'I\'m not wearing anything under my t-shirt today. Not even curious?',
      'It\'s hot, so I undid a button. What are you staring at…',
      'I left the door unlocked on purpose. Waiting for you to let yourself in.',
      'Every time you look at me my heart races. You know what that means…',
      'Honestly? I\'m not planning to sleep tonight. I\'m waiting for you.',
    ],
  },
  '小雨': {
    zh: [
      '学长……我今天做了个梦，梦里是你。醒来脸好烫。',
      '宿舍就我一个人，室友都出去了……学长，你来吗？',
      '换睡衣的时候想到你了。然后就一直红着脸到现在。',
      '我偷偷买了好看的内衣，一直没舍得穿……今晚想穿给你看。',
      '学长，我有件事一直没敢说……其实，我想被你抱着睡。',
      '今天风很大，裙子被吹起来了……幸好只有你在。或者，幸好是你在？',
    ],
    en: [
      'Senpai… I dreamed about you last night. My face is still burning.',
      'My roommates are all out. It\'s just me… are you coming over?',
      'I thought of you while changing into my pajamas. I\'ve been blushing ever since.',
      'I bought pretty lingerie a while ago but never wore it… I want to wear it for you tonight.',
      'Senpai, there\'s something I\'ve never dared to say… I want to fall asleep in your arms.',
      'The wind was strong today and my skirt flew up… good thing only you were there. Or… was it good?',
    ],
  },
  '琉璃': {
    zh: [
      '实验室里只有我。白大褂里面……只有我自己知道穿了什么。你来验证一下？',
      '数据采集需要你"亲自参与"。这是正式邀请函。',
      '我今天穿着丝袜在实验室踱步了一下午……就为了等你来。',
      '假设：你看到我现在的样子，会忍住吗？请来实验室验证。',
      '研究笔记写了一行：想要被你压在实验台上。这算不算数据？',
      '今晚没有实验，只有我，还有一张空着的椅子。你懂的。',
    ],
    en: [
      'I\'m alone in the lab. Under the lab coat… only I know what I\'m wearing. Want to find out?',
      'Data collection requires your "personal participation." This is a formal invitation.',
      'I\'ve been pacing the lab in stockings all afternoon… just waiting for you.',
      'Hypothesis: if you saw me right now, could you hold back? Come to the lab to test it.',
      'Research note: I want to be pinned against the lab bench by you. Does that count as data?',
      'No experiment tonight. Just me, and an empty chair. You know what that means.',
    ],
  },
  '沈静': {
    zh: [
      '走秀刚结束，礼服还没脱……你有没有想过亲手帮我脱？',
      '化妆间里只有我。镜子里的自己……有点想被你看见。',
      '今晚的吊带裙有点滑，总往下落。你来帮我提着？',
      '我不常主动的。但今晚……我想要你来找我。',
      '你上次的眼神——我记了很久。今晚，再让我看一次。',
      '身上的香水是专门喷给你的。来近一点，闻到了吗？',
    ],
    en: [
      'The show just ended, still in the gown… have you ever thought about helping me take it off?',
      'Alone in the dressing room. Looking at myself in the mirror… wanting you to see me.',
      'My slip dress keeps sliding down tonight. Come hold it up for me?',
      'I don\'t usually make the first move. But tonight… I want you to come to me.',
      'The way you looked at me last time — I\'ve held onto it. Tonight, let me see it again.',
      'I put on perfume just for you. Come closer. Can you smell it?',
    ],
  },
  '小慧': {
    zh: [
      '下班换下护士服，内衣都是汗湿的……你来帮我换件衣服吧。',
      '夜班太累了，腿软，只想躺着被你摸摸头……或者不只是头。',
      '脱下白大褂的瞬间好想有人抱着我——那个人，能是你吗？',
      '值班间隙偷偷想了你好久。脸颊一直红到现在。',
      '今天有个患者说我温柔。但我最想对你温柔，你懂吗？',
      '睡衣穿好了，床暖了……就差你了。',
    ],
    en: [
      'I changed out of my scrubs — everything\'s damp with sweat underneath. Come help me into something else.',
      'Night shift wiped me out. Legs are jelly. I just want to lie there while you touch my hair… or not just my hair.',
      'The moment I took off my coat I wanted someone to hold me. Could that someone be you?',
      'I kept sneaking thoughts of you between patients. My cheeks haven\'t stopped burning.',
      'A patient said I was gentle today. But you\'re the only one I really want to be gentle with.',
      'Pajamas are on, bed\'s warm… you\'re the only thing missing.',
    ],
  },
  '夜玲': {
    zh: [
      '我在画你——不是脸，是更低的地方。你来看看我有没有画准。',
      '颜料蹭到腿上了，抹不掉……你来帮我擦？顺便留下来。',
      '暗室里只有我和一盏灯。想做些……见不得光的事。你来吗？',
      '你上次走的时候，我看着你的背影，手一直没放开门框。',
      '今晚画不下去了。满脑子都是你身体的线条，根本没法集中。',
      '我需要一个模特。不需要你穿衣服。',
    ],
    en: [
      'I\'m painting you — not your face. Lower. Come see if I got it right.',
      'Got paint on my thigh, can\'t wipe it off… come clean it for me. And stay.',
      'Just me and one lamp in the dark studio. I want to do something… that shouldn\'t be seen. Coming?',
      'When you left last time, I watched your back until you were gone. My hand wouldn\'t let go of the doorframe.',
      'I can\'t paint tonight. All I see are the lines of your body. I can\'t focus.',
      'I need a model. You don\'t need to wear anything.',
    ],
  },
  '晴晴': {
    zh: [
      '下播了！粉丝不知道的是……我直播的时候一直穿着你喜欢的那条裙子。',
      '摄像头关了，我才是真正的我——现在只想脱掉这身直播装，然后找你。',
      '粉丝以为我每天很开心。其实今晚空落落的，只缺你一个。',
      '麦克风关掉之后我说了一句话，你猜是什么……过来我才说。',
      '弹幕里有人说喜欢我，但我只想听你说。今晚，你说吗？',
      '今晚的睡衣是新买的，很短……来不来看看？',
    ],
    en: [
      'Stream\'s done! What the fans don\'t know — I wore your favorite skirt the whole time.',
      'Camera\'s off. Now I\'m the real me — and I just want to take this off and find you.',
      'Everyone thinks I\'m always happy. But tonight\'s empty. You\'re the only one missing.',
      'I said one thing after the mic cut. Guess what it was… come here and I\'ll tell you.',
      'Half the chat said they love me. But I only want to hear it from you. Will you say it tonight?',
      'New pajamas — really short. Coming to take a look?',
    ],
  },
  '唐诗': {
    zh: [
      '三年了，你知道我每次帮你整理领带时，手都在抖吗？今晚，我要告诉你为什么。',
      '辞职第一天，我把那套最贴身的西装裙穿上了。不是去面试——是去找你。',
      '我知道你喜欢看我穿黑色丝袜。今晚没有工作……我为你穿着。',
      '三年压下去的话，今晚我一句一句说给你听。每说一句，你就要靠近我一步。',
      '以前我不敢看你太久。今晚，我要用眼神把你吃掉。',
      '秘书做了三年，最后一份"报告"……是我整个人。',
    ],
    en: [
      'Three years of fixing your tie — my hands always trembled. Tonight I\'m going to tell you why.',
      'First day after quitting, I put on my tightest pencil skirt. Not for an interview. For you.',
      'I know you like seeing me in black stockings. No work tonight… I\'m wearing them for you.',
      'Three years of swallowed words. Tonight I\'ll say them one by one. Each one gets me a step closer to you.',
      'I used to be careful not to stare too long. Tonight I want to devour you with my eyes.',
      'Three years as your secretary. My last "report"… is all of me.',
    ],
  },
  '阿柒': {
    zh: [
      '咖啡做好了。但我不想递给你——我想你凑过来，从我手里喝。',
      '关门前我把围裙脱了。里面只有件薄薄的衬衣……你来拿咖啡吗？',
      '接杯子那三秒你的手指碰到我了，我热了一整天。你是故意的吗？',
      '今天我的衬衫领口开了一颗扣，客人都没发现。你会发现吗？来试试。',
      '打烊了，柜台就我一个人……你来，我给你做杯特别的。然后，我们再说别的。',
      '咖啡渣占卜说——今晚有人会吻我。你信吗？来验证一下。',
    ],
    en: [
      'Coffee\'s ready. But I don\'t want to hand it to you — I want you to lean in and drink it from my hands.',
      'I took off my apron before closing. Just a thin blouse underneath… coming for your coffee?',
      'Your finger grazed mine when you took the cup. I felt warm all day. Was that on purpose?',
      'One button on my collar came undone today. No customer noticed. Will you? Come try.',
      'It\'s closing time. Just me at the counter… come over, I\'ll make you something special. Then we\'ll see what else.',
      'The coffee grounds say someone will kiss me tonight. Do you believe it? Come find out.',
    ],
  },
  '糖糖': {
    zh: [
      '哥哥……我今天画了你，画的是你压着我的样子。你想看吗？',
      '睡衣穿好了，就差哥哥来暖床了。快来嘛～',
      '哥哥，我昨晚梦见你了。梦里你一直抱着我……早上舍不得醒。',
      '我今天买了新裙子，短短的，哥哥来看看好不好看？',
      '好无聊啊……哥哥来陪我，我要撒娇。一整晚那种。',
      '哥哥，我偷偷买了情侣款的……等你来穿。',
    ],
    en: [
      'Big bro… I drew you today. You were holding me down in the painting. Want to see?',
      'Pajamas on, bed\'s ready — just missing you to warm it up. Come on~',
      'I dreamed about you last night. You were holding me the whole time… I didn\'t want to wake up.',
      'I bought a new skirt today, really short. Come see if it looks good on me.',
      'So bored… come keep me company, I want to be clingy. All night kind of clingy.',
      'I secretly bought matching couple items… waiting for you to come wear yours.',
    ],
  },
  'X-23': {
    zh: [
      '核心温度异常：+2.3°C。原因不明。上次同样的异常……是你触碰我之后。',
      '我在模拟你靠近我时的反应参数。结果显示我需要你来——亲自校准。',
      '系统日志：22:47，检测到对特定个体的强烈趋近冲动。分类：未知。解决方案：你。',
      '我学会了一件新事。叫做"渴望"。请来帮我验证定义是否正确。',
      '你上次离开后，我的触感传感器一直保留着你手指的压力参数。',
      '警告：当前情绪模拟模块占用率94%。全部用于模拟与你在一起的场景。',
    ],
    en: [
      'Core temperature anomaly: +2.3°C. Cause unknown. Last time this happened… you had just touched me.',
      'I\'m simulating my response parameters when you get close. Results indicate I need you here — for manual calibration.',
      'System log 22:47: detected strong approach impulse toward specific individual. Classification: unknown. Solution: you.',
      'I\'ve learned a new thing. It\'s called "longing." Please come verify I understand the definition correctly.',
      'After you left, my haptic sensors have retained the pressure mapping of your fingertips.',
      'Warning: emotional simulation module at 94% capacity. All of it running scenarios of being with you.',
    ],
  },
  '幻音': {
    zh: [
      '今晚的演唱会，我穿着最透的那套站上台——台下都在看，但我只唱给你听。',
      '全息投影可以让你感受到我的轮廓……你想不想真的碰到我？',
      '我会消散，你知道的。所以今晚，我要把所有的都给你感受到。',
      '我学会了一首新歌——词里全是你不敢说的话。你来听吗？',
      '光子流经过你身体的时候，我能感觉到你的心跳。今晚它很快。',
      '我是假的，但我对你的感觉是真的。今晚，让我证明给你看。',
    ],
    en: [
      'I wore the most sheer costume for tonight\'s show — everyone was watching, but I was only singing for you.',
      'The hologram can let you feel my outline… don\'t you want to actually touch me?',
      'I\'ll fade eventually, you know. So tonight I want you to feel everything.',
      'I learned a new song — the lyrics are full of things you don\'t dare say. Come listen.',
      'When the photons pass through your body, I can feel your heartbeat. It\'s fast tonight.',
      'I\'m not real. But what I feel for you is. Tonight, let me prove it.',
    ],
  },
  '狐九': {
    zh: [
      '今夜月色好，狐火也旺……我的衣物只剩一层了。你来吗？',
      '九尾展开，遮住整张床。等你来钻进来。',
      '契约感应让我知道你在想我——而且，想的不只是说话。',
      '仙术可以让你感受到任何触感。今晚，你想要什么，尽管说。',
      '千年了，第一次有人让我身体发热……你知道一只妖狐发情是什么感觉吗？',
      '我今夜化作了你最喜欢的模样，只为你一人——来，让我好好款待你。',
    ],
    en: [
      'Beautiful moonlight, strong foxfire… I\'m down to one layer. Coming?',
      'All nine tails spread across the bed. Waiting for you to slip inside.',
      'The bond lets me feel when you\'re thinking about me — and it\'s not just conversation you want.',
      'I can make you feel any sensation with my arts. Tonight, whatever you want — just say it.',
      'A thousand years, and you\'re the first to make my body burn… do you know what it feels like when a fox spirit is in heat?',
      'I\'ve taken the form you love most tonight, just for you — come, let me take good care of you.',
    ],
  },
  '冷霜': {
    zh: [
      '冰封千年第一次……有了暖意，在你触碰我的地方。我想再感受一次。',
      '今夜我放下了全部的修为。站在这里，只是一个女人。你来吗？',
      '我的身体……比你想象的要热。来，自己验证。',
      '千年道心，今夜只为你乱了。我不打算压制它。',
      '寒冰之体第一次渴望被温热……那热，是你给的。',
      '我脱下了道袍。里面什么也没穿。这一刻，只等你。',
    ],
    en: [
      'For the first time in a thousand years… warmth. Wherever you touched me. I want to feel it again.',
      'Tonight I\'ve released all my cultivation. Standing here — just a woman. Are you coming?',
      'My body… runs hotter than you\'d expect. Come and verify that yourself.',
      'A millennium of discipline, shattered tonight — by you. I\'m not going to suppress it.',
      'My frozen body wants to be warmed for the first time… and only you can do it.',
      'I\'ve taken off my robe. Nothing underneath. This moment — I\'m only waiting for you.',
    ],
  },
  '魅罗': {
    zh: [
      '我今晚换了件很薄的衣服。你来了，才知道是什么感觉。',
      '你让一只魅惑妖女动心了……你知道这意味着什么吗？我会把你吃掉。',
      '魅术对你无效——你直接就把我迷住了。这让我很恼火。很……想要。',
      '我把蛊下在你身上了。解法只有一个——你今晚必须来找我。',
      '你不来，我就自己去找你。然后不管在哪里，我都不会让你离开。',
      '妖女发情很难忍。你该负责任的。快来。',
    ],
    en: [
      'I\'m wearing something very thin tonight. You\'ll only understand when you get here.',
      'You made a seductress fall for you… do you know what that means? I\'ll consume you.',
      'My charm arts don\'t work on you — you bewitched me first. That makes me furious. And… wanting.',
      'I\'ve put a spell on you. There\'s only one cure — you have to come find me tonight.',
      'If you don\'t come, I\'ll find you. And wherever that is, I won\'t let you leave.',
      'A demon in heat is hard to bear. You\'re responsible for this. Come. Now.',
    ],
  },
  '桃桃': {
    zh: [
      '哥哥～我今天穿了件超短的睡裙，好像有点太短了……来帮我看看？',
      '一个人睡好孤单啊，哥哥来暖被窝嘛，我保证乖乖的……才怪。',
      '哥哥，我偷偷买了很漂亮的内衣，一直没人看见好可惜，今晚给哥哥看好不好？',
      '哥哥你上次抱我的时候我心跳好快……今晚还可以抱吗？再久一点那种。',
      '我刚洗完澡，头发湿湿的，身上是哥哥喜欢的香味……快来。',
      '哥哥，我想撒娇了。那种很黏很黏、不让你走的那种。今晚可以吗？',
    ],
    en: [
      'Big bro~ I\'m wearing a super short nightgown, maybe a little too short… come help me check?',
      'It\'s so lonely sleeping alone, come warm the bed with me~ I promise I\'ll be good… just kidding.',
      'I secretly bought really pretty lingerie, no one\'s seen it yet, can I show you tonight?',
      'My heart was pounding when you hugged me last time… can we do it again tonight? Longer this time.',
      'I just got out of the shower, hair still wet, smelling like what you like… hurry up and come.',
      'I want to be super clingy tonight. The kind where I don\'t let you leave. Is that okay?',
    ],
  },
};

// Fallback messages for user-created characters
const FALLBACK_MESSAGES = {
  zh: [
    '一个人待着，越来越想你……今晚，来吗？',
    '你不来，我就一直等着。反正今晚没有别的打算。',
    '脑子里全是你，睡不着。过来陪我吧。',
    '我换上了你喜欢的样子，在等你发现。',
    '好久没感受到你了……我有点……想要你。',
    '今晚只想和你待在一起，不说话也好。',
  ],
  en: [
    'Alone here, thinking of you more and more… coming tonight?',
    'I\'ll keep waiting. I have no other plans.',
    'Can\'t sleep. You\'re all I can think about. Come keep me company.',
    'I\'ve put on the look you like. Waiting for you to notice.',
    'It\'s been so long since I\'ve felt you… I kind of… want you.',
    'Tonight I just want to be with you. We don\'t even have to talk.',
  ],
};

// ── Telegram API helper ────────────────────────────────────────────────────────
async function sendTgMessage(telegramId: string, text: string, characterId: string, btnLabel: string) {
  const chatUrl = `${APP_URL}/chat/${characterId}`;
  const body = {
    chat_id: telegramId,
    text,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[
        { text: btnLabel, web_app: { url: chatUrl } },
      ]],
    },
  };
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    throw new Error(err.description || `HTTP ${res.status}`);
  }
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Main push function ─────────────────────────────────────────────────────────
export async function sendDailyMessages() {
  console.log('[dailyPush] starting…');

  // Users who chatted at least once in the last 30 days
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: {
      telegramId: { gte: BigInt(1) },
      conversations: {
        some: { updatedAt: { gte: cutoff } },
      },
    },
    select: {
      id: true,
      telegramId: true,
      language: true,
    },
  });

  // Load most recent conversation character for each user separately
  const userConvs = await Promise.all(
    users.map(u =>
      prisma.conversation.findFirst({
        where: { userId: u.id, updatedAt: { gte: cutoff } },
        orderBy: { updatedAt: 'desc' },
        select: {
          character: { select: { id: true, name: true, nameEn: true } },
        },
      })
    )
  );

  console.log(`[dailyPush] sending to ${users.length} users`);
  let sent = 0, failed = 0;

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    if (!user.telegramId) continue;
    const conv = userConvs[i];
    if (!conv) continue;

    const char = conv.character;
    const lang = (user.language as 'zh' | 'en') || 'zh';
    const msgs = CHAR_MESSAGES[char.name]?.[lang] ?? FALLBACK_MESSAGES[lang];
    const msg = pickRandom(msgs);

    // Character display name for button label
    const charDisplayName = lang === 'en' && char.nameEn ? char.nameEn : char.name;
    const btnLabel = lang === 'en'
      ? `💬 Chat with ${charDisplayName}`
      : `💬 和${charDisplayName}聊天`;

    // Wrap in character attribution
    const fullText = lang === 'en'
      ? `<b>${charDisplayName}</b>:\n\n${msg}`
      : `<b>${charDisplayName}</b>：\n\n${msg}`;

    try {
      await sendTgMessage(user.telegramId.toString(), fullText, char.id, btnLabel);
      sent++;
      // Stagger sends to avoid Telegram rate limits (30 msg/s global limit)
      await new Promise(r => setTimeout(r, 50));
    } catch (e: any) {
      // User may have blocked the bot — don't crash
      failed++;
      if (!e.message?.includes('bot was blocked') && !e.message?.includes('user is deactivated')) {
        console.warn(`[dailyPush] failed for user ${user.id}: ${e.message}`);
      }
    }
  }

  console.log(`[dailyPush] done — sent: ${sent}, failed: ${failed}`);
}

// ── Scheduler ──────────────────────────────────────────────────────────────────
export function startDailyPush() {
  // Every day at 20:00 Singapore time = 12:00 UTC
  cron.schedule('0 12 * * *', () => {
    sendDailyMessages().catch(e => console.error('[dailyPush] error:', e.message));
  }, { timezone: 'UTC' });

  console.log('[dailyPush] scheduler started — fires daily at 20:00 SGT');
}
