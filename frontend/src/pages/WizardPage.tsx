import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Message } from '../types';

const WELCOME = '你好！我是角色创建向导 ✨\n\n我会通过几个简单的问题，帮你设计一个独特的AI陪伴角色。\n\n首先，你想创建什么类型的角色？比如温柔的姐姐、知性的老师、幽默的朋友……';

export function WizardPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: WELCOME },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const res = await api.characters.wizard(text);
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply }]);

      if (res.isComplete && res.characterData) {
        setSaving(true);
        try {
          const char = await api.characters.create(res.characterData);
          setMessages(prev => [
            ...prev,
            { role: 'assistant', content: `🎉 角色「${char.name}」创建成功！现在可以开始对话了～` },
          ]);
          setTimeout(() => navigate(`/chat/${char.id}`), 1500);
        } catch {
          setMessages(prev => [...prev, { role: 'assistant', content: '保存角色时出错了，请重试' }]);
        } finally {
          setSaving(false);
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '出错了，请重试一下 🙏' }]);
    } finally {
      setLoading(false);
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  async function reset() {
    await api.characters.wizardReset().catch(() => {});
    setMessages([{ role: 'assistant', content: WELCOME }]);
    setInput('');
  }

  return (
    <div className="wizard-page">
      {/* Header */}
      <div className="chat-header">
        <button
          onClick={() => { reset(); navigate(-1); }}
          style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text)' }}
        >
          ‹
        </button>
        <div style={{ fontWeight: 600 }}>✨ 角色创建向导</div>
        <button
          onClick={reset}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 13, color: 'var(--accent)', cursor: 'pointer' }}
        >
          重新开始
        </button>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`bubble-wrap ${msg.role}`}>
            {msg.role === 'assistant' && (
              <div style={{ fontSize: 28, alignSelf: 'flex-end' }}>✨</div>
            )}
            <div className={`bubble ${msg.role}`} style={{ whiteSpace: 'pre-wrap' }}>
              {msg.content}
            </div>
          </div>
        ))}
        {(loading || saving) && (
          <div className="bubble-wrap assistant">
            <div style={{ fontSize: 28 }}>✨</div>
            <div className="bubble assistant" style={{ color: 'var(--text-hint)' }}>
              {saving ? '正在保存角色...' : '思考中...'}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <textarea
          ref={textareaRef}
          className="chat-input"
          placeholder="告诉我你的想法..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          disabled={loading || saving}
        />
        <button className="chat-send-btn" onClick={send} disabled={!input.trim() || loading || saving}>
          ↑
        </button>
      </div>
    </div>
  );
}
