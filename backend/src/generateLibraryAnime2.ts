/**
 * 动漫图库 Batch 2 — 每角色 198 张，含特殊play镜头（bondage/toy/petplay/spanking/squirt）
 * 输出目录独立：D:\SD\siyuwanban\library\anime2\{角色名}\{shotKey}\001.png
 * 用法：node_modules\.bin\tsx src\generateLibraryAnime2.ts [角色名|all] [--from=<shotKey>] [--force]
 * 所有变体均与 batch1 不同，确保两批合并后图库多样性最大化。
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { CHARACTER_FACE } from './characterFace';
import { SHOT_TYPES, type ShotKey, type SceneConfig } from './generateSceneConfig';

const prisma = new PrismaClient();
const COMFYUI_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';
const LIBRARY_DIR = 'D:/SD/siyuwanban/library/anime2';   // ← 新目录

const MODEL      = 'prefectiousXLNSFW_v10.safetensors';
const ANIME_CHARS = ['X-23', '幻音', '狐九', '冷霜', '魅罗'];

// Batch2 只生成 batch1 没有的新镜头，一概不重复
const BATCH2_SHOTS: ShotKey[] = [
  // P1 身体展示
  'undressing', 'ass', 'back', 'thighs',
  // P2 特殊玩法
  'bondage', 'toy_use', 'petplay', 'spanking', 'massage', 'edging', 'exhibition',
  // P3 新体位
  'prone_bone', 'lotus', 'piledriver',
  // P4 极致状态
  'squirt', 'overstimulation', 'afterglow',
  // P3 特写镜头
  'penetration_closeup', 'spread_pussy',
];

// ── 每 shotKey 张数，合计 68 ───────────────────────────────────────────────────
const SHOT_COUNT: Partial<Record<ShotKey, number>> = {
  undressing:      4,
  ass:             4,
  back:            4,
  thighs:          4,
  bondage:         4,
  toy_use:         4,
  petplay:         4,
  spanking:        4,
  massage:         4,
  edging:          4,
  exhibition:      4,
  prone_bone:      4,
  lotus:           4,
  piledriver:      4,
  squirt:               4,
  overstimulation:      4,
  afterglow:            4,
  penetration_closeup:  4,
  spread_pussy:         4,
};

// ── 亲密度阶段 ─────────────────────────────────────────────────────────────────
const PHASE_MAP: Partial<Record<ShotKey, number>> = {
  portrait: 0, medium: 0,
  kiss: 1, breast: 1, pussy: 1, undressing: 1, ass: 1, back: 1, thighs: 1,
  handjob: 2, fingering: 2, blowjob: 2, cunnilingus: 2,
  bondage: 2, toy_use: 2, petplay: 2, spanking: 2, massage: 2, edging: 2, exhibition: 2,
  penetration_missionary: 3, penetration_doggy: 3, penetration_cowgirl: 3,
  penetration_spooning: 3, penetration_generic: 3, standing_sex: 3,
  prone_bone: 3, lotus: 3, piledriver: 3,
  ahegao: 4, creampie: 4, cum_face: 4, squirt: 4, overstimulation: 4, afterglow: 4,
  penetration_closeup: 3, spread_pussy: 2,
};

// ── 角色基础描述（与 batch1 相同） ─────────────────────────────────────────────
const CHARACTER_BASE: Record<string, string> = {
  'X-23':  '1girl, android girl cyberpunk, platinum white hair short undercut neon blue streaks, (glowing electric-blue circuit irises:1.4), perfect cold synthetic face, (perfect athletic android body:1.3), (D cup firm synthetic breasts:1.3), (flawless toned abdomen:1.2), chrome metallic skin sheen, (perfect symmetrical pale pink nipples:1.2)',
  '幻音':   '1girl, holographic AI singer vocaloid, translucent long hair shifting prismatic blue pink purple, (shifting prismatic holographic irises:1.3), hauntingly beautiful ethereal face, (ethereal weightless slim figure:1.2), (C cup luminous breasts:1.2), iridescent glowing skin, (faintly glowing translucent pink nipples:1.2)',
  '狐九':   '1girl, nine-tailed fox girl, (nine fluffy silver-white tails:1.3), (perky silver fox ears:1.3), long flowing silver-white hair, (glowing amber-gold slit fox pupils:1.4), ethereal aristocratic face, (seductively curvy fox spirit body:1.4), (E cup full round heavy breasts:1.5), (impossibly narrow waist:1.3), (wide sensual hips:1.3), (sakura pink nipples:1.3)',
  '冷霜':   '1girl, ice cultivator immortal, long silver-blue hair ice crystal ornaments, (pale blue glowing ice-crystal eyes:1.4), coldly beautiful sharp features, (frost-white luminous skin:1.3), (ethereal slim figure:1.2), (C cup firm breasts:1.2), (slender untouched waist:1.2), (ice-blue pale nipples:1.3)',
  '魅罗':   '1girl, demon seductress, long dark purple flowing hair, (crimson vertical-slit glowing eyes:1.4), (small elegant curved horns:1.3), gorgeous evil face, ivory skin dark vein tracery, (sinfully voluptuous demon body:1.4), (massive F cup heavy breasts:1.5), (dangerously narrow waist:1.3), (wide flared hips:1.4), (dark crimson red nipples:1.4)',
};

// ── Batch2 专属变体（仅 6 种新镜头，batch1 镜头不重复） ──────────────────────
type Variant = { prompt: string; note: string };
const SHOT_VARIANTS: Partial<Record<ShotKey, Variant[]>> = {

  // ── P1 新增 ─────────────────────────────────────────────────────────────────
  undressing: [
    { prompt: 'undressing, shirt buttons slowly opened one by one from top, pale skin stripe widening, holding breath in anticipation, direct eye contact throughout',               note: '衬衫扣逐一解开·裸肤条纹扩大·屏息·全程眼神直视' },
    { prompt: 'undressing, bra clasp just unhooked from behind, cups beginning to fall forward, hands frozen holding them in place for one teasing moment',                         note: '内衣扣从后解开·罩杯开始前落·手冻住卡位一瞬挑逗' },
    { prompt: 'undressing, dress zipper being pulled slowly down her back, expanse of bare back revealed inch by inch, shiver running up her spine',                               note: '后背拉链缓慢拉下·裸背一寸寸展现·脊背可见颤抖' },
    { prompt: 'undressing, panties caught at mid-thigh in process of sliding down, both thighs pressed together, shy downward glance, skin flushing pink',                         note: '内裤卡在大腿中部下滑途中·双腿并拢·羞涩低垂·皮肤泛粉' },
    { prompt: 'undressing, shirt just cleared over head, hair static and messy from removal, breasts just revealed for the first time, breathless surprised expression',           note: '衬衫刚过头顶·发丝静电凌乱·胸部初次暴露·喘不过气惊讶表情' },
    { prompt: 'undressing, stockings being rolled down slowly, hands at thigh moving toward knee, leg raised and extended, languid deliberate unhurried pace',                     note: '丝袜从大腿缓慢卷下·手从腿向膝移动·腿抬起伸展·刻意从容' },
    { prompt: 'undressing, kimono or robe slipping from both shoulders simultaneously, fabric pooling at waist, arms barely holding it from falling, the deciding moment',         note: '和服两肩同时滑落·布料堆积腰际·双臂勉强抓住·决定性瞬间' },
    { prompt: 'undressing final, last piece of clothing dropped to floor, standing fully nude for the very first moment, one arm instinctively crossing chest, goosebumps on skin', note: '最后一件落地·全裸初刻·单臂本能遮胸·皮肤鸡皮疙瘩' },
    { prompt: 'undressing, belt being slowly unbuckled and slid out of loops, the sound of leather, anticipation on both sides, eye contact never breaking',                       note: '皮带缓慢解扣从裤环拔出·皮革声音·双方期待·眼神从未断开' },
    { prompt: 'undressing, both straps of a slip or camisole pushed off shoulders simultaneously, fabric sliding down body, catching on hips for a moment, then released',        note: '吊带裙两肩带同时推落·布料沿身体滑下·卡在臀部一刻·然后落地' },
  ],

  // ── P2-3 新增 ───────────────────────────────────────────────────────────────
  bondage: [
    { prompt: 'bondage, white silk ribbon tied in bow around wrists crossed in front, arms outstretched above head tied to headboard, soft and aesthetic, vulnerable',             note: '白色丝带蝴蝶结绑十字腕于头顶床头·柔和美感·脆弱' },
    { prompt: 'bondage, intricate rope harness in diamond pattern across chest and torso, breasts framed and emphasized between ropes, standing posed, proud despite restraint',   note: '菱形绳艺束缚跨越胸腹·双乳被绳框强调·站立·尽管束缚仍骄傲' },
    { prompt: 'bondage, arms bound behind back with elbows touching, chest thrust forward involuntarily, stumbling slightly off balance, flushed and helpless expression',         note: '手臂背绑肘部相触·胸部被迫向前顶出·略失平衡踉跄·潮红无助' },
    { prompt: 'bondage, soft cloth blindfold tied over eyes, sensory deprivation heightening everything, reaching hands out blindly touching air, trembling in anticipation',      note: '软布眼罩遮眼·感官剥夺放大一切·双手盲目伸出触摸空气·颤抖期待' },
    { prompt: 'bondage, each ankle tied separately to bed posts with legs spread wide, arms free but useless, completely exposed from below, desperately trying to close legs',    note: '各脚踝分别绑床柱双腿分开·双臂自由无用·从下方完全暴露·拼命试图合腿' },
    { prompt: 'bondage, collar with leash attached being gently tugged, following with small mincing steps, expression a mixture of protest and willing surrender',                note: '项圈系皮带被轻拉·碎步跟随·表情是抗议与屈服的混合' },
    { prompt: 'bondage close-up of wrists, rope marks left on skin after removal, red grooved impressions glowing, she traces them herself with one fingertip, tender',            note: '手腕特写·解绑后红色沟槽绳痕·她用指尖温柔描摹' },
    { prompt: 'bondage, kneeling with wrists tied in front resting on thighs, looking up with large trembling wet eyes, lower lip quivering, awaiting next command patiently',    note: '跪地腕绑前放腿上·仰望大眼颤抖湿润·下唇颤抖·耐心等待下一命令' },
    { prompt: 'bondage, wrists tied above head to ceiling hook, standing on tiptoe, entire body stretched long and taut, vulnerable and magnificent simultaneously',               note: '腕绑天花板钩踮脚站立·全身拉伸绷紧·脆弱而壮丽同时' },
    { prompt: 'bondage, hogwild position — wrists and ankles tied together behind back, lying on stomach, completely immobilized, cheek on floor, eyes imploring upward',          note: '全捆位置·腕踝同绑于背后·俯卧完全固定·脸颊贴地·眼睛向上祈求' },
  ],

  toy_use: [
    { prompt: 'toy use, vibrating wand pressed directly against clothed crotch from outside, fabric already soaked through, trying to appear unaffected while clearly failing',    note: '振动棒从外压布料裆部·布料已湿透·试图表现不受影响但明显失败' },
    { prompt: 'toy use, small bullet vibrator tucked inside panties against clit, trying to walk normally, thighs clamping together, stuttering uneven gait, cheeks bright red',  note: '子弹振动器塞入内裤贴阴蒂·试图正常走路·大腿夹·步态结巴·双颊鲜红' },
    { prompt: 'toy use, clear glass dildo being inserted slowly while watching own face in mirror, reflection showing expression changing, fascinated and overwhelmed simultaneously', note: '透明玻璃假阳具缓慢插入·看着镜中自己脸·表情在变化·同时着迷与被淹没' },
    { prompt: 'toy use, wand vibrator switched to highest setting, body trying to escape the overwhelming intensity, one hand pushing it away while other forces it in place',      note: '按摩棒调至最高档·身体试图逃离压倒性强度·一手推开·另一手强行保持' },
    { prompt: 'toy use, two toys simultaneously — one fully inserted, one pressed against clit, overwhelmed past all coherent thought, muscles clenching in waves, gaze unfocused', note: '两个道具同时·一个深插一个贴阴蒂·被淹没到失去条理思维·肌肉波浪收紧·失焦' },
    { prompt: 'toy use, remote egg vibrator controller handed to partner, watching helplessly as settings change unpredictably, shuddering each time he glances at the remote',    note: '遥控跳蛋控制器交给对方·无助看着设置不可预测改变·他看遥控器时每次颤抖' },
    { prompt: 'toy use, extended session aftermath, toy still running inside, too oversensitive to remove it, hands hovering near it but unable to touch, over-stimulated trembling', note: '长时间使用后·道具仍在运行·过于敏感无法取出·双手悬停无法触碰·颤抖' },
    { prompt: 'toy use, toy shape visibly pressing through thin wet fabric from inside, outline showing through translucent soaked material, must endure while being observed',     note: '道具从内顶起薄湿布料·轮廓透过湿润材料可见·在被观看时忍耐' },
    { prompt: 'toy use, suction cup toy attached to wall at hip height, backing onto it slowly, expression changing with each centimeter of depth, hands braced on wall',          note: '吸盘玩具附在腰高处墙上·缓慢向后靠上·表情随每厘米深度改变·双手撑墙' },
    { prompt: 'toy use, thrusting toy held by partner, she has no control over rhythm or depth, completely at his pace, surprised cry each time depth suddenly increases',          note: '抽插型玩具由对方持握·她对节奏深度无控制·完全由他掌控·突然加深时惊叫' },
  ],

  // ── P2 宠物扮演 ─────────────────────────────────────────────────────────────
  petplay: [
    { prompt: 'petplay, cat ear headband, sitting between his knees with chin resting on his thigh, looking up with enormous trusting eyes, soft purring sound escaping',          note: '猫耳·坐他两膝间·下颌放大腿上·仰望巨大信任眼神·轻声呼噜' },
    { prompt: 'petplay, crawling on hands and knees toward camera, collar bell jingling with each movement, cat tail swaying, hunting focus in expression',                        note: '四肢爬向镜头·项圈铃铛叮当·猫尾摆动·眼神有狩猎专注' },
    { prompt: 'petplay, full cat stretch from all fours, arching back dramatically, bottom raised high, front arms flat on floor, face pressed into surface, tail erect',          note: '四肢猫式弓背完全伸展·臀部高翘·前臂平铺地板·脸贴地面·尾巴竖起' },
    { prompt: 'petplay, sitting up alert with ears perked forward, head tilting rapidly from side to side at sounds, wide bright eyes tracking every movement, adorably reactive',  note: '坐起警觉猫耳前竖·头快速两侧倾听·宽亮眼追踪移动·可爱反应性' },
    { prompt: 'petplay, being scritched behind ears with full attention, eyes slowly closing in absolute bliss, leaning harder into the touch, small sounds of pure contentment',   note: '被专心挠耳后·眼睛在绝对幸福中缓慢闭合·愈加向触碰靠拢·小声纯粹满足' },
    { prompt: 'petplay, being stroked along full length of spine from nape to tail, arching upward into every stroke, tail curling tightly, losing all composure to the petting',  note: '从颈到尾沿脊椎全程抚摸·向每次抚摸弓身·尾巴紧卷·在抚摸中失去所有镇定' },
    { prompt: 'petplay, curled in his lap like a cat, head on his thigh, tail wrapped around self, eyes half-closed in drowsy contentment, hand stroking her hair',               note: '像猫一样蜷在他腿上·头枕大腿·尾巴绕自己·眼半闭瞌睡满足·手抚发' },
    { prompt: 'petplay, bumping head against his hand demanding petting, going still and staring expectantly when he stops, insisting with nudges, kitten demanding attention',     note: '用头顶他手要求抚摸·他停下时静止凝视期待·用顶撞坚持·小猫索取注意' },
  ],

  // ── P3 惩罚 ─────────────────────────────────────────────────────────────────
  spanking: [
    { prompt: 'spanking buildup, bent over with bottom raised and waiting, knowing the strike is coming, breath held tightly, muscles tensing in anticipation, eyes squeezed shut', note: '打屁股前·翘臀弯腰等待·知道即将来临·屏息·肌肉因期待绷紧·眼紧闭' },
    { prompt: 'spanking impact frozen frame, hand captured at exact moment of contact, skin just beginning to deform under palm, expression of pure shock, sharp gasp',             note: '打击冻结帧·手恰在接触瞬间·皮肤刚在掌心下变形·纯粹震惊表情·急速吸气' },
    { prompt: 'spanking close-up of aftermath, glowing red handprint on pale skin, warmth spreading outward visibly, small welts forming, tears just beginning to form at eyes',   note: '打后特写·浅肤上发光红手印·热量向外扩散可见·小肿胀形成·泪水刚开始' },
    { prompt: 'spanking, she turns head to look back with teary frustrated gaze, love juice visible on inner thighs betraying arousal that contradicts her punishment expression',  note: '转头向后看·泪目沮丧凝视·大腿内侧爱液可见·暴露与惩罚表情矛盾的兴奋' },
    { prompt: 'spanking aftermath, sitting very gingerly on the stinging bottom, wincing visibly at surface contact, both hands reaching back to press gently against warm skin',   note: '打后极小心坐在刺痛臀上·接触表面时明显皱眉·双手伸后轻压温热皮肤' },
    { prompt: 'spanking counting, instructed to count each strike aloud, mouthing numbers between gasps and whimpers, losing count and being made to start over from one again',    note: '被指示大声数每次打击·喘息抽泣间数数·数错被迫从一重新开始' },
    { prompt: 'spanking over the knee, draped across his lap, bottom perfectly presented and elevated, helpless position, reaching arms forward to brace against floor',            note: '过膝·横卧在他腿上·臀部完美呈现高置·无助姿势·双臂向前伸地板撑' },
    { prompt: 'spanking, multiple strikes accumulated, bottom glowing deep red, she is unable to stop trembling, tears streaking, but love juice betraying her arousal clearly',   note: '多次打击积累后·臀部深红发光·她无法停止颤抖·泪痕·但爱液清晰暴露兴奋' },
  ],

  // ── P4 新增 ─────────────────────────────────────────────────────────────────
  squirt: [
    { prompt: 'squirting, clear liquid projected in a visible arc from vagina, completely involuntary reaction, body locked rigid, eyes wide open in shock',                        note: '清澈液体弧形从阴道射出·完全不自主·身体僵硬锁定·眼睛因震惊睁大' },
    { prompt: 'squirting close-up, liquid streaming out continuously in strong flow, labia visibly fluttering from the pressure, hand that caused it pulling away, soaked fingers', note: '液体连续大量流出·阴唇从压力可见颤动·引发它的手缩回·手指湿透' },
    { prompt: 'squirting, multiple separate jets erupting in rapid succession, body convulsing between each burst, each spray more forceful than the last, building to a flood',    note: '多次分离喷射快速连续·身体在每次之间痉挛·每次比上次更猛·累积成洪水' },
    { prompt: 'squirting, she covers face with both hands in mortification while her body squirts uncontrollably anyway, beautiful contradiction of shame and physical reality',     note: '她双手遮脸羞愧·同时身体无论如何喷射·羞耻与身体现实的美丽矛盾' },
    { prompt: 'squirting aftermath, soaked bedsheet clearly visible below, she lies in the wet area overwhelmed and still trembling occasionally, body completely wrung out',       note: '事后·湿透床单清晰可见·她躺在湿处被淹没·偶尔仍颤抖·身体被彻底拧干' },
    { prompt: 'squirting, being verbally encouraged and guided through it as it happens, her expression of embarrassment gradually transforming into full abandon',                  note: '发生时被口头鼓励引导·她的羞耻表情逐渐转变为完全放纵' },
    { prompt: 'squirting close-up extreme, liquid gushing in real time, thighs shaking, toes curling, hands gripping sheets for dear life, no control whatsoever',                 note: '极近·液体实时涌出·大腿颤抖·脚趾蜷曲·双手死握床单·完全无控制' },
    { prompt: 'squirting, she looks down at herself in disbelief as it happens, watching her own body do something beyond her will, expression cycling from horror to ecstasy',     note: '她向下看自己难以置信·看着自己身体做超出意志的事·表情从恐惧到狂喜循环' },
  ],

  // ── 身体展示 ─────────────────────────────────────────────────────────────────
  ass: [
    { prompt: 'ass close-up from behind, on knees with bottom raised and presented, looking back over shoulder at camera with teasing expression, soft light on curves',             note: '跪姿臀部特写·向后回望镜头·挑逗表情·柔光勾勒曲线' },
    { prompt: 'ass, lying face down on bed, looking back at camera, one leg bent raising hip slightly, hand resting on lower back, completely at ease',                              note: '俯卧回望·单腿弯曲略抬臀·手放腰下·完全放松' },
    { prompt: 'ass, standing bent slightly forward, both hands spreading cheeks apart slowly, looking back with heat in eyes, completely unashamed display',                          note: '微微前弯·双手缓慢分开双颊·回望目光炽热·毫不羞耻的展示' },
    { prompt: 'ass side profile, one leg raised on surface, full curve of buttocks in profile, perfect silhouette against soft backlight, hand trailing along hip',                  note: '侧面·单腿搭高台·臀部完整侧面曲线·柔和逆光剪影·手沿臀线滑落' },
  ],

  back: [
    { prompt: 'bare back, facing away with arms raised above head, full back on display, shoulder blades prominent, spine a deep channel down the center, elegant',                  note: '裸背·双臂高举·完整背部展示·肩胛骨突出·脊椎深谷居中·优雅' },
    { prompt: 'bare back arching in slow stretch, spine becoming a dramatic curve, hair falling freely down the back, ribs expanding with deep breath',                              note: '裸背缓慢弓形伸展·脊椎成戏剧曲线·发丝自由飘落·深呼吸时肋骨扩张' },
    { prompt: 'bare back close-up, single finger trailing slowly down the full length of her spine from nape to lower back, skin responding with goosebumps',                       note: '裸背特写·单指从颈到腰缓慢沿脊椎下滑·皮肤起鸡皮疙瘩回应' },
    { prompt: 'bare back sitting with back to camera, hair swept entirely to one side exposing full back, shoulder slightly turned, looking into distance thoughtfully',              note: '背对镜头坐着·发丝全部扫向一侧露出完整背部·肩部微转·若有所思凝视远方' },
  ],

  thighs: [
    { prompt: 'inner thigh close-up, legs slightly spread, camera positioned between thighs, soft pale skin catching warm light, texture visible, intimate proximity',               note: '大腿内侧特写·双腿微张·镜头置于腿间·柔软浅肤捕捉暖光·肌理可见' },
    { prompt: 'thigh close-up, one leg raised and fully extended, inner thigh displayed completely, hand resting lightly on inner thigh just barely touching, featherlight contact', note: '单腿抬起完全伸展·大腿内侧完整展示·手轻放内腿轻触·羽毛般接触' },
    { prompt: 'thighs pressed together then slowly parting, gradual reveal of the space between, tension in the deliberate slowness, eyes watching the reveal',                      note: '双腿并拢缓慢分开·腿间空隙逐渐暴露·刻意缓慢中的张力·眼睛看着暴露过程' },
    { prompt: 'inner thigh close-up showing faint marks from earlier play, fingers tracing them lightly, skin still sensitive, tender examination of the evidence',                  note: '大腿内侧特写·显示之前游戏留下的淡痕·手指轻描·皮肤仍然敏感·温柔审视痕迹' },
  ],

  // ── 新玩法 ───────────────────────────────────────────────────────────────────
  massage: [
    { prompt: 'erotic massage, lying face down on bed, strong hands pressing deep into her lower back and sides, expression shifting from relaxed to flushed as hands move lower',   note: '情色按摩·俯卧·双手深压腰侧·表情从放松到潮红随手移低而变' },
    { prompt: 'massage, inner thigh being kneaded slowly, thumbs pressing close to the center, breath quickening visibly, fingers gripping the sheet beneath',                       note: '按摩大腿内侧缓慢揉捏·拇指向中心压近·呼吸明显加速·手指抓住下方床单' },
    { prompt: 'massage, lying on back now, hands moving from stomach to ribcage to breasts in smooth strokes, eyes closing slowly, head tilting back in surrender',                  note: '翻身仰卧·双手从腹部到肋骨到胸部流畅推抚·眼睛缓慢闭合·头向后仰投降' },
    { prompt: 'massage close-up of hands working slowly on bare skin, oil glistening on surface, skin dimpling under the pressure, the physical intimacy of skilled touch',          note: '特写双手在裸肤上缓慢运作·皮肤表面精油光泽·皮肤在压力下凹陷·熟练触碰的身体亲密' },
  ],

  edging: [
    { prompt: 'edging, brought to the very brink, fingers withdrawn at the exact last second, desperate frustrated expression, hips still raised chasing contact that is gone',      note: '边缘控制·被带到临界点·手指恰在最后一刻抽回·绝望挫败·腰臀仍高追逐消失的接触' },
    { prompt: 'edging, vibrator removed at the critical moment, she reaches for it instinctively, wrist caught, denied again, tears of frustration building at corners of eyes',    note: '振动器在关键时刻被取走·她本能伸手·手腕被抓·再次被拒·挫折泪水在眼角积聚' },
    { prompt: 'edging, repeatedly brought to edge and denied, counting under breath, tears streaming, body shaking with need, expression pure desperation and barely contained desire', note: '反复带到边缘并拒绝·低声数数·泪水流淌·身体因需要颤抖·表情是纯粹绝望和勉强压制的欲望' },
    { prompt: 'edging release finally granted after long denial, expression collapsing from desperate tension into overwhelming relief and release, entire body letting go at once',   note: '长时间拒绝后终于获准释放·表情从绝望紧张崩溃为压倒性的释然·整个身体同时放开' },
  ],

  exhibition: [
    { prompt: 'exhibition, in a nearly-public place, partially undressed, listening intently for approaching footsteps, mixture of terror and arousal plain on face, adrenaline high', note: '近公共场所·部分裸露·专注聆听脚步声·恐惧与兴奋的混合表情明显·肾上腺素飙升' },
    { prompt: 'exhibition against window with curtains only slightly parted, aware of anyone outside who might look up, thrilled by the exposure, pressing against the glass',        note: '窗帘只微开时靠窗展示·意识到外面任何人可能抬头·被暴露感兴奋·贴着玻璃' },
    { prompt: 'exhibition in semi-public bathroom, clothing adjusted for access, urgency and excitement competing on face, the forbidden thrill of the location visible',              note: '半公共浴室·衣物调整以便进入·紧迫感与兴奋感在脸上竞争·地点禁忌快感可见' },
    { prompt: 'exhibition in secluded outdoor location, surrounded by nature, exposed beneath open sky, the wild freedom of it on face, hair loose in breeze',                        note: '僻静户外位置·被自然包围·在开阔天空下暴露·脸上呈现野性自由·发丝在微风中散开' },
  ],

  // ── 新体位 ───────────────────────────────────────────────────────────────────
  prone_bone: [
    { prompt: 'prone bone position, lying completely flat on stomach, penetrated from behind, face turned to side on pillow, sounds muffled, completely pinned and unable to move',   note: '俯卧后入·完全俯卧·从后插入·脸转向枕头·声音被闷住·被完全压住无法移动' },
    { prompt: 'prone bone, legs slightly parted, weight pressing down from above, hands gripping headboard forward, the unusual angle of sensation clearly showing on face',           note: '俯卧·双腿微分·从上方压下来的重量·双手抓前方床头·不寻常角度的感觉清晰显示在脸上' },
    { prompt: 'prone bone from above angle, full back visible, spine curving with each thrust, hands white-knuckled gripping sheets, legs instinctively straightening',               note: '俯卧·从上方视角·完整背部可见·随每次推送脊椎弯曲·关节泛白手紧抓床单·双腿本能伸直' },
    { prompt: 'prone bone, one leg bent slightly to change the angle, sharp gasp as the sensation shifts, head lifting from pillow in surprise, then dropping back down overwhelmed',  note: '俯卧·一腿微弯改变角度·感觉改变时急促喘气·头从枕头抬起惊讶·然后再次被淹没低落' },
  ],

  lotus: [
    { prompt: 'lotus position, sitting facing each other, arms wrapped around his neck, his arms around her back, moving together slowly, foreheads almost touching, deeply intimate',  note: '莲花座·面对面·双臂绕他颈·他双臂绕她背·缓慢共同移动·额头几乎相触·深度亲密' },
    { prompt: 'lotus, eye contact maintained without breaking through the entire act, reading every response in each others faces, entirely vulnerable and present with each other',    note: '莲花座·全程保持不中断的眼神接触·在彼此脸上读取每个反应·完全脆弱·完全与彼此同在' },
    { prompt: 'lotus, she leans back slightly changing the depth and angle, his hands supporting the small of her back preventing her falling, both adjusting to the new sensation',   note: '莲花座·她略向后倾改变深度和角度·他双手支撑她腰小部防止跌落·双方适应新感觉' },
    { prompt: 'lotus close-up of faces, noses almost touching, sharing breath, whispered words between movements, the profound intimacy of being completely joined and face to face',   note: '莲花座·脸部特写·鼻子几乎相触·共享呼吸·在运动间低语·完全结合面对面的深刻亲密' },
  ],

  piledriver: [
    { prompt: 'piledriver position, legs pushed back over shoulders, body folded, extreme depth from above, expression of overwhelmed shock at the new angle and depth',               note: '竖腿位置·双腿推过肩·身体折叠·从上方极度深入·对新角度深度的被淹没震惊表情' },
    { prompt: 'piledriver, ankles held together above her head, completely suspended and immobile, gravity assisting depth, helpless beautiful vulnerability in the position',           note: '竖腿·双踝一起握在头顶·完全悬挂无法动弹·重力辅助深度·无助美丽的姿态脆弱' },
    { prompt: 'piledriver from the side, full position visible showing the dramatic angle of the bodies, the depth of penetration evident, her expression of intense sensation',        note: '竖腿·从侧面·完整姿势可见·展示身体戏剧性角度·深度插入明显·她强烈感觉的表情' },
    { prompt: 'piledriver, she reaches up gripping his forearms with both hands, anchoring herself in the position, knuckles white, using the grip to ground herself in overwhelming sensation', note: '竖腿·她双手抓住他前臂·在姿势中固定自己·指关节泛白·用抓握在压倒性感觉中定位自己' },
  ],

  // ── 极致状态 ─────────────────────────────────────────────────────────────────
  overstimulation: [
    { prompt: 'overstimulation, post-orgasm stimulation continuing, body too sensitive, pushing his hand away with trembling arm while simultaneously arching into the contact',        note: '过度刺激·高潮后继续·身体太敏感·颤抖的手臂推开他的手·同时向接触弓身' },
    { prompt: 'overstimulation, third orgasm hit, body shaking continuously, tears streaming not from pain but from the overwhelming accumulation, shaking head but unable to say stop', note: '过度刺激·第三次高潮·身体持续颤抖·泪水流淌不是因为疼痛而是积累性压倒·摇头但无法说停' },
    { prompt: 'overstimulation, skin so sensitive that even a breath across it causes flinching, hands hovering unable to touch, muscles still spasming from the last climax',          note: '过度刺激·皮肤敏感到连呼吸吹过都会颤抖·双手悬停无法触碰·肌肉仍因上次高潮而痉挛' },
    { prompt: 'overstimulation aftermath, lying completely still trying to let sensitivity pass, any movement sending aftershocks, expression of someone simultaneously wrecked and blissful', note: '过度刺激后·完全静止试图让敏感过去·任何动作引发余震·表情是同时被摧毁又幸福的人' },
  ],

  afterglow: [
    { prompt: 'afterglow, lying tangled together in warm light, skin still flushed from exertion, both completely relaxed, expressions of total satisfaction and peace',               note: '余韵·纠缠躺在暖光中·皮肤因运动仍潮红·双方完全放松·完全满足与平静的表情' },
    { prompt: 'afterglow, she traces slow lazy patterns on his chest with one fingertip, satisfied dreamy expression, eyes half-closed, neither wants to move or speak',               note: '余韵·她用指尖在他胸口画缓慢慵懒的图案·满足梦幻表情·眼半闭·谁也不想动或说话' },
    { prompt: 'afterglow close-up of face only, eyes half-closed with heavy lashes, lips still slightly swollen, soft flush on cheeks, expression of absolute deep peace and completion', note: '余韵·仅脸部特写·眼半闭睫毛厚重·嘴唇仍略肿·双颊柔和潮红·绝对深层平静与圆满的表情' },
    { prompt: 'afterglow, rolling to face ceiling with both arms stretched above head in a long languid satisfied stretch, legs straight, entire body releasing the last tension',      note: '余韵·翻身面向天花板·双臂上举完成长久懒洋洋满足的伸展·双腿伸直·整个身体释放最后张力' },
  ],

  // ── 性交链接部分特写 ──────────────────────────────────────────────────────────
  penetration_closeup: [
    { prompt: 'vaginal penetration close-up, erect cock fully inserted into wet pussy, (labia tightly wrapped around shaft:1.3), white creamy love juice coating shaft, glistening slick, from-below upward angle showing the union clearly, explicit junction detail', note: '极近特写·阴茎完全插入湿润阴道·阴唇紧绷包裹·白色爱液包裹轴杆·从下方仰角清晰展示结合' },
    { prompt: 'penetration half-withdrawal close-up, cock half pulled out revealing wet glistening shaft, (labia clinging to shaft as it slides outward:1.3), strings of love juice connecting them, mid-thrust moment frozen, explicit sliding friction detail', note: '半抽出中途特写·阴茎半拔出露出湿润轴杆·阴唇跟随轴杆向外黏附·爱液成丝连接·冻结中途抽送' },
    { prompt: 'penetration fully-buried close-up, cock base completely flush against labia, (labia compressed flat at maximum depth:1.3), abundant love juice pooling at the junction, deepest penetration moment, veins visible on shaft, gripped completely tight', note: '完全插入极近·阴茎根部完全贴合阴唇·最大深度时阴唇被压平·大量爱液在结合处汇集·最深插入瞬间' },
    { prompt: 'initial penetration close-up, swollen cock head pressing into tight entrance, (labia spreading slowly around glans:1.3), glistening wet opening parting for first penetration, tipping point moment, tension and surrender visible in the stretched flesh, explicit detail', note: '初次插入瞬间极近·膨胀龟头顶入紧口·阴唇缓慢围绕龟头展开·湿润入口为初次插入而张开·临界点瞬间' },
  ],

  // ── 掰开阴道特写（近距离特写，撑开展示） ──────────────────────────────────────
  spread_pussy: [
    { prompt: 'pussy spread open close-up, two thumbs pulling labia majora maximally apart, vaginal entrance fully exposed and gaping, (bright pink inner walls visible inside canal:1.3), swollen clitoris visible at top, inner labia stretched flat, love juice glistening, explicit anatomy display', note: '特写·双拇指用力将大阴唇最大程度撑开·阴道入口完全暴露张开·粉红内壁爱液光泽可见·阴蒂顶部清晰·小阴唇被撑力拉平' },
    { prompt: 'vulva spread close-up, index fingers hooked inside labia minora pulling outward, vaginal opening stretched into wide oval, (deep pink inner canal exposed:1.3), love juice pooling and dripping at entrance, labia pulled taut, clitoris hood retracted, direct lighting on wet surfaces', note: '外阴特写·食指勾住小阴唇向外拉·阴道口被撑成宽椭圆暴露深粉内壁·爱液在入口汇集滴落·小阴唇绷紧·阴蒂包皮后缩' },
    { prompt: 'spread pussy close-up, four fingers spreading labia as wide as possible, (entire vulva anatomy visible — clitoris, vaginal entrance, inner and outer labia:1.3), interior vaginal canal pink walls visible, abundant love juice coating every surface, maximum gape display, explicit spread', note: '特写·四指将阴唇尽可能撑开·全外阴解剖展示——阴蒂、阴道口、小阴唇、大阴唇同时可见·阴道内壁可见·大量爱液覆盖表面' },
    { prompt: 'spread pussy fingers pulling labia apart, maximum tension close-up, (love juice stringing in glistening threads between parting inner labia:1.3), vaginal entrance stretched open at center frame revealing inner pink walls, labia edges reddened and engorged, moisture creating specular highlights on wet surfaces', note: '掰开特写·手指在最大张力瞬间撑开·小阴唇分离间爱液成光泽细丝·阴道口居中张开露出内壁粉红·小阴唇边缘充血变红·湿润表面镜面高光' },
  ],
};

// ── 男性在场描述 ────────────────────────────────────────────────────────────────
const MALE_PRESENCE: Partial<Record<ShotKey, string>> = {
  kiss:                   'male lips pressing against hers',
  breast:                 'strong male hands on her breasts',
  handjob:                'erect male penis in her hand',
  fingering:              'male fingers inside her',
  blowjob:                'male thighs framing her face, hand gripping her hair',
  cunnilingus:            'male head between her legs',
  penetration_missionary: 'male body pressing down, male hips thrusting',
  penetration_doggy:      'male hands gripping her hips from behind',
  penetration_cowgirl:    'male body lying underneath her',
  penetration_spooning:   'male arm around her from behind',
  penetration_generic:    'male hands on her hips',
  standing_sex:           'male hands pinning her against wall',
  creampie:               'cum dripping from her stretched pussy',
  cum_face:               'male cock visible above her face',
  bondage:                'rope or restraint binding her',
  spanking:               'strong male hand mid-spank',
  toy_use:                'partner controlling the toy',
  squirt:                 'male hand just withdrawn from her',
  massage:                'male hands pressing into her skin',
  edging:                 'male hand withdrawn at the last moment',
  exhibition:             'male presence keeping her exposed',
  prone_bone:             'male body pressing down from behind, male hips thrusting',
  lotus:                  'male body seated beneath her, arms wrapped around her',
  piledriver:             'male body above her, holding her legs back',
  overstimulation:        'male hand continuing despite her sensitivity',
  penetration_closeup:    'male erect cock fully visible in the penetration junction',
  spread_pussy:           'her own hands or his hands spreading her open',
};

// ── Fallback 场景配置（scene_config 中缺少的 shotKey） ──────────────────────
const DEFAULT_SHOT_CONFIG: Partial<Record<ShotKey, { scene: string; outfit: string; mood: string; extra: string }>> = {
  undressing:      { scene: 'dimly lit bedroom, warm soft lamplight',              outfit: 'half-removed clothing, bra unhooked, skirt at thighs',         mood: 'shy nervous anticipation',               extra: 'slow reveal, cloth sliding off skin' },
  ass:             { scene: 'private bedroom, low warm light',                     outfit: 'panties pulled aside or nude bottom, bare ass',                mood: 'teasing coy presentation',               extra: 'bare ass, ass cheeks, erotic display' },
  back:            { scene: 'bedroom, soft light from window',                     outfit: 'topless, bare back fully visible',                             mood: 'languid elegant vulnerable',             extra: 'bare back, spine visible, shoulder blades' },
  thighs:          { scene: 'intimate private space, soft light',                  outfit: 'skirt raised or shorts removed, inner thighs bare',            mood: 'soft inviting vulnerability',            extra: 'inner thigh close-up, soft pale thighs' },
  bondage:         { scene: 'private room, low dramatic lighting',                 outfit: 'rope harness over nude body, collar with ring',                mood: 'submissive trembling anticipation',       extra: 'BDSM rope bondage, erotic restraint' },
  toy_use:         { scene: 'bedroom, soft ambient lighting, tangled sheets',      outfit: 'completely nude, toy in use',                                  mood: 'overwhelmed by internal sensation',       extra: 'sex toy stimulation, vibration, erotic device' },
  petplay:         { scene: 'living room, soft rug floor, comfortable cozy space', outfit: 'lingerie with cat ear headband, collar, bell, tail',           mood: 'playful obedient submissive kitten',     extra: 'pet play, collar, kitten persona' },
  spanking:        { scene: 'bedroom, bent over position',                         outfit: 'nude or panties pulled aside, bottom exposed',                 mood: 'embarrassed aroused anticipatory shame',  extra: 'punishment spanking, erotic discipline' },
  massage:         { scene: 'dimly lit room, massage table or bed, scented candles', outfit: 'towel draped or partially nude',                            mood: 'relaxed then gradually flushed aroused',  extra: 'erotic massage, hands on bare skin, oil' },
  edging:          { scene: 'bedroom, intimate close space',                       outfit: 'completely nude, spread and exposed',                          mood: 'desperate frustrated pleading on edge',   extra: 'orgasm denial, brought to edge, denied release' },
  exhibition:      { scene: 'semi-public location with risk of discovery',         outfit: 'partially clothed or adjusted for access',                    mood: 'thrilled terrified adrenaline arousal',   extra: 'semi-public, exhibition, risk of being seen' },
  prone_bone:      { scene: 'bedroom, sheets tangled',                             outfit: 'completely nude, lying flat face down',                        mood: 'helpless overwhelmed from below',         extra: 'prone bone position, lying flat, penetration from behind' },
  lotus:           { scene: 'bedroom, intimate warm light',                        outfit: 'completely nude, sitting face to face',                        mood: 'deeply intimate eye contact sustained',   extra: 'lotus position, face to face, arms wrapped around each other' },
  piledriver:      { scene: 'bedroom, pillows beneath hips',                       outfit: 'completely nude, legs pushed back',                            mood: 'overwhelmed by extreme depth sensation',  extra: 'piledriver position, legs over shoulders, deep penetration' },
  squirt:          { scene: 'soaked bedroom, wet sheets, humid close air',         outfit: 'completely nude, body glistening',                             mood: 'overwhelmed utterly out of control',      extra: 'female ejaculation, squirting orgasm, gushing' },
  overstimulation:      { scene: 'bedroom, post-orgasm, sheets damp',              outfit: 'completely nude, skin flushed and sensitive',                  mood: 'crying shaking oversensitive begging',    extra: 'overstimulation, post-orgasm continued stimulation, too sensitive' },
  afterglow:            { scene: 'bedroom, soft warm light, rumpled sheets',       outfit: 'nude or light sheet, skin still flushed',                     mood: 'blissful satisfied peaceful dreamy',      extra: 'afterglow, post-sex, satisfied, warm intimacy' },
  penetration_closeup:  { scene: 'bedroom, intimate close angle, between the legs perspective', outfit: 'completely nude, penetration actively occurring', mood: 'explicit intimate detail, glistening',       extra: 'vaginal penetration close-up, junction detail, cock in pussy, love juice, no mosaic, no censorship' },
  spread_pussy:         { scene: 'private bedroom, close angle, warm intimate lighting',        outfit: 'completely nude, legs spread wide, hands spreading labia open',   mood: 'explicit spread open, anatomy exposed, wet', extra: 'spread pussy close-up, labia pulled apart, vaginal canal visible, clitoris exposed, love juice, no mosaic, no censorship' },
};

// ── 拼接 SHOT_META（从 batch1 重用） ──────────────────────────────────────────
interface ShotMeta {
  category: string; description: string; tags: string[]; bodyFocus: string; viewAngle: string;
}
const SHOT_META: Partial<Record<ShotKey, ShotMeta>> = {
  portrait:               { category: '调情', description: '面部特写·眼神撩人·唯美氛围',      tags: ['正脸','眼神','近景','氛围'],       bodyFocus: '脸部',   viewAngle: '近景正面' },
  medium:                 { category: '调情', description: '半身展示·身材曲线·风情万种',      tags: ['半身','身材','中景','诱惑'],       bodyFocus: '上半身', viewAngle: '中景正面' },
  kiss:                   { category: '前戏', description: '嘴唇相贴·舌尖缠绕·沉醉',          tags: ['接吻','嘴唇','缠绵'],             bodyFocus: '嘴唇',   viewAngle: '近景' },
  undressing:             { category: '前戏', description: '脱衣中间态·裸肤初现·害羞期待',    tags: ['脱衣','半脱','裸肤','期待'],      bodyFocus: '全身',   viewAngle: '中景' },
  ass:                    { category: '前戏', description: '裸臀展示·翘臀弧线·撩拨视角',      tags: ['裸臀','翘臀','臀部特写'],         bodyFocus: '臀部',   viewAngle: '后方近景' },
  back:                   { category: '前戏', description: '裸背优雅·脊柱曲线·背影撩人',      tags: ['裸背','脊椎','背影','优雅'],      bodyFocus: '背部',   viewAngle: '后方中景' },
  thighs:                 { category: '前戏', description: '大腿内侧·柔软肌肤·大腿间隙',      tags: ['大腿','内侧','腿部特写'],         bodyFocus: '腿部',   viewAngle: '近景' },
  breast:                 { category: '前戏', description: '乳房爱抚·乳头坚挺·娇喘连连',      tags: ['裸胸','乳头','揉捏'],             bodyFocus: '胸部',   viewAngle: '近景' },
  pussy:                  { category: '前戏', description: '下体湿润·粉嫩阴唇·完全暴露',      tags: ['阴部','湿润','张腿','爱液'],      bodyFocus: '阴部',   viewAngle: '近景' },
  handjob:                { category: '前戏', description: '纤手握住阳具·挑逗抚弄',            tags: ['手交','阳具','POV'],              bodyFocus: '手部',   viewAngle: 'POV' },
  fingering:              { category: '前戏', description: '手指探入湿润内壁·爱液淋漓',        tags: ['手指插入','爱液','颤抖'],         bodyFocus: '阴部',   viewAngle: '中景' },
  blowjob:                { category: '前戏', description: '含入阳具·仰望镜头·口水欲滴',      tags: ['口交','阳具','含住','POV'],       bodyFocus: '嘴部',   viewAngle: '近景仰视' },
  cunnilingus:            { category: '前戏', description: '舌尖爱抚阴蒂·双腿夹紧·失神',      tags: ['舔阴','阴蒂','舌头'],             bodyFocus: '阴部',   viewAngle: '中景' },
  bondage:                { category: '调教', description: '捆绑束缚·顺从颤抖·绳痕美感',      tags: ['捆绑','绳索','束缚','顺从'],      bodyFocus: '全身',   viewAngle: '中景' },
  toy_use:                { category: '调教', description: '情趣玩具使用·感官超载·失控',      tags: ['玩具','振动棒','跳蛋','失控'],    bodyFocus: '阴部',   viewAngle: '中景' },
  petplay:                { category: '调教', description: '猫耳项圈宠物扮演·娇憨服从',        tags: ['猫娘','猫耳','项圈','爬行'],      bodyFocus: '全身',   viewAngle: '中景' },
  spanking:               { category: '调教', description: '翘臀受罚·手印红痕·羞耻泪眼',      tags: ['打屁股','惩罚','红痕','翘臀'],    bodyFocus: '臀部',   viewAngle: '侧视' },
  massage:                { category: '调教', description: '情色按摩·从放松到兴奋·肌肤相亲',  tags: ['按摩','触碰','皮肤','渐进'],      bodyFocus: '全身',   viewAngle: '中景俯视' },
  edging:                 { category: '调教', description: '边缘控制·高潮被剥夺·欲望累积',    tags: ['边缘','拒绝','渴望','欲火'],      bodyFocus: '全身',   viewAngle: '中景' },
  exhibition:             { category: '调教', description: '半公开场所·被看见风险·刺激兴奋',  tags: ['展示','半公开','风险','刺激'],    bodyFocus: '全身',   viewAngle: '中景' },
  penetration_missionary: { category: '插入', description: '仰躺插入·眼神交汇·喘息缠绵',      tags: ['传教士','插入','正面'],           bodyFocus: '阴部',   viewAngle: '正面中景' },
  penetration_doggy:      { category: '插入', description: '四肢跪趴·后入深插·腰臀律动',      tags: ['后入','跪趴','臀部'],             bodyFocus: '臀部',   viewAngle: '后方' },
  penetration_cowgirl:    { category: '插入', description: '主动骑乘·腰臀律动·乳房颠簸',      tags: ['骑乘','主动','乳房'],             bodyFocus: '全身',   viewAngle: '正面' },
  penetration_spooning:   { category: '插入', description: '侧躺紧贴·从后插入·温柔缠绵',      tags: ['侧入','勺式','温柔'],             bodyFocus: '侧身',   viewAngle: '侧面' },
  penetration_generic:    { category: '插入', description: '结合处特写·爱液交融',              tags: ['插入特写','爱液'],                bodyFocus: '阴部',   viewAngle: '特写' },
  prone_bone:             { category: '插入', description: '俯卧后入·完全被压·无法移动',        tags: ['俯卧','后入','压制','深入'],      bodyFocus: '全身',   viewAngle: '后方俯视' },
  lotus:                  { category: '插入', description: '正面环抱骑乘·深度亲密·眼神直视',  tags: ['莲花座','正面','环抱','亲密'],    bodyFocus: '全身',   viewAngle: '正面中景' },
  piledriver:             { category: '插入', description: '竖腿深入·极度深插·角度刺激',      tags: ['竖腿','传教士变体','深入','极限'], bodyFocus: '全身',   viewAngle: '侧面' },
  standing_sex:           { category: '插入', description: '站立后入·靠墙·力道十足',          tags: ['站立','后入','贴墙'],             bodyFocus: '全身',   viewAngle: '侧面' },
  ahegao:                 { category: '高潮', description: '白眼上翻·嘴巴大张·极乐之脸',      tags: ['高潮表情','白眼','口水','失神'],  bodyFocus: '脸部',   viewAngle: '近景' },
  squirt:                 { category: '高潮', description: '潮喷液体喷涌·双腿战栗·失控',      tags: ['潮喷','液体','颤抖','失控'],      bodyFocus: '阴部',   viewAngle: '近景' },
  overstimulation:        { category: '高潮', description: '高潮后继续刺激·过度敏感·崩溃',    tags: ['过度刺激','敏感','哭泣','崩溃'],  bodyFocus: '全身',   viewAngle: '中景' },
  afterglow:              { category: '高潮', description: '性爱后余韵·满足沉醉·肌肤温热',    tags: ['余韵','满足','温柔','事后'],      bodyFocus: '全身',   viewAngle: '中景' },
  creampie:               { category: '高潮', description: '内射后精液流出·满足余韵',          tags: ['内射','精液','流出','满足'],      bodyFocus: '阴部',   viewAngle: '近景' },
  cum_face:               { category: '高潮', description: '精液装饰脸庞·颜射满足',            tags: ['颜射','精液','脸部','满足'],      bodyFocus: '脸部',   viewAngle: '近景' },
  penetration_closeup:    { category: '插入', description: '性交链接部位极近特写·爱液交融·轴杆细节',  tags: ['插入特写','龟头','阴唇','爱液','链接'], bodyFocus: '结合部', viewAngle: '极近特写' },
  spread_pussy:           { category: '前戏', description: '双手掰开阴道·内壁完全暴露·粉嫩湿润',    tags: ['掰开','展示','内壁','阴唇','湿润'],   bodyFocus: '阴部',   viewAngle: '极近特写' },
};

// ── LoRA 配置 ─────────────────────────────────────────────────────────────────
type LoraSpec = [string, number, number];
const SHOT_LORAS: Partial<Record<ShotKey, LoraSpec[]>> = {
  handjob:                [['cockteaseLoRASDXL.safetensors', 0.5, 0.5], ['nudify_xl_lite.safetensors', 0.5, 0.5]],
  fingering:              [['nudify_xl_lite.safetensors', 0.62, 0.62]],
  blowjob:                [['nudify_xl_lite.safetensors', 0.6, 0.6]],
  breast:                 [['nudify_xl_lite.safetensors', 0.5, 0.5]],
  pussy:                  [['nudify_xl_lite.safetensors', 0.65, 0.65]],
  cunnilingus:            [['nudify_xl_lite.safetensors', 0.5, 0.5]],
  undressing:             [['nudify_xl_lite.safetensors', 0.35, 0.35]],
  ass:                    [['nudify_xl_lite.safetensors', 0.45, 0.45]],
  back:                   [],
  thighs:                 [['nudify_xl_lite.safetensors', 0.4, 0.4]],
  bondage:                [['nudify_xl_lite.safetensors', 0.55, 0.55]],
  toy_use:                [['nudify_xl_lite.safetensors', 0.6, 0.6]],
  petplay:                [],
  spanking:               [['nudify_xl_lite.safetensors', 0.45, 0.45]],
  massage:                [['nudify_xl_lite.safetensors', 0.4, 0.4]],
  edging:                 [['nudify_xl_lite.safetensors', 0.6, 0.6]],
  exhibition:             [['nudify_xl_lite.safetensors', 0.45, 0.45]],
  prone_bone:             [['dggy.safetensors', 0.6, 0.6], ['nudify_xl_lite.safetensors', 0.4, 0.4]],
  lotus:                  [['rvcg.safetensors', 0.55, 0.55], ['nudify_xl_lite.safetensors', 0.4, 0.4]],
  piledriver:             [['MissionaryVaginal-v1-SDXL.safetensors', 0.6, 0.6], ['nudify_xl_lite.safetensors', 0.45, 0.45]],
  squirt:                 [['PornMaster-cum-sdxl-V3-lora.safetensors', 0.4, 0.4], ['nudify_xl_lite.safetensors', 0.6, 0.6]],
  overstimulation:        [['nudify_xl_lite.safetensors', 0.55, 0.55]],
  afterglow:              [['nudify_xl_lite.safetensors', 0.3, 0.3]],
  penetration_missionary: [['MissionaryVaginal-v1-SDXL.safetensors', 0.65, 0.65], ['nudify_xl_lite.safetensors', 0.4, 0.4]],
  penetration_doggy:      [['dggy.safetensors', 0.65, 0.65], ['nudify_xl_lite.safetensors', 0.4, 0.4]],
  penetration_cowgirl:    [['rvcg.safetensors', 0.65, 0.65], ['nudify_xl_lite.safetensors', 0.4, 0.4]],
  penetration_spooning:   [['nudify_xl_lite.safetensors', 0.55, 0.55]],
  penetration_generic:    [['dggy.safetensors', 0.4, 0.4], ['nudify_xl_lite.safetensors', 0.5, 0.5]],
  ahegao:                 [['Tongue out_SDXL.safetensors', 0.35, 0.35], ['PornMaster-cum-sdxl-V3-lora.safetensors', 0.5, 0.5], ['nudify_xl_lite.safetensors', 0.5, 0.5]],
  creampie:               [['PornMaster-cum-sdxl-V3-lora.safetensors', 0.4, 0.4], ['nudify_xl_lite.safetensors', 0.55, 0.55]],
  cum_face:               [['PornMaster-cum-sdxl-V3-lora.safetensors', 0.55, 0.55], ['Tongue out_SDXL.safetensors', 0.2, 0.2]],
  penetration_closeup:    [['nudify_xl_lite.safetensors', 0.65, 0.65]],
  spread_pussy:           [['nudify_xl_lite.safetensors', 0.55, 0.55]],
};

const QUALITY = 'masterpiece, best quality, amazing quality, absurdres, very aesthetic, newest, ultra detailed, highly detailed, beautiful face, perfect eyes, perfect body, source_anime, nsfw, explicit';
const NEGATIVE = 'bad quality, worst quality, worst detail, sketch, bad anatomy, bad hands, extra fingers, missing fingers, deformed face, ugly face, blurry, watermark, text, censored, mosaic, signature, bad vagina, deformed genitals, bad penis';
// 非 portrait/medium 镜头额外加入：阻止 charBase 里的 expressionless 词主导输出
const EXPRESSION_NEGATIVE = 'expressionless, blank face, neutral expression, empty expression, deadpan';

const SHOT_NEGATIVE_EXTRA: Partial<Record<ShotKey, string>> = {
  cunnilingus:     '2girls, yuri, lesbian, two girls, female on female, two females, two women, gl',
  fingering:       '2girls, yuri, lesbian, two girls, robot hands, mechanical fingers, claw',
  petplay:         '2girls, yuri, lesbian',
  massage:         '2girls, yuri, lesbian, two girls',
  lotus:           '2girls, yuri, lesbian, two girls',
  afterglow:       '2girls, yuri, lesbian, two girls',
  back:            'front facing, face visible, nsfw genitals',
  thighs:          '2girls, yuri, lesbian',
};

// ── 角色专属变体打乱（各角色图片顺序不同，增加跨角色多样性） ───────────────────
function deterministicShuffle<T>(arr: T[], charName: string): T[] {
  const seed = charName.split('').reduce((a, c, i) => (a ^ (c.charCodeAt(0) * (i + 1))) >>> 0, 0x12345678);
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = ((seed ^ (i * 2654435769)) >>> 0) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ── 分阶段表情修饰词（每张图循环，叠加在 variant 之上） ──────────────────────
const PHASE_EXPR: Record<number, string[]> = {
  0: [
    'shy soft smile, gentle warmth in eyes',
    'coy knowing smirk, playful confidence',
    'dreamy half-closed eyes, soft parted lips',
    'curious tilted head, bright inquisitive gaze',
    'teasing pout, one eyebrow arched',
    'warm genuine smile, eyes crinkling at corners',
  ],
  1: [
    'flushed surprise, blinking rapidly',
    'bitten lower lip, cheeks deeply flushed pink',
    'eyes fluttering half-closed, breathless anticipation',
    'sharp intake of breath, lips parted in sudden gasp',
    'shy downward glance, face flushed scarlet red',
    'overwhelmed, body trembling slightly',
  ],
  2: [
    'panting open mouth, eyes glazed with pleasure',
    'biting own knuckle to muffle sounds',
    'tears pricking at corners of eyes from intensity',
    'defiant gaze slowly dissolving into surrender',
    'completely lost in sensation, gaze unfocused',
    'shuddering breath, muscles involuntarily clenching',
  ],
  3: [
    'eyes rolling back, mouth hanging open in ecstasy',
    'desperate clinging expression, tear-streaked cheeks',
    'barely coherent, mind blanking from overwhelming pleasure',
    'frantic gasping, knuckles white from gripping',
    'teetering on edge of collapse, legs shaking',
    'crying and moaning simultaneously, release imminent',
  ],
  4: [
    'post-orgasm dazed half-smile, eyes still glazed',
    'proud exhausted satisfied warmth in eyes',
    'trembling aftermath, skin still flushed and warm, soft rosy sheen',
    'blank beautiful wrecked expression, thoroughly spent',
    'slow blinking return to awareness, lashes heavy',
    'tears and smile together, deeply overwhelmed',
  ],
};

// ── Portrait / Medium 专属表情（无动作时表情是最关键的变量） ─────────────────
const PORTRAIT_EXPR: string[] = [
  'cold aloof expression, distant piercing gaze directly into lens',
  'barely-there smile, eyes warm but carefully guarded',
  'openly challenging, lips curving in slow dangerous smile',
  'caught off guard, fleeting vulnerability quickly masked',
  'languid sensual heavy-lidded warmth, lips slightly parted',
  'fierce focused intensity, piercing gaze locked directly at viewer',
];
const MEDIUM_EXPR: string[] = [
  'relaxed confidence, inhabiting body completely unselfconsciously',
  'sudden awareness of being watched, caught mid-private-moment',
  'deliberate slow reveal of emotion, savoring the tension',
  'lost in inner world, expression unguarded and beautiful',
  'teasing invitation, clearly in full control of the moment',
  'barely restrained energy coiled in every line of posture and gaze',
];

// ── ComfyUI 工作流（与 batch1 相同，含 FaceDetailer） ─────────────────────────
function buildWorkflow(prompt: string, seed: number, loras: LoraSpec[], w: number, h: number, negExtra = ''): object {
  const full = `${QUALITY}, ${prompt}`;
  const neg  = negExtra ? `${NEGATIVE}, ${negExtra}` : NEGATIVE;
  const nodes: Record<string, object> = {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: MODEL } },
  };

  let modelRef: [string, number] = ["1", 0];
  let clipRef:  [string, number] = ["1", 1];

  loras.forEach((lora, i) => {
    const id = `lora_${i}`;
    nodes[id] = { class_type: "LoraLoader", inputs: { model: modelRef, clip: clipRef, lora_name: lora[0], strength_model: lora[1], strength_clip: lora[2] } };
    modelRef = [id, 0];
    clipRef  = [id, 1];
  });

  nodes["2"] = { class_type: "CLIPTextEncode",  inputs: { text: full, clip: clipRef } };
  nodes["3"] = { class_type: "CLIPTextEncode",  inputs: { text: neg,  clip: clipRef } };
  nodes["4"] = { class_type: "EmptyLatentImage", inputs: { width: w, height: h, batch_size: 1 } };
  nodes["5"] = { class_type: "KSampler",         inputs: { model: modelRef, positive: ["2", 0], negative: ["3", 0], latent_image: ["4", 0], seed, steps: 28, cfg: 6.0, sampler_name: "dpmpp_2m", scheduler: "karras", denoise: 1.0 } };
  nodes["6"] = { class_type: "VAEDecode",        inputs: { samples: ["5", 0], vae: ["1", 2] } };

  nodes["det"] = { class_type: "UltralyticsDetectorProvider", inputs: { model_name: "bbox/face_yolov8m.pt" } };
  nodes["fd"]  = { class_type: "FaceDetailer", inputs: {
    image: ["6", 0], model: modelRef, clip: clipRef, vae: ["1", 2],
    positive: ["2", 0], negative: ["3", 0], bbox_detector: ["det", 0],
    guide_size: 512, guide_size_for: true, max_size: 1024,
    seed: seed + 1, steps: 20, cfg: 6.0, sampler_name: "dpmpp_2m", scheduler: "karras",
    denoise: 0.42, feather: 20, noise_mask: true, force_inpaint: true,
    bbox_threshold: 0.5, bbox_dilation: 10, bbox_crop_factor: 3.0,
    sam_detection_hint: "center-1", sam_dilation: 0, sam_cosine_threshold: 0.3,
    sam_bbox_expansion: 0, sam_mask_hint_threshold: 0.3, sam_mask_hint_use_negative: "False",
    sam_threshold: 0.93, drop_size: 10, wildcard: "", cycle: 1,
    inpaint_model: false, noise_mask_feather: 20,
  }};
  nodes["7"] = { class_type: "SaveImage", inputs: { images: ["fd", 0], filename_prefix: "anime2_lib" } };
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
  const res = await fetch(`${COMFYUI_URL}/view?filename=${filename}&type=output`);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  fs.writeFileSync(savePath, Buffer.from(await res.arrayBuffer()));
}

async function generateForCharacter(characterName: string, fromArg?: string, forceRegen = false) {
  const configPath = path.join(__dirname, '..', 'scene_configs', `${characterName}.json`);
  const sceneConfig: SceneConfig | null = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    : null;

  if (!sceneConfig) {
    console.warn(`⚠️  无 scene_config for ${characterName}，将对所有 shotKey 使用 DEFAULT_SHOT_CONFIG 兜底`);
  }

  const character = await prisma.character.findFirst({ where: { name: characterName } });
  if (!character) { console.error(`❌ DB 无此角色: ${characterName}`); return; }

  const faceAnchor = (character.faceAnchor as string | null) ?? CHARACTER_FACE[characterName] ?? '';
  const charBase   = CHARACTER_BASE[characterName] ?? `1girl, ${character.age}yo`;

  console.log(`\n🎨 【${characterName}】Batch2`);

  const shotKeys = SHOT_TYPES.map(t => t.key);
  const startIdx = fromArg ? Math.max(0, shotKeys.indexOf(fromArg as ShotKey)) : 0;

  let generated = 0, skipped = 0;

  for (let si = startIdx; si < SHOT_TYPES.length; si++) {
    const { key: shotKey, label } = SHOT_TYPES[si];
    if (!BATCH2_SHOTS.includes(shotKey)) continue;

    const count = SHOT_COUNT[shotKey] ?? 0;
    if (count === 0) continue;

    const shotDir = path.join(LIBRARY_DIR, characterName, shotKey);
    fs.mkdirSync(shotDir, { recursive: true });

    // scene_config 中没有的 shotKey 用 DEFAULT_SHOT_CONFIG 兜底
    const shotConfig = (sceneConfig?.shotConfigs[shotKey]) ?? DEFAULT_SHOT_CONFIG[shotKey];
    if (!shotConfig?.scene) { console.log(`  ⏭️  ${shotKey} 无配置且无默认，跳过`); continue; }

    const rawVariants = SHOT_VARIANTS[shotKey];
    if (!rawVariants || rawVariants.length === 0) { console.log(`  ⏭️  ${shotKey} 无变体，跳过`); continue; }
    const variants = deterministicShuffle(rawVariants, characterName);

    console.log(`  ── ${shotKey} (${label}) ×${count}`);

    const isPortrait = ['portrait','medium','blowjob','cum_face','ahegao','kiss','breast','pussy',
                        'fingering','cunnilingus','bondage','toy_use','petplay','undressing','squirt','spanking',
                        'ass','back','thighs','massage','edging','overstimulation','afterglow','exhibition',
                        'lotus','penetration_closeup','spread_pussy'].includes(shotKey);
    const [w, h]     = isPortrait ? [768, 1024] : [1024, 768];
    const loras      = SHOT_LORAS[shotKey] ?? [];
    const phase      = PHASE_MAP[shotKey] ?? 0;
    const meta       = SHOT_META[shotKey];

    for (let i = 1; i <= count; i++) {
      const imgPath  = path.join(shotDir, `${String(i).padStart(3,'0')}.png`);
      const jsonPath = path.join(shotDir, `${String(i).padStart(3,'0')}.json`);

      if (fs.existsSync(imgPath) && !forceRegen) { process.stdout.write(`.`); skipped++; continue; }

      const variant  = variants[(i - 1) % variants.length];
      const exprList = shotKey === 'portrait' ? PORTRAIT_EXPR :
                       shotKey === 'medium'   ? MEDIUM_EXPR :
                       (PHASE_EXPR[phase] ?? PHASE_EXPR[0]);
      const exprRaw  = exprList[(i - 1) % exprList.length];
      // 加权重确保表情词优先于 charBase 里的 expressionless 固定词
      const exprMod  = `(${exprRaw}:1.3)`;
      // portrait/medium 表情是主要内容，放在最前；其他镜头放在 charBase 之后 outfit 之前
      const isPortraitShot = shotKey === 'portrait' || shotKey === 'medium';
      const negExtra = [
        SHOT_NEGATIVE_EXTRA[shotKey] ?? '',
        isPortraitShot ? '' : EXPRESSION_NEGATIVE,
      ].filter(Boolean).join(', ');
      const prompt  = isPortraitShot
        ? [exprMod, charBase, faceAnchor, shotConfig.outfit, variant.prompt,
           MALE_PRESENCE[shotKey] ?? '', shotConfig.scene, shotConfig.mood,
           ...(shotConfig.extra ? [shotConfig.extra] : [])].filter(Boolean).join(', ')
        : [charBase, exprMod, faceAnchor, shotConfig.outfit, variant.prompt,
           MALE_PRESENCE[shotKey] ?? '', shotConfig.scene, shotConfig.mood,
           ...(shotConfig.extra ? [shotConfig.extra] : [])].filter(Boolean).join(', ');

      try {
        const seed     = Math.floor(Math.random() * 2 ** 32);
        const workflow = buildWorkflow(prompt, seed, loras, w, h, negExtra);
        const promptId = await queuePrompt(workflow);
        const filename = await waitForImage(promptId);
        await downloadImage(filename, imgPath);

        fs.writeFileSync(jsonPath, JSON.stringify({
          character:   characterName,
          shotKey,
          category:    meta?.category ?? '',
          label,
          description: meta?.description ?? '',
          variantNote: variant.note,
          tags:        meta?.tags ?? [],
          bodyFocus:   meta?.bodyFocus ?? '',
          viewAngle:   meta?.viewAngle ?? '',
          index:       i,
          intimacyPhase: phase,
          batch:       2,
          model:       MODEL,
          width:       w,
          height:      h,
          prompt,
          seed,
        }, null, 2));

        process.stdout.write(`✓`);
        generated++;
      } catch (err: any) {
        process.stdout.write(`✗`);
        console.error(`\n  ❌ ${shotKey}/${i}: ${err.message}`);
      }
    }
    console.log(` (${count}张)`);
  }

  console.log(`\n✅ ${characterName} Batch2 完成 — 生成 ${generated} 张，跳过 ${skipped} 张`);
}

async function main() {
  const args    = process.argv.slice(2);
  const charArg = args.find(a => !a.startsWith('--'));
  const fromArg = args.find(a => a.startsWith('--from='))?.split('=')[1];
  const force   = args.includes('--force');
  const all     = args.includes('--all');

  const targets = all || charArg === 'all' || !charArg ? ANIME_CHARS : [charArg];

  console.log(`🚀 Batch2 动漫图库生成`);
  console.log(`   输出目录: ${LIBRARY_DIR}`);
  console.log(`   目标角色: ${targets.join(', ')}`);
  const totalPlanned = Object.values(SHOT_COUNT).reduce((a, b) => a + (b ?? 0), 0);
  console.log(`   每角色计划: ${totalPlanned} 张 (${BATCH2_SHOTS.length} 种新 shotKey: ${BATCH2_SHOTS.join(', ')})`);

  for (const char of targets) {
    if (!ANIME_CHARS.includes(char)) { console.error(`❌ 未知角色: ${char}`); continue; }
    await generateForCharacter(char, fromArg, force);
  }

  await prisma.$disconnect();
  console.log('\n🎉 全部完成！');
  console.log(`\n上传命令：`);
  console.log(`  scp -r D:\\SD\\siyuwanban\\library\\anime2\\* root@168.144.108.9:/var/www/siyuwanban/images/library/anime2/`);
}

main().catch(err => { console.error(err); process.exit(1); });
