/**
 * Flux 写实风格图库生成 — 单角色 100 张
 * 用法：node_modules\.bin\tsx src\generateLibraryFluxOne.ts <角色名> [--from=<shotKey>] [--force]
 * 输出：D:\SD\siyuwanban\library\{角色名}\{shotKey}\001.png + 001.json
 */

import 'dotenv/config';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { SHOT_TYPES, type ShotKey, type SceneConfig } from './generateSceneConfig';
const COMFYUI_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';
const LIBRARY_DIR = process.env.LIBRARY_DIR || 'D:/SD/siyuwanban/library/realistic';

// ═══════════════════════════════════════════════════════════════════
//  模型 & LoRA 配置区  ← 改这里
// ═══════════════════════════════════════════════════════════════════
const FLUX_MODEL = 'flux1DevAsian_v10FP16.safetensors';
const FLUX_CLIP1 = 't5xxl_fp8_e4m3fn.safetensors';
const FLUX_CLIP2 = 'clip_l.safetensors';
const FLUX_VAE   = 'ae.safetensors';

// LoRA 列表：[文件名, 权重]  — 只加面容 LoRA，不加肢体修复
// Flux 用 LoraLoaderModelOnly（不修改 CLIP）
const FLUX_LORAS: [string, number][] = [
  ['flux_cultures_age_v308.safetensors', 0.3],  // 多民族面容+年龄响应，触发词: chinese/japanese + 24yo
  ['Body FIX FLUX.safetensors', 0.3],           // 女性身体比例修复
];
// ═══════════════════════════════════════════════════════════════════

const SKIP_SHOTS: ShotKey[] = ['standing_sex'];

const SHOT_COUNT: Partial<Record<ShotKey, number>> = {
  portrait:               4,
  medium:                 4,
  kiss:                   5,
  breast:                 6,
  pussy:                  6,
  handjob:                6,
  fingering:              6,
  blowjob:                8,
  cunnilingus:            6,
  penetration_missionary: 7,
  penetration_doggy:      7,
  penetration_cowgirl:    7,
  penetration_spooning:   5,
  penetration_generic:    5,
  ahegao:                 7,
  creampie:               6,
  cum_face:               5,
  bondage:                5,
  toy_use:                5,
  petplay:                4,
  spanking:               4,
  undressing:             4,
  squirt:                 4,
};

const PHASE_MAP: Partial<Record<ShotKey, number>> = {
  portrait: 0, medium: 0,
  kiss: 1, breast: 1, pussy: 1,
  handjob: 2, fingering: 2, blowjob: 2, cunnilingus: 2,
  penetration_missionary: 3, penetration_doggy: 3, penetration_cowgirl: 3,
  penetration_spooning: 3, penetration_generic: 3, standing_sex: 3,
  ahegao: 4, creampie: 4, cum_face: 4,
  bondage: 3, toy_use: 3, petplay: 2, spanking: 3,
  undressing: 1, squirt: 4,
};

const CHARACTER_BASE: Record<string, string> = {
  // 格式：国籍/年龄/职业/身高 | 脸 | 发型 | 三围身材 | 乳头颜色
  '椎名老师': 'japanese, 24yo, teacher, 157cm, (soft round face:1.3), (chubby full cheeks:1.3), (small button nose:1.2), single eyelid warm brown eyes, black framed round glasses, dark black hair in loose bun, milky porcelain skin, (petite soft figure:1.2), (C cup perky breasts:1.3), (slim soft waist:1.2), (87cm round hips:1.1), (pale pink nipples:1.2)',
  '晓彤':    'chinese, 22yo, fitness coach, 163cm, (compact defined jawline:1.3), (strong cheekbones:1.2), (peach-blossom droopy eyes:1.3), jet black hair in high ponytail, tanned golden skin, (athletic toned body:1.3), (D cup firm breasts:1.3), (tight toned waist:1.2), (91cm strong round hips:1.2), (defined abs:1.2), (light tan-pink nipples:1.2)',
  '娜娜':    'chinese, 18yo, high school girl, 155cm, (heart-shaped face:1.4), (very plump round cheeks:1.3), (wide-set large round eyes:1.3), (tiny pointed chin:1.2), long straight jet black hair, porcelain skin, (very petite slender figure:1.3), (B cup soft breasts:1.3), (narrow childlike waist:1.3), (80cm slim hips:1.2), (pale pink nipples:1.3)',
  '小雨':    'chinese, 19yo, college girl, 160cm, (soft oval face:1.2), (big watery double-eyelid eyes:1.4), (delicate small nose:1.2), faint tear mole under left eye, soft wavy chestnut hair, cream white skin, (slim delicate figure:1.2), (C cup soft breasts:1.2), (slim 60cm waist:1.2), (85cm gentle hips:1.1), (long slim legs:1.2), (soft light pink nipples:1.2)',
  '琉璃':    'chinese, 22yo, graduate student, 161cm, (sharp angular oval face:1.3), (high nose bridge:1.3), (narrow single-lid eyes:1.3), neat straight black hair blunt bangs, black rectangular glasses, cool ivory skin, (slim straight figure:1.2), (C cup firm breasts:1.2), (flat taut waist:1.1), (84cm angular hips:1.1), (long slender legs:1.2), (pale cool-tone pink nipples:1.2)',
  '糖糖':    'chinese, 20yo, art student, 157cm, (round chubby apple face:1.3), (very deep prominent dimples:1.5), (wide bright double-lid eyes:1.2), black hair in ponytail, rosy warm fair skin, (petite soft round figure:1.2), (C cup soft breasts:1.3), (soft pudgy waist:1.1), (88cm plump round hips:1.2), (plump round bottom:1.2), (peach-pink nipples:1.2)',
  '沈静':    'chinese, 25yo, supermodel, 178cm, (extremely sharp angular face:1.5), (razor jawline:1.5), (very high prominent cheekbones:1.4), (elongated fox eyes:1.3), bone-straight black hair center-parted, pale ivory cool skin, (tall slender supermodel figure:1.4), (B cup firm breasts:1.2), (visible collarbones:1.3), (slim 64cm waist:1.2), (razor hip bones:1.2), (impossibly long slim legs:1.4), (pale cool-tone pink nipples:1.1)',
  '小慧':    'chinese, 23yo, nurse, 159cm, (egg-shaped gentle face:1.3), (soft round cheeks:1.2), (warm puppy-dog eyes:1.2), (small round nose:1.2), soft wavy light brown hair, peachy white skin, (soft gentle figure:1.2), (D cup full soft breasts:1.4), (soft round belly:1.1), (91cm wide gentle hips:1.2), (plump soft thighs:1.1), (soft pink nipples:1.2)',
  '夜玲':    'chinese, 26yo, artist, 162cm, (sharp pointed chin:1.3), (hollow cheeks:1.3), (heavy-lidded almond eyes:1.3), long dark wavy hair, heavy smoky makeup, dark red lips, (slim angular gothic figure:1.2), (C cup firm breasts:1.2), (narrow bony 59cm waist:1.2), (83cm slim hips:1.1), cold corpse-pale skin, (dark rose red nipples:1.3)',
  '晴晴':    'chinese, 21yo, gaming streamer, 158cm, (round apple cheeks:1.3), (bright crescent double-lid eyes:1.3), (prominent dimples:1.3), (cute upturned nose:1.1), long hair pink and lavender streaks, rosy healthy skin, (petite cute figure:1.2), (C cup perky breasts:1.3), (slim soft waist:1.1), (88cm round perky hips:1.2), (round perky bottom:1.2), (bright pink nipples:1.2)',
  '唐诗':    'chinese, 27yo, secretary, 163cm, (refined sharp oval face:1.3), (long narrow phoenix eyes:1.3), (sculpted cheekbones:1.2), (elegant arched brows:1.2), sleek black hair elegant chignon, jade-white cool skin, (slim elegant mature figure:1.2), (D cup firm full breasts:1.3), (trim defined waist:1.2), (90cm graceful hips:1.2), (graceful long legs:1.3), (elegant light pink nipples:1.2)',
  '阿柒':    'chinese, 22yo, cafe barista, 160cm, (warm soft round face:1.2), (faint freckles on nose and cheeks:1.4), (crescent smile eyes:1.3), (naturally full lips:1.2), wavy chestnut-brown hair loose, peachy fair skin, (natural soft figure:1.2), (C cup natural breasts:1.2), (soft warm waist:1.1), (87cm gentle round hips:1.1), (natural peach-pink nipples:1.2)',
};

// ── 男性存在感 ────────────────────────────────────────────────────
const MALE_PRESENCE: Partial<Record<ShotKey, string>> = {
  kiss:                   'male chin and lips visible pressing against hers',
  breast:                 'strong male hands groping her breasts, male fingers on nipples',
  handjob:                'erect male penis, male crotch close-up, veiny shaft',
  fingering:              'male fingers inside her, male hand between her thighs',
  blowjob:                'male thighs framing her face, male hand gripping her hair from above',
  cunnilingus:            'male head buried between her legs, dark hair visible from above',
  penetration_missionary: 'male body pressing down, male hips thrusting, male torso visible',
  penetration_doggy:      'male hands gripping her hips from behind, male torso behind her',
  penetration_cowgirl:    'male body lying underneath, male hands on her thighs, male chest visible',
  penetration_spooning:   'male arm wrapped around her from behind, male chest against her back',
  penetration_generic:    'male hands on her hips, male body partially visible',
  standing_sex:           'male hands pinning her to wall, male forearm visible',
  creampie:               'cum dripping from her stretched pussy',
  cum_face:               'male cock visible above her face, cum ropes shooting',
  bondage:                'male hands adjusting rope, male presence dominant behind her',
  toy_use:                'male hand controlling vibrator, male fingers guiding toy',
  spanking:               'male hand raised for or just landed spank, red handprint on buttock',
  undressing:             'male hands gently sliding garment off her shoulders',
  squirt:                 'male fingers just withdrawn, clear liquid gushing from her',
};

// ── 质量前缀 & 负向 ────────────────────────────────────────────────
const QUALITY = 'photorealistic, hyperrealistic, RAW photo, 8k uhd, masterpiece, dewy moist skin, slim petite figure, youthful delicate features, perfect face, flawless skin, nsfw, explicit, professional photography, sharp focus, cinematic lighting, correct anatomy, perfect hands, perfect fingers, no extra limbs, no watermark, no text';
const NEGATIVE = ''; // Flux cfg=1.0 negative 无效，留空

// ── Flux 超强面部差异化锚点（每人绝对标志权重 1.8~1.9）────────────────
// 规则：脸锚点放 prompt 最前，Flux 语言模型越前权重越高
const FACE_ANCHOR: Record<string, string> = {
  // 知性温柔：眼镜+单眼皮+深棕发盘发
  '椎名老师': '(thin black-framed oval glasses on nose:1.8), (single-eyelid warm brown eyes:1.6), (very soft round chubby face:1.4), warm nude pink lip gloss, gentle intellectual expression, dark brown-black hair in loose bun',

  // 运动网红：强下垂桃花眼+深棕马尾+铜色皮肤
  '晓彤':    '(strongly drooping peach-blossom eyes:1.8), (sharp compact defined jawline:1.6), (subtle lower-lash shimmer:1.3), coral glossy lips, confident sporty expression, (tanned golden skin:1.4), dark brown hair high ponytail, no glasses',

  // 辣妹萝莉：超大圆眼+黑发灰紫渐染发尾
  '娜娜':    '(enormously wide-set round doll eyes:1.8), (heart-shaped face very plump pinchable cheeks:1.6), (thick dramatic lower lashes:1.5), (pink-to-purple gradient eyeshadow:1.4), puffy glossy strawberry lips, (black hair with gray-purple ombre dyed tips:1.4), no glasses',

  // 清纯学妹：泪痣+栗棕卷发
  '小雨':    '(prominent tear mole directly under left eye:1.9), (large watery glistening double-eyelid eyes:1.6), barely-there glossy lip, porcelain pale dewy skin, pure innocent expression, soft wavy chestnut-brown hair, no glasses',

  // 学术御姐：方框眼镜+纯黑齐刘海直发
  '琉璃':    '(thick black rectangular glasses:1.8), (very narrow calm single-lid eyes:1.6), (sharp precise cat-eye liner:1.4), brick red matte lips, cool aloof expression, neat straight pure black hair with blunt bangs',

  // 甜系艺术生：超深酒窝+奶茶棕发
  '糖糖':    '(extremely deep prominent dimples both cheeks:1.9), (round chubby apple face:1.5), (warm amber shimmer eyeshadow:1.4), peach glossy lips, bright crinkle-smile eyes, (milk-tea brown hair in ponytail:1.4), no glasses',

  // 高冷超模：刀刃颧骨+冷灰棕中分发
  '沈静':    '(razor-sharp angular cheekbones protruding visibly:1.9), (deeply hollow sunken cheeks:1.7), (elongated fox-eye double wing liner:1.5), bone-pale cool-undertone skin, nude matte thin lips, dead-fish distant gaze, (cool ash-brown hair center-parted straight:1.4), no glasses',

  // 邻家护士：桃粉大腮红+浅棕卷发
  '小慧':    '(very soft round egg-shaped gentle face:1.7), (warm peachy-pink blush spread wide on cheeks:1.7), (soft doe eyes with light brown mascara:1.4), sheer pink lip tint, warm approachable smile, soft wavy light-brown hair, no glasses',

  // 暗黑哥特：极重烟熏+深紫黑波浪发
  '夜玲':    '(extremely heavy bleeding smoky black eyeshadow extending outward:1.9), (very dark crimson black-tinted matte lips:1.7), (sharp narrow pointed chin:1.5), cold corpse-pale white skin, intense heavy-lidded gaze, (dark purple-black long wavy hair:1.4), no glasses',

  // 韩系主播：puppy眼线+粉紫挑染发
  '晴晴':    '(strong puppy-eye downward-flick liner both eyes:1.8), (glass-skin extreme dewy highlight:1.6), (pink-to-coral gradient ombre lips:1.4), bright sparkling round eyes, (long hair with pink and lavender color streaks:1.5), no glasses',

  // 高定秘书：正红唇+深酒红盘发
  '唐诗':    '(bold classic red matte lipstick:1.9), (sharp long narrow phoenix upturned eyes:1.7), (sharp refined high arch brow:1.4), sculpted cool ivory skin, elegant composed expression, (deep wine-red hair in elegant updo:1.5), no glasses',

  // 自然咖啡师：密集雀斑+栗棕波浪
  '阿柒':    '(natural scattered freckles densely on nose bridge and both cheeks:1.9), (warm crescent smile eyes:1.5), apricot-brown glossy lip, sheer dewy skin, effortless casual warm expression, wavy chestnut-brown hair loose, no glasses',
};

// ── 角色外貌结构化属性（写入数据库 faceFeatures + faceAnchor）────────────
interface CharStyle {
  hairStyle:  string;   // 发型
  hairColor:  string;   // 发色
  makeup:     string;   // 妆容风格
  skinTone:   string;   // 肤色
  eyeType:    string;   // 眼型
  lipColor:   string;   // 唇色
  lensColor:  string;   // 美瞳/隐形眼镜
  jewelry:    string;   // 首饰（耳环/项链/手链等）
  nailArt:    string;   // 美甲
  scent:      string;   // 体香/香水风格
  lingerie?:  string;   // 情趣内衣（中文描述，存DB，可选）
  signature:  string;   // 最标志性特征（一句话）
  imageModel: string;   // 本底模
}

// ── 情趣内衣 SD 提示词（英文，直接进 prompt）─────────────────────────────
// 规则：按角色气质定制；outfit 为"内衣版"，写进 penetration/handjob/fingering 的奇数张
// 格式：lingerie worn during sex（内裤脱掉或挪开，胸罩保留/半脱）
const CHARACTER_LINGERIE: Record<string, string> = {
  // 知性老师：白色蕾丝文胸半解扣垂下，白色大腿袜，眼镜还戴着
  '椎名老师': 'white lace bra half-unhooked dangling off shoulders, white thigh-high stockings with lace top, wearing glasses, panties removed',

  // 运动教练：运动内衣推上去，短裤拉到大腿，比基尼晒痕
  '晓彤':    'sports bra pushed up above breasts, athletic shorts pulled down to thighs, visible bikini tan line contrast, panties removed',

  // 辣妹萝莉：粉色荷叶边babydoll，白色蕾丝内裤挪到一侧
  '娜娜':    'pink ruffled babydoll chemise with bow detail, white lace thong pulled aside, chest exposed, stockings on',

  // 清纯学妹：浅蓝色细肩带蕾丝胸衣+白色膝上袜，内裤脱掉
  '小雨':    'pale blue delicate lace bralette straps slipping off shoulders, white knee-high socks, no panties, innocent contrast',

  // 学术御姐：黑色极简三角文胸+超薄黑色丝袜+吊袜带，内裤脱掉
  '琉璃':    'black minimalist triangle bra still on, sheer black thigh-high stockings with garter belt, glasses on, panties off, cold expression',

  // 甜系艺术生：蜜桃珊瑚色蕾丝套装，细肩带，蕾丝边内裤挪开
  '糖糖':    'peach-coral ruffled lace bra and matching thong set, thin straps, thong pulled aside, white ankle socks, dimples showing',

  // 高冷超模：极简黑色细带三点式几乎透明，裸色超薄连腿袜，内裤已脱
  '沈静':    'barely-there black micro lingerie with ultra-thin straps, nude sheer full-leg stockings, minimalist and cold, panties removed',

  // 邻家护士：护士主题白色蕾丝连体内衣，白色大腿袜，红十字胸针
  '小慧':    'white nurse-themed lace babydoll with red cross emblem, white thigh-high stockings, soft and gentle look, panties off',

  // 暗黑哥特：黑色皮质绑带胸衣+黑色网格丝袜+黑色蕾丝吊袜带，内裤脱掉
  '夜玲':    'black leather strap harness bra with buckles, black fishnet stockings, black lace garter belt, gothic accessories on, no panties',

  // 韩系主播：紫色猫耳发箍+粉紫色镂空连体内衣，内裤部分镂空，游戏少女
  '晴晴':    'purple cat ear headband, lavender sheer lace bodysuit with cutout details, colorful thigh-high socks, gaming streamer aesthetic',

  // 高定秘书：深红色缎面束腰胸衣+黑色网格丝袜+吊袜带+细跟高跟鞋全程不脱
  '唐诗':    'dark red satin corset with gold trim lacing, black sheer stockings with garter belt, stiletto heels still on, panties off, powerful elegant',

  // 自然咖啡师：米白色棉质蕾丝文胸+简约白色内裤挪开，不做作自然风
  '阿柒':    'cream cotton lace bralette with tiny floral print, simple white cotton panties pulled aside, natural effortless look, ankle socks',
};

// 哪些 shotKey 会启用情趣内衣版（奇数张穿内衣，偶数张全裸）
const LINGERIE_SHOTS = new Set<ShotKey>([
  'breast', 'handjob', 'fingering', 'blowjob',
  'penetration_missionary', 'penetration_doggy', 'penetration_cowgirl',
  'penetration_spooning', 'penetration_generic',
  'bondage', 'toy_use', 'undressing',
]);
const CHARACTER_STYLE: Record<string, CharStyle> = {
  '椎名老师': {
    hairStyle: '松散盘发',       hairColor: '深棕黑色',
    makeup:    '知性裸妆，细框椭圆眼镜，无妆感底妆',
    skinTone:  '瓷白牛奶肌',    eyeType: '单眼皮暖褐色',  lipColor: '裸粉唇釉',
    lensColor: '不戴美瞳，自然单眼皮暖褐色原瞳',
    jewelry:   '细金链项链+小珍珠耳钉',
    nailArt:   '短圆裸粉法式美甲，白色月牙边',
    scent:     '淡雅白茶香，书卷气息',
    signature: '细框椭圆眼镜+单眼皮',  imageModel: 'flux-asian',
  },
  '晓彤': {
    hairStyle: '高马尾',         hairColor: '深棕色',
    makeup:    '运动网红妆，桃花卧蚕，珊瑚唇',
    skinTone:  '健康铜色小麦肌', eyeType: '强下垂桃花眼',  lipColor: '珊瑚橘唇釉',
    lensColor: '蜜糖棕色隐形，轻微放大自然桃花眼',
    jewelry:   '金色细圈耳环+运动风金属项圈',
    nailArt:   '短方形裸橘色甲，哑光质感',
    scent:     '运动后清爽皂感，薄荷+柑橘',
    signature: '强下垂桃花眼+小麦肌',  imageModel: 'flux-asian',
  },
  '娜娜': {
    hairStyle: '直发灰紫渐染发尾', hairColor: '黑色渐染灰紫尾',
    makeup:    '辣妹萝莉妆，粉紫渐变眼影，厚下睫毛，泡泡唇',
    skinTone:  '瓷白肌',          eyeType: '超大圆娃娃眼',  lipColor: '草莓泡泡唇',
    lensColor: '紫罗兰大直径美瞳，直径15mm，超大娃娃眼效果',
    jewelry:   '爱心形水钻耳坠+草莓吊坠项链+彩色串珠手链',
    nailArt:   '长圆形糖果粉甲+紫色星星贴片+银色亮粉',
    scent:     '少女草莓奶油香，甜腻水果调',
    signature: '超大圆眼+心形脸+灰紫渐染发',  imageModel: 'flux-asian',
  },
  '小雨': {
    hairStyle: '栗色软波浪',      hairColor: '栗棕色',
    makeup:    '清纯零妆，水光唇，左眼下泪痣',
    skinTone:  '奶油瓷白肌',      eyeType: '大水眸双眼皮',  lipColor: '水光透明唇',
    lensColor: '灰棕裸色美瞳，自然水润放大，强化泪眼感',
    jewelry:   '细银链项链+水滴形月光石耳坠',
    nailArt:   '短圆形裸粉甲，透明闪粉顶层',
    scent:     '清甜婴儿香粉感，白麝香+玉兰',
    signature: '左眼下泪痣+栗色卷发',  imageModel: 'flux-asian',
  },
  '琉璃': {
    hairStyle: '直发齐刘海',      hairColor: '纯黑色',
    makeup:    '学术御姐妆，方框黑框眼镜，砖红哑光唇，猫眼线',
    skinTone:  '冷调象牙白',      eyeType: '细长单眼皮',   lipColor: '砖红哑光唇',
    lensColor: '不戴美瞳，自然冷调单眼皮黑瞳，配猫眼线',
    jewelry:   '简约银质直条耳钉+细银手表',
    nailArt:   '短方形砖红哑光甲，纯色极简',
    scent:     '冷调木质香，柏木+皮革+淡淡墨水',
    signature: '方框黑眼镜+砖红唇+齐刘海',  imageModel: 'flux-asian',
  },
  '糖糖': {
    hairStyle: '奶茶色马尾',      hairColor: '奶茶棕色',
    makeup:    '甜系艺术生妆，深酒窝，橘调眼影，水蜜桃唇',
    skinTone:  '玫瑰白肌',        eyeType: '宽双眼皮',     lipColor: '水蜜桃唇釉',
    lensColor: '奶茶棕日系大美瞳，温暖甜系，强化苹果脸感',
    jewelry:   '水蜜桃小耳钉+细金质贝壳项链+发圈珍珠',
    nailArt:   '短圆形水蜜桃渐变甲+手绘小花朵+金色小星星',
    scent:     '甜蜜焦糖桃子香，温暖奶甜调',
    signature: '超深双侧酒窝+奶茶棕发',  imageModel: 'flux-asian',
  },
  '沈静': {
    hairStyle: '冷灰棕中分直发',  hairColor: '冷灰棕色',
    makeup:    '高冷超模妆，双飞翼猫眼，裸唇无神',
    skinTone:  '骨感冷调象牙白',  eyeType: '细长狐狸眼',   lipColor: '裸色哑光唇',
    lensColor: '冷灰绿混血美瞳，异域高冷感，配双飞翼眼线',
    jewelry:   '超长几何金色耳坠+极细链条多层项链',
    nailArt:   '长尖形冷灰裸甲+极细金线装饰',
    scent:     '高冷白色花香，白玫瑰+琥珀+微量皮革',
    signature: '刀刃颧骨+凹脸颊+冷灰棕发',  imageModel: 'flux-asian',
  },
  '小慧': {
    hairStyle: '浅棕软波浪',      hairColor: '浅棕色',
    makeup:    '邻家温柔妆，桃粉大腮红，粉唇，淡眼线',
    skinTone:  '桃粉白肌',        eyeType: '软圆柴犬眼',   lipColor: '粉嫩唇彩',
    lensColor: '蜜茶棕放大美瞳，温柔大眼，强化柴犬下垂眼感',
    jewelry:   '护士主题小熊耳钉+粉色爱心细项链',
    nailArt:   '短圆形婴儿粉甲+白色小碎花手绘',
    scent:     '温柔棉花糖香，轻甜樱花+白麝香',
    signature: '桃粉大腮红+鸡蛋圆脸',  imageModel: 'flux-asian',
  },
  '夜玲': {
    hairStyle: '深紫黑波浪长发',  hairColor: '深紫黑色',
    makeup:    '暗黑哥特妆，极重烟熏外晕，深枣红黑唇，苍白死感肌',
    skinTone:  '冰冷尸感苍白',    eyeType: '重眼皮杏眼',   lipColor: '深枣红黑唇',
    lensColor: '纯黑扩瞳美瞳，极度放大瞳孔，死感空洞凝视',
    jewelry:   '黑十字架长耳坠+蛇骨银项链+多枚黑戒指',
    nailArt:   '超长棺材形黑甲+暗红玫瑰手绘+银箔碎片',
    scent:     '暗黑玫瑰焚香，黑鸦片+烟熏皮革',
    signature: '极重烟熏+深紫黑发+枣红黑唇',  imageModel: 'flux-asian',
  },
  '晴晴': {
    hairStyle: '粉紫挑染长发',    hairColor: '黑底粉紫挑染',
    makeup:    'K-pop网红妆，puppy下勾眼线，玻璃光感肌，渐变唇',
    skinTone:  '玫瑰白透亮肌',    eyeType: 'puppy下垂眼',  lipColor: '粉珊瑚渐变唇',
    lensColor: '蓝紫星空渐变美瞳，配粉紫发色，电竞少女感',
    jewelry:   '游戏手柄小耳坠+彩虹珠珠发圈+银质闪电项链',
    nailArt:   '长圆形彩虹渐变甲+像素游戏图案+亮片贴纸',
    scent:     '元气西瓜汽水香，少女电竞风清甜调',
    signature: 'puppy眼线+粉紫发色+玻璃肌',  imageModel: 'flux-asian',
  },
  '唐诗': {
    hairStyle: '深酒红盘发',      hairColor: '深酒红色',
    makeup:    '高定御姐妆，正红哑光唇，锋利凤眼，精致弓眉',
    skinTone:  '冷调玉白肌',      eyeType: '细长凤凰眼',   lipColor: '正红哑光唇',
    lensColor: '深棕金边美瞳，细金圈内环，高贵御姐凤眼更锋利',
    jewelry:   '祖母绿宝石耳坠+金质细手镯+珍珠胸针',
    nailArt:   '长尖形酒红法式甲+金箔边线+镜面质感',
    scent:     '高贵东方香，沉香+大马士革玫瑰+琥珀',
    signature: '正红唇+深酒红盘发+锋利凤眼',  imageModel: 'flux-asian',
  },
  '阿柒': {
    hairStyle: '栗棕松散波浪',    hairColor: '栗棕色',
    makeup:    '自然系妆容，鼻梁雀斑，杏棕唇，透明底妆',
    skinTone:  '桃粉自然肌',      eyeType: '月牙笑眼',     lipColor: '杏棕唇釉',
    lensColor: '淡榛子棕混血美瞳，自然感，让雀斑五官更立体',
    jewelry:   '麻绳编织小耳环+金色细圆圈鼻钉（左）+咖啡豆吊坠项链',
    nailArt:   '短圆形裸杏甲+手绘小雏菊+泥土感哑光',
    scent:     '咖啡豆烘焙香，焦糖拿铁+温暖香草',
    signature: '密集雀斑+栗棕波浪+自然气质',  imageModel: 'flux-asian',
  },
};

// ── 每个 shotKey 的变体（轮转使用，确保每张图不一样）──────────────────
type Variant = { prompt: string; note: string };
const SHOT_VARIANTS: Partial<Record<ShotKey, Variant[]>> = {
  portrait: [
    { prompt: 'portrait photo, head and shoulders, direct eye contact, soft natural smile, hair flowing, warm soft background',                                                       note: '柔和微笑·直视镜头·发丝自然' },
    { prompt: 'portrait photo, head and shoulders, head slightly tilted, coy playful expression, finger lightly touching lips, flushed cheeks',                                      note: '侧头媚笑·手指触唇·脸颊微红' },
    { prompt: 'portrait photo, head and shoulders, low angle shot looking up, doe eyes wide open, lips slightly parted, innocent yet seductive expression',                           note: '仰角·大眼睛·嘴唇微张·纯真撩人' },
    { prompt: 'portrait photo, head and shoulders, looking over shoulder, mysterious gaze, hair partially falling over face, subtle smile at corner of lips',                         note: '侧目回眸·发丝遮脸·嘴角神秘微笑' },
  ],
  medium: [
    { prompt: 'medium shot waist up, arms relaxed, teasing confident smile, collarbones visible, soft front lighting, casual sexy pose',                                             note: '正面·锁骨展露·自信撩人' },
    { prompt: 'medium shot waist up, leaning slightly forward toward camera, chest subtly emphasized, chin up, challenging direct gaze',                                             note: '前倾·胸线若隐若现·下巴上扬挑衅' },
    { prompt: 'medium shot waist up, both hands on hips, slim waist emphasized, playful wink, side lighting with shadow',                                                            note: '双手掐腰·纤腰强调·俏皮眨眼' },
    { prompt: 'medium shot waist up, one hand lifting hair, other fingertips resting on collarbone, longing dreamy expression, soft backlight halo',                                 note: '撩发·指尖触颈·神情若有所思' },
  ],
  kiss: [
    { prompt: 'close-up kissing, lips barely touching, both eyes open wide, breath mingling, hesitant first-kiss tenderness, noses almost touching',                                 note: '轻触嘴唇·双眼睁着·迟疑温柔的初吻' },
    { prompt: 'close-up kissing, deep passionate kiss, both eyes tightly shut, her hands gripping his shirt collar, completely surrendered and melting into him',                     note: '深吻·眼紧闭·双手抓衣领·完全沉沦' },
    { prompt: 'close-up kissing, tongues visibly meeting between parted lips, saliva glistening, cheeks deeply flushed, eyes half-lidded in pleasure',                               note: '舌尖相遇·唾液晶莹·双颊绯红·眼半闭' },
    { prompt: 'close-up kissing, lips just separating, thin saliva thread connecting both mouths, her eyes dazed and glassy, lips swollen from kissing',                             note: '分离瞬间·唾液细丝相连·眼神迷离·嘴唇肿' },
    { prompt: 'close-up kissing, she aggressively pulls him in, fingers deep in his hair, hungry and passionate, his hands cradling her face',                                       note: '主动拉近·手握发根·热情饥渴·他手捧脸' },
  ],
  breast: [
    { prompt: 'close-up bare breasts, both male hands squeezing from front, erect pink nipples between fingers, she looks down with flushed submissive expression',                  note: '双手前揉·乳头坚挺夹指·低头顺从潮红' },
    { prompt: 'close-up bare breasts, nipple pinched and pulled between two fingers, other breast cupped, back arching involuntarily, mouth open wide in loud moan',                 note: '乳头夹捏拉扯·另手托揉·背弓·嘴大张呻吟' },
    { prompt: 'close-up bare breasts, male hands cupping from behind, her head tilted back onto his shoulder, eyes closed, soft moaning expression',                                 note: '男手从后托住·头靠肩·闭眼轻声呻吟' },
    { prompt: 'extreme close-up, male tongue circling wet around nipple, saliva glistening, his hand squeezing the other breast, her eyes rolling slightly',                         note: '舌头绕乳头画圈·湿润特写·另手揉捏·眼微翻' },
    { prompt: 'close-up bare breasts, both nipples swollen and erect after play, hands just pulled away, breasts heaving with her heavy rapid breathing',                            note: '爱抚后乳头肿胀坚挺·手刚离开·随急促喘息起伏' },
    { prompt: 'close-up, nipple fully sucked deep into mouth, cheeks hollowed from strong suction, other hand kneading breast rhythmically, intense moaning',                        note: '乳头被深深含入吮吸·脸颊凹陷·另手节奏揉捏' },
  ],
  pussy: [
    { prompt: 'close-up spread pussy, lying on back, both fingers spreading labia wide open, pink wet interior visible, straight-on camera angle, glistening',                       note: '仰躺·双手撑开阴唇·粉嫩湿润内部·正面' },
    { prompt: 'close-up pussy, side angle shot, one leg raised and spread wide, swollen and wet after arousal, inner thigh glistening with love juice',                              note: '侧角·单腿高举·湿润肿胀·大腿内侧晶莹' },
    { prompt: 'extreme macro close-up of vaginal entrance, overflowing wet, swollen pink labia, love juice naturally seeping out in drops',                                          note: '极近特写·入口湿润溢出·爱液自然滴落' },
    { prompt: 'close-up pussy from rear angle, kneeling with ass raised, looking back between spread thighs at camera, fully exposed and vulnerable',                                note: '跪趴翘臀后方·双腿间回望镜头·完全暴露' },
    { prompt: 'close-up pussy, sitting spread wide, both hands pulling labia open in offering, directly facing camera, love juice dripping down',                                    note: '坐姿大开·双手撑开献上·正对镜头·爱液垂落' },
    { prompt: 'close-up pussy after stimulation, slightly closing but still dripping, puffy swollen labia, love juice thread hanging between them',                                  note: '受刺激后微合·仍滴落·肿胀阴唇·爱液垂丝' },
  ],
  handjob: [
    { prompt: 'POV handjob, full fist grip around erect veiny shaft, eye contact looking up seductively from below, slow deliberate strokes, teasing smirk',                        note: '满握勃起茎·POV仰视媚眼·缓慢刻意撸动' },
    { prompt: 'POV handjob, both hands working the shaft together, fingers interlaced around it, cock head peeking out at top, eager expression',                                    note: '双手共同握持·手指交叉·龟头露出顶端·期待' },
    { prompt: 'POV handjob, just fingertips teasing and circling the cock head, pre-cum on tip, playful innocent expression, head tilted',                                           note: '指尖轻触龟头画圈·前液·歪头娇憨表情' },
    { prompt: 'POV handjob, one hand stroking shaft while tongue simultaneously licks the tip, saliva and pre-cum mixing, submissive upward gaze',                                   note: '一手撸茎同时舔尖·唾液前液交融·顺从仰视' },
    { prompt: 'POV handjob, fast pumping motion with hand slightly blurred from speed, pre-cum dripping, cheeks flushed, breathing fast and heavy',                                  note: '快速抽动·手部动感模糊·前液滴落·喘气潮红' },
    { prompt: 'POV handjob, slow deliberate tease, thumb rubbing cock head in slow circles, watching intently with half-lidded hungry eyes, biting lower lip',                       note: '拇指缓绕龟头·专注凝视·眼半闭饥渴·咬下唇' },
  ],
  fingering: [
    { prompt: 'fingering close-up, one finger slowly inserting, spread eagle lying back, front view, mouth open in breathy soft moan, eyes wide',                                   note: '单指缓入·大字仰躺·正面·轻声娇吟·眼睁大' },
    { prompt: 'fingering close-up, two fingers curled upward for g-spot stimulation, legs trembling involuntarily, eyes beginning to roll back, gasping loudly',                     note: '两指上勾G点刺激·双腿不自主颤抖·眼球开始翻' },
    { prompt: 'fingering close-up, three fingers deep and rapidly thrusting, love juice splashing, thighs shaking violently, losing complete control, mouth agape',                  note: '三指急速深插·爱液飞溅·大腿剧烈颤·完全失控' },
    { prompt: 'fingering close-up, lying on side, fingers entering from behind while she arches back, clutching pillow tightly, biting into it',                                     note: '侧躺·手指从后方插入·背弓·紧抓枕头·咬入' },
    { prompt: 'fingering, sitting upright on edge of bed, hand thrust between thighs from front, biting lower lip hard, thighs squeezing hand tightly',                             note: '坐姿·手伸入大腿间·咬下唇用力·大腿紧夹' },
    { prompt: 'fingering close-up, fingers slowly withdrawing, long glistening love juice strings stretching from fingers to entrance, extremely soaked',                            note: '手指缓慢抽出·爱液长丝拉扯·极度湿润' },
  ],
  blowjob: [
    { prompt: 'close-up blowjob POV, cock head resting on flat extended tongue, playful teasing upward gaze, saliva pooling around it, hands resting on thighs',                    note: '龟头置于平伸舌面·嬉皮仰视·唾液积聚' },
    { prompt: 'close-up blowjob POV, lips wrapped tight around cock head only, cheeks slightly hollowed in suction, saliva glistening, eyes locked upward',                         note: '嘴唇紧包龟头·脸颊微凹吮吸·眼神锁定' },
    { prompt: 'close-up blowjob POV, half depth in mouth, shaft visibly stretching one cheek outward, thick saliva trailing down, muffled moaning expression',                      note: '半深含入·阴茎撑起脸颊·浓厚唾液·闷哼' },
    { prompt: 'close-up blowjob POV, deep throat, nose nearly touching skin, eyes watering with tears, drool running freely down chin, hair disheveled',                             note: '深喉·鼻尖几乎抵触·眼角泪湿·口水流颌·发乱' },
    { prompt: 'close-up blowjob side profile, tongue flat licking slowly from base to tip along underside, wet and deliberate, eyes looking up playfully',                           note: '侧面·舌平展从根到尖缓慢舔·湿润·眼神俏皮' },
    { prompt: 'close-up blowjob POV, both hands gripping shaft, tongue swirling around tip, expression eager and starving, pre-cum visible on tongue tip',                           note: '双手握茎·舌绕尖旋转·饥渴期待·前液在舌尖' },
    { prompt: 'close-up blowjob POV, rhythmic bobbing motion, lips moving up and down shaft, saliva strings forming with each movement, eyes never break contact',                   note: '有节奏上下运动·嘴唇移动·唾液丝牵引·眼神不断' },
    { prompt: 'close-up blowjob aftermath, cock just pulled out, thick saliva strings stretching from lips to tip, chin and lips completely soaked, satisfied dazed face',           note: '口交后刚抽出·浓厚唾液长丝·下巴湿透·满足迷离' },
  ],
  cunnilingus: [
    { prompt: 'cunnilingus, broad tongue flat licking upward slowly across entire labia, love juice coating tongue, she arches upward',                                              note: '宽舌平展从下往上舔·爱液挂舌·腰上挺' },
    { prompt: 'cunnilingus close-up, lips fully suctioned around clitoris, intense rhythmic suction, her legs clamping around his head, toes curling tightly',                      note: '嘴唇吸住阴蒂·节奏性吮吸·双腿夹头·脚趾蜷' },
    { prompt: 'cunnilingus, tongue tip actively probing vaginal entrance, two fingers spreading labia wide apart, love juice everywhere, deep uncontrolled moaning',                 note: '舌尖探入口·两指撑开阴唇·爱液四溢·深沉呻吟' },
    { prompt: 'cunnilingus medium shot, his face fully buried between thighs, only top of head visible, her hands gripping his hair, back fully arched off bed',                    note: '整脸埋入大腿间·只见头顶·双手抓发·背完全弓' },
    { prompt: 'cunnilingus, her legs draped over his shoulders, she looks down at him with glazed needy eyes, he looks up while tonguing, sustained eye contact',                    note: '双腿搭肩·她俯视渴求·他舔时仰视·持续对视' },
    { prompt: 'cunnilingus, two fingers thrusting while tongue simultaneously circles clit, double stimulation, slight squirting, eyes fully rolled back',                            note: '手指插入同时舌圈阴蒂·双重刺激·微潮吹·眼全翻' },
  ],
  penetration_missionary: [
    { prompt: 'missionary sex position, slow gentle first entry, both watching the penetration point, tender intimate eye contact, soft moaning, love juice coating shaft',          note: '缓慢轻柔初次插入·双方凝视结合处·温柔对视' },
    { prompt: 'missionary sex position, both legs raised high onto his shoulders, deep angle penetration, gasping from depth, hands white-knuckling the sheets',                    note: '双腿搭肩·深角度插入·因深度倒吸气·死抓床单' },
    { prompt: 'missionary sex position, legs tightly wrapped around his waist pulling him deeper, urgent clinging, passionate eye contact, moaning together loudly',                 note: '双腿绕腰拉他更深·紧迫缠绵·热烈对视·共同呻吟' },
    { prompt: 'missionary sex position, fast hard pounding rhythm, breasts bouncing with each thrust, sweat visible on both bodies, head thrown back in screaming ecstasy',          note: '激烈快速抽插·乳房随冲击晃·汗水·仰头嚎叫' },
    { prompt: 'missionary sex position, slow tender thrusting while simultaneously kissing deeply, both eyes closed, intimate lovemaking, fingers intertwined',                      note: '缓慢温柔抽插同时深吻·闭眼·指尖交握·温存' },
    { prompt: 'missionary sex position, pillow under raised hips changing angle, deeper penetration, love juice overflowing, connection area close-up shot',                         note: '臀下垫枕调角度·更深插入·爱液溢·连接处特写' },
    { prompt: 'missionary sex position explicit close-up, cock pulling halfway out showing glistening wet shaft then thrusting fully back in, love juice visible on both',           note: '传教士插入特写·抽出一半显湿茎·再全力推入' },
  ],
  penetration_doggy: [
    { prompt: 'doggy style sex, classic four-point position, rear view filling frame, full deep penetration, his hands gripping her hips firmly, back arched',                      note: '经典四点跪趴·后方视角·全力深插·双手抓腰' },
    { prompt: 'doggy style sex, face-down ass-up variation, cheek pressed into pillow, ass raised high in air, deep penetration, lower back deeply arched',                         note: '脸下臀上变体·脸颊贴枕·臀高耸·深插·腰深弓' },
    { prompt: 'doggy style sex, she looks back over shoulder making direct eye contact, mouth open moaning, hair tousled, his hands on her waist',                                  note: '回头越肩直视对眼·张嘴呻吟·发乱·手抓腰' },
    { prompt: 'doggy style sex, her hair pulled back in his fist, neck forced to arch upward, side profile view, tears of pleasure on cheek, exposed throat',                       note: '头发被握拳拽起·颈部被迫上仰暴露·侧面快感泪' },
    { prompt: 'doggy style sex, full side angle showing complete connected bodies, rhythmic thrusting, sweat droplets, ass rippling and bouncing with each impact',                  note: '侧面全身连接·节奏冲击·汗珠·臀部随撞击波动' },
    { prompt: 'doggy style sex extreme close-up of rear penetration, cock entering from behind clearly visible, love juice coating both, ass cheeks spread wide',                    note: '后入极近特写·插入清晰可见·爱液涂抹·臀展开' },
    { prompt: 'doggy style sex, relentless pounding, she collapses forward onto elbows completely overwhelmed, moaning into bed, completely taken and undone',                       note: '猛烈不停·她向前倒到肘部·呻吟入床·完全被制服' },
  ],
  penetration_cowgirl: [
    { prompt: 'cowgirl sex position, sitting upright riding, hands braced on his chest, steady bouncing rhythm, breasts swaying, cheeks deeply flushed',                            note: '直立骑乘·手撑其胸·稳定律动·乳房摇曳' },
    { prompt: 'cowgirl sex position, leaning forward onto his chest, hair curtaining around both faces, intimate close whisper, slow sensual circular grind',                        note: '前倾俯身贴胸·发丝垂帘·亲密低语·缓慢磨蹭' },
    { prompt: 'cowgirl sex position, fast intense bouncing, breasts wildly in motion, head thrown fully back, eyes rolling, mouth screaming wide open',                              note: '快速激烈弹跳·乳房狂烈晃动·仰头·眼翻·嘴张叫' },
    { prompt: 'cowgirl sex position, slow sensual circular grinding, hips rotating in wide circles, eyes half-lidded, tongue slowly licking lips, savoring every sensation',         note: '缓慢旋转磨蹭·臀部画圈·眼半闭品味·舌缓舔唇' },
    { prompt: 'reverse cowgirl sex position, facing completely away, ass and lower back fully in view, controlled bouncing, looking back over shoulder seductively',                 note: '反骑乘·完全背对·臀部全视·回头媚视' },
    { prompt: 'cowgirl sex position, full depth squat, completely impaled all the way down, hands on thighs for balance, completely overwhelmed gasping expression',                 note: '深蹲完全插入底部·手撑大腿平衡·被充满的窒息感' },
    { prompt: 'cowgirl sex position orgasm, body convulsing uncontrollably, eyes fully rolled back white, mouth agape, fingers clawing at his chest, thighs trembling',              note: '骑乘高潮·身体不受控颤抖·眼球全翻·嘴大张·抓胸' },
  ],
  penetration_spooning: [
    { prompt: 'spooning sex position, both lying on side, gentle slow entry from behind, her back curved perfectly into him, soft breathy moaning, intimate',                        note: '勺式侧躺·缓慢轻柔后入·背靠贴他·轻声喘息' },
    { prompt: 'spooning sex position, her top leg raised and held up by his hand, deeper penetration angle, sudden gasp, toes pointing straight',                                    note: '上腿被他托起·更深角度插入·突然倒吸气·脚尖绷' },
    { prompt: 'spooning sex position, he kisses and gently bites her neck and shoulder while thrusting, she tilts head to give full access, eyes closed in bliss',                   note: '抽插时吻咬颈肩·她仰头让步·闭眼陶醉' },
    { prompt: 'spooning sex position, she reaches back grabbing his hip urging him deeper, turns head to bite his arm softly, needy desperate expression',                           note: '她回手抓其臀催促更深·转头轻咬手臂·渴求' },
    { prompt: 'spooning sex position full side view, both complete bodies visible, slow sensual rhythm, their joined area clearly shown, warm intimate lighting',                     note: '侧面全身视角·双身完整可见·缓慢感性·连接清晰' },
  ],
  penetration_generic: [
    { prompt: 'explicit vaginal penetration close-up, slightly elevated angle, cock deeply buried in wet pussy, love juice coating shaft heavily, labia stretched',                  note: '插入特写·略高视角·深埋其中·爱液裹茎·阴唇撑开' },
    { prompt: 'vaginal penetration, standing position, one leg lifted and held against wall, deep hard entry, her foot pointed, moaning and gripping wall',                          note: '站立·单腿托起靠墙·深力插入·脚尖绷·抓墙呻吟' },
    { prompt: 'vaginal penetration, sitting on table edge, legs dangling and spread open, him standing between thighs, deep thrusting, table surface visible',                       note: '坐桌边·双腿悬垂张开·站立插入·深力抽插' },
    { prompt: 'vaginal penetration, pinned against wall, one leg hooked up around him, deep and urgent, both sweating heavily, her scratching his back',                             note: '靠墙被压制·一腿勾住·深而急迫·双方出汗·抓背' },
    { prompt: 'explicit vaginal penetration close-up at angle, cock pulling halfway out showing glistening wet shaft, then fully buried again, love juice connecting both bodies',   note: '斜角抽出一半显湿润茎·再次全力插入·爱液连接' },
  ],
  standing_sex: [
    { prompt: 'standing sex from behind, bent forward against wall, penetration from behind while standing, hands flat on wall, moaning',                                            note: '站立后入·靠墙前弯·手撑墙·呻吟' },
  ],
  ahegao: [
    { prompt: 'close-up face, ahegao expression just beginning, eyes starting to roll back, mouth falling open, just losing control, light flush, drool starting',                   note: '眼球刚开始上翻·嘴刚张·初失控·浅潮红·口水将至' },
    { prompt: 'close-up face, full ahegao, both eyes completely rolled back showing whites only, tongue extended all the way out, heavy drool, tears, deep crimson flush',           note: '双眼全翻白·舌头全伸·浓重口水·泪痕·深红潮红' },
    { prompt: 'close-up face, tears streaming freely down cheeks, mouth wide agape, eyes rolled, trembling visibly from overwhelming pleasure',                                      note: '泪水双颊自由流淌·嘴大张·眼翻·极乐颤抖' },
    { prompt: 'close-up face, ahegao but looking directly into camera, one eye slightly more focused through the madness, surreal half-aware gaze',                                  note: '透过失神凝视镜头·一只眼略有焦点·超现实意识' },
    { prompt: 'close-up face, thick drool strand hanging from chin, post-orgasm daze, body exhausted but another wave building, eyes completely glazed',                             note: '浓厚口水从下颌垂落·高潮后呆滞·疲软又一波来' },
    { prompt: 'close-up face, multiple orgasm expression, barely able to hold head up, completely overwhelmed and destroyed, full body trembling, eyes totally gone',                note: '多重高潮·头几乎抬不起来·完全溃败·全身颤·眼全无' },
    { prompt: 'close-up face ahegao with white cum streaks, cum ropes crossing her ahegao expression, tongue catching some drops, tears and cum mixing on cheeks',                   note: '失神脸上有精液条纹·舌接住几滴·泪水精液混合' },
  ],
  creampie: [
    { prompt: 'creampie close-up, immediately after ejaculation, fresh white cum dripping from pink stretched labia, legs still spread, inner walls still visibly pulsing',          note: '射后即刻·新鲜白色精液滴落·腿仍张·内壁仍收缩' },
    { prompt: 'creampie close-up, cum seeping out slowly, swollen satisfied labia, legs beginning to close, thoroughly satisfied afterglow expression on her face',                  note: '精液缓慢渗出·满足肿胀阴唇·双腿开始合·余晖满足' },
    { prompt: 'creampie close-up, legs pressing together squeezing more cum out, milky overflow running down inner thighs, white stains on inner thighs',                            note: '双腿合拢挤出更多·乳白溢流·大腿内侧白迹斑斑' },
    { prompt: 'creampie, lying on back front view, cum running downward toward ass crack, exhausted body, sweat glistening, thoroughly used and satisfied expression',               note: '仰卧正面·精液向下流向臀沟·疲惫·汗水·被用尽' },
    { prompt: 'creampie, sitting upright, movement causing more cum to pour out, thick white overflow, looking down at it with dazed satisfied expression',                          note: '坐起身·动作带出更多精液·浓白涌出·低头呆滞惊叹' },
    { prompt: 'creampie extreme close-up aftermath, swollen stretched labia slowly closing back, overflowing white cum pooling outside entrance, thoroughly creamed',                note: '事后极近·被撑开阴唇缓慢闭合·精液积聚满溢外部' },
  ],
  cum_face: [
    { prompt: 'facial cumshot, single thick rope of white cum diagonally crossing cheek and forehead, surprised yet pleased expression, one eye glistening',                        note: '单条浓白精液斜划脸颊额头·惊喜愉悦·眼睛晶莹' },
    { prompt: 'facial cumshot, heavy multi-rope facial, face thoroughly covered with cum, cum in hair, on nose, chin dripping, messy and overwhelmed',                               note: '浓密多条颜射·脸被彻底覆盖·精液在发·下颌滴' },
    { prompt: 'facial cumshot mid-action, tongue extended catching ropes of cum mid-air, eyes half open watching each rope land on outstretched tongue',                             note: '颜射进行中·伸舌接住空中精液·眼半开看落点' },
    { prompt: 'facial cumshot aftermath, deliberately licking cum off lips and fingers one by one, satisfied direct gaze at camera, cum still decorating cheek',                     note: '颜射后刻意舔唇舔指·满足直视镜头·脸颊仍有精液' },
    { prompt: 'facial cumshot, eyes half-glazed under cum coating, not quite ahegao but utterly spent, cum dripping slowly off chin, numb blissful satisfied expression',            note: '精液下眼神呆滞半开·未完全失神·下颌缓慢滴落·麻木极乐' },
  ],
  bondage: [
    { prompt: 'bondage restraint, wrists tied behind back with soft rope, kneeling on floor, head bowed submissively, rope texture visible against skin, trembling slightly',        note: '手腕背绑跪地·头低顺从·绳纹贴肤·微微颤抖' },
    { prompt: 'bondage restraint, wrists bound in front with rope, sitting on bed, arms stretched upward tied to headboard, chest exposed, vulnerable display',                     note: '双手前绑拴床头·坐姿·胸部暴露·脆弱展示' },
    { prompt: 'bondage restraint, blindfolded with dark cloth, hands behind back, kneeling, head slightly tilted listening, heightened senses, shivers running through body',        note: '蒙眼黑布·背绑跪姿·头微倾聆听·感官放大·全身颤' },
    { prompt: 'bondage restraint, spread eagle position, both wrists and ankles restrained by rope at bedposts, fully exposed and helpless, eyes wide with anticipation',            note: '大字捆绑·四肢拴床柱·完全暴露无力·眼神期待' },
    { prompt: 'bondage restraint close-up, rope around wrists, red rope marks on pale skin, pulling gently against restraints testing limits, flushed cheeks',                       note: '绳索手腕特写·绳痕印皮肤·轻拉测试·脸颊绯红' },
  ],
  toy_use: [
    { prompt: 'sex toy use, vibrator held against clitoris from outside, legs trembling, toes curling, eyes rolling, biting lower lip hard to suppress loud moaning',               note: '振动棒抵阴蒂·腿颤·脚趾蜷·眼翻·咬唇压呻吟' },
    { prompt: 'sex toy use, dildo toy partially inserted in vagina, hand holding it, other hand gripping thigh, looking down with overwhelmed flushed expression',                   note: '假阳具半插入·手持·另手抓大腿·低头潮红失控' },
    { prompt: 'sex toy use, vibrating egg inside with remote control visible, trying to act normal but clearly losing composure, inner thighs wet, mouth barely open',              note: '跳蛋在内·遥控器可见·试图正常但显然失控·内腿湿' },
    { prompt: 'sex toy use, wand massager against outside of pussy through thin fabric, fabric soaked through, convulsing gasps, one hand gripping toy one hand clutching sheets',   note: '按摩棒隔薄布·布料湿透·抽搐倒吸气·一手握具一手抓床' },
    { prompt: 'sex toy use, multiple toys stimulating simultaneously, dildo inserted and vibrator on clit, completely overwhelmed, eyes crossed, screaming orgasm',                  note: '多道具同时·假阳具插入振动棒阴蒂·完全崩溃·高潮嚎叫' },
  ],
  petplay: [
    { prompt: 'pet play, cat ear headband on, collar with small bell around neck, kneeling on all fours, looking up with large innocent eyes, playful and obedient',               note: '猫耳发箍·铃铛项圈·四肢跪地·仰望大眼·娇憨顺从' },
    { prompt: 'pet play, cat ears and collar, sitting in lap, nuzzling face against chest, arms wrapped around, making soft contented sounds, tail accessory visible',              note: '猫耳项圈·坐膝上·蹭脸·轻声满足哼鸣·尾巴道具' },
    { prompt: 'pet play, collar being fastened around neck from behind, eyes wide looking up at it, blush spreading across cheeks, hands touching collar in wonder',                 note: '从后方系上项圈·仰视眼睁大·脸颊晕红·手触摸项圈' },
    { prompt: 'pet play, cat ears tilting sideways curiously, head tilting to match, one finger at lips in shy thinking pose, playful half-smile half-pout expression',              note: '猫耳随头歪·单指嘴边思考·娇羞半笑半噘嘴' },
  ],
  spanking: [
    { prompt: 'spanking, bent over displaying raised bottom, male hand mid-swing about to make contact, anticipatory expression, braced holding onto bedpost',                       note: '弯腰翘臀·男手摆动将至·期待表情·抓床柱支撑' },
    { prompt: 'spanking, after impact, faint red handprint visible on pale buttock, sharp intake of breath, tears welling in eyes, other cheek untouched',                          note: '打击后·浅红手印·倒吸气·眼眶泛泪·另一侧未打' },
    { prompt: 'spanking, bottom reddened from multiple strikes, looking back over shoulder with teary embarrassed expression, trying to count under breath',                         note: '臀部多处泛红·越肩回望·泪眼羞红·试图小声数数' },
    { prompt: 'spanking close-up, glowing red handprint on bare bottom, skin flushed and warm looking, slight trembling, love juice dripping despite punishment',                    note: '手印红痕特写·皮肤绯红发热·微颤·爱液在惩罚中流淌' },
  ],
  undressing: [
    { prompt: 'undressing process, shirt slowly sliding off one shoulder, bare skin revealed, slightly flushed cheeks, eyes meeting camera with shy anticipation, hands pausing mid-motion', note: '单肩衬衫缓缓滑落·裸肤初现·害羞期待·手停在动作中' },
    { prompt: 'undressing process, bra straps slipping down both shoulders, bra barely staying up, hands reaching behind about to unhook, biting lower lip, shy smile',              note: '文胸带双肩滑落·将解未解·咬唇·羞涩微笑' },
    { prompt: 'undressing process, skirt or pants pushed down to mid-thigh, standing and stepping out of them, one leg raised, slender thigh revealed, candid natural moment',       note: '裙/裤推到大腿中·单腿抬起步出·纤腿初现·自然瞬间' },
    { prompt: 'undressing process, completely removing final garment, last piece of clothing dropping to floor, standing naked just revealed, hands instinctively covering chest, flushed expression', note: '最后一件落地·裸体刚刚呈现·手本能遮胸·潮红表情' },
  ],
  squirt: [
    { prompt: 'squirting close-up, clear liquid gushing forcefully from pussy, legs spread wide and trembling, toes curling tightly, eyes completely rolled back, mouth wide open screaming', note: '潮喷近景·透明液体强力喷出·双腿张开颤抖·眼全翻·嘴大张叫' },
    { prompt: 'squirting, liquid spraying in an arc, inner thighs and surface completely soaked, body convulsing with wave after wave, unable to stop, full loss of control',        note: '液体弧形喷出·大腿内侧全湿·身体一波波痉挛·完全失控' },
    { prompt: 'squirting aftermath close-up, pussy still dripping with clear fluid, swollen labia, pool of liquid visible, body collapsed and exhausted, glassy glazed eyes',        note: '潮喷后特写·仍在滴落·肿胀阴唇·液体积聚·身体瘫软·眼神涣散' },
    { prompt: 'squirting mid-orgasm, fingers just withdrawn and liquid releasing, simultaneous orgasm convulsions visible, thighs drenched, screaming ahegao expression',             note: '手指刚抽出触发潮喷·同时高潮痉挛·大腿湿透·失神嚎叫' },
  ],
};

// ── metadata ──────────────────────────────────────────────────────
interface ShotMeta { category: string; description: string; tags: string[]; bodyFocus: string; viewAngle: string; }
const SHOT_META: Partial<Record<ShotKey, ShotMeta>> = {
  portrait:               { category: '调情', description: '面部特写，眼神撩人，轻启朱唇，若有所思',           tags: ['正脸','眼神挑逗','轻启朱唇','媚眼','近景','唯美','撩人','无裸露'],                       bodyFocus: '脸部',      viewAngle: '近景正面'  },
  medium:                 { category: '调情', description: '半身展示，身材曲线若隐若现，撩拨心弦',             tags: ['半身','身材','撩人','性感','衣着','胸线','腰线','中景','诱惑'],                          bodyFocus: '上半身',    viewAngle: '中景正面'  },
  kiss:                   { category: '前戏', description: '嘴唇相贴，舌尖缠绕，唾液交换，沉醉其中',           tags: ['接吻','舌吻','嘴唇','唾液','脸红','眼睛半闭','男性出现','亲密','缠绵'],                  bodyFocus: '嘴唇',      viewAngle: '近景'      },
  breast:                 { category: '前戏', description: '男手揉捏双乳，粉嫩乳头坚挺，娇喘连连',             tags: ['裸胸','乳头','揉捏','爱抚','男手','坚挺乳头','娇喘','上身裸露','胸部特写'],              bodyFocus: '胸部',      viewAngle: '近景俯视'  },
  pussy:                  { category: '前戏', description: '双腿张开，下体粉嫩湿润，完全暴露于视线',           tags: ['下体','阴部','张腿','湿润','粉嫩','完全裸露','展示','近距离','阴唇','爱液'],              bodyFocus: '阴部',      viewAngle: '近景'      },
  handjob:                { category: '前戏', description: '纤手握住阳具轻柔抚弄，眼神撩人挑逗',               tags: ['手交','阳具','握住','抚弄','挑逗','POV','手部特写','撸动','勃起','眼神交流'],              bodyFocus: '手部·阳具', viewAngle: 'POV俯视'   },
  fingering:              { category: '前戏', description: '手指探入湿润内壁，爱液淋漓，娇吟失控',             tags: ['手指插入','阴部','爱液','仰躺','张腿','两根手指','湿润内壁','抽插','颤抖','呻吟'],        bodyFocus: '阴部·手指', viewAngle: '中景俯视'  },
  blowjob:                { category: '前戏', description: '含入阳具，仰望镜头，口水欲滴，顺从媚眼',           tags: ['口交','阳具','含住','口腔','唾液','仰望','顺从','POV','舌尖','吮吸','深喉'],              bodyFocus: '嘴部·阳具', viewAngle: '近景仰视'  },
  cunnilingus:            { category: '前戏', description: '舌尖爱抚阴蒂，双腿夹紧，失神呻吟不止',             tags: ['舔阴','阴蒂','舌头','男性舔舐','夹腿','腰部上挺','呻吟','白眼','湿润','爱液'],            bodyFocus: '阴部',      viewAngle: '中景'      },
  penetration_missionary: { category: '插入', description: '仰躺张腿，正面插入，眼神交汇，喘息缠绵',           tags: ['插入','传教士体位','正面','仰躺','张腿','眼神交汇','呻吟','抽插','爱液','高潮临近'],        bodyFocus: '阴部·插入', viewAngle: '中景正面'  },
  penetration_doggy:      { category: '插入', description: '四肢跪趴，从后方猛力插入，腰臀律动顿挫',           tags: ['插入','后入','趴式','臀部','抓腰','从后方','深入','臀部晃动','呻吟','后视角'],              bodyFocus: '臀部·阴部', viewAngle: '后方视角'  },
  penetration_cowgirl:    { category: '插入', description: '主动骑上男性，腰臀律动，乳房随波颠簸',             tags: ['插入','骑乘体位','主动进攻','乳房晃动','腰臀律动','高潮','仰头','呻吟','俯视','掌控'],    bodyFocus: '全身·插入', viewAngle: '正面中景'  },
  penetration_spooning:   { category: '插入', description: '侧躺紧贴，从身后轻柔插入，耳语呢喃',               tags: ['插入','侧入','勺式体位','侧躺','亲密','温柔','从后','贴合','耳语','缠绵'],                  bodyFocus: '侧身·插入', viewAngle: '侧面视角'  },
  penetration_generic:    { category: '插入', description: '下体结合处特写，爱液交融，充盈饱满',               tags: ['插入特写','下体','阴部','爱液','充盈','连接处','张腿','湿润','近距离','露骨'],              bodyFocus: '阴部·插入', viewAngle: '特写'      },
  standing_sex:           { category: '插入', description: '站立后入，身体前倾压墙，力道十足',                 tags: ['插入','站立体位','后入','贴墙','前倾','力道','臀部','粗暴','呻吟'],                        bodyFocus: '全身·插入', viewAngle: '侧面中景'  },
  ahegao:                 { category: '高潮', description: '白眼上翻，嘴巴大张流涎，极乐之脸失控',             tags: ['高潮表情','白眼上翻','口水','流涎','潮红','失神','颤抖','泪水','娇喘','完全失控'],          bodyFocus: '脸部',      viewAngle: '近景正面'  },
  creampie:               { category: '高潮', description: '白色精液从阴部溢出，满溢余韵，疲软倒地',           tags: ['内射','精液','阴部','溢出','白浊','事后','余韵','疲软','满足','阴部特写'],                  bodyFocus: '阴部',      viewAngle: '近景'      },
  cum_face:               { category: '高潮', description: '精液喷射脸庞，呆滞媚眼，舌尖舔舐品尝',             tags: ['颜射','精液','脸部','白浊','白眼','舌头舔舐','口水混精','娇喘','满足','近景'],              bodyFocus: '脸部',      viewAngle: '近景正面'  },
  bondage:                { category: '调教', description: '绳索束缚双手，跪地顺从，绳纹印皮，羞耻颤抖',       tags: ['捆绑','束缚','跪地','绳索','背绑','蒙眼','顺从','调教','羞耻','失控'],                    bodyFocus: '手腕·全身', viewAngle: '中景'      },
  toy_use:                { category: '调教', description: '情趣玩具刺激阴蒂或插入，失控颤抖，眼神涣散',       tags: ['玩具','振动棒','跳蛋','假阳具','阴蒂刺激','插入','颤抖','湿透','失控','潮红'],            bodyFocus: '阴部·道具', viewAngle: '中景俯视'  },
  petplay:                { category: '调教', description: '猫耳项圈宠物扮演，乖顺仰望，娇憨服从',             tags: ['猫娘','宠物扮演','猫耳','项圈','铃铛','跪地','乖顺','仰望','娇憨','顺从'],                bodyFocus: '全身·脸部', viewAngle: '中景正面'  },
  spanking:               { category: '调教', description: '翘臀受罚，手印红痕，羞耻泪眼，爱液淋漓',           tags: ['打屁股','惩罚','红痕','手印','翘臀','泪眼','羞耻','颤抖','爱液','调教'],                  bodyFocus: '臀部',      viewAngle: '中景侧视'  },
  undressing:             { category: '前戏', description: '脱衣中间态，衣物半脱，裸肤初现，害羞期待',           tags: ['脱衣','半脱','裸肤','文胸','内衣','衬衫','害羞','期待','张力','撩拨'],                    bodyFocus: '上身·全身', viewAngle: '中景正面'  },
  squirt:                 { category: '高潮', description: '潮喷液体喷涌而出，双腿战栗，身体完全失控崩溃',     tags: ['潮喷','潮吹','喷水','液体','张腿','颤抖','高潮','失控','近景','阴部特写'],                  bodyFocus: '阴部',      viewAngle: '近景正面'  },
};

// ── ComfyUI Flux Workflow（LoraLoaderModelOnly 链式叠加）──────────
function buildWorkflow(prompt: string, seed: number, w: number, h: number): object {
  const full  = prompt; // QUALITY 已在 prompt 末尾拼入
  const nodes: Record<string, object> = {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: FLUX_MODEL } },
    "2": { class_type: "DualCLIPLoader",         inputs: { clip_name1: FLUX_CLIP1, clip_name2: FLUX_CLIP2, type: "flux" } },
    "3": { class_type: "VAELoader",              inputs: { vae_name: FLUX_VAE } },
  };

  // LoRA 链：每个 LoRA 只修改 model，不修改 CLIP
  let modelRef: [string, number] = ["1", 0];
  FLUX_LORAS.forEach(([name, weight], i) => {
    const id = `lora_${i}`;
    nodes[id] = { class_type: "LoraLoaderModelOnly", inputs: { model: modelRef, lora_name: name, strength_model: weight } };
    modelRef   = [id, 0];
  });

  const lastModel = modelRef;
  nodes["enc"] = { class_type: "CLIPTextEncodeFlux", inputs: { clip: ["2", 0], clip_l: full, t5xxl: full, guidance: 3.5 } };
  nodes["neg"] = { class_type: "CLIPTextEncode",     inputs: { clip: ["2", 0], text: NEGATIVE } };
  nodes["lat"] = { class_type: "EmptyLatentImage",   inputs: { width: w, height: h, batch_size: 1 } };
  nodes["ks"]  = { class_type: "KSampler",           inputs: { model: lastModel, positive: ["enc", 0], negative: ["neg", 0], latent_image: ["lat", 0], seed, steps: 20, cfg: 1.0, sampler_name: "euler", scheduler: "beta", denoise: 1.0 } };
  nodes["dec"] = { class_type: "VAEDecode",          inputs: { samples: ["ks", 0], vae: ["3", 0] } };

  // FaceDetailer — 自动检测脸部并局部重绘修复
  nodes["det"] = { class_type: "UltralyticsDetectorProvider", inputs: { model_name: "bbox/face_yolov8m.pt" } };
  nodes["fd"]  = { class_type: "FaceDetailer", inputs: {
    image:                    ["dec", 0],
    model:                    lastModel,
    clip:                     ["2", 0],
    vae:                      ["3", 0],
    positive:                 ["enc", 0],
    negative:                 ["neg", 0],
    bbox_detector:            ["det", 0],
    guide_size:               512,
    guide_size_for:           true,
    max_size:                 1024,
    seed:                     seed + 1,
    steps:                    12,
    cfg:                      1.0,
    sampler_name:             "euler",
    scheduler:                "beta",
    denoise:                  0.35,
    feather:                  20,
    noise_mask:               true,
    force_inpaint:            true,
    bbox_threshold:           0.5,
    bbox_dilation:            10,
    bbox_crop_factor:         3.0,
    sam_detection_hint:       "center-1",
    sam_dilation:             0,
    sam_cosine_threshold:     0.3,
    sam_bbox_expansion:       0,
    sam_mask_hint_threshold:  0.3,
    sam_mask_hint_use_negative: "False",
    sam_threshold:              0.93,
    drop_size:                10,
    wildcard:                 "",
    cycle:                    1,
    inpaint_model:            false,
    noise_mask_feather:       20,
  }};

  nodes["sav"] = { class_type: "SaveImage", inputs: { images: ["fd", 0], filename_prefix: "flux_real" } };
  return nodes;
}

async function queuePrompt(workflow: object): Promise<string> {
  const res = await fetch(`${COMFYUI_URL}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: workflow }) });
  if (!res.ok) throw new Error(`Queue failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { prompt_id: string }).prompt_id;
}

async function waitForImage(promptId: string): Promise<string> {
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000));
    const res = await fetch(`${COMFYUI_URL}/history/${promptId}`);
    if (!res.ok) continue;
    const data = await res.json() as Record<string, any>;
    if (!data[promptId]?.outputs) continue;
    for (const out of Object.values(data[promptId].outputs) as any[]) {
      if (out?.images?.length) return out.images[0].filename;
    }
  }
  throw new Error('Timeout');
}

async function downloadImage(filename: string, savePath: string) {
  const params = new URLSearchParams({ filename, subfolder: '', type: 'output' });
  const res = await fetch(`${COMFYUI_URL}/view?${params}`);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  fs.writeFileSync(savePath, Buffer.from(await res.arrayBuffer()));
}


const REALISTIC_CHARS = Object.keys(CHARACTER_BASE);

async function generateForCharacter(characterName: string, fromArg: string | undefined, forceRegen: boolean, maxTotal: number) {
  const configPath = path.join(__dirname, '..', 'scene_configs', `${characterName}.json`);
  if (!fs.existsSync(configPath)) { console.error(`❌ 无场景配置: ${characterName}，跳过（先运行: tsx src/generateSceneConfig.ts ${characterName}）`); return; }
  const sceneConfig: SceneConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  const faceAnchor = FACE_ANCHOR[characterName] ?? '';
  const charBase   = CHARACTER_BASE[characterName] ?? characterName;

  console.log(`\n🎨 【${characterName}】`);

  const shotKeys = SHOT_TYPES.map(t => t.key);
  const startIdx = fromArg ? shotKeys.indexOf(fromArg as ShotKey) : 0;
  if (fromArg && startIdx === -1) { console.error(`❌ 未知 shotKey: ${fromArg}`); return; }

  let generated = 0, skipped = 0, totalGenerated = 0;

  for (let si = startIdx; si < SHOT_TYPES.length; si++) {
    const { key: shotKey, label } = SHOT_TYPES[si];
    if (SKIP_SHOTS.includes(shotKey)) continue;

    const count     = SHOT_COUNT[shotKey] ?? 5;
    const shotDir   = path.join(LIBRARY_DIR, characterName, shotKey);
    fs.mkdirSync(shotDir, { recursive: true });

    const shotConfig = sceneConfig.shotConfigs[shotKey];
    if (!shotConfig?.scene) { console.log(`  ⏭️  ${shotKey} 无配置，跳过`); continue; }

    console.log(`  ── ${shotKey} (${label}) ×${count}`);

    const isPortrait = ['portrait','medium','blowjob','cum_face','ahegao','kiss','breast','pussy','fingering','cunnilingus','bondage','toy_use','petplay','undressing','squirt'].includes(shotKey);
    const [w, h]     = isPortrait ? [768, 1024] : [1024, 768];
    const variants   = SHOT_VARIANTS[shotKey] ?? [];
    const phase      = PHASE_MAP[shotKey] ?? 0;

    for (let i = 1; i <= count; i++) {
      const imgPath  = path.join(shotDir, `${String(i).padStart(3,'0')}.png`);
      const jsonPath = path.join(shotDir, `${String(i).padStart(3,'0')}.json`);

      if (fs.existsSync(imgPath) && !forceRegen) { process.stdout.write('.'); skipped++; continue; }

      const variant = variants[(i - 1) % variants.length];

      // 情趣内衣逻辑：奇数张穿内衣，偶数张用场景配置的 outfit（通常全裸）
      const useLingerie = LINGERIE_SHOTS.has(shotKey) && (i % 2 === 1);
      const lingeriePrompt = CHARACTER_LINGERIE[characterName] ?? '';
      const outfitFinal = useLingerie && lingeriePrompt
        ? lingeriePrompt                // 情趣内衣版
        : shotConfig.outfit;            // 原始 outfit（全裸/半裸）

      // Flux 是语言模型，越前面权重越高 → 脸锚点必须放最前
      const prompt  = [
        faceAnchor,           // ① 脸部绝对标志（最高优先级）
        charBase,             // ② 体型+职业+身材
        variant.prompt,       // ③ 场景动作构图
        MALE_PRESENCE[shotKey] ?? '', // ④ 男性存在感
        outfitFinal,          // ⑤ 服装（情趣内衣 or 全裸）
        shotConfig.scene, shotConfig.mood,
        ...(shotConfig.extra ? [shotConfig.extra] : []),
        QUALITY,              // ⑥ 质量词放最后
      ].filter(Boolean).join(', ');

      try {
        const seed     = Math.floor(Math.random() * 2 ** 32);
        const workflow = buildWorkflow(prompt, seed, w, h);
        const promptId = await queuePrompt(workflow);
        const filename = await waitForImage(promptId);
        await downloadImage(filename, imgPath);

        const meta = SHOT_META[shotKey] ?? { category: '', description: '', tags: [], bodyFocus: '', viewAngle: '' };
        fs.writeFileSync(jsonPath, JSON.stringify({
          character:     characterName,
          shotKey,
          category:      meta.category,
          label,
          description:   meta.description,
          variantNote:   variant.note,
          tags:          meta.tags,
          bodyFocus:     meta.bodyFocus,
          viewAngle:     meta.viewAngle,
          index:         i,
          intimacyPhase: phase,
          hasLingerie:   useLingerie,
          model:         FLUX_MODEL,
          width:         w,
          height:        h,
        }, null, 2));

        process.stdout.write('✅');
        generated++;
        totalGenerated++;
        if (totalGenerated >= maxTotal) { console.log(`\n[--max=${maxTotal} 已达上限，停止]`); break; }
      } catch (err: any) {
        process.stdout.write('❌');
        console.error(` ${err.message}`);
      }
    }
    console.log();
    if (totalGenerated >= maxTotal) break;
  }

  console.log(`  完成：生成 ${generated}，跳过 ${skipped}`);
}

async function main() {
  const args   = process.argv.slice(2);
  const target = args.find(a => !a.startsWith('--'));
  if (!target) {
    console.error('用法: node_modules\\.bin\\tsx src\\generateLibraryFluxOne.ts <角色名|all> [--from=<shotKey>] [--force] [--max=N]');
    console.error(`可用角色: ${REALISTIC_CHARS.join(', ')}`);
    process.exit(1);
  }
  const fromArg    = args.find(a => a.startsWith('--from='))?.replace('--from=', '');
  const forceRegen = args.includes('--force');
  const maxTotal   = parseInt(args.find(a => a.startsWith('--max='))?.replace('--max=', '') ?? '99999');

  const chars = target === 'all' ? REALISTIC_CHARS : [target];
  console.log(`\n🚀 Flux 写实图库生成 — 模型: ${FLUX_MODEL}`);
  FLUX_LORAS.forEach(([n, w]) => console.log(`   LoRA: ${n}  weight=${w}`));
  console.log(`   角色: ${chars.join(', ')}\n`);

  for (const char of chars) {
    await generateForCharacter(char, fromArg, forceRegen, maxTotal);
  }

  console.log(`\n🎉 全部完成！`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
