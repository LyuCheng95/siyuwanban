import { useState } from 'react';
import { api } from '../api/client';

interface Props {
  onDone: (nickname: string) => void;
  onSkip: () => void;
}

export function NicknameModal({ onDone, onSkip }: Props) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    const name = value.trim();
    if (!name) return;
    setSaving(true);
    try {
      await api.auth.setNickname(name);
      onDone(name);
    } catch {
      setSaving(false);
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') submit();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: 'linear-gradient(145deg, #1a0a24, #120818)',
        border: '1px solid rgba(255,61,127,0.22)',
        borderRadius: 24,
        padding: '36px 24px 28px',
        width: '100%',
        maxWidth: 340,
        textAlign: 'center',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 40px rgba(232,53,108,0.08)',
      }}>
        <div style={{ fontSize: 44, marginBottom: 14, lineHeight: 1 }}>✨</div>
        <div style={{
          fontSize: 21, fontWeight: 700,
          color: 'rgba(245,225,255,0.95)',
          marginBottom: 8, letterSpacing: '-0.3px',
        }}>
          你叫什么名字？
        </div>
        <div style={{
          fontSize: 14, color: 'rgba(180,130,210,0.65)',
          marginBottom: 28, lineHeight: 1.65,
        }}>
          她们会用这个名字叫你
        </div>

        <input
          autoFocus
          type="text"
          placeholder="输入你的昵称…"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKey}
          maxLength={20}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.06)',
            border: `1.5px solid ${value.trim() ? 'rgba(232,53,108,0.5)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 12,
            padding: '13px 16px',
            fontSize: 17,
            color: 'rgba(245,225,255,0.95)',
            outline: 'none',
            marginBottom: 16,
            boxSizing: 'border-box',
            textAlign: 'center',
            transition: 'border-color 0.2s ease',
          }}
        />

        <button
          onClick={submit}
          disabled={!value.trim() || saving}
          style={{
            width: '100%',
            background: value.trim()
              ? 'linear-gradient(135deg, #e8356c, #9a1258)'
              : 'rgba(255,255,255,0.07)',
            border: 'none',
            borderRadius: 12,
            padding: '14px',
            fontSize: 16,
            fontWeight: 700,
            color: value.trim() ? 'white' : 'rgba(255,255,255,0.3)',
            cursor: value.trim() && !saving ? 'pointer' : 'default',
            transition: 'all 0.25s ease',
            boxShadow: value.trim() ? '0 4px 20px rgba(232,53,108,0.35)' : 'none',
          }}
        >
          {saving ? '保存中…' : '开始'}
        </button>

        <button
          onClick={onSkip}
          style={{
            marginTop: 14, background: 'none', border: 'none',
            color: 'rgba(180,130,210,0.45)', fontSize: 13, cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          跳过
        </button>
      </div>
    </div>
  );
}
