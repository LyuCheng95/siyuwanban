import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Character, Review } from '../types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小时前`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}天前`;
  return `${Math.floor(days / 30)}个月前`;
}

function tagList(personality: string): string[] {
  return personality.split(/[、,，\s]+/).filter(Boolean).slice(0, 6);
}

export function CharacterProfilePage() {
  const { characterId } = useParams<{ characterId: string }>();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<Character | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!characterId) return;
    Promise.all([
      api.characters.get(characterId),
      api.chat.get(characterId).catch(() => null),
    ]).then(([char, chatData]) => {
      setCharacter(char);
      setReviews((char.reviews ?? []) as Review[]);
      // Can review if had 3+ conversation turns
      if (chatData && (chatData as any).conversation?.totalTurns >= 3) {
        setCanReview(true);
      }
    }).catch(() => navigate('/')).finally(() => setLoading(false));
  }, [characterId]);

  async function submitReview() {
    if (!characterId || submitting) return;
    setSubmitting(true);
    try {
      await api.marketplace.review(characterId, { rating: reviewRating, comment: reviewComment.trim() || undefined });
      setShowReviewForm(false);
      setReviewComment('');
      // Reload reviews
      const char = await api.characters.get(characterId);
      setReviews((char.reviews ?? []) as Review[]);
    } catch (e: any) {
      alert(e?.data?.error ?? '评价失败');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !character) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div style={{ fontSize: 48, animation: 'pulse 1s infinite' }}>{character?.avatarEmoji ?? '💋'}</div>
      </div>
    );
  }

  const tags = tagList(character.personality);
  // Build image list: prioritize portraitImages array, fall back to single portraitUrl
  const rawImages: string[] = Array.isArray(character.portraitImages) && character.portraitImages.length > 0
    ? character.portraitImages
    : (character.portraitUrl && !imgError ? [character.portraitUrl] : []);
  const images = rawImages;

  function handleCarouselScroll() {
    if (!carouselRef.current) return;
    const { scrollLeft, offsetWidth } = carouselRef.current;
    setActiveSlide(Math.round(scrollLeft / offsetWidth));
  }

  function goToSlide(idx: number) {
    if (!carouselRef.current) return;
    carouselRef.current.scrollTo({ left: idx * carouselRef.current.offsetWidth, behavior: 'smooth' });
  }

  return (
    <div className="page" style={{ background: 'var(--bg)', paddingBottom: 100 }}>
      {/* Cover image / carousel hero */}
      <div className="portrait-carousel">
        {images.length > 0 ? (
          <>
            <div
              className="portrait-carousel-track"
              ref={carouselRef}
              onScroll={handleCarouselScroll}
            >
              {images.map((src, i) => (
                <div key={i} className="portrait-carousel-slide">
                  <img
                    src={src}
                    alt={`${character.name} ${i + 1}`}
                    onError={() => { if (i === 0) setImgError(true); }}
                  />
                  {/* Per-slide gradient overlay */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 35%, rgba(13,13,18,0.8) 75%, #0d0d12 100%)',
                    zIndex: 2,
                  }} />
                </div>
              ))}
            </div>
            {/* Slide counter */}
            {images.length > 1 && (
              <div className="portrait-carousel-counter">{activeSlide + 1} / {images.length}</div>
            )}
            {/* Dot indicators */}
            {images.length > 1 && (
              <div className="portrait-carousel-dots">
                {images.map((_, i) => (
                  <div
                    key={i}
                    className={`portrait-carousel-dot ${i === activeSlide ? 'active' : ''}`}
                    onClick={() => goToSlide(i)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(160deg, #1a0a2e 0%, #3d1a4a 40%, #7c1a6a 70%, #c026d3 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 110,
          }}>
            {character.avatarEmoji}
          </div>
        )}
        {/* Gradient overlay for text readability when no images */}
        {images.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, #0d0d12 100%)', zIndex: 2 }} />
        )}
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          style={{
            position: 'absolute', top: 16, left: 16, zIndex: 10,
            background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '50%', width: 38, height: 38,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 20, cursor: 'pointer',
            backdropFilter: 'blur(6px)',
          }}
        >‹</button>
        {/* Name at bottom of hero */}
        <div style={{ position: 'absolute', bottom: 18, left: 16, right: 16, zIndex: 5 }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', textShadow: '0 2px 16px rgba(0,0,0,0.9)' }}>
            {character.name}
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.72)', marginTop: 4 }}>
            {character.age}岁 · {character.occupation}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <ActionBtn icon="🔥" label={`${character.usageCount}`} />
          {character.reviewCount > 0 && <ActionBtn icon="★" label={character.avgRating.toFixed(1)} />}
        </div>
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-primary"
          style={{ padding: '10px 28px', fontSize: 15, fontWeight: 700, borderRadius: 24 }}
          onClick={() => navigate(`/chat/${characterId}`)}
        >
          💬 开始聊天
        </button>
      </div>

      {/* Tags */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tags.map(tag => (
            <span key={tag} style={{
              padding: '4px 10px', borderRadius: 20, fontSize: 12,
              background: 'rgba(192,38,211,0.12)', border: '1px solid rgba(192,38,211,0.25)',
              color: 'var(--accent)',
            }}>#{tag}</span>
          ))}
        </div>
      </div>

      {/* Opening scene */}
      {character.openingScene && (
        <Section title="📖 故事简介">
          <div style={{
            fontSize: 14, lineHeight: 1.8, color: 'var(--text-2)',
            fontStyle: 'italic',
            background: 'linear-gradient(135deg, rgba(61,26,74,0.4), rgba(124,26,106,0.2))',
            border: '1px solid rgba(255,61,127,0.15)',
            borderRadius: 12, padding: 14,
          }}>
            {character.openingScene}
          </div>
        </Section>
      )}

      {/* Background */}
      <Section title="👤 角色背景">
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-2)' }}>
          {character.background}
        </div>
      </Section>

      {/* Creator */}
      {character.creator && (
        <div style={{ padding: '0 16px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, #3d1a4a, #7c1a6a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
          }}>👤</div>
          <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>
            创建者：{character.creator.firstName || character.creator.username || '匿名'}
          </div>
        </div>
      )}

      {/* Reviews section */}
      <Section title={`💬 评论 (${reviews.length})`} action={
        canReview ? (
          <button
            onClick={() => setShowReviewForm(true)}
            style={{
              background: 'none', border: '1px solid var(--border-accent)',
              color: 'var(--accent)', borderRadius: 16, padding: '4px 12px',
              fontSize: 12, cursor: 'pointer',
            }}
          >✏️ 写评论</button>
        ) : undefined
      }>
        {reviews.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-hint)', fontSize: 13 }}>
            还没有评论，聊聊之后来说说感受吧 🌸
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reviews.map(r => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        )}
      </Section>

      {/* Review form modal */}
      {showReviewForm && (
        <div className="sheet-overlay" onClick={() => setShowReviewForm(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>评价 {character.name}</div>
            {/* Star rating */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
              {[1,2,3,4,5].map(n => (
                <button
                  key={n}
                  onClick={() => setReviewRating(n)}
                  style={{
                    background: 'none', border: 'none', fontSize: 32, cursor: 'pointer',
                    opacity: n <= reviewRating ? 1 : 0.3,
                    filter: n <= reviewRating ? 'drop-shadow(0 0 4px rgba(255,200,0,0.8))' : 'none',
                  }}
                >★</button>
              ))}
            </div>
            <textarea
              placeholder="分享你的感受… (可选)"
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
              rows={3}
              style={{
                width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 14,
                resize: 'none', marginBottom: 16, boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowReviewForm(false)}>取消</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={submitReview} disabled={submitting}>
                {submitting ? '提交中…' : '提交评价'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed bottom CTA */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 16px',
        background: 'linear-gradient(to top, var(--bg) 70%, transparent)',
        zIndex: 100,
      }}>
        <button
          className="btn btn-primary btn-full"
          style={{ borderRadius: 28, fontSize: 16, fontWeight: 700, padding: '14px 0' }}
          onClick={() => navigate(`/chat/${characterId}`)}
        >
          💬 开始聊天
        </button>
      </div>
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ padding: '16px 16px 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function ActionBtn({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      background: 'var(--bg-elevated)', borderRadius: 16, padding: '5px 12px',
      fontSize: 13, color: 'var(--text-2)',
    }}>
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const name = review.user?.firstName || review.user?.username || '用户';
  const initial = name.charAt(0);
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, #3d1a4a, #c026d3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 700, color: '#fff',
      }}>{initial}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
          <span style={{ color: '#f59e0b', fontSize: 12 }}>{'★'.repeat(review.rating)}</span>
        </div>
        {review.comment && (
          <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{review.comment}</div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 4 }}>
          {timeAgo(review.createdAt)}
        </div>
      </div>
    </div>
  );
}
