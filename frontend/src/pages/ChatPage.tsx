import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
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

export function ChatPage({ user, onCreditsUpdate }: Props) {
  const { characterId } = useParams<{ characterId: string }>();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [credits, setCredits] = useState({ free: user.freeCredits, paid: user.paidCredits });
  const [needPayment, setNeedPayment] = useState(false);
  const [portraitOpen, setPortraitOpen] = useState(false);
  const [portraitLoading, setPortraitLoading] = useState(false);
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!characterId) return;
    api.chat.get(characterId).then(data => {
      setCharacter(data.character);
      setCredits(data.credits);
      if (data.conversation?.messages?.length) {
        setMessages(data.conversation.messages.map(m => ({
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
  }, [messages]);

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

  async function send() {
    const text = input.trim();
    if (!text || streaming || !characterId) return;
    // TODO: re-enable payment check before launch
    // const total = credits.free + credits.paid;
    // if (total <= 0) { setNeedPayment(true); return; }

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setStreaming(true);
    let aiMsg = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await api.chat.send(characterId, text);
      // TODO: re-enable before launch
      // if (res.status === 402) { setNeedPayment(true); ... }
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
                next[next.length - 1] = { role: 'assistant', content: aiMsg };
                return next;
              });
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

  async function openPayment() {
    try {
      const tiers = await api.payments.tiers();
      const { invoiceLink } = await api.payments.createInvoice(1);
      WebApp.openInvoice(invoiceLink, (status) => {
        if (status === 'paid') {
          setCredits(prev => ({ ...prev, paid: prev.paid + tiers[1].turns }));
          onCreditsUpdate(credits.free, credits.paid + tiers[1].turns);
          setNeedPayment(false);
        }
      });
    } catch {
      WebApp.showAlert('无法创建订单，请稍后重试');
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  if (!character) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div style={{ animation: 'pulse 1.5s ease-in-out infinite' }} className="pulse">💋</div>
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
          style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text)', padding: '0 4px' }}
        >‹</button>

        <div style={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #3d1a4a, #7c1a6a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>{character.avatarEmoji}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {character.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{character.occupation}</div>
        </div>

        {/* 看她现在的样子 */}
        <button
          className="portrait-btn"
          onClick={generatePortrait}
          title="看她现在的样子"
        >
          📸
        </button>

        <div className="credits-badge">
          {credits.free > 0
            ? <span className="free">💚 {credits.free}</span>
            : <span className="paid">⭐ {credits.paid}</span>
          }
        </div>
      </div>

      {/* TODO: re-enable payment banner before launch */}

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
                  onClick={() => WebApp.openLink(msg.imageUrl!)}
                />
              )}
            </div>
          </div>
        ))}
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
          onClick={send}
          disabled={!input.trim() || streaming}
        >
          {totalCredits <= 0 ? '⭐' : '↑'}
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
                <img
                  className="portrait-image"
                  src={portraitUrl}
                  alt={character.name}
                  onClick={() => WebApp.openLink(portraitUrl)}
                />
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={generatePortrait}
                  >
                    重新生成
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setPortraitOpen(false)}
                  >
                    关闭
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-hint)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
                <div>生成失败，请确保 ComfyUI 正在运行</div>
                <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={generatePortrait}>
                  重试
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
