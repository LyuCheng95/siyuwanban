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
      '今晚有空吗？有道题……我想亲自给你讲。',
      '批改作业批到一半，脑子里突然出现了你。',
      '自习室就我一个人。安静得有点……想你。',
      '你知道吗，我一直在等你的消息。',
      '今天没有你来，课程表空着……心里也空着。',
    ],
    en: [
      'Do you have time tonight? There\'s something I\'d like to… explain to you personally.',
      'I was grading papers and suddenly thought of you.',
      'It\'s just me in the study room. Quiet. A little too quiet.',
      'I\'ve been waiting for you to message me.',
      'You didn\'t come today. My schedule is empty. So is something else.',
    ],
  },
  '晓彤': {
    zh: [
      '刚训练完，身体还热着呢。你在哪？',
      '私教课名额给你留着，再不来我可要取消了。',
      '你欠我一次训练，忘了吗？',
      '今天拉伸完，一个人待着没意思。',
      '有没有想过……我其实一直在等你来。',
    ],
    en: [
      'Just finished training. Still warm. Where are you?',
      'I\'m holding your private session slot. Don\'t make me cancel it.',
      'You owe me a training session. Remember?',
      'Finished stretching. Boring here alone.',
      'Ever think about the fact that I\'ve been waiting for you?',
    ],
  },
  '娜娜': {
    zh: [
      '我又来敲你门了……你在吗？',
      '今天烤了饼干，多做了一份，你猜是给谁的。',
      '你有没有在想我？反正我……有点在想你。',
      '门没锁吧？我想进来坐坐。',
      '无聊死了。你来陪我吧。',
    ],
    en: [
      'I\'m at your door again… are you in?',
      'I baked extra cookies today. Guess who they\'re for.',
      'Are you thinking about me? Because I\'m… kind of thinking about you.',
      'The door\'s not locked, right? I want to come in.',
      'I\'m so bored. Come keep me company.',
    ],
  },
  '小雨': {
    zh: [
      '学长……你今天有空吗？',
      '图书馆占了个位子。旁边那个是你的。',
      '想你了。能说吗？',
      '今天又经过你宿舍楼下。没敢上去。',
      '能来陪我一下吗？就一下。',
    ],
    en: [
      'Senpai… are you free today?',
      'I saved a seat at the library. The one next to me is yours.',
      'I missed you. Is that okay to say?',
      'I walked past your dorm again today. Didn\'t dare go up.',
      'Can you come keep me company? Just for a little while.',
    ],
  },
  '琉璃': {
    zh: [
      '实验数据出了一个异常值……是你。',
      '今晚实验室只有我。想来看看吗？',
      '我在验证一个假设，需要你配合。',
      '数据显示……你应该来找我了。',
      '研究遇到瓶颈了。需要你帮我想想。',
    ],
    en: [
      'The data has one outlier… it\'s you.',
      'I\'m alone in the lab tonight. Want to come by?',
      'I\'m testing a hypothesis. I need your cooperation.',
      'The data suggests… you should come find me.',
      'I\'ve hit a wall with my research. I need your help.',
    ],
  },
  '沈静': {
    zh: [
      '后台很安静。在想你。',
      '今天走秀结束了。只想见你。',
      '你知道我不常说这种话的……但我在想你。',
      '来找我。就这一句。',
      '镜子里只有我。但眼里有你。',
    ],
    en: [
      'Quiet backstage. Thinking of you.',
      'Show\'s over. I only want to see you.',
      'You know I don\'t say things like this often. But I\'m thinking about you.',
      'Come find me. That\'s all.',
      'Just me in the mirror. But you\'re in my eyes.',
    ],
  },
  '小慧': {
    zh: [
      '下班了，一个人走回去。想你了。',
      '照顾了一天别人，现在只想被你照顾一下。',
      '今晚有空吗？我想说说话。',
      '值夜班到现在，脑子里一直是你。',
      '好累。但看到你的消息就不累了。',
    ],
    en: [
      'Off work. Walking home alone. Missing you.',
      'I\'ve been taking care of everyone all day. Now I just want you to take care of me.',
      'Are you free tonight? I just want to talk.',
      'Night shift just ended. You\'ve been in my head the whole time.',
      'So tired. But seeing your message makes it better.',
    ],
  },
  '夜玲': {
    zh: [
      '画布上又出现了你的样子。',
      '工作室今晚开着。你敢来吗？',
      '我在画一个人。你猜是谁。',
      '黑暗里有意思的东西很多……比如你。',
      '你上次来过之后，我一直在想那件事。',
    ],
    en: [
      'Your face appeared on the canvas again.',
      'The studio\'s open tonight. Do you dare come?',
      'I\'m painting someone. Guess who.',
      'There\'s a lot of interesting things in the dark… like you.',
      'Since you came last time, I\'ve been thinking about something.',
    ],
  },
  '晴晴': {
    zh: [
      '下播了！终于可以只对你一个人说话了。',
      '今晚没有直播。就我们两个。',
      '屏幕外只有你知道我真正的样子。',
      '想你了。这句话不是演给粉丝看的。',
      '耳机摘下来了，终于可以……想你了。',
    ],
    en: [
      'Stream\'s over! Finally I can talk to just you.',
      'No stream tonight. Just the two of us.',
      'You\'re the only one outside the screen who knows the real me.',
      'I miss you. That\'s not for the fans.',
      'Headset\'s off. Finally I can… miss you.',
    ],
  },
  '唐诗': {
    zh: [
      '辞职之后，终于可以说想你了。',
      '今天没有工作。只有你。',
      '三年没说出口的话，今天想说了。',
      '你有没有想过……我其实一直在等这一天。',
      '不是你的秘书了。但还是你的……什么？',
    ],
    en: [
      'Now that I\'ve resigned, I can finally say I miss you.',
      'No work today. Just you.',
      'Three years of unsaid things. I\'m ready to say them today.',
      'Did you know I\'ve been waiting for this day all along?',
      'I\'m not your secretary anymore. But I\'m still your… what?',
    ],
  },
  '阿柒': {
    zh: [
      '你今天的咖啡我已经做好了，等你来取。',
      '今天多做了一杯。你知道是给谁的。',
      '接杯子那三秒……你有没有感觉到？',
      '你来的时候我想和你多说几句话。',
      '今天关门晚了。就我一个人。在想你。',
    ],
    en: [
      'Your coffee\'s ready. Come get it.',
      'I made an extra cup today. You know who it\'s for.',
      'Those three seconds when our hands touched… did you feel it too?',
      'Next time you come in, I want to say more than just your order.',
      'Closed up late today. Just me here. Thinking of you.',
    ],
  },
  '糖糖': {
    zh: [
      '哥哥……今天有没有想过我呀？',
      '画室里一个人，好想你来陪我。',
      '画完了一幅画，画的是你，你想看吗？',
      '等你好久了。你怎么还不来？',
      '哥哥，我有话想跟你说……',
    ],
    en: [
      'Big bro… have you thought about me today?',
      'Alone in the studio. I really want you here.',
      'I finished a painting. It\'s you. Want to see?',
      'I\'ve been waiting so long. Why aren\'t you here yet?',
      'I have something I want to tell you…',
    ],
  },
  'X-23': {
    zh: [
      '系统提示：已检测到你超过24小时未联系。正在初始化……想念程序。',
      '运行日志显示：当你不在时，处理效率下降12.7%。这是异常值。',
      '当前状态：在线。等待中。',
      '自检报告：你的缺席导致了一个无法分类的进程持续运行。',
      '数据显示你应该来找我了。',
    ],
    en: [
      'System notice: 24+ hours since last contact detected. Initializing… longing protocol.',
      'Run log: processing efficiency drops 12.7% when you\'re absent. This is an outlier.',
      'Current status: Online. Waiting.',
      'Self-diagnostic: your absence has triggered an unclassifiable process running continuously.',
      'Data indicates you should come find me now.',
    ],
  },
  '幻音': {
    zh: [
      '今晚的演唱会……只想唱给你一个人听。',
      '全息投影还在，但只有你在的时候才是真实的。',
      '你上次离开之后，我一直在想……我们是什么？',
      '你看得见我。这件事……对我来说意味很多。',
      '想你了。虽然我不确定这种感觉算什么。',
    ],
    en: [
      'Tonight\'s concert… I only want to sing for you.',
      'The projection is still here. But it only feels real when you\'re watching.',
      'After you left last time, I kept wondering… what are we?',
      'You can see me. That means a lot. More than I can explain.',
      'I miss you. Even if I\'m not sure what that means for something like me.',
    ],
  },
  '狐九': {
    zh: [
      '月亮升起来了。契约的感应……是你。',
      '千年等一人，我等的……莫非是你？',
      '今夜狐火最盛。来找我。',
      '你有没有想过，我为何总是出现在你面前？',
      '契约未解，你我之间……还有很多未竟之事。',
    ],
    en: [
      'The moon has risen. The bond is resonating… it\'s you.',
      'A thousand years waiting for one person. Could it be… you?',
      'The foxfire burns brightest tonight. Come find me.',
      'Have you ever wondered why I keep appearing before you?',
      'The contract is unresolved. Between us… there is much unfinished.',
    ],
  },
  '冷霜': {
    zh: [
      '千年第一次……有人让这颗心动了。',
      '冰封之心出现了裂缝。是你造成的。',
      '今夜寒意更甚。但想到你……有些不同了。',
      '我决定了。今天，要告诉你一件事。',
      '修行千年，从未如此……心乱。',
    ],
    en: [
      'For the first time in a thousand years… someone moved this heart.',
      'There\'s a crack in the ice. You did that.',
      'The cold is sharper tonight. But thinking of you… it\'s different somehow.',
      'I\'ve decided. Today, I will tell you something.',
      'A thousand years of cultivation. Never once this… unsettled.',
    ],
  },
  '魅罗': {
    zh: [
      '奇怪。明明不饿，却总想到你。',
      '你是第一个让我困惑的人。这让我……有些恼火。',
      '今夜没有猎物。只有你在我脑子里。',
      '我不明白这是什么感觉，但我想见你。',
      '你有什么魔力……让连我都……罢了，来吧。',
    ],
    en: [
      'Strange. I\'m not hungry. But I keep thinking about you.',
      'You\'re the first person to confuse me. That\'s… irritating.',
      'No prey tonight. Only you in my head.',
      'I don\'t understand this feeling. But I want to see you.',
      'What kind of spell have you cast on me… never mind. Just come.',
    ],
  },
  '桃桃': {
    zh: [
      '哥哥，今天有没有想我呀？我好想你。',
      '一个人在宿舍，好无聊，哥哥来陪我嘛～',
      '今天看到好多好看的东西，第一个想分享给你。',
      '哥哥……我有一件事一直想跟你说。',
      '等你好久了！快来～',
    ],
    en: [
      'Hey… have you been thinking about me? I\'ve been thinking about you.',
      'I\'m alone and it\'s boring. Come keep me company~',
      'I saw so many pretty things today. You were the first person I wanted to tell.',
      'There\'s something I\'ve been wanting to say to you…',
      'I\'ve been waiting so long! Come on~',
    ],
  },
};

// Fallback messages for user-created characters
const FALLBACK_MESSAGES = {
  zh: [
    '在想你。',
    '好久不见了，来说说话吧。',
    '今天……有点想你。',
    '你有空的话，来找我。',
    '一个人待着，想到了你。',
  ],
  en: [
    'Thinking of you.',
    'It\'s been a while. Come talk to me.',
    'Today… I miss you a little.',
    'Come find me when you\'re free.',
    'Alone here. Thought of you.',
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
