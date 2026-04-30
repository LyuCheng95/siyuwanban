// ── 拆分为动画段落：每个 *旁白* 和每行对话分别成段 ────────────────────────────
interface Segment { content: string; type: 'narration' | 'text' }

// Strip any <META>...</META> block (safety net for leaked tags or old DB content)
function stripMeta(text: string): string {
  return text
    .replace(/<META>[\s\S]*?<\/META>/gi, '')
    .replace(/<META>[\s\S]*/gi, '')   // unclosed tag at end
    .trim();
}

function splitIntoSegments(text: string): Segment[] {
  const out: Segment[] = [];
  for (const line of stripMeta(text).split(/\n+/)) {
    const t = line.trim();
    if (!t) continue;
    const parts = t.split(/(\*[^*\n]+\*)/g);
    for (const part of parts) {
      const p = part.trim();
      if (!p) continue;
      if (p.startsWith('*') && p.endsWith('*')) {
        out.push({ content: p.slice(1, -1), type: 'narration' });
      } else {
        out.push({ content: p, type: 'text' });
      }
    }
  }
  return out;
}

export function countSegments(text: string): number {
  return splitIntoSegments(text).length;
}

function renderInline(text: string) {
  return text.split(/([""][^""]+[""]|「[^」]+」|『[^』]+』|"[^"]+"|'[^']+')/g).map((dp, di) => {
    if (/^["「『"']/.test(dp) && dp.length > 2) {
      return <span key={di} className="dialogue">{dp}</span>;
    }
    return <span key={di}>{dp}</span>;
  });
}

// ── 渲染消息内容：每个旁白/台词行独立出现 ──────────────────────────────────────
export function renderContent(text: string, fresh = false) {
  const segments = splitIntoSegments(text);
  return (
    <>
      {segments.map((seg, idx) => {
        const animStyle: React.CSSProperties | undefined = fresh ? {
          opacity: 0,
          animation: 'paraIn 0.55s cubic-bezier(0.22,1,0.36,1) forwards',
          animationDelay: `${idx * 900}ms`,
        } : undefined;

        if (seg.type === 'narration') {
          return (
            <p key={idx} className="seg-narration" style={animStyle}>
              <em className="narration">{renderInline(seg.content)}</em>
            </p>
          );
        }
        return (
          <p key={idx} style={animStyle}>
            {renderInline(seg.content)}
          </p>
        );
      })}
    </>
  );
}

// ── 状态变化浮动提示 ────────────────────────────────────────────────────────────
export interface DeltaEntry { id: number; label: string; val: number; color: string; bg: string }

export function StatDeltaToast({ entries, onExpire }: { entries: DeltaEntry[]; onExpire: (id: number) => void }) {
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
