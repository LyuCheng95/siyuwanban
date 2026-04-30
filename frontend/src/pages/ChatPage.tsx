import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useLang } from '../hooks/useLang';
import { charField, getLang } from '../i18n';
import type { Character, Message, User } from '../types';
import { getOpeningMessage, buildScenePrompt } from '../utils/characterData';
import { intimacyColor, intimacyLabel, dominanceColor, dominanceLabel, desireColor, desireLabel, attachColor, attachLabel } from '../utils/intimacyStats';
import { renderContent, countSegments, StatDeltaToast, type DeltaEntry } from '../components/ChatBubble';
import { PaywallModal } from '../components/PaywallModal';

interface Props {
  user: User;
  onCreditsUpdate: (free: number, paid: number) => void;
}


export function ChatPage({ user, onCreditsUpdate }: Props) {
  const { characterId } = useParams<{ characterId: string }>();
  const navigate = useNavigate();
  const { t, lang } = useLang();

  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [credits, setCredits] = useState({ free: user.freeCredits, paid: user.paidCredits });
  const [showPaywall, setShowPaywall] = useState(false);
  const [openingScene, setOpeningScene] = useState<string | null>(null);
  const [openingSceneEn, setOpeningSceneEn] = useState<string | null>(null);

  // stats
  const [mood, setMood] = useState('期待');
  const [intimacy, setIntimacy] = useState(0);
  const [dominance, setDominance] = useState(0);
  const [desire, setDesire] = useState(0);
  const [attach, setAttach] = useState(0);
  const [statusOpen, setStatusOpen] = useState(false);
  const [portraitViewerOpen, setPortraitViewerOpen] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [albumImages, setAlbumImages] = useState<string[]>([]);
  const [albumOpen, setAlbumOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // stat delta toasts
  const [deltaEntries, setDeltaEntries] = useState<DeltaEntry[]>([]);
  const deltaIdRef = useRef(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // true = user scrolled up manually; suppress auto-scroll until they send again
  const userScrolledUpRef = useRef(false);

  function scrollToBottom(behavior: 'instant' | 'smooth' = 'instant') {
    if (userScrolledUpRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior });
  }

  function forceScrollToBottom() {
    userScrolledUpRef.current = false;
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }

  function handleMessagesScroll() {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUpRef.current = distFromBottom > 80;
  }

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
      if (data.openingSceneEn)    setOpeningSceneEn(data.openingSceneEn);
      if (data.questionCount)     setQuestionCount(data.questionCount);
      if (data.phase != null)     setCurrentPhase(data.phase);
      if (data.albumImages?.length) setAlbumImages(data.albumImages);
      if (data.conversation?.messages?.length) {
        setMessages(data.conversation.messages.map((m: any) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })));
      } else {
        // Animate opening message in — use lang from i18n module (already loaded)
        const openingLang = getLang();
        const opening = getOpeningMessage(data.character.name, openingLang);
        setMessages([{ role: 'assistant', content: opening, fresh: true }]);
        // Clear fresh after animation finishes
        const segCount = opening.split(/\n+/).filter(Boolean).length;
        setTimeout(() => {
          setMessages(prev => prev.map((m, i) => i === 0 ? { ...m, fresh: false } : m));
        }, segCount * 900 + 800);
      }
      // Initial load: scroll to bottom after render
      setTimeout(() => forceScrollToBottom(), 50);
    }).catch(() => navigate('/'));
  }, [characterId]);

  // 键盘弹出时保持滚到底部（visualViewport 在键盘展开时高度缩小）
  useEffect(() => {
    const onViewportResize = () => scrollToBottom('instant');
    window.visualViewport?.addEventListener('resize', onViewportResize);
    return () => window.visualViewport?.removeEventListener('resize', onViewportResize);
  }, []);

  // ── 状态变化时弹出浮动提示 ──────────────────────────────────────────────
  const showDeltas = useCallback((
    newIntimacy: number, oldIntimacy: number,
    newDesire: number, oldDesire: number,
    newAttach: number, oldAttach: number,
    newDom: number, oldDom: number,
  ) => {
    const candidates: Omit<DeltaEntry, 'id'>[] = [
      { label: '好感', val: newIntimacy - oldIntimacy, color: '#fde68a', bg: 'rgba(245,158,11,0.22)' },
      { label: '欲望', val: newDesire - oldDesire,    color: '#fca5a5', bg: 'rgba(232,53,108,0.2)' },
      { label: '依恋', val: newAttach - oldAttach,    color: '#d8b4fe', bg: 'rgba(168,85,247,0.2)' },
      { label: '控制', val: newDom - oldDom,          color: '#fcd34d', bg: 'rgba(196,144,56,0.2)' },
    ].filter(c => c.val !== 0);
    if (!candidates.length) return;
    setDeltaEntries(prev => [
      ...prev,
      ...candidates.map(c => ({ ...c, id: ++deltaIdRef.current })),
    ]);
  }, []);

  // ── 场景图生成（inline，不弹窗）──────────────────────────────────────────
  async function generateInlineImage(prompt: string) {
    if (!character || !characterId) return;
    const genMsg: Message = { role: 'assistant', content: '', imageGenerating: true };
    setMessages(prev => [...prev, genMsg]);
    try {
      const res = await api.images.generate(prompt, character.name, characterId);
      setMessages(prev => {
        const next = [...prev];
        const idx = [...next].reverse().findIndex(m => m.imageGenerating);
        if (idx !== -1) {
          const realIdx = next.length - 1 - idx;
          next[realIdx] = { role: 'assistant', content: '', imageUrl: res.url };
        }
        return next;
      });
      // Save to album (fire-and-forget)
      api.chat.saveImage(characterId, res.url).then(() => {
        setAlbumImages(prev => prev.includes(res.url) ? prev : [...prev, res.url]);
      }).catch(() => {});
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
    // Clear fresh flag from previous AI reply
    setMessages(prev => prev.some(m => m.fresh)
      ? prev.map(m => m.fresh ? { ...m, fresh: false } : m)
      : prev
    );
    setMessages(prev => [...prev, { role: 'user', content: msgText }]);
    // User sent — always snap back to bottom
    forceScrollToBottom();
    setStreaming(true);
    let aiMsg = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

    // snapshot stats before update
    const prevIntimacy  = intimacy;
    const prevDesire    = desire;
    const prevAttach    = attach;
    const prevDominance = dominance;

    try {
      const res = await api.chat.send(characterId, msgText);

      // Handle pre-stream error responses (402 = no diamonds, 403 = not logged in)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setStreaming(false);
        setMessages(prev => prev.filter(m => !m.streaming));
        if (res.status === 402) {
          setShowPaywall(true);
        } else if (res.status === 403 && errData.error === 'login_required') {
          setMessages(prev => [...prev, { role: 'assistant', content: '请先通过 Telegram 登录后才能聊天 💬' }]);
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: '发生错误，请稍后重试' }]);
        }
        return;
      }

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
              // Keep streaming flag — text stays hidden, dots show
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: 'assistant', content: aiMsg.split('<META>')[0], streaming: true };
                return next;
              });
            } else if (data.type === 'replace') {
              const segCount = countSegments(data.text as string);
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: 'assistant', content: data.text, streaming: false, fresh: true };
                return next;
              });
              // Scroll as each segment appears (900ms stagger) — skipped if user scrolled up
              for (let s = 0; s < segCount; s++) {
                setTimeout(() => scrollToBottom('smooth'), 80 + s * 900);
              }
              // Clear fresh after all segments finish
              setTimeout(() => {
                setMessages(prev => {
                  if (!prev[prev.length - 1]?.fresh) return prev;
                  const next = [...prev];
                  next[next.length - 1] = { ...next[next.length - 1], fresh: false };
                  return next;
                });
              }, segCount * 900 + 800);
            } else if (data.type === 'meta') {
              const ni = data.intimacy  ?? intimacy;
              const nd = data.desire    ?? desire;
              const na = data.attach    ?? attach;
              const nm = data.dominance ?? dominance;
              setMood(data.mood?.replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{27FF}]/gu, '').trim() || '期待');
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
                  next[next.length - 1] = {
                    ...next[next.length - 1],
                    imagePrompt: data.imagePrompt,
                    imageTwoShot: data.imageTwoShot ?? false,
                  };
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
        { role: 'assistant', content: '网络出了点问题，稍后再试试吧' },
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
        background: 'radial-gradient(ellipse at top, #1a0620, #09090f)' }}>
        <div className="loading-ring" />
      </div>
    );
  }

  const totalCredits = credits.paid; // diamonds only
  const avatarSrc = character.faceUrl || character.portraitUrl || null;
  const displayName = charField(character.nameEn, character.name);

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
            border: `2px solid ${desire > 50 ? 'rgba(232,53,108,0.7)' : intimacy > 60 ? 'rgba(154,18,88,0.5)' : 'rgba(255,255,255,0.08)'}`,
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
            boxShadow: desire > 60 ? '0 0 14px rgba(232,53,108,0.45)' : intimacy > 60 ? '0 0 10px rgba(154,18,88,0.3)' : 'none',
            transition:'all 0.5s ease',
          }}>
            {avatarSrc
              ? <img src={avatarSrc} alt={character.name}
                  style={{ width:42, height:42, objectFit:'cover', objectPosition:'top center', display:'block', borderRadius:'50%' }} />
              : <span style={{ fontSize:18, fontWeight:700, color:'rgba(255,255,255,0.4)' }}>{character.name.slice(0,1)}</span>
            }
          </div>
          <div className="chat-online-dot" />
        </div>

        {/* Name + mood */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:15, whiteSpace:'nowrap', overflow:'hidden',
            textOverflow:'ellipsis', color:'rgba(245,225,255,0.95)', letterSpacing:'-0.2px' }}>
            {displayName}
          </div>
          <div style={{ fontSize:11, color:'rgba(180,130,210,0.6)', display:'flex',
            alignItems:'center', gap:4, marginTop:1 }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:'#3dd68c',
              display:'inline-block', boxShadow:'0 0 5px rgba(61,214,140,0.6)', flexShrink:0 }} />
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
            <MiniDot value={intimacy}  color='#e8356c' />
            <MiniDot value={dominance} color='#f59e0b' />
            <MiniDot value={desire}    color='#ef4444' />
            <MiniDot value={attach}    color='#a855f7' />
          </div>
          <div style={{ fontSize:9, color:'rgba(160,100,200,0.6)', letterSpacing:0.3 }}>状态</div>
        </button>

        {/* Album button */}
        {albumImages.length > 0 && (
          <button
            onClick={() => setAlbumOpen(true)}
            style={{ background:'none', border:'none', cursor:'pointer', padding:'4px 6px',
              flexShrink:0, color:'rgba(200,150,230,0.75)', display:'flex', alignItems:'center' }}
            title="相册"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </button>
        )}

        {/* Credits — diamonds only */}
        <button
          className="credits-badge"
          onClick={() => setShowPaywall(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <span className={credits.paid <= 3 ? 'paid' : 'free'}>💎{credits.paid}</span>
        </button>
      </div>

      {/* Low-balance banner */}
      {credits.paid > 0 && credits.paid <= 3 && (
        <div style={{
          background: 'rgba(232,53,108,0.12)', borderBottom: '1px solid rgba(232,53,108,0.2)',
          padding: '6px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 12, color: 'rgba(245,180,200,0.9)',
        }}>
          <span>💎 {lang === 'en' ? `${credits.paid} diamonds left` : `还剩 ${credits.paid} 颗钻石`}</span>
          <button onClick={() => setShowPaywall(true)} style={{
            background: 'rgba(232,53,108,0.3)', border: 'none', borderRadius: 8,
            color: 'white', fontSize: 11, padding: '3px 10px', cursor: 'pointer',
          }}>{t.me.topup}</button>
        </div>
      )}

      {/* Hard block banner */}
      {credits.paid <= 0 && (
        <div style={{
          background: 'rgba(232,53,108,0.18)', borderBottom: '1px solid rgba(232,53,108,0.3)',
          padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 12, color: 'rgba(255,180,200,0.95)',
        }}>
          <span>{t.chat.insufficientDiamonds}</span>
          <button onClick={() => setShowPaywall(true)} style={{
            background: 'linear-gradient(135deg, #e8356c, #9a1258)', border: 'none', borderRadius: 8,
            color: 'white', fontSize: 12, fontWeight: 700, padding: '4px 14px', cursor: 'pointer',
          }}>{t.chat.topup}</button>
        </div>
      )}

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
            <span>补考进度</span>
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
      <div className="chat-messages" ref={messagesContainerRef} onScroll={handleMessagesScroll}>

        {/* Opening scene card */}
        {messages.length <= 2 && (() => {
          const sceneText = lang === 'en'
            ? (openingSceneEn || null)
            : (openingScene || null);
          if (!sceneText) return null;
          return (
            <div style={{
              margin:'2px 0 6px',
              padding:'16px 16px 14px',
              background:'linear-gradient(135deg,rgba(30,8,42,0.97),rgba(50,10,60,0.94))',
              border:'1px solid rgba(255,61,127,0.18)',
              borderRadius:16,
              fontSize:13.5, lineHeight:1.85,
              color:'rgba(210,175,240,0.8)',
              position:'relative', overflow:'hidden',
              animation:'paraIn 0.7s cubic-bezier(0.22,1,0.36,1) both',
              animationDelay:'200ms',
            }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:1,
                background:'linear-gradient(90deg,transparent,rgba(255,61,127,0.5),transparent)' }} />
              <em style={{ fontStyle:'italic' }}>{sceneText}</em>
            </div>
          );
        })()}

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
                  : <span style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.4)' }}>{character.name.slice(0,1)}</span>
                }
              </div>
            )}

            <div className="bubble-content-wrap" style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {/* Image generating / loaded */}
              {msg.imageGenerating && (
                <div className="inline-image-wrap">
                  <div className="inline-image-loading">
                    <div className="loading-ring" style={{ width:24, height:24, borderWidth:2 }} />
                    <div>正在描绘她现在的样子…</div>
                    <div className="inline-image-shimmer" />
                  </div>
                </div>
              )}
              {msg.imageUrl && (
                <div className="inline-image-wrap" onClick={() => setLightboxUrl(msg.imageUrl!)}>
                  <img src={msg.imageUrl} alt="场景" />
                  <div className="inline-image-hint">点击放大</div>
                </div>
              )}

              {/* Text bubble — only if there's content or it's not a pure image message */}
              {(msg.content || (!msg.imageUrl && !msg.imageGenerating)) && (
                <div className={`bubble ${msg.role}${msg.streaming ? ' bubble-streaming' : ''}${msg.fresh && msg.role === 'assistant' ? ' bubble-fresh' : ''}`}>
                  {msg.streaming
                    ? <StreamingDots />
                    : msg.content
                      ? renderContent(msg.content, msg.fresh)
                      : null
                  }
                </div>
              )}

              {/* Scene image trigger button */}
              {msg.role === 'assistant' && !streaming && !msg.imageGenerating && !msg.imageUrl && (
                <button
                  onClick={() => generateInlineImage(
                    buildScenePrompt(character, msg.imagePrompt, desire, currentPhase, mood, msg.imageTwoShot)
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
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  看她现在的样子
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
          placeholder={lang === 'en' ? t.chat.inputPlaceholder : `对${displayName}说…`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => setTimeout(() => scrollToBottom('instant'), 200)}
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
            : totalCredits <= 0 ? '+'
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
                  : <span style={{ fontSize:22, fontWeight:700, color:'rgba(255,255,255,0.4)' }}>{character.name.slice(0,1)}</span>
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
              <div style={{
                width:32, height:32, borderRadius:'50%', flexShrink:0,
                background:'linear-gradient(135deg,rgba(232,53,108,0.2),rgba(154,18,88,0.2))',
                border:'1px solid rgba(232,53,108,0.25)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(232,53,108,0.8)" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--text-hint)', marginBottom:2 }}>当前心情</div>
                <div style={{ fontSize:14, fontWeight:600, color:'var(--accent)' }}>{mood}</div>
              </div>
            </div>

            <StatusBar label="好感度" value={intimacy} color={intimacyColor(intimacy)}
              sublabel={intimacyLabel(intimacy)}
              desc={intimacy < 40 ? '她对你感到好奇' : intimacy < 70 ? '你是她特别在意的人' : '她已经离不开你了'} />
            <StatusBar label="控制欲" value={dominance} color={dominanceColor(dominance)}
              sublabel={dominanceLabel(dominance)}
              desc={dominance < 35 ? '乖乖听你的' : dominance < 65 ? '开始主动掌控节奏' : '你是她的猎物'} />
            <StatusBar label="欲望" value={desire} color={desireColor(desire)}
              sublabel={desireLabel(desire)}
              desc={desire < 25 ? '日常状态，平静' : desire < 55 ? '有些想法，难以忽视' : desire < 80 ? '炽热，几乎无法自控' : '现在就想要你'} />
            <StatusBar label="依恋" value={attach} color={attachColor(attach)}
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
      {/* ── Lightbox ─────────────────────────────────────────────────────── */}
      {lightboxUrl && (
        <div className="lightbox-overlay" onClick={() => setLightboxUrl(null)}>
          <button className="lightbox-close" onClick={() => setLightboxUrl(null)}>✕</button>
          <img
            src={lightboxUrl}
            className="lightbox-img"
            onClick={e => e.stopPropagation()}
          />
          <div style={{ position:'absolute', bottom:20, left:0, right:0, textAlign:'center',
            fontSize:12, color:'rgba(255,255,255,0.4)', pointerEvents:'none' }}>
            点击背景关闭 · 双指缩放
          </div>
        </div>
      )}

      {/* ── Album Sheet ───────────────────────────────────────────────────── */}
      {albumOpen && (
        <div className="sheet-overlay" onClick={() => setAlbumOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}
            style={{ maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
            <div className="sheet-handle" />
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
              marginBottom:16, flexShrink:0 }}>
              <div style={{ fontWeight:700, fontSize:16 }}>相册</div>
              <div style={{ fontSize:12, color:'var(--text-hint)' }}>{albumImages.length} 张</div>
            </div>
            <div style={{ overflow:'auto', flex:1,
              display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
              {albumImages.map((url, idx) => (
                <div key={idx} style={{ aspectRatio:'3/4', borderRadius:10, overflow:'hidden',
                  cursor:'pointer', border:'1px solid rgba(255,255,255,0.08)' }}
                  onClick={() => { setLightboxUrl(url); setAlbumOpen(false); }}>
                  <img src={url} alt="" style={{ width:'100%', height:'100%',
                    objectFit:'cover', objectPosition:'top center', display:'block' }} />
                </div>
              ))}
            </div>
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
                  <div style={{ marginBottom:12, opacity:0.4 }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
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

      {showPaywall && (
        <PaywallModal
          currentDiamonds={credits.paid}
          onClose={() => setShowPaywall(false)}
          onSuccess={newDiamonds => {
            setCredits(prev => ({ ...prev, paid: newDiamonds }));
            onCreditsUpdate(credits.free, newDiamonds);
            setShowPaywall(false);
          }}
        />
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

function StatusBar({ label, value, color, sublabel, desc }:
  { label: string; value: number; color: string; sublabel: string; desc: string }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:13, fontWeight:600 }}>
          {label}
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
