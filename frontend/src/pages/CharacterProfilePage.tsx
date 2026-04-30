import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useLang } from '../hooks/useLang';
import { charField } from '../i18n';
import type { Lang } from '../i18n';
import type { Character, Review } from '../types';

function timeAgo(dateStr: string, lang: Lang = 'zh'): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (lang === 'en') {
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }
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
  const { t, lang } = useLang();
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
        <div className="loading-ring" />
      </div>
    );
  }

  const displayName = charField(character.nameEn, character.name);
  const displayOcc = charField(character.occupationEn, character.occupation);
  const displayBg = charField(character.backgroundEn, character.background);
  const displayOpening = charField(character.openingSceneEn, character.openingScene);
  const displayPersonality = charField(character.personalityEn, character.personality);

  const tags = tagList(displayPersonality || character.personality);
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
      {/* Hero carousel */}
      <div className="portrait-carousel">
        {images.length > 0 ? (
          <>
            <div className="portrait-carousel-track" ref={carouselRef} onScroll={handleCarouselScroll}>
              {images.map((src, i) => (
                <div key={i} className="portrait-carousel-slide">
                  <img
                    src={src}
                    alt={`${character.name} ${i + 1}`}
                    onError={() => { if (i === 0) setImgError(true); }}
                  />
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, transparent 30%, rgba(9,9,15,0.7) 72%, #09090f 100%)',
                    zIndex: 2,
                  }} />
                </div>
              ))}
            </div>
            {images.length > 1 && (
              <div className="portrait-carousel-counter">{activeSlide + 1} / {images.length}</div>
            )}
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
            background: 'linear-gradient(160deg, #120820 0%, #2a0840 40%, #5a1050 70%, #9a1258 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              fontSize: 80, fontWeight: 900, color: 'rgba(255,255,255,0.12)',
              letterSpacing: -4, userSelect: 'none',
            }}>
              {character.name.slice(0, 1)}
            </div>
          </div>
        )}
        {images.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, #09090f 100%)', zIndex: 2 }} />
        )}
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          style={{
            position: 'absolute', top: 16, left: 16, zIndex: 10,
            background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '50%', width: 38, height: 38,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 20, cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
        >‹</button>
        {/* Name */}
        <div style={{ position: 'absolute', bottom: 18, left: 16, right: 16, zIndex: 5 }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', textShadow: '0 2px 20px rgba(0,0,0,0.9)', letterSpacing: '-0.02em' }}>
            {displayName}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4, letterSpacing: '0.05em' }}>
            {character.age} {t.profile.age} · {displayOcc}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <StatChip value={String(character.usageCount)} label={t.profile.conversations} />
          {character.reviewCount > 0 && <StatChip value={character.avgRating.toFixed(1)} label={t.profile.ratingLabel} gold />}
        </div>
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-primary"
          style={{ padding: '10px 28px', fontSize: 14, fontWeight: 700, borderRadius: 24, letterSpacing: '0.04em' }}
          onClick={() => navigate(`/chat/${characterId}`)}
        >
          {t.profile.startChat}
        </button>
      </div>

      {/* Tags */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tags.map(tag => (
            <span key={tag} style={{
              padding: '4px 10px', borderRadius: 20, fontSize: 11,
              background: 'rgba(154,18,88,0.1)', border: '1px solid rgba(154,18,88,0.2)',
              color: 'rgba(232,100,160,0.85)', letterSpacing: '0.04em',
            }}>#{tag}</span>
          ))}
        </div>
      </div>

      {/* Opening scene */}
      {displayOpening && (
        <Section title={t.profile.story}>
          <div style={{
            fontSize: 14, lineHeight: 1.85, color: 'var(--text-2)',
            fontStyle: 'italic',
            background: 'linear-gradient(135deg, rgba(42,8,55,0.5), rgba(90,16,70,0.25))',
            border: '1px solid rgba(232,53,108,0.1)',
            borderRadius: 12, padding: 14,
          }}>
            {displayOpening}
          </div>
        </Section>
      )}

      {/* Background */}
      <Section title={t.profile.background}>
        <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--text-2)' }}>
          {displayBg}
        </div>
      </Section>

      {/* Creator */}
      {character.creator && (
        <div style={{ padding: '0 16px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-hint)' }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-hint)', letterSpacing: '0.03em' }}>
            {t.profile.creator}：{character.creator.firstName || character.creator.username || t.profile.anon}
          </div>
        </div>
      )}

      {/* Reviews */}
      <Section title={`${t.profile.reviews}${reviews.length > 0 ? ` (${reviews.length})` : ''}`} action={
        canReview ? (
          <button
            onClick={() => setShowReviewForm(true)}
            style={{
              background: 'none', border: '1px solid var(--border-accent)',
              color: 'var(--accent)', borderRadius: 16, padding: '4px 12px',
              fontSize: 11, cursor: 'pointer', letterSpacing: '0.04em',
            }}
          >{t.profile.writeReview}</button>
        ) : undefined
      }>
        {reviews.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-hint)', fontSize: 13 }}>
            {t.profile.noReviews}
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
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, letterSpacing: '-0.01em' }}>{t.profile.reviewFor} {displayName}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
              {[1,2,3,4,5].map(n => (
                <button
                  key={n}
                  onClick={() => setReviewRating(n)}
                  style={{
                    background: 'none', border: 'none', fontSize: 32, cursor: 'pointer',
                    color: n <= reviewRating ? 'var(--accent-gold)' : 'var(--text-hint)',
                    opacity: n <= reviewRating ? 1 : 0.3,
                    transition: 'all 0.15s',
                    filter: n <= reviewRating ? 'drop-shadow(0 0 4px rgba(196,144,56,0.6))' : 'none',
                  }}
                >★</button>
              ))}
            </div>
            <textarea
              placeholder={t.profile.reviewPlaceholder}
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
              rows={3}
              style={{
                width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 14,
                resize: 'none', marginBottom: 16, boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowReviewForm(false)}>{t.common.cancel}</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={submitReview} disabled={submitting}>
                {submitting ? t.profile.submitting : t.profile.submit}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed CTA */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 16px',
        background: 'linear-gradient(to top, var(--bg) 70%, transparent)',
        zIndex: 100,
      }}>
        <button
          className="btn btn-primary btn-full"
          style={{ borderRadius: 28, fontSize: 15, fontWeight: 700, padding: '14px 0', letterSpacing: '0.06em' }}
          onClick={() => navigate(`/chat/${characterId}`)}
        >
          {t.profile.startChat}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ padding: '16px 16px 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function StatChip({ value, label, gold }: { value: string; label: string; gold?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      background: 'var(--bg-elevated)', borderRadius: 16, padding: '5px 12px',
      fontSize: 12, color: gold ? 'var(--accent-gold)' : 'var(--text-2)',
    }}>
      <span style={{ fontWeight: 700 }}>{value}</span>
      <span style={{ color: 'var(--text-hint)', fontSize: 11 }}>{label}</span>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const { t, lang } = useLang();
  const name = review.user?.firstName || review.user?.username || t.profile.anon;
  const initial = name.charAt(0);
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, #2a0840, #9a1258)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700, color: '#fff',
      }}>{initial}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
          <span style={{ color: 'var(--accent-gold)', fontSize: 11 }}>{'★'.repeat(review.rating)}</span>
        </div>
        {review.comment && (
          <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{review.comment}</div>
        )}
        <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 4, letterSpacing: '0.04em' }}>
          {timeAgo(review.createdAt, lang)}
        </div>
      </div>
    </div>
  );
}
