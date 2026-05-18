/**
 * 每个角色的面部气质锚点 — 用于 generateAlbum / generateAvatars / comfyui (inline)
 * 以 SD 加权关键词描述"脸的气质"，确保同一角色跨图一致，不同角色之间有明显区别
 */
export const CHARACTER_FACE: Record<string, string> = {
  // ── 真实感角色 ──────────────────────────────────────────────────────────────

  // 知性温柔系 — 裸妆+淡粉唇，书卷气
  '椎名老师': '(warm intellectual beauty:1.3), (soft single-eyelid warm brown eyes:1.2), (thin-rimmed glasses resting on nose:1.3), (light rosy nude lip gloss:1.2), (natural no-makeup skin:1.2), (gentle soft round face:1.2)',

  // 运动网红系 — 桃花妆+烟熏卧蚕，健康小麦肌
  '晓彤':    '(sporty confident beauty:1.3), (bold peach-blossom droopy eyes:1.3), (lower lash line subtle shimmer:1.2), (tanned healthy skin:1.3), (coral glossy lips:1.2), (defined compact jawline:1.3)',

  // 辣妹萝莉系 — 裂纹眼线+粉紫渐变眼影+泡泡唇
  '娜娜':    '(gyaru baby-face lolita:1.4), (wide puppy round eyes:1.3), (pink-to-purple gradient eyeshadow:1.4), (thick bottom lashes:1.3), (puffy glossy strawberry lips:1.3), (soft plump pinchable cheeks:1.3)',

  // 清纯学妹系 — 零妆感+水光唇+泪痣
  '小雨':    '(pure dewy doe-eyed beauty:1.3), (big watery double-eyelid eyes:1.3), (barely-there glossy lip:1.2), (faint tear mole under left eye:1.3), (porcelain pale skin:1.2), (soft delicate features:1.2)',

  // 学术御姐系 — 冷调哑光砖红唇+猫眼线+立体五官
  '琉璃':    '(cool lab-chic intellectual beauty:1.3), (sharp precise cat-eye liner:1.4), (brick red matte lips:1.3), (high sharp nose bridge:1.3), (calm almond eyes:1.3), (cool-tone pale skin:1.2)',

  // 甜系艺术生 — 深酒窝+橘调晕染眼影+水蜜桃唇
  '糖糖':    '(sweet art-student dimple beauty:1.3), (warm amber-orange shimmer eyeshadow:1.3), (deep prominent dimples both cheeks:1.5), (peach glossy full lips:1.3), (bright crinkle-smile eyes:1.3), (warm beige skin:1.2)',

  // 高冷超模系 — 骨感轮廓+狐狸眼+裸唇无表情
  '沈静':    '(high-fashion cold editorial model:1.4), (sharp angular cheekbones:1.5), (elongated fox-eye double wing liner:1.4), (bone-pale cool-undertone skin:1.3), (nude matte thin lips:1.2), (dead-fish distant gaze:1.3)',

  // 邻家护士系 — 桃粉腮红+淡眼线+水润唇
  '小慧':    '(warm approachable girl-next-door:1.3), (soft doe eyes with light brown mascara:1.2), (peachy pink blush on round cheeks:1.3), (sheer pink lip tint:1.2), (healthy natural glow skin:1.2), (soft egg-shaped face:1.2)',

  // 暗黑哥特系 — 浓重烟熏+深枣红唇+苍白死感肌
  '夜玲':    '(dark gothic mysterious beauty:1.4), (heavy smoky black eyeshadow bleeding outward:1.5), (dark crimson black-tinted matte lips:1.4), (porcelain cold corpse-pale skin:1.3), (intense heavy-lidded eyes:1.3), (sharp pointed chin:1.2)',

  // 韩系网红系 — 水光肌+puppy liner+渐变唇
  '晴晴':    '(Korean ulzzang e-girl streamer:1.4), (puppy-eye downward flick liner:1.4), (pink-to-coral gradient ombre lips:1.3), (glass-skin dewy highlight:1.3), (bright sparkling round eyes:1.3), (cute nose tip blush:1.2)',

  // 高定秘书御姐系 — 正红唇+眉眼锋利+高贵气场
  '唐诗':    '(elegant high-status secretary beauty:1.4), (classic bold red matte lips:1.5), (sharp refined arch brow:1.3), (precise almond fox eyes:1.3), (sculpted cheekbones:1.2), (ivory cool skin:1.2)',

  // 自然咖啡师系 — 微雀斑+杏棕唇+清透底妆
  '阿柒':    '(natural warm girl-next-door:1.3), (light scatter freckles on nose and cheeks:1.3), (apricot-brown glossy lip:1.2), (crescent warm smile eyes:1.3), (sheer dewy foundation skin:1.2), (effortless casual beauty:1.2)',

  // 甜萝莉动漫系 — 草莓唇+粉橘腮红+超大电眼
  '桃桃':    '(ultra-sweet lolita anime face:1.4), (huge sparkling round eyes with starlight catchlights:1.5), (heavy pink-orange blush spread wide:1.4), (glossy strawberry red lips:1.3), (soft pillowy cheeks:1.3), (cute dimples:1.3)',

  // ── 二次元角色 ──────────────────────────────────────────────────────────────

  // 赛博机器人 — 发光蓝虹膜+无妆感金属感皮肤
  'X-23':    '(flawless synthetic android face:1.3), (glowing electric blue irises:1.4), (chrome metallic skin sheen:1.3), (expressionless neutral thin lips:1.2), (perfect symmetry:1.3)',

  // 全息歌姬 — 渐变星空眼影+半透明光感肌
  '幻音':    '(ethereal holographic vocaloid face:1.3), (galaxy gradient eyeshadow blue-to-violet:1.4), (luminous semi-transparent glowing skin:1.3), (softly glowing dreamy eyes:1.3), (iridescent lip:1.2)',

  // 九尾狐妖 — 琥珀竖瞳+金丹砂唇+仙气底妆
  '狐九':    '(ethereal seductive fox spirit:1.3), (amber vertical-slit pupils:1.5), (vermilion cinnabar red lips:1.3), (golden shimmer highlight on cheekbones:1.2), (otherworldly pale porcelain skin:1.3)',

  // 冰修仙女 — 冰蓝唇+霜感底妆+空灵神情
  '冷霜':    '(cold immortal ice cultivator:1.3), (pale frost-blue glowing eyes:1.4), (icy silver-white lip:1.3), (translucent frost-touched skin:1.3), (aloof serene distant expression:1.3)',

  // 魅惑女魔 — 血红竖瞳+黑紫唇+邪魅笑
  '魅罗':    '(gorgeous sinister demon seductress:1.4), (blood-red vertical-slit eyes:1.5), (dark black-violet gradient lips:1.4), (evil enchanting smirk:1.3), (flawless pale skin with subtle dark vein texture:1.2)',
};
