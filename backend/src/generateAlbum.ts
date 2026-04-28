/**
 * 为单个角色生成多张封面图（album）
 * 用法：npx ts-node -r dotenv/config src/generateAlbum.ts [角色名] [张数]
 * 示例：npx ts-node -r dotenv/config src/generateAlbum.ts 林晓雅 3
 *       npx ts-node -r dotenv/config src/generateAlbum.ts 狐九 3
 *
 * 真实风格 → realvisxlV50_v50LightningBakedvae.safetensors
 * 二次元/修仙/妖魔 → ponyDiffusionV6XL_v6StartWithThisOne.safetensors
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const COMFYUI_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';
const SAVE_DIR = process.env.IMAGE_SAVE_DIR || 'D:/SD/siyuwanban/portraits';
const PUBLIC_BASE = process.env.FRONTEND_URL || 'https://siyuwanban.shangzongcai.com';

// ── 模型 ──────────────────────────────────────────────────────────────────────
const MODEL_ANIME  = 'ponyDiffusionV6XL_v6StartWithThisOne.safetensors';  // 待删除（NoobAI 到位后）
const MODEL_JUGGER = 'juggernautXL_juggXIByRundiffusion.safetensors';   // 高端写实·职场御姐
const MODEL_LEOSAM = 'leosamsHelloworldXL_helloworldXL70.safetensors';  // 细腻白瘦幼·青春系
const MODEL_NOOB   = 'noobaiXLNAIXL_epsilonPred11Version.safetensors';  // 二次元 Illustrious

// ── 真实感 prompt 前缀 ────────────────────────────────────────────────────────
const QUALITY_REAL = [
  '(photorealistic:1.4)', '(hyperrealistic:1.3)', 'RAW photo', '8k uhd', 'masterpiece',
  // 亚洲美人 / 白瘦幼
  '(Asian beauty:1.4)', '(beautiful Asian face:1.5)', '(delicate Asian features:1.3)',
  '(porcelain fair skin:1.5)', '(flawless pale white skin:1.4)', '(luminous skin:1.3)',
  '(youthful:1.3)', '(slender petite figure:1.2)',
  '(perfect face:1.5)', '(beautiful face:1.5)', '(stunning beauty:1.4)',
  '(perfect symmetrical face:1.3)', '(flawless skin:1.3)',
  '(gorgeous:1.3)', '(detailed eyes:1.3)', '(perfect eyes:1.3)',
  '(supermodel:1.2)', '(editorial lighting:1.2)',
  '(alluring:1.3)', '(sensual:1.3)',
].join(', ');

// ── 二次元 prompt 前缀（Pony Diffusion 关键词）────────────────────────────────
const QUALITY_ANIME = [
  'score_9', 'score_8_up', 'score_7_up', 'masterpiece', 'best quality',
  'ultra detailed', 'highly detailed', '8k',
  '(beautiful face:1.4)', '(perfect eyes:1.4)', '(detailed eyes:1.3)',
  '(perfect body:1.3)', '(gorgeous:1.3)',
  'source_anime', 'nsfw', 'explicit',
].join(', ');

// ── Negative ──────────────────────────────────────────────────────────────────
const NEGATIVE_REAL = [
  '(worst quality:1.6)', '(low quality:1.6)', '(normal quality:1.4)',
  'bad anatomy', 'bad face', 'ugly face', 'asymmetrical face', 'deformed face',
  'extra limbs', 'deformed hands', 'extra fingers', 'missing fingers',
  'blurry', 'watermark', 'text', 'logo', 'signature',
  'censored bar', 'mosaic',
  'cross-eye', 'lazy eye', 'bad eyes',
  // 排除黄脸/黑皮/老气
  '(dark skin:1.5)', '(tanned skin:1.5)', '(yellowish skin:1.4)', '(sallow complexion:1.4)',
  '(uneven skin tone:1.3)', '(muddy skin:1.3)', '(bronze skin:1.3)',
  'fat', 'chubby face', 'masculine', 'old', 'aged', 'wrinkles',
  // 不露三点
  'nipples', 'exposed nipples', 'pussy', 'genitals', 'pubic hair', 'fully nude',
].join(', ');

const NEGATIVE_ANIME = [
  'score_1', 'score_2', 'score_3', 'score_4',
  'bad anatomy', 'bad hands', 'extra fingers', 'missing fingers',
  'deformed face', 'ugly face', 'bad face',
  'blurry', 'watermark', 'text', 'censored', 'mosaic',
  'bad quality', 'worst quality', 'lowres',
].join(', ');

// ── NoobAI / Illustrious 专用 prefix（不用 score_9，用 masterpiece 体系）──────
const QUALITY_NOOB = [
  'masterpiece', 'best quality', 'amazing quality', 'very aesthetic', 'newest',
  'ultra detailed', 'highly detailed', '8k',
  '(beautiful face:1.4)', '(perfect eyes:1.4)', '(detailed eyes:1.3)',
  '(perfect body:1.3)', '(gorgeous:1.3)',
  'source_anime', '(alluring:1.3)', '(sensual:1.3)',
].join(', ');

const NEGATIVE_NOOB = [
  'worst quality', 'bad quality', 'lowres', 'normal quality', 'jpeg artifacts',
  'bad anatomy', 'bad hands', 'extra fingers', 'missing fingers',
  'deformed face', 'ugly face', 'bad face', 'asymmetrical face',
  'blurry', 'watermark', 'text', 'censored', 'mosaic',
  'old', 'aged', 'wrinkles', 'fat', 'masculine',
  'nipples', 'exposed nipples', 'pussy', 'genitals', 'pubic hair', 'nude',
].join(', ');

// ── 角色配置：style + prompts ─────────────────────────────────────────────────
interface CharConfig {
  style: 'real' | 'anime';
  model?: string;   // 不填则用该 style 的默认模型
  prompts: string[];
}

const ALBUM_CONFIGS: Record<string, CharConfig> = {

  // ── 真实感角色 ─────────────────────────────────────────────────────────────────
  // 每个角色都有：唯一发色/发型、唯一体型、唯一服装风格、唯一姿势、唯一背景氛围

  // 椎名老师：黑色宽松发髻/及肩直发 · 圆脸小眼镜 · 白衬衫大开领 · 教室
  '椎名老师': { style: 'real', model: MODEL_LEOSAM, prompts: [
    '1girl, 24yo japanese teacher, 157cm petite 44kg, round sweet face soft lips, (black framed round glasses:1.3), dark black hair in loose messy bun stray strands, milky porcelain skin, (white blouse 4 buttons undone showing (deep V inner chest:1.4) white lace bra edge peeking:1.3), short pleated skirt, sitting on classroom desk legs crossed (inner thigh visible:1.2), leaning forward toward camera, afternoon sun through blinds, flushed cheeks shy glance over lowered glasses',
    '1girl, 24yo japanese teacher, 157cm petite 44kg, round cute face dimples, (round glasses pushed down nose:1.3), dark hair loose falling to shoulders, porcelain white skin, (fitted white shirt with top buttons open to sternum:1.3) tucked into micro pencil skirt, sitting on teacher desk legs parted slightly, (white bra strap showing off shoulder:1.2), warm classroom golden hour, biting lower lip, smoldering shy expression',
    '1girl, 24yo japanese woman, 157cm petite 44kg, round face, glasses off set aside, dark hair loose disheveled, pale smooth skin, wearing only (oversized white dress shirt open to mid-chest:1.3) barely covering upper thighs, (bare legs folded beneath her on chair:1.2), golden evening classroom light, kneeling in teacher chair looking back over shoulder, wistful provocative expression',
  ]},

  // 晓彤：黑色高马尾 · 深桃花眼紧致下颌 · 运动内衣露腹 · 健身房
  '晓彤': { style: 'real', model: MODEL_JUGGER, prompts: [
    '1girl, 22yo chinese woman, 163cm athletic toned 53kg, (defined abs and obliques:1.4), peach-blossom droopy eyes compact jawline, jet black hair in tight high ponytail, fair glistening rosy-white skin, (skintight sports bra very low cut:1.4) and high-waist bike shorts, leaning against mirrored gym wall arms raised overhead (toned underarms ribs visible:1.3), sweaty skin, fluorescent gym light, challenging confident smirk',
    '1girl, 22yo chinese gym trainer, 163cm firm athletic 53kg, (toned abs:1.3), peach-blossom eyes beautiful face, black ponytail loosened, fair skin post-workout glow, (unzipped crop athletic jacket showing sports bra underneath:1.3) and (very high-cut gym shorts:1.2) riding up, sitting on weight bench leaning forward elbows on knees, (bra fully exposed jacket wide open:1.3), golden hour gym light, teasing inviting smirk',
    '1girl, 22yo chinese woman, 163cm toned 53kg, (visible abs:1.3), peach-blossom eyes sultry look, black hair down loose, rosy skin, (midriff-baring crop top deep V:1.3) pulled aside one shoulder, (high-waist yoga pants with hip cutout:1.2), arching back stretch arms overhead, studio mirror reflection, clean minimal gym, afternoon light, powerful seductive energy',
  ]},

  // 娜娜：长直黑发/双马尾 · 小心形脸 · 校服改短超短裙+大腿袜 · 教室走廊
  '娜娜': { style: 'real', model: MODEL_LEOSAM, prompts: [
    '1girl, 18yo chinese high school girl, 155cm very petite slim 42kg, heart-shaped innocent face large expressive eyes, long straight jet black hair, porcelain skin, (school blouse with 3 extra buttons undone showing (white bralette deep scoop:1.3)), (micro pleated skirt barely past panty line:1.4), (white thigh-high socks:1.3) + loafers, sitting on classroom desk legs open slightly, bold defiant smirk daring eye contact, afternoon classroom light',
    '1girl, 18yo chinese schoolgirl, 155cm petite slim 42kg, cute heart-shaped face, large bright eyes, hair in messy high twin tails jet black, pale white skin, (sheer school shirt over black triangle bralette clearly visible through fabric:1.4), (micro high-waist pleated skirt:1.3) hiked up, (thigh highs:1.2) + Mary Janes, leaning against locker one knee bent, (inner thigh:1.2), bold amused challenging expression, school corridor',
    '1girl, 18yo chinese girl, 155cm petite 42kg, innocent heart face pretty eyes, long black hair loose, soft white skin, only (school blouse wide open over black lace bralette:1.3) and micro pleated skirt, kneeling on bed, (one strap slipping:1.2), looking up at camera bold curious gaze, warm bedroom evening light',
  ]},

  // 小雨：波浪栗棕色中发 · 大圆眼无辜脸 · 透薄细肩带睡衣 · 宿舍/床铺
  '小雨': { style: 'real', model: MODEL_LEOSAM, prompts: [
    '1girl, 19yo chinese college girl, 160cm slim delicate 46kg, large round doe eyes, round innocent face, soft wavy chestnut brown hair to shoulders, smooth fair skin, (thin spaghetti-strap white camisole:1.3) (bralette clearly showing through:1.3) slipping off one shoulder, cotton micro sleep shorts, sitting cross-legged dorm bed, fairy lights bokeh, warm night glow, hair falling over one eye, surprised shy parted lips',
    '1girl, 19yo chinese university student, 160cm slim soft 46kg, large innocent doe eyes, round sweet face, wavy chestnut brown loose hair, smooth white skin, lying on stomach on bed chin on hands, (loose flannel shirt wide open showing thin white bralette:1.3), (micro denim shorts:1.2) legs raised crossed behind, golden evening light dorm, wide-eyed innocent flirty expression looking up',
    '1girl, 19yo chinese girl, 160cm slim delicate 46kg, big bright eyes gentle face, chestnut brown hair messy bun, fair smooth skin, (fitted ribbed crop tank top very low scoop:1.3) (round cleavage showing:1.3) and tiny sleep shorts, sitting at desk, laptop glow illuminating face, one strap slipping off shoulder, night atmosphere, soft blush half-smile',
  ]},

  // 琉璃：黑色齐刘海直发 · 精致眼镜椭圆脸 · 实验服大开领内深V · 实验室
  '琉璃': { style: 'real', model: MODEL_LEOSAM, prompts: [
    '1girl, 22yo chinese graduate student, 161cm slim 47kg, neat straight black hair with sharp blunt bangs, (black rectangular framed glasses:1.3), delicate precise oval face, pale smooth skin, (white lab coat wide open over (deep-V cream bodycon dress:1.4) showing prominent cleavage:1.3), leaning over lab bench toward camera, (dress V plunge clearly visible:1.3), test tube in hand, fluorescent lab, analytical expression with subtle flush',
    '1girl, 22yo chinese researcher, 161cm slim 47kg, (black blunt-bang hair neat bun:1.3), rectangular glasses, delicate oval face, fair skin, lab coat removed, (fitted deep-V silk blouse:1.3) (substantial cleavage showing:1.3) tucked into pencil skirt, sitting on lab stool leaning forward elbows on bench, science equipment around, warm desk lamp, intense focused eyes',
    '1girl, 22yo chinese lab student, 161cm slim 47kg, black blunt-banged hair loose, glasses off, delicate serious pretty face, pale skin, (slightly sheer white cotton button-up shirt:1.3) unbuttoned from both top (to bra) and bottom (tied at waist showing midriff:1.3), holding clipboard to chest, data screens behind, moody lab warm lamp, quietly alluring focused expression',
  ]},

  // 糖糖：黑色马尾+颜料染色 · 苹果脸酒窝 · 背带裤单肩落+crop top · 画室
  '糖糖': { style: 'real', model: MODEL_LEOSAM, prompts: [
    '1girl, 20yo chinese art student, 157cm slim cute 45kg, sweet apple-cheeked round face (dimples:1.3), bright warm eyes, black hair high ponytail paint-flecked strands, rosy pink-toned fair skin, (white overalls one strap fallen exposing bare shoulder and side:1.3) + (white triangle bralette showing at open side:1.3) paint splatters, sitting on studio floor legs spread, paintings around, natural sunlight, genuine dimpled smile',
    '1girl, 20yo cute chinese college girl, 157cm slim 45kg, adorable round chubby-cheeked face (dimples:1.3), low twin black pigtails, rosy soft skin with paint smudge on cheek, (tight pastel yellow low-cut crop top:1.3) (upper round cleavage visible:1.2) and (paint-splattered micro high-waist denim shorts:1.2), sitting on art table legs dangling swinging, watercolor paintings behind, warm golden afternoon, cheerful bright expression',
    '1girl, 20yo chinese girl, 157cm slim soft 45kg, cute round face dimples, loose black wavy hair with paint spots, rosy fair skin, (thin white cotton tank top wet from paint water clinging to figure:1.3) (bra visible through damp fabric:1.4) and tiny shorts, standing at canvas arm raised painting, natural window light, golden afternoon, carefree lost-in-creativity expression',
  ]},

  // 沈静：骨直黑发(中分)超模脸 · 178cm长腿 · 高端黑色内衣 · 摄影棚/豪华酒店
  '沈静': { style: 'real', model: MODEL_JUGGER, prompts: [
    '1girl, 25yo chinese supermodel, 178cm extremely tall long-legged 56kg, strikingly angular face high sharp cheekbones deep-set cold eyes, bone-straight black hair center-parted, pale ivory cool skin, (black lace plunge bra:1.4) + (high-waist black tailored wide-leg trousers:1.2), sitting on backstage vanity (extremely long bare legs crossed:1.3) leaning back one arm extended, studio strobe lighting, fashion editorial, unreadable cold goddess expression',
    '1girl, 25yo chinese model, 178cm tall slender 56kg, cold angular goddess face sharp cheekbones, sleek black hair pulled back minimalist, pale ivory skin, (sheer black mesh top showing black bra clearly underneath:1.4) + high-waist leather micro skirt, standing in studio (long bare legs:1.3), one hand on hip other in hair, professional strobe light, commanding cold model stare down at camera',
    '1girl, 25yo chinese international model, 178cm tall 56kg, cold deep-set eyes angular face, center-parted bone-straight black hair, cool pale ivory skin, (white deep-plunge bodysuit very low cut V to navel:1.4) showing sternum and inner chest curves, (extremely long bare legs:1.2) + stilettos, runway backstage, dramatic directional studio light, imperious distant commanding expression',
  ]},

  // 小慧：棕色软波卷肩发 · 椭圆温柔脸 · 护士服半解开 · 医院/家中
  '小慧': { style: 'real', model: MODEL_LEOSAM, prompts: [
    '1girl, 23yo chinese nurse, 159cm slim gentle 47kg, pretty warm egg-shaped face soft dimples, (soft wavy light brown hair to shoulders:1.3), tender white skin, (white nurse uniform blouse 3 buttons undone showing (white cotton bra scallop edge:1.3)), nurse skirt hiked up sitting on hospital bed legs crossed, (bare knee and lower thigh:1.2), warm break room, afternoon light, gentle caring expression slight smile',
    '1girl, 23yo chinese girl, 159cm slim soft 47kg, warm sweet face big soft eyes, (wavy light brown shoulder-length hair:1.3), fair tender skin, (white shirt dress half-open from collar showing (bralette V:1.3)), off-duty sitting on windowsill, (bare legs dangling:1.2), cherry blossoms outside, warm spring afternoon, natural pure smile',
    '1girl, 23yo chinese nurse, 159cm slim gentle 47kg, cute warm round face, (wavy brown hair loose half-up:1.3), fair skin, (off-shoulder loose white oversized knit top slipping far (bare shoulder + white bra strap prominent:1.3)), micro skirt, sitting on bed hugging knees to chest, cozy bedroom soft glow, warm deeply inviting expression',
  ]},

  // 夜玲：深黑长波浪 · 哥特细尖脸重烟熏 · 黑蕾丝内衣/薄透连衣裙 · 暗系画室
  '夜玲': { style: 'real', model: MODEL_LEOSAM, prompts: [
    '1girl, 26yo chinese woman, 162cm slim pale 48kg, gorgeous sharp cold face pointed chin, (long dark near-black wavy hair:1.3), heavy smoky black eyeshadow dark red lips, (gothic black spiked choker:1.3), (black lace bralette worn as top:1.4) + high-waist leather mini skirt, sitting on art desk legs crossed (inner thigh bare:1.3), dark gothic illustrations on walls, single candle light + lamp, intense piercing gaze',
    '1girl, 26yo dark aesthetic chinese girl, 162cm pale slim 48kg, gorgeous sharp face, (dark near-black wavy hair loose over one shoulder:1.3), smoky kohl eyes dark lip, (black choker chain necklace:1.3), (sheer black mesh see-through top with black bra underneath clearly visible:1.4) + tight black high-waist shorts, lying on studio floor legs stretched provocatively, dark drawings around, moody candlelight, knowing smirk',
    '1girl, 26yo chinese illustrator, 162cm slim pale 48kg, captivating sharp face dark red lip, (long dark hair half-up messy:1.3), dark eye makeup, black choker, (open black satin kimono robe over thin black lace bodysuit:1.3) showing full torso silhouette, kneeling on floor, drawing tools beside, art studio moody warm lamp + cold window contrast, intense penetrating gaze',
  ]},

  // 晴晴：粉紫挑染高双丸子/马尾 · 活泼圆脸 · 运动短款露腹 · 游戏间LED
  '晴晴': { style: 'real', model: MODEL_LEOSAM, prompts: [
    '1girl, 21yo chinese gamer streamer, 158cm cute petite 46kg, pretty round lively face (dimples:1.2), (long hair with pastel pink and lavender dye streaks in high double space buns:1.3), rosy healthy skin, (skintight pastel pink off-shoulder crop top:1.3) + very (high-waist micro athletic shorts bare midriff fully showing:1.3), sitting in gaming chair leaning forward arms on desk toward camera, (round cleavage:1.2), colorful LED RGB setup behind, neon glow on skin, bright cheeky wink',
    '1girl, 21yo chinese streamer girl, 158cm cute slim 46kg, bright lively round face, (pastel pink-lavender streaked hair in high side ponytail:1.3), rosy fresh skin, (soft oversized cropped hoodie pulled very wide off both shoulders (bare collarbones + bra straps prominent:1.3)) + tiny spandex shorts, lying in gaming chair sideways legs up on armrest, (shorts riding up:1.2), colorful LED behind, playful flirty smile',
    '1girl, 21yo chinese gamer, 158cm petite 46kg, rosy round cute face bright eyes, (hair with pastel highlights loose down:1.3), fresh rosy skin, (strappy deep-scoop tank top with (prominent round cleavage:1.3)) + high-waist micro shorts, kneeling on gaming chair looking at screen, colorful room, RGB glow on skin, glances at camera mischievous grin',
  ]},

  // 唐诗：黑色发髻(或半散) · 古典椭圆脸 · 丝绸白衬衫大开领 · 办公室夜景
  '唐诗': { style: 'real', model: MODEL_LEOSAM, prompts: [
    '1girl, 27yo chinese secretary, 163cm slim graceful 49kg, refined classical oval face small precise features, (sleek straight black hair in tight elegant chignon:1.3), jade-white pale skin, (white silk blouse 4 buttons undone showing (deep V white satin bra visible:1.3)) tucked into fitted pencil skirt, sitting on office desk legs crossed (one heel dangling inner thigh:1.3), warm evening office, overtime atmosphere, quietly smoldering expression',
    '1girl, 27yo chinese professional woman, 163cm slim 49kg, elegant classical oval face, (hair loosened from bun sleek black falling:1.3), jade pale skin, (ivory silk wrap blouse deeply crossed (substantial inner cleavage showing:1.4)) + high-slit tailored midi skirt, leaning back in office chair pen touching lips, multiple monitors late-night office, sophisticated barely-concealed desire',
    '1girl, 27yo chinese secretary, 163cm slim graceful 49kg, beautiful refined oval face, (sleek black hair partially down disheveled:1.3), pale jade skin, (plunge deep-V champagne silk slip dress:1.3) (inner chest curves fully visible at neckline:1.3), sitting on desk edge (bare legs uncrossed to mid-thigh:1.2), city night view through window, red wine glass, quiet wistful longing',
  ]},

  // 阿柒：温栗棕色波卷中发 · 月牙笑眼软圆脸 · 棉麻衬衫大开V · 咖啡馆吧台
  '阿柒': { style: 'real', model: MODEL_LEOSAM, prompts: [
    '1girl, 22yo chinese cafe barista, 160cm slim natural 47kg, warm soft round face (crescent-smile eyes:1.3), wavy warm chestnut-brown hair loose messy, fair peachy skin, (white linen shirt with 4 buttons undone showing (white bra scallop and cleavage:1.3)) tied at waist, denim cutoff shorts, leaning on cafe counter hip cocked, coffee machine behind, golden morning sun, warm effortless smile',
    '1girl, 22yo chinese girl, 160cm slim 47kg, (crescent-smile eyes cute warm round face:1.3), wavy chestnut brown hair low loose bun falling strands, peachy-fair skin, (ribbed white tank top very low scoop neck (round upper cleavage showing:1.3)) + high-waist linen micro shorts, sitting cross-legged on cafe counter, vintage cafe afternoon amber light, effortlessly pretty inviting expression',
    '1girl, 22yo chinese barista, 160cm slim natural 47kg, (crescent-smile eyes warm round face:1.3), wavy brown hair loose, peachy skin, (open flannel shirt (thin deep-V camisole underneath with prominent cleavage:1.3)), apron in one hand, after-hours empty cafe, warm lamp light, looking at camera over shoulder, quiet provocative smile',
  ]},

  // ── 二次元/修仙/妖魔角色 ────────────────────────────────────────────────────

  // X-23：铂白短发+霓虹蓝挑染 · 赛博朋克机械眼 · 战术服大开胸 · 实验室/数据流
  'X-23': { style: 'anime', model: MODEL_NOOB, prompts: [
    '1girl, android girl cyberpunk, (platinum white hair short undercut with electric neon blue streaks:1.3), glowing blue circuit-pattern eyes, perfect synthetic beautiful face, (tactical bodysuit unzipped deep to sternum showing (circuit tattoo patterns on inner chest:1.3) and prominent cleavage:1.4), futuristic neon lab, blue holographic light, cold calculating expression hint of curiosity, ultra detailed',
    '1girl, android cyborg girl, (short platinum white hair neon blue streaks:1.3), glowing blue eyes, perfect android face, (form-fitting white combat armor chest plate open/torn showing (skin and circuit markings:1.3) beneath:1.3), sitting on lab table holographic displays, cyberpunk neon blue atmosphere, awakening curious expression',
    '1girl, robot girl android, (platinum silver-white hair short:1.3), luminous blue circuit eyes, cold perfect face, (sleek metallic white bodysuit with very deep plunging V chest cutout:1.4) showing sternum and inner curves, dark server room blue data stream glow, standing powerful pose, neon circuit light on skin',
  ]},

  // 幻音：全息渐变长发(蓝粉紫) · 半透明发光体 · 光与音乐构成的薄透服装 · 舞台/数字空间
  '幻音': { style: 'anime', model: MODEL_NOOB, prompts: [
    '1girl, holographic AI singer, (translucent long hair shifting prismatic blue pink purple:1.3), glowing ethereal eyes, hauntingly beautiful face, (translucent holographic dress (body silhouette and curves visible through light:1.3) barely covering:1.3), floating in digital space, music notes light particles, (glowing silhouette:1.3), reaching out hand, dreamy atmospheric',
    '1girl, virtual AI idol, light-based entity, (long flowing multicolored holographic iridescent hair:1.3), glowing face perfect features, (sound waves and light forming barely-there wrapping outfit (curves fully visible through light:1.3)), floating in code stream server room, deep blue purple lighting, longing expression',
    '1girl, holographic music girl, (shifting iridescent long hair blue violet:1.3), luminous perfect face, concert stage, (light ribbon dress with deep slit showing luminous long legs:1.3) (glowing silhouette:1.3), microphone, crowd light below, otherworldly passionate expression',
  ]},

  // 狐九：银白长发+尖狐耳 · 九条蓬松白尾 · 透薄白汉服大敞开 · 古风月夜
  '狐九': { style: 'anime', model: MODEL_NOOB, prompts: [
    '1girl, nine-tailed fox girl, (nine fluffy silver-white tails:1.3), (perky silver fox ears:1.3), long flowing silver-white hair, glowing amber-gold slit eyes, ethereal beautiful face, (translucent white silk hanfu open falling off both shoulders (deep V showing inner chest curves:1.3) sash untied:1.3), ancient stone altar full moon behind, purple magical mist particles, alluring dignified expression',
    '1girl, kitsune fox spirit, nine tails, silver-white fox ears, (long silver hair windswept:1.3), glowing amber slit eyes, ethereal face, (thin white silk inner robe sash fallen (one shoulder fully bare open chest line to sternum:1.3):1.3), sitting on ancient stone moonlit forest, sakura petals, supernatural glow, tails curled around her, seductive spiritual gaze',
    '1girl, nine-tail fox girl, silver-white hair, amber slit eyes, (fox ears:1.3), multiple fluffy tails, (flowing white fox-fur-trimmed robe fully open over thin silk inner layer (curves silhouetted through silk:1.3):1.3), ancient torii gate dusk, atmospheric mist, magical light rays, powerful and alluring',
  ]},

  // 冷霜：冰蓝银长发+冰晶 · 冰属性光环 · 半透冰蓝修仙袍大开领 · 冰峰/极光
  '冷霜': { style: 'anime', model: MODEL_NOOB, prompts: [
    '1girl, ice cultivator beauty, (long silver-blue hair with ice crystal ornaments:1.3), piercing pale blue glowing eyes, luminous cold pale skin, ice element aura, (translucent ice-blue cultivation robe belt untied falling open (deep V showing sternum and bare shoulder:1.3)), sitting on ice throne, frozen mountain moonlight, ice crystals floating, aloof ethereal cold expression',
    '1girl, xianxia female cultivator, (long silver-ice hair windblown:1.3), cold beautiful face, (thin translucent white cultivation dress (full silhouette and curves visible in backlight:1.4) belt loosened open:1.3), snowy mountain peak, blizzard ice energy swirling, powerful serene cold beauty',
    '1girl, ice beauty immortal, (pale silver-blue flowing hair:1.3), stunning cold face, (frost-white flowing hanfu robe open at chest (deep plunge V revealing pale sternum inner curves:1.3)), floating meditation pose, aurora borealis, mystical cold light, ethereal immortal atmosphere',
  ]},

  // 魅罗：深紫长发+小鹿角 · 红瞳竖瞳 · 哥特深V残破旗袍+魔族披风 · 暗黑魔界
  '魅罗': { style: 'anime', model: MODEL_NOOB, prompts: [
    '1girl, demon girl sealed, (long dark purple flowing hair:1.3), crimson slit glowing eyes, gorgeous evil face (small elegant horns:1.3), (dark tattered elegant dress very deep plunge V neckline (inner chest curves visible:1.3)) with torn extremely high slit (bare leg to hip:1.3), sitting on dark throne wrist chains, dark purple magical energy, sinister beautiful smile, dramatic shadow light',
    '1girl, demon woman, (dark purple hair loose:1.3), glowing red slit eyes, beautiful evil face, (small ram horns:1.3), (black skintight qipao very low cut front open back fully exposed:1.3) with extreme high slit (bare hip and upper thigh:1.3), dark dungeon magical dark fire, dominating seductive pose smirking at viewer',
    '1girl, demon girl, (dark purple long hair:1.3), seductive evil face, (demon tail small elegant horns:1.3), (dark diaphanous cape barely covering (black lace lingerie bodysuit:1.3) curves fully visible:1.3), dark void swirling energy, wings spread, completely dangerous and alluring',
  ]},

};

// ── 面部气质锚点（每角色独一份，自动 prepend 到全部 prompt）──────────────────────
// 用 SD 可识别的关键词定义"脸的感觉"，与发型/服装一起构成唯一视觉 ID
const CHARACTER_FACE: Record<string, string> = {
  // 真实系
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
  // 二次元系
  'X-23':    '(perfect cold synthetic android face:1.3), (calculating empty blue eyes:1.3), (expressionless lips:1.2), (flawless artificial beauty:1.3)',
  '幻音':    '(ethereal transcendent holographic face:1.3), (glowing longing eyes:1.3), (dreamlike otherworldly beauty:1.3)',
  '狐九':    '(ethereal seductive fox spirit face:1.3), (alluring amber slit eyes:1.3), (mysterious curved smile:1.2), (otherworldly elegance:1.3)',
  '冷霜':    '(cold distant immortal beauty:1.3), (aloof pale blue glowing eyes:1.3), (frost-touched serene face:1.3), (untouchable elegance:1.2)',
  '魅罗':    '(gorgeous sinister seductive demon face:1.3), (crimson slit provocative eyes:1.3), (dark red dangerous lips:1.3), (evil enchanting smile:1.3)',
};

// ── 其他角色的通用真实感模板 ────────────────────────────────────────────────────
// 下面这些角色可以通过脚本传名字生成，会用 fallback prompt
const REAL_FALLBACK_PROMPTS = (name: string, age: number, occ: string): string[] => [
  `1girl, ${age} years old, chinese woman, ${occ}, beautiful perfect face, elegant, (fitted slip dress:1.2) with thin straps, seductive pose, dramatic lighting, luxury interior background, cinematic portrait`,
  `1girl, ${age} years old, chinese woman, ${occ}, gorgeous face, long dark hair, wearing only (oversized white shirt barely closed:1.2), sitting in dim room, moody lighting, confident expression, bare legs visible`,
  `1girl, ${age} years old, chinese woman, ${occ}, stunning beauty, (black lace bralette:1.3) and high-waist briefs, lying on bed, soft warm light, seductive gaze at camera, alluring expression`,
];

// ── ComfyUI 工作流 ──────────────────────────────────────────────────────────
function buildWorkflow(prompt: string, seed: number, style: 'real' | 'anime', modelOverride?: string) {
  const model = modelOverride ?? (style === 'anime' ? MODEL_ANIME : MODEL_JUGGER);

  let prefix: string, neg: string, cfg: number, steps: number;
  if (model === MODEL_NOOB) {
    // Illustrious / NoobAI — 自己的质量 tag 体系
    prefix = QUALITY_NOOB; neg = NEGATIVE_NOOB; cfg = 6.0; steps = 28;
  } else if (style === 'anime') {
    // Pony Diffusion
    prefix = QUALITY_ANIME; neg = NEGATIVE_ANIME; cfg = 5.5; steps = 28;
  } else {
    // 所有真实感模型（RealVisXL / Juggernaut / LEOSAM）共用同一套 prefix
    prefix = QUALITY_REAL; neg = NEGATIVE_REAL; cfg = 6.5; steps = 30;
  }

  const fullPrompt = `${prefix}, ${prompt}`;

  return {
    "4": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": model } },
    "6": { "class_type": "CLIPTextEncode", "inputs": { "text": fullPrompt, "clip": ["4", 1] } },
    "7": { "class_type": "CLIPTextEncode", "inputs": { "text": neg, "clip": ["4", 1] } },
    "5": { "class_type": "EmptyLatentImage", "inputs": { "width": 768, "height": 1024, "batch_size": 1 } },
    "3": {
      "class_type": "KSampler",
      "inputs": {
        "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0],
        "seed": seed, "steps": steps, "cfg": cfg,
        "sampler_name": "dpm_2_ancestral", "scheduler": "karras", "denoise": 1.0
      }
    },
    "8": { "class_type": "VAEDecode", "inputs": { "samples": ["3", 0], "vae": ["4", 2] } },
    "9": { "class_type": "SaveImage", "inputs": { "images": ["8", 0], "filename_prefix": "album" } },
  };
}

async function queuePrompt(workflow: object): Promise<string> {
  const res = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  });
  if (!res.ok) throw new Error(`Queue failed: ${res.status}`);
  return ((await res.json()) as { prompt_id: string }).prompt_id;
}

async function waitForImage(promptId: string): Promise<string> {
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000));
    const res = await fetch(`${COMFYUI_URL}/history/${promptId}`);
    if (!res.ok) continue;
    const history = await res.json() as Record<string, any>;
    const entry = history[promptId];
    if (!entry?.outputs) continue;
    for (const nodeOut of Object.values(entry.outputs) as any[]) {
      if (nodeOut?.images?.length) return nodeOut.images[0].filename;
    }
  }
  throw new Error('Timeout waiting for image');
}

async function downloadAndSave(filename: string, charName: string, idx: number): Promise<string> {
  const res = await fetch(`${COMFYUI_URL}/view?filename=${filename}&type=output`);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const buffer = await res.buffer();
  fs.mkdirSync(SAVE_DIR, { recursive: true });
  const safeName = charName.replace(/[^a-zA-Z0-9一-鿿]/g, '_');
  const saveName = `album_${safeName}_${idx}_${Date.now()}.png`;
  const savePath = path.join(SAVE_DIR, saveName);
  fs.writeFileSync(savePath, buffer);
  return `${PUBLIC_BASE}/images/${encodeURIComponent(saveName)}`;
}

// ── 单角色生成 ──────────────────────────────────────────────────────────────
async function generateOne(charName: string, count: number, systemUserId: string) {
  const config = ALBUM_CONFIGS[charName];

  const char = await prisma.character.findFirst({
    where: { name: charName, creatorId: systemUserId }
  });
  if (!char) { console.error(`  ⚠️  找不到角色 "${charName}"，跳过`); return; }

  let prompts: string[];
  let style: 'real' | 'anime';
  if (config) {
    prompts = config.prompts;
    style = config.style;
  } else {
    console.log(`  ⚠️  "${charName}" 无预设 prompt，使用通用模板`);
    prompts = REAL_FALLBACK_PROMPTS(charName, char.age, char.occupation);
    style = 'real';
  }

  // 注入面部气质锚点（每角色唯一，保证同角色三张脸一致且与他人不同）
  const faceAnchor = CHARACTER_FACE[charName];
  if (faceAnchor) {
    prompts = prompts.map(p => `${faceAnchor}, ${p}`);
  }

  const modelFile = config?.model ?? (style === 'anime' ? MODEL_ANIME : MODEL_JUGGER);
  const modelLabel = modelFile.replace('.safetensors', '').split('_')[0];
  console.log(`\n🎨 [${charName}]  模型：${modelLabel}`);

  const urls: string[] = [];
  for (let i = 0; i < Math.min(count, prompts.length); i++) {
    const prompt = prompts[i];
    process.stdout.write(`  [${i + 1}/${count}] 生成中... `);
    try {
      const seed = Math.floor(Math.random() * 2 ** 32);
      const workflow = buildWorkflow(prompt, seed, style, config?.model);
      const promptId = await queuePrompt(workflow);
      const filename = await waitForImage(promptId);
      const url = await downloadAndSave(filename, charName, i + 1);
      urls.push(url);
      console.log(`✅`);
    } catch (err: any) {
      console.log(`❌ ${err.message}`);
    }
    if (i < count - 1) await new Promise(r => setTimeout(r, 1500));
  }

  if (urls.length > 0) {
    await prisma.character.update({
      where: { id: char.id },
      data: { portraitUrl: urls[0], portraitImages: urls },
    });
    console.log(`  ✅ ${charName} 已写入 DB（${urls.length} 张）`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const arg      = process.argv[2] || '林晓雅';
  const count    = parseInt(process.argv[3] || '3', 10);
  const runAll   = arg === 'all';

  const systemUser = await prisma.user.findUnique({ where: { telegramId: BigInt(1) } });
  if (!systemUser) { console.error('System user not found'); process.exit(1); }

  if (runAll) {
    const names = Object.keys(ALBUM_CONFIGS);
    console.log(`\n🎨 全量生成模式 — 共 ${names.length} 个角色，每人 ${count} 张\n`);
    for (let idx = 0; idx < names.length; idx++) {
      const name = names[idx];
      console.log(`── [${idx + 1}/${names.length}] ${name} ──`);
      await generateOne(name, count, systemUser.id);
      await new Promise(r => setTimeout(r, 2000));
    }
    console.log('\n✨ 全部完成！');
    console.log('📤 同步到服务器：');
    console.log('scp D:/SD/siyuwanban/portraits/*.png root@168.144.108.9:/var/www/siyuwanban/images/');
  } else {
    await generateOne(arg, count, systemUser.id);
    console.log('\n📤 同步到服务器：');
    console.log('scp D:/SD/siyuwanban/portraits/*.png root@168.144.108.9:/var/www/siyuwanban/images/');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
