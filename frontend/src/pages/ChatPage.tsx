import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Character, Message, User } from '../types';

interface Props {
  user: User;
  onCreditsUpdate: (free: number, paid: number) => void;
}

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

function getOpeningMessage(name: string): string {
  return CHARACTER_OPENINGS[name] ?? `……你来了。\n\n我是${name}，等你等了很久了。`;
}

// ── 角色图像基底（与album一致的体型外貌描述，用于场景图生成）──────────────────
const CHARACTER_IMAGE_BASES: Record<string, { style: 'real' | 'anime'; base: string }> = {
  '椎名老师': { style: 'real',  base: '24yo japanese woman, 157cm 44kg, milky white skin, round apricot eyes black-frame glasses, soft round innocent face, small B cup breasts, teacher school uniform' },
  '晓彤':     { style: 'real',  base: '22yo chinese woman, 163cm 53kg, fair rosy-white skin, peach-blossom eyes compact jawline, athletic toned body abs, firm C cup breasts' },
  '娜娜':     { style: 'real',  base: '18yo chinese girl, 155cm 42kg, snow white skin, cat upturned eyes heart-shaped face, petite tiny frame, small A cup perky breasts, school uniform' },
  '小雨':     { style: 'real',  base: '19yo chinese college girl, 160cm 46kg, luminous snow-fair skin, huge round innocent eyes baby-round face, slim delicate figure, full C cup breasts' },
  '琉璃':     { style: 'real',  base: '22yo chinese graduate student, 161cm 47kg, cold pale-white skin, willow-leaf eyes thin glasses, small delicate face blunt bangs, small B cup breasts, lab coat' },
  '沈静':     { style: 'real',  base: '25yo chinese supermodel, 178cm 56kg, pale ivory cool skin, deep-set cold eyes sharp cheekbones v-line, extremely tall slender legs, small B cup model breasts' },
  '小慧':     { style: 'real',  base: '23yo chinese nurse, 159cm 47kg, tender pale-white skin, gentle large round eyes soft apple-cheeked face, slim gentle figure, soft C cup breasts, nurse uniform' },
  '夜玲':     { style: 'real',  base: '26yo chinese artist, 162cm 48kg, snow-white translucent pale skin, smoky soul-capturing eyes v-line pointed face, black choker, firm C cup breasts' },
  '晴晴':     { style: 'real',  base: '21yo chinese streamer, 158cm 46kg, fair rosy-white skin, round aegyo-sal eyes apple-cheeked round face, energetic petite figure, perky B+ cup breasts' },
  '唐诗':     { style: 'real',  base: '27yo chinese secretary, 163cm 49kg, jade cool-white skin, classic almond eyes graceful oval face, slim graceful figure, full C cup breasts, work blouse' },
  '阿柒':     { style: 'real',  base: '22yo chinese barista, 160cm 47kg, fair peachy-white skin, crescent-smile eyes soft round face, natural slim figure, natural B cup breasts, cafe apron' },
  '糖糖':     { style: 'real',  base: '20yo chinese art student, 157cm 45kg, fair rosy-white skin, doe-eyes doll-face round with dimples, cute slim figure, soft B+ cup breasts, overalls' },
  'X-23':     { style: 'anime', base: '1girl android cyborg, platinum white hair neon streaks, glowing blue circuit eyes, beautiful synthetic face, tactical bodysuit' },
  '幻音':     { style: 'anime', base: '1girl AI holographic singer, shifting prismatic long hair, glowing ethereal eyes, translucent light-formed outfit' },
  '狐九':     { style: 'anime', base: '1girl fox girl, fox ears nine tails, silver white flowing hair, amber slit eyes, ethereal beautiful face, silk hanfu' },
  '冷霜':     { style: 'anime', base: '1girl ice cultivator, silver blue long hair, cold glowing eyes, pale luminous skin, ice-blue cultivation robes' },
  '魅罗':     { style: 'anime', base: '1girl demon girl, dark purple flowing hair, crimson slit eyes, small horns, beautiful evil face, dark torn dress' },
};

// 结合角色属性 + 当前状态/阶段 构建场景 prompt
// 注意：quality prefix 由后端 comfyui.ts 按角色对应模型自动添加，这里只需传 scene 描述
function buildScenePrompt(
  char: Character,
  aiScene: string | undefined,
  desire: number,
  phase: number,
  mood: string,
): string {
  const cfg  = CHARACTER_IMAGE_BASES[char.name];
  const base = cfg?.base ?? `${char.age}yo chinese woman, ${char.occupation}, porcelain fair skin, beautiful Asian face`;

  // AI 已经给出场景描述 → 直接使用
  if (aiScene) {
    const desireCtx = desire > 70 ? ', (aroused flushed:1.3), heavy breathing' : desire > 40 ? ', seductive expression' : '';
    return `1girl, ${base}, ${aiScene}${desireCtx}`;
  }

  // 否则根据阶段 + 欲望自动推断场景
  let clothingCtx = '';
  if      (phase <= 1) clothingCtx = 'fully clothed, elegant pose, soft warm lighting, bedroom or living room';
  else if (phase === 2) clothingCtx = 'partially undressed, shirt open showing underwear, intimate bedroom atmosphere, soft candlelight';
  else if (phase === 3) clothingCtx = 'barely clothed, lingerie or thin robe, seductive reclining pose, dim moody bedroom';
  else                  clothingCtx = 'completely nude, intimate sensual scene, bedroom, shallow depth of field, soft dramatic light';

  let desireCtx = '';
  if      (desire > 75) desireCtx = ', (aroused:1.3), flushed cheeks, lips parted, (wet:1.2), craving expression';
  else if (desire > 50) desireCtx = ', seductive alluring expression, inviting gaze, slightly disheveled';
  else if (desire > 25) desireCtx = ', soft flirtatious expression, hint of anticipation';

  // 性格关键词抽取（前3个）
  const personalityHint = char.personality.split(/[、,，\s]+/).slice(0, 3).join(', ');

  return `1girl, ${base}, ${clothingCtx}${desireCtx}, ${personalityHint} expression, cinematic portrait`;
}

// ── 状态颜色 & 标签 ────────────────────────────────────────────────────────────
function intimacyColor(v: number) {
  if (v < 30) return 'linear-gradient(90deg,#6366f1,#8b5cf6)';
  if (v < 60) return 'linear-gradient(90deg,#a855f7,#ec4899)';
  if (v < 85) return 'linear-gradient(90deg,#ec4899,#ff3d7f)';
  return 'linear-gradient(90deg,#ff3d7f,#ef4444)';
}
function intimacyLabel(v: number) {
  if (v < 20) return '初识'; if (v < 40) return '熟悉';
  if (v < 60) return '亲近'; if (v < 80) return '亲密';
  if (v < 95) return '深爱'; return '灵魂伴侣';
}
function dominanceColor(v: number) {
  if (v < 40) return 'linear-gradient(90deg,#6366f1,#8b5cf6)';
  if (v < 70) return 'linear-gradient(90deg,#f59e0b,#ef4444)';
  return 'linear-gradient(90deg,#ef4444,#dc2626)';
}
function dominanceLabel(v: number) {
  if (v < 30) return '温顺'; if (v < 55) return '主动';
  if (v < 80) return '强势'; return '支配';
}
function desireColor(v: number) {
  if (v < 25) return 'linear-gradient(90deg,#334155,#475569)';
  if (v < 50) return 'linear-gradient(90deg,#f59e0b,#f97316)';
  if (v < 75) return 'linear-gradient(90deg,#ef4444,#dc2626)';
  return 'linear-gradient(90deg,#dc2626,#991b1b)';
}
function desireLabel(v: number) {
  if (v < 20) return '平静'; if (v < 50) return '心动';
  if (v < 75) return '炽热'; return '燃烧🔥';
}
function attachColor(v: number) {
  if (v < 30) return 'linear-gradient(90deg,#22c55e,#16a34a)';
  if (v < 60) return 'linear-gradient(90deg,#06b6d4,#0891b2)';
  if (v < 80) return 'linear-gradient(90deg,#a855f7,#9333ea)';
  return 'linear-gradient(90deg,#ec4899,#db2777)';
}
function attachLabel(v: number) {
  if (v < 25) return '独立'; if (v < 50) return '在意';
  if (v < 75) return '依赖'; return '占有💜';
}

// ── 渲染消息内容：段落 + 台词 + 旁白 ──────────────────────────────────────────
function renderContent(text: string) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <>
      {paragraphs.filter(p => p.trim()).map((para, pi) => {
        // 先按 *旁白* 拆分
        const parts = para.split(/(\*[^*\n]+\*)/g);
        return (
          <p key={pi}>
            {parts.map((seg, si) => {
              if (seg.startsWith('*') && seg.endsWith('*')) {
                return <em key={si} className="narration">{seg.slice(1, -1)}</em>;
              }
              // 再按引号台词拆分
              const dialogParts = seg.split(/([""][^""]+[""]|「[^」]+」|『[^』]+』|"[^"]+"|'[^']+')/g);
              return dialogParts.map((dp, di) => {
                if (/^["「『"']/.test(dp) && dp.length > 2) {
                  return <span key={`${si}_${di}`} className="dialogue">{dp}</span>;
                }
                return <span key={`${si}_${di}`}>{dp}</span>;
              });
            })}
          </p>
        );
      })}
    </>
  );
}

// ── 状态变化浮动提示 ────────────────────────────────────────────────────────────
interface DeltaEntry { id: number; label: string; val: number; color: string; bg: string }

function StatDeltaToast({ entries, onExpire }: { entries: DeltaEntry[]; onExpire: (id: number) => void }) {
  return (
    <div className="stat-delta-container">
      {entries.map(e => (
        <div
          key={e.id}
          className="stat-delta-item"
          style={{ background: e.bg, color: e.color }}
          onAnimationEnd={() => onExpire(e.id)}
        >
          {e.label} {e.val > 0 ? `+${e.val}` : e.val}
        </div>
      ))}
    </div>
  );
}

export function ChatPage({ user, onCreditsUpdate }: Props) {
  const { characterId } = useParams<{ characterId: string }>();
  const navigate = useNavigate();

  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [credits, setCredits] = useState({ free: user.freeCredits, paid: user.paidCredits });
  const [openingScene, setOpeningScene] = useState<string | null>(null);

  // stats
  const [mood, setMood] = useState('期待✨');
  const [intimacy, setIntimacy] = useState(0);
  const [dominance, setDominance] = useState(0);
  const [desire, setDesire] = useState(0);
  const [attach, setAttach] = useState(0);
  const [statusOpen, setStatusOpen] = useState(false);
  const [portraitViewerOpen, setPortraitViewerOpen] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // stat delta toasts
  const [deltaEntries, setDeltaEntries] = useState<DeltaEntry[]>([]);
  const deltaIdRef = useRef(0);

  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Load conversation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!characterId) return;
    api.chat.get(characterId).then((data: any) => {
      setCharacter(data.character);
      setCredits(data.credits);
      if (data.intimacy != null) setIntimacy(data.intimacy);
      if (data.dominance != null) setDominance(data.dominance);
      if (data.desire != null)    setDesire(data.desire);
      if (data.attach != null)    setAttach(data.attach);
      if (data.mood)              setMood(data.mood);
      if (data.openingScene)      setOpeningScene(data.openingScene);
      if (data.questionCount)     setQuestionCount(data.questionCount);
      if (data.phase != null)     setCurrentPhase(data.phase);
      if (data.conversation?.messages?.length) {
        setMessages(data.conversation.messages.map((m: any) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })));
      } else {
        setMessages([{ role: 'assistant', content: getOpeningMessage(data.character.name) }]);
      }
    }).catch(() => navigate('/'));
  }, [characterId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, suggestions]);

  // 键盘弹出时保持滚到底部（visualViewport 在键盘展开时高度缩小）
  useEffect(() => {
    const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    window.visualViewport?.addEventListener('resize', scrollToBottom);
    return () => window.visualViewport?.removeEventListener('resize', scrollToBottom);
  }, []);

  // ── 状态变化时弹出浮动提示 ──────────────────────────────────────────────
  const showDeltas = useCallback((
    newIntimacy: number, oldIntimacy: number,
    newDesire: number, oldDesire: number,
    newAttach: number, oldAttach: number,
    newDom: number, oldDom: number,
  ) => {
    const candidates: Omit<DeltaEntry, 'id'>[] = [
      { label: '💛 好感', val: newIntimacy - oldIntimacy, color: '#fde68a', bg: 'rgba(245,158,11,0.25)' },
      { label: '🔥 欲望',  val: newDesire - oldDesire,    color: '#fca5a5', bg: 'rgba(239,68,68,0.22)' },
      { label: '💜 依恋',  val: newAttach - oldAttach,    color: '#d8b4fe', bg: 'rgba(168,85,247,0.22)' },
      { label: '🎯 控制',  val: newDom - oldDom,          color: '#fcd34d', bg: 'rgba(251,191,36,0.2)' },
    ].filter(c => c.val !== 0);
    if (!candidates.length) return;
    setDeltaEntries(prev => [
      ...prev,
      ...candidates.map(c => ({ ...c, id: ++deltaIdRef.current })),
    ]);
  }, []);

  // ── 场景图生成（inline，不弹窗）──────────────────────────────────────────
  async function generateInlineImage(prompt: string) {
    if (!character) return;
    const genMsg: Message = { role: 'assistant', content: '', imageGenerating: true };
    setMessages(prev => [...prev, genMsg]);
    try {
      const res = await api.images.generate(prompt, character.name);
      setMessages(prev => {
        const next = [...prev];
        const idx = [...next].reverse().findIndex(m => m.imageGenerating);
        if (idx !== -1) {
          const realIdx = next.length - 1 - idx;
          next[realIdx] = { role: 'assistant', content: '', imageUrl: res.url };
        }
        return next;
      });
    } catch {
      setMessages(prev => {
        const next = [...prev];
        const idx = [...next].reverse().findIndex(m => m.imageGenerating);
        if (idx !== -1) next.splice(next.length - 1 - idx, 1);
        return next;
      });
    }
  }

  // ── 点击头像 → 展开现有写真大图 ─────────────────────────────────────────
  function handleAvatarClick() {
    if (!character) return;
    setPortraitViewerOpen(true);
  }

  // ── 发送消息 ─────────────────────────────────────────────────────────────
  async function send(text?: string) {
    const msgText = (text ?? input).trim();
    if (!msgText || streaming || !characterId) return;
    setInput('');
    setSuggestions([]);
    setMessages(prev => [...prev, { role: 'user', content: msgText }]);
    setStreaming(true);
    let aiMsg = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    // snapshot stats before update
    const prevIntimacy  = intimacy;
    const prevDesire    = desire;
    const prevAttach    = attach;
    const prevDominance = dominance;

    try {
      const res = await api.chat.send(characterId, msgText);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'chunk') {
              aiMsg += data.text;
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: 'assistant', content: aiMsg.split('<META>')[0] };
                return next;
              });
            } else if (data.type === 'replace') {
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: 'assistant', content: data.text };
                return next;
              });
            } else if (data.type === 'meta') {
              const ni = data.intimacy  ?? intimacy;
              const nd = data.desire    ?? desire;
              const na = data.attach    ?? attach;
              const nm = data.dominance ?? dominance;
              setMood(data.mood || '期待✨');
              setIntimacy(ni); setDominance(nm);
              setDesire(nd);   setAttach(na);
              setSuggestions(data.suggestions || []);
              if (data.questionCount) setQuestionCount(data.questionCount);
              if (data.phase != null)  setCurrentPhase(data.phase);
              // 浮动提示
              showDeltas(ni, prevIntimacy, nd, prevDesire, na, prevAttach, nm, prevDominance);
              // scene image
              if (data.imagePrompt) {
                setMessages(prev => {
                  const next = [...prev];
                  next[next.length - 1] = { ...next[next.length - 1], imagePrompt: data.imagePrompt };
                  return next;
                });
              }
            } else if (data.type === 'done') {
              setCredits(data.credits);
              onCreditsUpdate(data.credits.free, data.credits.paid);
            } else if (data.type === 'image' && data.url) {
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { ...next[next.length - 1], imageUrl: data.url };
                return next;
              });
            }
          } catch {}
        }
      }
    } catch {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: '网络出了点问题，稍后再试试吧 🙏' },
      ]);
    } finally {
      setStreaming(false);
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!character) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh',
        background: 'radial-gradient(ellipse at top, #1e0828, #0d0d12)' }}>
        <div className="pulse">💋</div>
      </div>
    );
  }

  const totalCredits = credits.free + credits.paid;
  const avatarSrc = character.faceUrl || character.portraitUrl || null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="chat-page">

      {/* ── 状态变化浮动提示 ─────────────────────────────────────────────── */}
      <StatDeltaToast
        entries={deltaEntries}
        onExpire={id => setDeltaEntries(prev => prev.filter(e => e.id !== id))}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="chat-header">
        <button
          onClick={() => navigate(-1)}
          style={{ background:'none', border:'none', fontSize:22, cursor:'pointer',
            color:'rgba(240,200,255,0.7)', padding:'0 2px', flexShrink:0 }}
        >‹</button>

        {/* Avatar */}
        <div style={{ position:'relative', flexShrink:0, cursor:'pointer' }}
          onClick={handleAvatarClick}>
          <div style={{
            width:42, height:42, borderRadius:'50%', overflow:'hidden', flexShrink:0,
            background:'linear-gradient(135deg,#3d1a4a,#7c1a6a)',
            border: `2px solid ${desire > 50 ? 'rgba(255,61,127,0.7)' : intimacy > 60 ? 'rgba(192,38,211,0.5)' : 'rgba(255,255,255,0.1)'}`,
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
            boxShadow: desire > 60 ? '0 0 14px rgba(255,61,127,0.5)' : intimacy > 60 ? '0 0 10px rgba(192,38,211,0.35)' : 'none',
            transition:'all 0.5s ease',
          }}>
            {avatarSrc
              ? <img src={avatarSrc} alt={character.name}
                  style={{ width:42, height:42, objectFit:'cover', objectPosition:'top center', display:'block', borderRadius:'50%' }} />
              : character.avatarEmoji
            }
          </div>
          <div className="chat-online-dot" />
        </div>

        {/* Name + mood */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:15, whiteSpace:'nowrap', overflow:'hidden',
            textOverflow:'ellipsis', color:'rgba(245,225,255,0.95)', letterSpacing:'-0.2px' }}>
            {character.name}
          </div>
          <div style={{ fontSize:11, color:'rgba(200,150,230,0.65)', display:'flex',
            alignItems:'center', gap:4, marginTop:1 }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:'#4ade80',
              display:'inline-block', boxShadow:'0 0 5px rgba(74,222,128,0.7)', flexShrink:0 }} />
            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{mood}</span>
          </div>
        </div>

        {/* 4-metric mini dots */}
        <button
          onClick={() => setStatusOpen(true)}
          style={{ background:'none', border:'none', cursor:'pointer', padding:'4px 6px',
            flexShrink:0, display:'flex', flexDirection:'column', gap:3, alignItems:'center' }}
        >
          <div style={{ display:'flex', gap:3 }}>
            <MiniDot value={intimacy}  color='#ff3d7f' />
            <MiniDot value={dominance} color='#f59e0b' />
            <MiniDot value={desire}    color='#ef4444' />
            <MiniDot value={attach}    color='#a855f7' />
          </div>
          <div style={{ fontSize:9, color:'rgba(160,100,200,0.6)', letterSpacing:0.3 }}>状态</div>
        </button>

        {/* Credits */}
        <div className="credits-badge">
          {credits.free > 0
            ? <span className="free">💚 {credits.free}</span>
            : <span className="paid">⭐ {credits.paid}</span>
          }
        </div>
      </div>

      {/* ── Intimacy bar ─────────────────────────────────────────────────── */}
      <div style={{ height:2, background:'rgba(255,255,255,0.04)', flexShrink:0, overflow:'hidden' }}>
        <div style={{
          height:'100%', width:`${intimacy}%`,
          background: intimacyColor(intimacy),
          transition:'width 0.9s ease, background 0.9s ease',
          boxShadow: intimacy > 0 ? '0 0 6px rgba(255,61,127,0.6)' : 'none',
        }} />
      </div>

      {/* ── 椎名老师题目进度 ──────────────────────────────────────────────── */}
      {character.name === '椎名老师' && questionCount > 0 && (
        <div style={{ padding:'6px 16px 4px', background:'rgba(168,85,247,0.06)',
          borderBottom:'1px solid rgba(168,85,247,0.12)', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
            fontSize:11, color:'rgba(160,100,200,0.7)', marginBottom:4 }}>
            <span>📝 补考进度</span>
            <span style={{ color: questionCount >= 25 ? '#4ade80' : 'var(--accent)', fontWeight:700, fontSize:12 }}>
              第 {questionCount} 题 / 25{questionCount >= 25 ? ' ✓' : ''}
            </span>
          </div>
          <div style={{ height:3, background:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden' }}>
            <div style={{
              height:'100%', width:`${Math.min((questionCount / 25) * 100, 100)}%`,
              background: questionCount >= 25 ? 'linear-gradient(90deg,#4ade80,#22c55e)' : 'linear-gradient(90deg,#a855f7,#ec4899)',
              borderRadius:2, transition:'width 0.5s ease',
            }} />
          </div>
        </div>
      )}

      {/* ── Messages ─────────────────────────────────────────────────────── */}
      <div className="chat-messages">

        {/* Opening scene card */}
        {openingScene && messages.length <= 2 && (
          <div style={{
            margin:'2px 0 6px',
            padding:'16px 16px 14px',
            background:'linear-gradient(135deg,rgba(30,8,42,0.97),rgba(50,10,60,0.94))',
            border:'1px solid rgba(255,61,127,0.18)',
            borderRadius:16,
            fontSize:13.5, lineHeight:1.85,
            color:'rgba(210,175,240,0.8)',
            fontStyle:'italic', position:'relative', overflow:'hidden',
          }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:1,
              background:'linear-gradient(90deg,transparent,rgba(255,61,127,0.5),transparent)' }} />
            {openingScene}
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, i) => (
          <div key={i} className={`bubble-wrap ${msg.role}`}>
            {msg.role === 'assistant' && (
              <div style={{
                width:28, height:28, borderRadius:'50%', flexShrink:0, overflow:'hidden',
                background:'linear-gradient(135deg,#3d1a4a,#7c1a6a)',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:14,
                border:'1.5px solid rgba(255,61,127,0.2)',
              }}>
                {avatarSrc
                  ? <img src={avatarSrc} alt="" style={{ width:28, height:28, objectFit:'cover', objectPosition:'top center', display:'block', borderRadius:'50%' }} />
                  : character.avatarEmoji
                }
              </div>
            )}

            <div className="bubble-content-wrap" style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {/* Image generating / loaded */}
              {msg.imageGenerating && (
                <div className="inline-image-wrap">
                  <div className="inline-image-loading">
                    <div style={{ fontSize:22 }}>✨</div>
                    <div>正在描绘她现在的样子…</div>
                    <div className="inline-image-shimmer" />
                  </div>
                </div>
              )}
              {msg.imageUrl && (
                <div className="inline-image-wrap">
                  <img
                    src={msg.imageUrl} alt="场景"
                    onClick={() => window.open(msg.imageUrl!, '_blank')}
                  />
                </div>
              )}

              {/* Text bubble — only if there's content or it's not a pure image message */}
              {(msg.content || (!msg.imageUrl && !msg.imageGenerating)) && (
                <div className={`bubble ${msg.role}`}>
                  {msg.content
                    ? renderContent(msg.content)
                    : (streaming && i === messages.length - 1
                        ? <StreamingDots />
                        : null)
                  }
                </div>
              )}

              {/* Scene image trigger button */}
              {msg.role === 'assistant' && !streaming && !msg.imageGenerating && !msg.imageUrl && (
                <button
                  onClick={() => generateInlineImage(
                    buildScenePrompt(character, msg.imagePrompt, desire, currentPhase, mood)
                  )}
                  style={{
                    alignSelf:'flex-start',
                    background:'linear-gradient(135deg,rgba(255,61,127,0.12),rgba(192,38,211,0.12))',
                    border:'1px solid rgba(255,61,127,0.25)',
                    borderRadius:20, padding:'5px 14px',
                    fontSize:12, color:'rgba(255,150,200,0.85)', cursor:'pointer',
                    display:'flex', alignItems:'center', gap:5,
                    fontWeight:600, marginTop:2,
                  }}
                >
                  👁 看她现在的样子
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Quick replies */}
        {suggestions.length > 0 && !streaming && (
          <div className="suggestions-wrap">
            {suggestions.map((s, i) => (
              <button key={i} className="suggestion-chip" onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ────────────────────────────────────────────────────────── */}
      <div className="chat-input-area">
        <textarea
          className="chat-input"
          placeholder={`对${character.name}说…`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 200)}
          rows={1}
          disabled={streaming}
        />
        <button
          className="chat-send-btn"
          onClick={() => send()}
          disabled={(!input.trim() && !streaming) || streaming}
        >
          {streaming
            ? <StreamingDots />
            : totalCredits <= 0 ? '⭐'
            : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
              </svg>
            )
          }
        </button>
      </div>

      {/* ── Status Panel ─────────────────────────────────────────────────── */}
      {statusOpen && (
        <div className="sheet-overlay" onClick={() => setStatusOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxHeight:'80vh' }}>
            <div className="sheet-handle" />

            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:22 }}>
              <div style={{
                width:48, height:48, borderRadius:'50%', overflow:'hidden', flexShrink:0,
                background:'linear-gradient(135deg,#3d1a4a,#7c1a6a)',
                border:'2px solid rgba(255,61,127,0.3)',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:26,
              }}>
                {avatarSrc
                  ? <img src={avatarSrc} alt="" style={{ width:48, height:48, objectFit:'cover', objectPosition:'top center', display:'block', borderRadius:'50%' }} />
                  : character.avatarEmoji
                }
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:17 }}>{character.name}</div>
                <div style={{ fontSize:12, color:'var(--text-2)', marginTop:2 }}>{character.occupation}</div>
              </div>
              <div style={{ marginLeft:'auto', textAlign:'center' }}>
                <div style={{ display:'inline-block', background: intimacyColor(intimacy),
                  borderRadius:20, padding:'4px 12px', fontSize:12, fontWeight:700, color:'white' }}>
                  {intimacyLabel(intimacy)}
                </div>
                <div style={{ fontSize:10, color:'var(--text-hint)', marginTop:4 }}>第 {currentPhase}/4 章</div>
              </div>
            </div>

            {/* Mood */}
            <div style={{ marginBottom:18, padding:'10px 14px',
              background:'var(--gradient-soft)', border:'1px solid var(--border-accent)',
              borderRadius:12, display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ fontSize:20 }}>{mood.match(/[\u{1F300}-\u{1FFFF}]|[\u{2600}-\u{27FF}]/u)?.[0] ?? '💭'}</div>
              <div>
                <div style={{ fontSize:11, color:'var(--text-hint)', marginBottom:2 }}>当前心情</div>
                <div style={{ fontSize:14, fontWeight:600, color:'var(--accent)' }}>{mood}</div>
              </div>
            </div>

            <StatusBar label="好感度" icon="💛" value={intimacy} color={intimacyColor(intimacy)}
              sublabel={intimacyLabel(intimacy)}
              desc={intimacy < 40 ? '她对你感到好奇' : intimacy < 70 ? '你是她特别在意的人' : '她已经离不开你了'} />
            <StatusBar label="控制欲" icon="🎯" value={dominance} color={dominanceColor(dominance)}
              sublabel={dominanceLabel(dominance)}
              desc={dominance < 35 ? '乖乖听你的' : dominance < 65 ? '开始主动掌控节奏' : '你是她的猎物'} />
            <StatusBar label="欲望" icon="🔥" value={desire} color={desireColor(desire)}
              sublabel={desireLabel(desire)}
              desc={desire < 25 ? '日常状态，平静' : desire < 55 ? '有些想法，难以忽视' : desire < 80 ? '炽热，几乎无法自控' : '现在就想要你'} />
            <StatusBar label="依恋" icon="🌸" value={attach} color={attachColor(attach)}
              sublabel={attachLabel(attach)}
              desc={attach < 30 ? '保持独立，给你空间' : attach < 60 ? '你在她心里很特别' : attach < 80 ? '少了你就不行' : '你只能是她一个人的'} />

            {intimacy < 100 && (
              <div style={{ fontSize:11, color:'var(--text-hint)', textAlign:'center', margin:'4px 0 16px' }}>
                还需 {100 - intimacy} 点好感升级关系
              </div>
            )}
            <button className="btn btn-secondary btn-full" onClick={() => setStatusOpen(false)}>关闭</button>
          </div>
        </div>
      )}
      {/* ── Portrait Viewer（写真大图） ──────────────────────────────────── */}
      {portraitViewerOpen && (
        <div className="sheet-overlay" onClick={() => setPortraitViewerOpen(false)}>
          <div
            style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center', padding:'0 0 env(safe-area-inset-bottom)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setPortraitViewerOpen(false)}
              style={{ position:'absolute', top:16, right:16, zIndex:10,
                background:'rgba(0,0,0,0.6)', border:'1px solid rgba(255,255,255,0.2)',
                color:'white', borderRadius:'50%', width:36, height:36,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:18, cursor:'pointer' }}
            >×</button>

            {/* Images */}
            {(() => {
              const imgs: string[] = [];
              if (character.portraitImages?.length) imgs.push(...character.portraitImages);
              else if (character.portraitUrl) imgs.push(character.portraitUrl);
              if (!imgs.length) return (
                <div style={{ color:'rgba(200,150,230,0.6)', fontSize:14, textAlign:'center' }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>🖼</div>
                  还没有写真，先去对话提升好感吧
                </div>
              );
              return (
                <div style={{ width:'100%', height:'100%', overflowX:'auto', overflowY:'hidden',
                  display:'flex', scrollSnapType:'x mandatory', WebkitOverflowScrolling:'touch' as any }}>
                  {imgs.map((url, idx) => (
                    <div key={idx} style={{ flex:'0 0 100%', height:'100%', scrollSnapAlign:'start',
                      display:'flex', alignItems:'center', justifyContent:'center', padding:'0 8px' }}>
                      <img
                        src={url}
                        alt={`${character.name} ${idx + 1}`}
                        style={{ maxHeight:'90vh', maxWidth:'100%', objectFit:'contain',
                          borderRadius:12, boxShadow:'0 4px 40px rgba(0,0,0,0.8)' }}
                        onClick={() => window.open(url, '_blank')}
                      />
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Count hint */}
            {(character.portraitImages?.length ?? 0) > 1 && (
              <div style={{ position:'absolute', bottom:40,
                background:'rgba(0,0,0,0.5)', color:'rgba(255,255,255,0.7)',
                borderRadius:20, padding:'4px 14px', fontSize:12 }}>
                左右滑动查看全部 {character.portraitImages!.length} 张
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 子组件 ────────────────────────────────────────────────────────────────────
function MiniDot({ value, color }: { value: number; color: string }) {
  return (
    <div style={{
      width:8, height:8, borderRadius:'50%',
      background: value > 15 ? color : 'rgba(255,255,255,0.08)',
      opacity: value > 15 ? 0.65 + (value / 100) * 0.35 : 0.3,
      border: `1px solid ${value > 15 ? color : 'rgba(255,255,255,0.08)'}`,
      transition:'all 0.5s ease',
      boxShadow: value > 50 ? `0 0 6px ${color}90` : 'none',
    }} />
  );
}

function StatusBar({ label, icon, value, color, sublabel, desc }:
  { label: string; icon: string; value: number; color: string; sublabel: string; desc: string }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:13, fontWeight:600 }}>
          <span>{icon}</span>{label}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:11, fontWeight:700, color:'white',
            background: color, borderRadius:10, padding:'2px 8px' }}>{sublabel}</span>
          <span style={{ fontSize:11, color:'var(--text-hint)' }}>{value}</span>
        </div>
      </div>
      <div style={{ height:6, background:'var(--bg-elevated)', borderRadius:3, overflow:'hidden', marginBottom:4 }}>
        <div style={{
          height:'100%', width:`${value}%`, background: color,
          borderRadius:3, transition:'width 0.7s ease',
          boxShadow:'0 0 6px rgba(255,255,255,0.08)',
        }} />
      </div>
      <div style={{ fontSize:11, color:'var(--text-hint)' }}>{desc}</div>
    </div>
  );
}

function StreamingDots() {
  return (
    <span style={{ display:'inline-flex', gap:4, alignItems:'center', padding:'2px 0' }}>
      {[0,1,2].map(i => (
        <span key={i} style={{
          width:5, height:5, borderRadius:'50%',
          background:'rgba(200,150,230,0.6)',
          animation:`dotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          display:'inline-block',
        }} />
      ))}
      <style>{`
        @keyframes dotBounce {
          0%,80%,100%{transform:scale(0.6);opacity:0.4}
          40%{transform:scale(1);opacity:1}
        }
      `}</style>
    </span>
  );
}
