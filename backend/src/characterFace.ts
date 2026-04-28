/**
 * 每个角色的面部气质锚点 — 用于 generateAlbum / generateAvatars / comfyui (inline)
 * 以 SD 加权关键词描述"脸的气质"，确保同一角色跨图一致，不同角色之间有明显区别
 */
export const CHARACTER_FACE: Record<string, string> = {
  // ── 真实感角色 ──────────────────────────────────────────────────────────────
  '椎名老师': '(warm gentle intellectual beauty:1.3), (soft curved warm eyes:1.2), (rosy natural lips:1.2), (soft round face:1.2)',
  '晓彤':    '(bold sporty confident beauty:1.3), (strong peach-blossom droopy eyes:1.3), (compact defined jawline:1.3), (playful lips:1.2)',
  '娜娜':    '(innocent sweet baby face:1.3), (wide puppy round eyes:1.3), (soft plump cheeks:1.2), (pouty lips:1.3)',
  '小雨':    '(pure doe-eyed innocent beauty:1.3), (big watery gentle eyes:1.3), (soft delicate features:1.2), (shy parted lips:1.2)',
  '琉璃':    '(cool intellectual aloof beauty:1.3), (precise calm almond eyes:1.3), (thin elegant lips:1.2), (delicate composed features:1.3)',
  '糖糖':    '(bubbly sweet apple-cheeked face:1.3), (bright crinkle-smile eyes:1.3), (deep prominent dimples:1.4), (full happy lips:1.2)',
  '沈静':    '(cold editorial model face:1.3), (empty distant deep-set eyes:1.3), (thin stern unsmiling lips:1.2), (sharp angular high cheekbones:1.4)',
  '小慧':    '(warm approachable gentle beauty:1.3), (kind soft round eyes:1.3), (natural sweet smile:1.2), (soft egg-shaped face:1.2)',
  '夜玲':    '(sharp cold gothic mysterious face:1.3), (intense penetrating heavy-lidded eyes:1.3), (dark red lips:1.3), (pointed chin:1.2)',
  '晴晴':    '(lively energetic cute face:1.3), (bright sparkling round eyes:1.3), (cheerful curved smile:1.2), (youthful fresh look:1.2)',
  '唐诗':    '(elegant refined classical beauty:1.3), (graceful composed almond eyes:1.3), (subtle sophisticated lips:1.2), (poised oval face:1.2)',
  '阿柒':    '(natural warm girl-next-door beauty:1.3), (crescent-smile warm eyes:1.3), (soft approachable lips:1.2), (effortless sweetness:1.2)',
  // ── 二次元角色 ──────────────────────────────────────────────────────────────
  'X-23':    '(perfect cold synthetic android face:1.3), (calculating empty blue glowing eyes:1.3), (expressionless thin lips:1.2), (flawless artificial beauty:1.3)',
  '幻音':    '(ethereal transcendent holographic face:1.3), (glowing longing dreamy eyes:1.3), (dreamlike otherworldly beauty:1.3)',
  '狐九':    '(ethereal seductive fox spirit face:1.3), (alluring amber slit eyes:1.3), (mysterious curved smile:1.2), (otherworldly elegance:1.3)',
  '冷霜':    '(cold distant immortal beauty:1.3), (aloof pale blue glowing eyes:1.3), (frost-touched serene face:1.3), (untouchable elegance:1.2)',
  '魅罗':    '(gorgeous sinister seductive demon face:1.3), (crimson slit provocative eyes:1.3), (dark red dangerous lips:1.3), (evil enchanting smile:1.3)',
};
