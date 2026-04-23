import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { api } from '../api/client';
import type { Character, Message, User } from '../types';

interface Props {
  user: User;
  onCreditsUpdate: (free: number, paid: number) => void;
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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!characterId) return;
    api.chat.get(characterId).then(data => {
      setCharacter(data.character);
      setCredits(data.credits);
      if (data.conversation?.messages) {
        setMessages(
          data.conversation.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
        );
      } else {
        // First visit: show greeting
        setMessages([{
          role: 'assistant',
          content: `你好！我是${data.character.name}～ 很高兴认识你 😊`,
        }]);
      }
    }).catch(() => navigate('/'));
  }, [characterId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || streaming || !characterId) return;

    const totalCredits = credits.free + credits.paid;
    if (totalCredits <= 0) { setNeedPayment(true); return; }

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setStreaming(true);

    let aiMsg = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await api.chat.send(characterId, text);

      if (res.status === 402) {
        setNeedPayment(true);
        setMessages(prev => prev.slice(0, -2));
        setStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
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
              const newCredits = data.credits;
              setCredits(newCredits);
              onCreditsUpdate(newCredits.free, newCredits.paid);
            }
          } catch {}
        }
      }
    } catch {
      setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: '发送失败，请重试 🙏' }]);
    } finally {
      setStreaming(false);
    }
  }

  async function openPayment() {
    try {
      const tiers = await api.payments.tiers();
      // Show Telegram payment sheet with mid tier
      const { invoiceLink } = await api.payments.createInvoice(1);
      WebApp.openInvoice(invoiceLink, (status) => {
        if (status === 'paid') {
          setCredits(prev => ({ ...prev, paid: prev.paid + tiers[1].turns }));
          onCreditsUpdate(credits.free, credits.paid + tiers[1].turns);
          setNeedPayment(false);
        }
      });
    } catch {
      WebApp.showAlert('无法创建付款，请稍后重试');
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  if (!character) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ color: 'var(--text-hint)' }}>加载中...</div>
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
          style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text)' }}
        >
          ‹
        </button>
        <div style={{ fontSize: 28 }}>{character.avatarEmoji}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{character.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>{character.occupation}</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <div className="credits-badge">
            {credits.free > 0
              ? <span className="free">💚 {credits.free}免费</span>
              : <span className="paid">⭐ {credits.paid}次</span>
            }
          </div>
        </div>
      </div>

      {/* Payment banner */}
      {needPayment && (
        <div style={{
          background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
          color: 'white',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>免费次数已用完 ⭐</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>购买次数继续和{character.name}聊天</div>
          </div>
          <button
            className="btn"
            style={{ background: 'white', color: '#7c3aed', padding: '8px 14px', fontSize: 13 }}
            onClick={openPayment}
          >
            购买
          </button>
          <button
            style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer' }}
            onClick={() => setNeedPayment(false)}
          >
            ×
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`bubble-wrap ${msg.role}`}>
            {msg.role === 'assistant' && (
              <div style={{ fontSize: 24, alignSelf: 'flex-end' }}>{character.avatarEmoji}</div>
            )}
            <div className={`bubble ${msg.role}`} style={{ whiteSpace: 'pre-wrap' }}>
              {msg.content || (streaming && i === messages.length - 1 ? (
                <span style={{ opacity: 0.5 }}>正在输入...</span>
              ) : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <textarea
          className="chat-input"
          placeholder={totalCredits <= 0 ? '购买次数后继续聊天' : `和${character.name}说些什么...`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          disabled={streaming || totalCredits <= 0}
        />
        <button
          className="chat-send-btn"
          onClick={totalCredits <= 0 ? openPayment : send}
          disabled={totalCredits <= 0 ? false : (!input.trim() || streaming)}
        >
          {totalCredits <= 0 ? '⭐' : '↑'}
        </button>
      </div>
    </div>
  );
}
