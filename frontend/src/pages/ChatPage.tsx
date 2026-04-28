import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Character, Message, User } from '../types';

interface Props {
  user: User;
  onCreditsUpdate: (free: number, paid: number) => void;
}

function buildPortraitPrompt(char: Character): string {
  const tags = char.personality.split(/[、,，\s]+/).filter(Boolean).slice(0, 4).join(', ');
  return `(photorealistic:1.4), (hyperrealistic:1.3), RAW photo, 8k uhd, masterpiece, 1girl, solo, adult, ${char.age} years old, asian, ${char.occupation}, ${tags}, beautiful face, perfect body, (nude:1.3), (nsfw:1.3), bedroom, soft dramatic lighting, shallow depth of field, detailed skin, film grain`;
}

function intimacyColor(level: number): string {
  if (level < 30) return 'linear-gradient(90deg, #6366f1, #8b5cf6)';
  if (level < 60) return 'linear-gradient(90deg, #a855f7, #ec4899)';
  if (level < 85) return 'linear-gradient(90deg, #ec4899, #ff3d7f)';
  return 'linear-gradient(90deg, #ff3d7f, #ef4444)';
}

function intimacyLabel(level: number): string {
  if (level < 20) return '初识';
  if (level < 40) return '熟悉';
  if (level < 60) return '亲近';
  if (level < 80) return '亲密';
  if (level < 95) return '深爱';
  return '灵魂伴侣 💞';
}

export function ChatPage({ user, onCreditsUpdate }: Props) {
  const { characterId } = useParams<{ characterId: string }>();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [credits, setCredits] = useState({ free: user.freeCredits, paid: user.paidCredits });
  const [portraitOpen, setPortraitOpen] = useState(false);
  const [portraitLoading, setPortraitLoading] = useState(false);
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null);

  // Interactive engagement state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [mood, setMood] = useState<string>('期待✨');
  const [intimacy, setIntimacy] = useState<number>(0);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!characterId) return;
    api.chat.get(characterId).then((data: any) => {
      setCharacter(data.character);
      setCredits(data.credits);
      if (data.intimacy != null) setIntimacy(data.intimacy);
      if (data.mood) setMood(data.mood);
      if (data.conversation?.messages?.length) {
        setMessages(data.conversation.messages.map((m: any) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })));
      } else {
        setMessages([{
          role: 'assistant',
          content: `嗯…你终于来了 💋 我是${data.character.name}，一直在等你呢…`,
        }]);
      }
    }).catch(() => navigate('/'));
  }, [characterId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, suggestions]);

  async function generatePortrait() {
    if (!character || portraitLoading) return;
    setPortraitOpen(true);
    setPortraitUrl(null);
    setPortraitLoading(true);
    try {
      const res = await api.images.generate(buildPortraitPrompt(character));
      setPortraitUrl(res.url);
    } catch {
      setPortraitUrl(null);
    } finally {
      setPortraitLoading(false);
    }
  }

  async function send(text?: string) {
    const msgText = (text ?? input).trim();
    if (!msgText || streaming || !characterId) return;

    setInput('');
    setSuggestions([]);
    setMessages(prev => [...prev, { role: 'user', content: msgText }]);
    setStreaming(true);
    let aiMsg = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

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
              // Hide <META> tag from display in real time
              const displayMsg = aiMsg.split('<META>')[0];
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: 'assistant', content: displayMsg };
                return next;
              });

            } else if (data.type === 'replace') {
              // Backend-cleaned text (definitive)
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: 'assistant', content: data.text };
                return next;
              });

            } else if (data.type === 'meta') {
              setMood(data.mood || '期待✨');
              setIntimacy(data.intimacy ?? intimacy);
              setSuggestions(data.suggestions || []);

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

  if (!character) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div className="pulse">💋</div>
      </div>
    );
  }

  const totalCredits = credits.free + credits.paid;

  return (
    <div className="chat-page">
      {/* Header */}
      <div className="chat-header">
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text)', padding: '0 4px', flexShrink: 0 }}
        >‹</button>

        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'linear-gradient(135deg, #3d1a4a, #7c1a6a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            border: '2px solid rgba(255,255,255,0.1)',
          }}>{character.avatarEmoji}</div>
          <div className="chat-online-dot" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {character.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: '#4ade80',
              display: 'inline-block', boxShadow: '0 0 5px rgba(74,222,128,0.7)', flexShrink: 0,
            }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mood}</span>
          </div>
        </div>

        <button className="portrait-btn" onClick={generatePortrait} title="看她现在的样子">📸</button>

        <div className="credits-badge">
          {credits.free > 0
            ? <span className="free">💚 {credits.free}</span>
            : <span className="paid">⭐ {credits.paid}</span>
          }
        </div>
      </div>

      {/* Intimacy bar */}
      <div style={{ height: 3, background: 'var(--bg-elevated)', flexShrink: 0, position: 'relative', overflow: 'visible' }}>
        <div style={{
          height: '100%',
          width: `${intimacy}%`,
          background: intimacyColor(intimacy),
          transition: 'width 0.8s ease, background 0.8s ease',
          borderRadius: '0 2px 2px 0',
          boxShadow: intimacy > 0 ? '0 0 6px rgba(255,61,127,0.4)' : 'none',
        }} />
        {intimacy > 0 && (
          <div style={{
            position: 'absolute', right: 8, top: 5,
            fontSize: 10, color: 'var(--text-hint)', whiteSpace: 'nowrap',
            background: 'var(--bg)', padding: '0 4px', borderRadius: 4,
          }}>
            {intimacyLabel(intimacy)} {intimacy}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`bubble-wrap ${msg.role}`}>
            {msg.role === 'assistant' && (
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #3d1a4a, #7c1a6a)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              }}>{character.avatarEmoji}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: '75%' }}>
              <div className={`bubble ${msg.role}`} style={{ whiteSpace: 'pre-wrap' }}>
                {msg.content || (streaming && i === messages.length - 1
                  ? <span style={{ opacity: 0.4, fontSize: 20, letterSpacing: 4 }}>···</span>
                  : ''
                )}
              </div>
              {msg.imageUrl && (
                <img
                  src={msg.imageUrl}
                  alt="场景图"
                  style={{ borderRadius: 12, maxWidth: '100%', cursor: 'pointer', border: '1px solid var(--border)' }}
                  onClick={() => window.open(msg.imageUrl!, '_blank')}
                />
              )}
            </div>
          </div>
        ))}

        {/* Quick reply suggestions */}
        {suggestions.length > 0 && !streaming && (
          <div className="suggestions-wrap">
            {suggestions.map((s, i) => (
              <button key={i} className="suggestion-chip" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <textarea
          className="chat-input"
          placeholder={`对${character.name}说点什么…`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          disabled={streaming}
        />
        <button
          className="chat-send-btn"
          onClick={() => send()}
          disabled={(!input.trim() && !streaming) || streaming}
        >
          {streaming ? (
            <span style={{ fontSize: 14, letterSpacing: 2, opacity: 0.7 }}>···</span>
          ) : totalCredits <= 0 ? '⭐' : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
            </svg>
          )}
        </button>
      </div>

      {/* Portrait sheet */}
      {portraitOpen && (
        <div className="sheet-overlay" onClick={() => { if (!portraitLoading) setPortraitOpen(false); }}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{character.name} 现在的样子</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                  {portraitLoading ? 'AI 正在为你生成，约需1-3分钟…' : '点击图片可放大查看'}
                </div>
              </div>
              {!portraitLoading && (
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--text-hint)', fontSize: 22, cursor: 'pointer' }}
                  onClick={() => setPortraitOpen(false)}
                >×</button>
              )}
            </div>
            {portraitLoading ? (
              <div className="portrait-loading">
                <div className="pulse">{character.avatarEmoji}</div>
                <div>正在为你描绘她的样子…</div>
                <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>约需 1–3 分钟，请耐心等待</div>
              </div>
            ) : portraitUrl ? (
              <>
                <img className="portrait-image" src={portraitUrl} alt={character.name} onClick={() => window.open(portraitUrl, '_blank')} />
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={generatePortrait}>重新生成</button>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPortraitOpen(false)}>关闭</button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-hint)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
                <div>生成失败，请确保 ComfyUI 正在运行</div>
                <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={generatePortrait}>重试</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
