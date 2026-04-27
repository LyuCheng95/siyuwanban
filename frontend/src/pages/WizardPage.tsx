import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const ARCHETYPES = [
  { label: '御姐系', icon: '👸', sub: '成熟气质、掌控感' },
  { label: '清纯学妹', icon: '🎀', sub: '天真可爱、青春感' },
  { label: '性感人妻', icon: '💋', sub: '风情万种、懂你' },
  { label: '女神范儿', icon: '✨', sub: '高冷神秘、难追到' },
  { label: '邻家女孩', icon: '🌸', sub: '温暖亲切、日常感' },
  { label: '腹黑系', icon: '🌙', sub: '心机深沉、难以捉摸' },
  { label: '元气少女', icon: '⚡', sub: '活力四射、阳光' },
  { label: '知性白领', icon: '💼', sub: '聪明干练、职场风' },
];

const AGES = [
  { label: '18–20岁', value: 19 },
  { label: '21–24岁', value: 22 },
  { label: '25–29岁', value: 27 },
  { label: '30–35岁', value: 32 },
];

const PERSONALITIES = [
  '温柔体贴', '主动撩人', '傲娇可爱', '腹黑撩人',
  '元气满满', '害羞腼腆', '霸道占有', '知性优雅',
  '热情奔放', '神秘感十足',
];

const OCCUPATIONS = [
  { label: '大学生', icon: '📚' },
  { label: '护士', icon: '💉' },
  { label: '教师', icon: '🎓' },
  { label: '秘书', icon: '📋' },
  { label: '模特/主播', icon: '📸' },
  { label: '家庭主妇', icon: '🏠' },
  { label: '职场精英', icon: '💼' },
  { label: '艺术家', icon: '🎨' },
];

const RELATIONSHIPS = [
  { label: '刚认识', icon: '👋', sub: '神秘陌生人' },
  { label: '青梅竹马', icon: '🌱', sub: '从小认识' },
  { label: '热恋情侣', icon: '💕', sub: '甜蜜恋人' },
  { label: '秘密情人', icon: '🔑', sub: '不能说的关系' },
  { label: '禁忌之恋', icon: '🔥', sub: '越界的吸引' },
  { label: '老夫老妻', icon: '💍', sub: '相互了解' },
];

const EMOJIS = [
  '👩','💃','🌸','🌺','🌹','💋','👄','🦋',
  '🌙','✨','🍑','💕','🌷','🔥','💎','🌊',
  '🎀','👑','🌈','💫','🍒','🌿','🦊','🐰',
  '💖','🌟','🎭','🍓','🌙','💜','🌸','🎪',
];

interface Selections {
  archetype: string;
  age: number;
  personalities: string[];
  occupation: string;
  relationship: string;
  background: string;
  name: string;
  emoji: string;
  isPublic: boolean;
}

const STEPS = ['类型', '年龄', '性格', '职业', '关系', '故事', '定名'];

export function WizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [sel, setSel] = useState<Selections>({
    archetype: '', age: 22, personalities: [],
    occupation: '', relationship: '', background: '',
    name: '', emoji: '🌸', isPublic: true,
  });

  function canNext(): boolean {
    if (step === 0) return !!sel.archetype;
    if (step === 1) return !!sel.age;
    if (step === 2) return sel.personalities.length > 0;
    if (step === 3) return !!sel.occupation;
    if (step === 4) return !!sel.relationship;
    if (step === 5) return true;
    if (step === 6) return sel.name.trim().length >= 1;
    return true;
  }

  function togglePersonality(p: string) {
    setSel(s => ({
      ...s,
      personalities: s.personalities.includes(p)
        ? s.personalities.filter(x => x !== p)
        : [...s.personalities, p],
    }));
  }

  async function finish() {
    if (!canNext() || saving) return;
    setSaving(true);
    try {
      const personality = [sel.archetype, ...sel.personalities, sel.relationship].join('、');
      const speakingStyleMap: Record<string, string> = {
        '御姐系': '成熟优雅，偶尔强势，用"本小姐"自称',
        '清纯学妹': '天真可爱，说话带点撒娇，常用"嗯嗯""哥哥"',
        '性感人妻': '温柔风情，说话软糯，充满暗示和撩拨',
        '女神范儿': '高冷简洁，不轻易示弱，偶尔露出温柔',
        '邻家女孩': '亲切自然，说话轻松日常，像老朋友',
        '腹黑系': '表面温柔，话中有话，喜欢反将一军',
        '元气少女': '活泼开朗，语气跳跃，多用感叹号和颜文字',
        '知性白领': '理性干练，措辞精准，偶尔展露柔情',
      };
      const speakingStyle = speakingStyleMap[sel.archetype] || `${sel.archetype}风格，${sel.personalities[0] || '温柔'}的说话方式`;

      const char = await api.characters.create({
        name: sel.name.trim(),
        age: sel.age,
        gender: '女',
        occupation: sel.occupation,
        personality,
        background: sel.background.trim() || `${sel.archetype}风格，${sel.relationship}的关系`,
        speakingStyle,
        avatarEmoji: sel.emoji,
        isPublic: sel.isPublic,
      });
      navigate(`/chat/${char.id}`, { replace: true });
    } catch (e) {
      console.error('创建角色失败', e);
      setSaving(false);
    }
  }

  function next() {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else finish();
  }

  function back() {
    if (step > 0) setStep(s => s - 1);
    else navigate(-1);
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="wizard-page">
      {/* Progress bar */}
      <div className="wizard-progress">
        <div className="wizard-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Header */}
      <div className="chat-header">
        <button
          onClick={back}
          style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text)', padding: '0 4px' }}
        >
          ‹
        </button>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-2)' }}>
          创建角色 {step + 1}/{STEPS.length}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i <= step ? 16 : 6,
              height: 6,
              borderRadius: 3,
              background: i < step ? 'var(--accent)' : i === step ? 'var(--gradient)' : 'var(--bg-elevated)',
              transition: 'all 0.2s',
            }} />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="wizard-content">

        {/* Step 0: Archetype */}
        {step === 0 && (
          <>
            <div className="wizard-q">你想要什么类型的她？</div>
            <div className="wizard-sub">选择一种最吸引你的气质类型</div>
            <div className="option-grid">
              {ARCHETYPES.map(a => (
                <div
                  key={a.label}
                  className={`option-chip-lg ${sel.archetype === a.label ? 'selected' : ''}`}
                  onClick={() => setSel(s => ({ ...s, archetype: a.label }))}
                >
                  <span className="chip-icon">{a.icon}</span>
                  {a.label}
                  <div className="chip-sub">{a.sub}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Step 1: Age */}
        {step === 1 && (
          <>
            <div className="wizard-q">她大概多大？</div>
            <div className="wizard-sub">年龄会影响她的谈话方式和心态</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {AGES.map(a => (
                <div
                  key={a.label}
                  className={`option-chip-lg ${sel.age === a.value ? 'selected' : ''}`}
                  onClick={() => setSel(s => ({ ...s, age: a.value }))}
                  style={{ padding: '18px 20px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <span style={{ fontSize: 20 }}>
                    {a.value <= 20 ? '🌱' : a.value <= 24 ? '🌸' : a.value <= 29 ? '🌹' : '💎'}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{a.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                      {a.value <= 20 ? '青春活力、懵懂可爱' :
                       a.value <= 24 ? '青春与成熟的过渡' :
                       a.value <= 29 ? '成熟风韵、有内涵' : '人生阅历丰富、懂男人'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Step 2: Personality */}
        {step === 2 && (
          <>
            <div className="wizard-q">她是什么性格？</div>
            <div className="wizard-sub">可以多选，打造专属于你的她</div>
            <div className="option-grid">
              {PERSONALITIES.map(p => (
                <div
                  key={p}
                  className={`option-chip ${sel.personalities.includes(p) ? 'selected' : ''}`}
                  onClick={() => togglePersonality(p)}
                >
                  {sel.personalities.includes(p) && <span style={{ marginRight: 4 }}>✓</span>}
                  {p}
                </div>
              ))}
            </div>
            {sel.personalities.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--accent)' }}>
                已选 {sel.personalities.length} 个性格特征
              </div>
            )}
          </>
        )}

        {/* Step 3: Occupation */}
        {step === 3 && (
          <>
            <div className="wizard-q">她从事什么职业？</div>
            <div className="wizard-sub">职业塑造她的谈吐和气场</div>
            <div className="option-grid">
              {OCCUPATIONS.map(o => (
                <div
                  key={o.label}
                  className={`option-chip-lg ${sel.occupation === o.label ? 'selected' : ''}`}
                  onClick={() => setSel(s => ({ ...s, occupation: o.label }))}
                >
                  <span className="chip-icon">{o.icon}</span>
                  {o.label}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Step 4: Relationship */}
        {step === 4 && (
          <>
            <div className="wizard-q">你们是什么关系？</div>
            <div className="wizard-sub">关系决定了她对待你的方式</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {RELATIONSHIPS.map(r => (
                <div
                  key={r.label}
                  className={`option-chip-lg ${sel.relationship === r.label ? 'selected' : ''}`}
                  onClick={() => setSel(s => ({ ...s, relationship: r.label }))}
                  style={{ padding: '16px 20px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14 }}
                >
                  <span style={{ fontSize: 28 }}>{r.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{r.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Step 5: Background */}
        {step === 5 && (
          <>
            <div className="wizard-q">关于她，还有什么故事？</div>
            <div className="wizard-sub">可选 — 描述她的背景、特点、秘密……越具体越真实</div>
            <textarea
              className="text-input"
              placeholder={`比如：她是一个在咖啡馆打工的大学生，平时喜欢看漫画，第一次见你就对你有好感，但是很害羞不敢说出口……`}
              value={sel.background}
              onChange={e => setSel(s => ({ ...s, background: e.target.value }))}
              style={{ minHeight: 160, fontSize: 14 }}
            />
            <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-hint)', marginTop: 6 }}>
              {sel.background.length}/500
            </div>
          </>
        )}

        {/* Step 6: Name + Emoji + Public */}
        {step === 6 && (
          <>
            <div className="wizard-q">最后，给她起个名字</div>
            <div className="wizard-sub">一个好名字让她更有灵魂</div>

            <input
              className="name-input"
              placeholder="她叫什么？"
              value={sel.name}
              onChange={e => setSel(s => ({ ...s, name: e.target.value }))}
              maxLength={20}
            />

            {/* TODO: 智能生成头像 — 根据角色设定（性格、职业、气质）调用 AI 图片生成接口
                自动生成专属头像，替换手动选 emoji 的方式。
                接口已有 /api/images/generate，需要：
                1. 在完成所有步骤后自动触发生成
                2. 显示 loading 状态
                3. 生成的图片 URL 存入 character.avatarUrl 字段（需加 DB 字段）
                4. 保留 emoji 作为备选/占位符 */}
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>选择头像</div>
            <div className="emoji-grid">
              {EMOJIS.map(e => (
                <div
                  key={e}
                  className={`emoji-opt ${sel.emoji === e ? 'selected' : ''}`}
                  onClick={() => setSel(s => ({ ...s, emoji: e }))}
                >
                  {e}
                </div>
              ))}
            </div>

            <div className="toggle-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>公开到广场</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>让其他人也能和她聊天</div>
              </div>
              <button
                className={`toggle ${sel.isPublic ? 'on' : ''}`}
                onClick={() => setSel(s => ({ ...s, isPublic: !s.isPublic }))}
              />
            </div>

            {/* Preview */}
            {sel.name && (
              <div style={{
                marginTop: 16, padding: '14px 16px',
                background: 'var(--bg-card)', borderRadius: 'var(--radius)',
                border: '1px solid var(--border-accent)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ fontSize: 36 }}>{sel.emoji}</div>
                <div>
                  <div style={{ fontWeight: 700 }}>{sel.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    {sel.age}岁 · {sel.occupation} · {sel.archetype}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>
                    {sel.personalities.slice(0, 3).join(' · ')}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="wizard-footer">
        {step > 0 && (
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={back}>
            上一步
          </button>
        )}
        <button
          className="btn btn-primary"
          style={{ flex: step === 0 ? 1 : 2 }}
          disabled={!canNext() || saving}
          onClick={next}
        >
          {saving ? '创建中...' : step === STEPS.length - 1 ? '✦ 开始聊天' : '下一步'}
        </button>
      </div>
    </div>
  );
}
