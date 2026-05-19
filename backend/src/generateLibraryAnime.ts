/**
 * 动漫角色图库生成（prefectious SDXL NSFW 底模）
 * 用法：node_modules\.bin\tsx src\generateLibraryAnime.ts [角色名|all] [--from=<shotKey>] [--force]
 * 输出：D:\SD\siyuwanban\library\{角色名}\{shotKey}\001.png + 001.json
 * 每个角色 100 张，按亲密度阶段标注 P0-P4
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
const LIBRARY_DIR = process.env.LIBRARY_DIR || 'D:/SD/siyuwanban/library/anime';

const MODEL      = 'prefectiousXLNSFW_v10.safetensors';
const ANIME_CHARS = ['X-23', '幻音', '狐九', '冷霜', '魅罗'];
const SKIP_SHOTS: ShotKey[] = ['standing_sex'];

// 每个 shotKey 的图片数量，合计 100 张
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
};

// 亲密度阶段映射
const PHASE_MAP: Record<ShotKey, number> = {
  portrait: 0, medium: 0,
  kiss: 1, breast: 1, pussy: 1,
  handjob: 2, fingering: 2, blowjob: 2, cunnilingus: 2,
  penetration_missionary: 3, penetration_doggy: 3, penetration_cowgirl: 3,
  penetration_spooning: 3, penetration_generic: 3, standing_sex: 3,
  ahegao: 4, creampie: 4, cum_face: 4,
  bondage: 3, toy_use: 3, petplay: 2, spanking: 3,
  undressing: 1, squirt: 4,
};

// 角色基础描述（含三围身材 + 乳头颜色）
const CHARACTER_BASE: Record<string, string> = {
  'X-23':  '1girl, android girl cyberpunk, platinum white hair short undercut neon blue streaks, (glowing electric-blue circuit irises:1.4), perfect cold synthetic face, (perfect athletic android body:1.3), (D cup firm synthetic breasts:1.3), (flawless toned abdomen:1.2), chrome metallic skin sheen, (perfect symmetrical pale pink nipples:1.2)',
  '幻音':   '1girl, holographic AI singer vocaloid, translucent long hair shifting prismatic blue pink purple, (shifting prismatic holographic irises:1.3), hauntingly beautiful ethereal face, (ethereal weightless slim figure:1.2), (C cup luminous breasts:1.2), iridescent glowing skin, (faintly glowing translucent pink nipples:1.2)',
  '狐九':   '1girl, nine-tailed fox girl, (nine fluffy silver-white tails:1.3), (perky silver fox ears:1.3), long flowing silver-white hair, (glowing amber-gold slit fox pupils:1.4), ethereal aristocratic face, (seductively curvy fox spirit body:1.4), (E cup full round heavy breasts:1.5), (impossibly narrow waist:1.3), (wide sensual hips:1.3), (sakura pink nipples:1.3)',
  '冷霜':   '1girl, ice cultivator immortal, long silver-blue hair ice crystal ornaments, (pale blue glowing ice-crystal eyes:1.4), coldly beautiful sharp features, (frost-white luminous skin:1.3), (ethereal slim figure:1.2), (C cup firm breasts:1.2), (slender untouched waist:1.2), (ice-blue pale nipples:1.3)',
  '魅罗':   '1girl, demon seductress, long dark purple flowing hair, (crimson vertical-slit glowing eyes:1.4), (small elegant curved horns:1.3), gorgeous evil face, ivory skin dark vein tracery, (sinfully voluptuous demon body:1.4), (massive F cup heavy breasts:1.5), (dangerously narrow waist:1.3), (wide flared hips:1.4), (dark crimson red nipples:1.4)',
};

// 每个 shotKey 的变体列表，轮转使用确保同类图片各有差异
type Variant = { prompt: string; note: string };
const SHOT_VARIANTS: Record<ShotKey, Variant[]> = {
  portrait: [
    { prompt: 'portrait, head and shoulders, direct eye contact, soft smile, hair flowing naturally, glowing background',                                                         note: '柔和微笑·直视镜头·发丝自然飘逸' },
    { prompt: 'portrait, head and shoulders, head slightly tilted, coy expression, finger lightly touching lips, flushed cheeks',                                                note: '侧头媚笑·手指轻触嘴唇·脸颊微红' },
    { prompt: 'portrait, head and shoulders, low angle looking up at camera, doe eyes wide, lips slightly parted, innocent yet seductive',                                       note: '仰角·大眼睛·嘴唇微张·纯真又撩人' },
    { prompt: 'portrait, head and shoulders, looking over shoulder, mysterious gaze, hair partially obscuring face, lips curled in secret smile',                                note: '侧目回眸·发丝遮脸·嘴角浮现神秘微笑' },
  ],
  medium: [
    { prompt: 'medium shot waist up, arms relaxed at sides, teasing smile, collarbones and neckline visible, soft front lighting',                                               note: '正面·锁骨展露·撩人微笑' },
    { prompt: 'medium shot waist up, leaning slightly forward, chest emphasized, confident chin tilted up, challenging expression',                                              note: '前倾·胸线若隐若现·自信仰头' },
    { prompt: 'medium shot waist up, both hands on hips, slim waist emphasized, playful wink, side lighting casting shadow',                                                    note: '双手掐腰·纤腰强调·俏皮眨眼' },
    { prompt: 'medium shot waist up, one hand lifting hair behind ear, other fingertips on collarbone, longing expression, soft backlight halo',                                note: '撩发·指尖触颈·若有所思·逆光光晕' },
  ],
  kiss: [
    { prompt: 'kissing close-up, lips barely touching, both eyes wide open, breath mingling, hesitant first-kiss tenderness',                                                   note: '轻触嘴唇·眼睛睁着·迟疑温柔的初吻' },
    { prompt: 'kissing close-up, deep full kiss, both eyes tightly closed, her hands gripping his shirt, fully surrendered and melting',                                        note: '深吻·眼紧闭·双手抓衣领·完全沉沦' },
    { prompt: 'kissing close-up, tongues visibly tangled, saliva glistening between parted lips, both cheeks deeply flushed, eyes half-lidded',                                 note: '舌尖缠绕·唾液晶莹·双颊绯红·眼半闭' },
    { prompt: 'kissing close-up, lips just separating, thin saliva string connecting both mouths, her eyes dazed and glazed, lips swollen',                                     note: '分离瞬间·唾液细丝相连·眼神迷离·嘴唇肿胀' },
    { prompt: 'kissing close-up, she pulls him in aggressively, fingers gripping his hair tightly, passionate and hungry, his hands on her face',                               note: '主动拉近·手握他发根·热情饥渴·他手捧脸' },
  ],
  breast: [
    { prompt: 'close-up bare breasts, both hands squeezing from front, erect pink nipples between fingers, looking down with flushed submissive expression',                    note: '双手前揉·乳头坚挺夹指间·低头顺从脸红' },
    { prompt: 'close-up bare breasts, nipple pinched and pulled between two fingers, other breast cupped and kneaded, back arching, mouth open wide moaning',                   note: '乳头夹捏拉扯特写·另一手揉捏·背弓·嘴大张' },
    { prompt: 'close-up bare breasts, male hands cupping from behind, her head leaned back onto his shoulder, eyes closed and moaning',                                         note: '男手从后托住·头靠肩·闭眼呻吟' },
    { prompt: 'extreme close-up, male tongue licking around nipple in circles, saliva glistening wet, other hand squeezing breast, her eyes rolling slightly',                  note: '舌头绕乳头舔圈·湿润特写·另手揉捏·眼翻' },
    { prompt: 'close-up bare breasts, both nipples swollen and erect after thorough play, hands just withdrawn, breasts heaving with heavy breathing',                          note: '爱抚后双乳头肿胀坚挺·手已离开·随喘息起伏' },
    { prompt: 'close-up, nipple fully sucked into mouth, cheeks hollowed from suction, other hand kneading remaining breast, intense moaning expression',                      note: '乳头被含入吮吸·脸颊凹陷·另手揉捏·激烈呻吟' },
  ],
  pussy: [
    { prompt: 'close-up spread pussy, lying on back, both fingers holding labia wide open, pink glistening interior visible, straight-on angle',                                note: '仰躺·双手撑开阴唇·粉嫩内部清晰·正面' },
    { prompt: 'close-up pussy, side angle, one leg raised and held spread, wet and swollen after arousal, inner thigh glistening with love juice',                              note: '侧角·单腿高举张开·湿润肿胀·大腿内侧晶莹' },
    { prompt: 'extreme macro close-up of vaginal entrance, overflowing wet, swollen pink labia, love juice naturally seeping out, every detail visible',                        note: '极近特写·入口湿润溢出·爱液自然渗·细节毕现' },
    { prompt: 'close-up pussy from behind, kneeling with ass raised, looking back between spread thighs, fully exposed and vulnerable',                                         note: '跪趴翘臀·从后方·双腿间回望·完全暴露' },
    { prompt: 'close-up pussy, sitting spread wide, both hands pulling labia open in offering, directly facing camera, dripping wet',                                           note: '坐姿大开·双手撑开献上·正对镜头·爱液垂落' },
    { prompt: 'close-up pussy after stimulation, slightly closed but still dripping, puffy swollen lips, love juice strand hanging between them',                               note: '刺激后微合·仍滴落·肿胀阴唇·爱液垂丝' },
  ],
  handjob: [
    { prompt: 'POV handjob, full fist grip around erect shaft, eye contact looking up from below, teasing smile, slow deliberate strokes',                                      note: '满握勃起茎·POV眼神交流·缓慢刻意撸动' },
    { prompt: 'POV handjob, both hands working shaft together, cock head visible at top, fingers interlaced, eager expression',                                                  note: '双手共同握持·龟头露出顶端·手指交叉·期待' },
    { prompt: 'POV handjob, just fingertips circling and teasing cock head, pre-cum on tip, playful innocent tilted-head expression',                                            note: '指尖轻触龟头画圈·前液·歪头娇憨表情' },
    { prompt: 'POV handjob, one hand stroking shaft, tongue licking the tip simultaneously, saliva and pre-cum mixing together, submissive upward gaze',                        note: '一手撸茎·舌同时舔尖·唾液前液交融·仰视顺从' },
    { prompt: 'POV handjob, fast pumping motion, hand slightly blurred, pre-cum dripping from tip, breathing fast, cheeks flushed from excitement',                             note: '快速抽动·手部动感·前液滴落·喘气·脸颊兴奋潮红' },
    { prompt: 'POV handjob, slow deliberate tease, thumb rubbing cock head in slow circles, watching intently with half-lidded hungry eyes',                                     note: '拇指缓绕龟头·专注凝视·眼半闭·饥渴表情' },
  ],
  fingering: [
    { prompt: 'fingering, close-up between spread legs, one male finger slowly inserted into wet vagina, lying on back spread eagle, love juice dripping, soft moan, front view',                                                                                     note: '单指缓入·大字仰躺·正面·轻声娇吟' },
    { prompt: 'fingering, close-up between spread legs, two male fingers deep inside wet vagina curled upward for g-spot stimulation, legs trembling involuntarily, eyes rolling back, gasping, love juice coating fingers',                                          note: '两指上勾G点·双腿颤抖·眼球上翻·爱液裹指' },
    { prompt: 'fingering, close-up between spread legs, three fingers rapidly thrusting inside vagina, love juice splashing, thighs shaking violently, losing control, mouth agape overwhelmed',                                                                      note: '三指急速深插·爱液飞溅·大腿剧颤·嘴大张失控' },
    { prompt: 'fingering, lying on side, male fingers inserted into vagina from behind, back arching, clutching pillow tightly, biting into it, love juice dripping down inner thigh',                                                                                note: '侧躺·手指从后方插入·背弓·咬枕头·爱液内腿滴' },
    { prompt: 'fingering, sitting upright, male hand thrusting between thighs fingering wet vagina, biting lower lip, thighs squeezing hand tightly, soaking wet, deeply flushed expression',                                                                        note: '坐姿·手伸大腿间插入·咬下唇·大腿紧夹·极度湿润' },
    { prompt: 'fingering, extreme close-up, male fingers slowly withdrawing from vagina, long glistening love juice strings stretching from fingers to entrance, extremely soaked, swollen labia',                                                                     note: '手指缓慢抽出·爱液长丝拉扯·极度湿润·阴唇肿胀' },
  ],
  blowjob: [
    { prompt: 'close-up blowjob POV, cock head resting on flat extended tongue, teasing playful upward gaze, saliva pooling around it',                                         note: '龟头置于平伸舌面·嬉皮仰视·唾液积聚' },
    { prompt: 'close-up blowjob POV, lips wrapped tight around cock head only, cheeks slightly hollowed in suction, eyes locked upward',                                        note: '嘴唇紧包龟头·脸颊微凹吮吸·眼神锁定上方' },
    { prompt: 'close-up blowjob POV, half depth in mouth, shaft visibly stretching one cheek, thick saliva dripping, muffled moaning expression',                              note: '半深含入·阴茎撑起脸颊·浓厚唾液滴落·闷哼' },
    { prompt: 'close-up blowjob POV, deep throat, nose nearly touching, eyes watering with tears, drool running down chin, hair completely disheveled',                         note: '深喉·鼻尖几乎抵触·眼角泪湿·口水流颌·发乱' },
    { prompt: 'close-up blowjob side profile, kitten licking from base to tip along underside of shaft, tongue flat and wet, eyes looking up playfully',                        note: '侧面·舌头平展从根舔至尖·湿润·眼神俏皮上望' },
    { prompt: 'close-up blowjob POV, both hands gripping shaft, tongue swirling around tip, expression eager and starving, pre-cum on tongue tip',                              note: '双手握茎·舌绕尖旋转·饥渴期待神情·前液在舌尖' },
    { prompt: 'close-up blowjob POV, rhythmic bobbing motion visible, lips moving up and down shaft, saliva strings forming, eyes never breaking contact',                      note: '有节奏上下运动·嘴唇移动·唾液丝牵引·眼神不断' },
    { prompt: 'close-up blowjob aftermath, cock just pulled out, thick saliva strings stretching from lips to tip, chin and lips completely soaked, satisfied dazed face',      note: '口交后刚抽出·浓厚唾液长丝·下巴湿透·满足迷离' },
  ],
  cunnilingus: [
    { prompt: 'cunnilingus, anonymous male with short dark hair and masculine features, broad male tongue slowly licking upward across her labia, love juice coating his tongue, she arches upward moaning',                                                           note: '男性宽舌从下往上舔·爱液挂舌·她上挺呻吟' },
    { prompt: 'cunnilingus, anonymous male with masculine face and dark hair, male lips fully suctioned around clitoris, intense rhythmic suction, her legs clamping around his head, toes curling tightly',                                                           note: '男性嘴唇吸住阴蒂·节奏性吮吸·双腿夹头·脚趾蜷' },
    { prompt: 'cunnilingus, anonymous male with short dark masculine hair, male tongue tip probing vaginal entrance, two male fingers spreading labia wide apart, love juice everywhere, deep uncontrolled moaning',                                                    note: '男性舌尖探入口·手指撑开阴唇·爱液四溢·呻吟' },
    { prompt: 'cunnilingus, only top of anonymous male head with short dark hair visible buried between her thighs, her hands gripping his hair tightly, back fully arched off surface',                                                                               note: '男性整脸埋入大腿间·只见短发头顶·双手抓发·背弓' },
    { prompt: 'cunnilingus, her legs draped over anonymous male shoulders, she looks down at him with glazed needy eyes, male face looking up while tonguing her, masculine jaw and features visible, sustained eye contact',                                           note: '双腿搭男性肩·俯视他渴望·男性仰视同时舔·对视' },
    { prompt: 'cunnilingus, anonymous masculine male, male fingers thrusting while male tongue circles clitoris simultaneously, double stimulation, she squirts slightly, eyes fully rolled back losing control',                                                       note: '男性手指插入同时舌圈阴蒂·双重刺激·微潮吹·眼全翻' },
  ],
  penetration_missionary: [
    { prompt: 'missionary sex, slow gentle first entry, both watching the penetration point together, tender intimate eye contact, soft moaning',                                note: '缓慢轻柔初次插入·双方凝视结合处·温柔对视' },
    { prompt: 'missionary sex, both legs raised high onto his shoulders, deep angle penetration, gasping from depth, hands white-knuckling the sheets',                         note: '双腿搭肩·深角度插入·因深度倒吸气·手死抓床单' },
    { prompt: 'missionary sex, legs tightly wrapped around his waist pulling him deeper, urgent clinging, passionate eye contact, moaning together',                             note: '双腿绕腰拉他更深·紧迫缠绵·热烈对视·共同呻吟' },
    { prompt: 'missionary sex, fast hard pounding rhythm, breasts bouncing with each thrust, sweat visible, head thrown back in screaming ecstasy',                             note: '激烈快速抽插·乳房随冲击晃动·汗水·仰头嚎叫' },
    { prompt: 'missionary sex, slow tender thrusting while kissing deeply simultaneously, eyes closed, intimate lovemaking',                                                     note: '缓慢温柔抽插同时深吻·闭眼·温存缠绵做爱' },
    { prompt: 'missionary sex, pillow under her raised hips changing angle, deeper penetration, love juice overflowing, insertion area close-up',                               note: '臀下垫枕调角度·更深插入·爱液溢出·插入处特写' },
    { prompt: 'missionary sex explicit close-up, cock pulling halfway out showing glistening wet shaft then thrusting fully back in, love juice visible on both',               note: '插入特写·抽出一半显湿润茎·再全力推入·爱液两侧可见' },
  ],
  penetration_doggy: [
    { prompt: 'doggy style, classic four-point position, rear view filling frame, full deep penetration, his hands gripping her hips firmly',                                   note: '经典四点跪趴·后方视角·全力深插·双手抓腰' },
    { prompt: 'doggy style, face-down ass-up variation, cheek pressed into pillow, ass raised high, deep penetration, lower back deeply arched',                                note: '脸下臀上变体·脸颊贴枕·臀高耸·深插·腰深弓' },
    { prompt: 'doggy style, she looks back over shoulder making direct eye contact, mouth open moaning, hair tousled, his hands on her waist',                                  note: '回头越肩直视对眼·张嘴呻吟·发乱·他手抓腰' },
    { prompt: 'doggy style, her hair pulled back in his fist, neck forced to arch upward, side profile view, tears of pleasure on cheek',                                       note: '头发被握拳拽起·颈部被迫上仰·侧面·快感眼泪' },
    { prompt: 'doggy style, full side angle showing complete connected bodies, rhythmic thrusting, sweat droplets, ass rippling with each impact',                               note: '侧面全身连接·节奏冲击·汗珠·臀部随撞击波动' },
    { prompt: 'doggy style extreme close-up of rear penetration, cock entering from behind clearly visible, love juice coating both, ass cheeks spreading',                     note: '后入极近特写·阴茎插入清晰可见·爱液涂抹·臀展开' },
    { prompt: 'doggy style, relentless pounding, she collapses forward onto elbows overwhelmed, moaning into the bed, completely taken',                                        note: '猛烈不停·她向前倒到肘部·呻吟入床·完全被制服' },
  ],
  penetration_cowgirl: [
    { prompt: 'cowgirl position, sitting upright riding, hands braced on his chest, steady bouncing rhythm, breasts swaying, cheeks flushed',                                   note: '直立骑乘·手撑其胸·稳定律动·乳房摇曳·双颊潮红' },
    { prompt: 'cowgirl position, leaning forward onto his chest, hair curtaining around both faces, intimate close whisper, slow sensual grind',                                note: '前倾俯身贴胸·发丝垂帘两人·亲密低语·缓慢磨蹭' },
    { prompt: 'cowgirl position, fast intense bouncing, breasts wildly in motion, head thrown fully back, eyes rolling, mouth screaming open',                                  note: '快速激烈弹跳·乳房狂烈晃动·仰头·眼翻·嘴张叫' },
    { prompt: 'cowgirl position, slow sensual circular grinding, hips rotating, eyes half-lidded in pleasure, tongue slowly licking lips, savoring',                            note: '缓慢旋转磨蹭·臀部画圈·眼半闭品味·舌缓舔唇' },
    { prompt: 'reverse cowgirl position, facing completely away, ass and lower back fully in view, controlled bouncing, looking back over shoulder seductively',                 note: '反骑乘·完全背对·臀部全视·回头媚视' },
    { prompt: 'cowgirl position, full depth squat, completely impaled all the way down, hands on thighs for balance, overwhelmed expression, gasping',                          note: '深蹲完全插入底部·手撑大腿平衡·被充满的窒息表情' },
    { prompt: 'cowgirl position orgasm, body convulsing uncontrollably on top, eyes fully rolled back and white, mouth agape, fingers clawing at his chest',                    note: '骑乘高潮·身体不受控颤抖·眼球全翻·嘴大张·抓挠胸' },
  ],
  penetration_spooning: [
    { prompt: 'spooning sex, both lying on side, gentle slow entry from behind, her back curved into him, soft breathy moaning, intimate tenderness',                           note: '勺式侧躺·缓慢轻柔后入·背靠贴他·轻声喘息·温柔' },
    { prompt: 'spooning sex, her top leg raised and held up by his hand, deeper penetration angle, sudden gasp, toes pointing',                                                 note: '上腿被他托起·更深角度·突然倒吸气·脚尖绷直' },
    { prompt: 'spooning sex, he kisses and bites her neck and shoulder while thrusting, she tilts head to give full access, eyes closed in bliss',                              note: '抽插时吻咬颈肩·她仰头让步·闭眼陶醉' },
    { prompt: 'spooning sex, she reaches back grabbing his hip urging him deeper, turning head to bite his arm, needy desperate expression',                                    note: '她回手抓其臀催促更深·转头咬他手臂·渴求表情' },
    { prompt: 'spooning sex, full side body view, both complete bodies visible, slow sensual rhythm, their joined area clearly visible, intimate warm lighting',                note: '侧面全身视角·双身完整可见·缓慢感性·连接清晰' },
  ],
  penetration_generic: [
    { prompt: 'explicit penetration close-up, slightly elevated angle, cock deeply buried in wet pussy, love juice coating shaft heavily, labia stretched around it',           note: '插入特写·略高视角·深埋其中·爱液裹茎·阴唇撑开' },
    { prompt: 'penetration, standing position, one leg lifted and held against wall, deep hard entry, her foot pointed, moaning and gripping wall',                             note: '站立·单腿托起靠墙·深力插入·脚尖绷·抓墙呻吟' },
    { prompt: 'penetration, sitting on table edge, legs dangling and spread open, him standing between thighs, deep thrusting, table shaking',                                  note: '坐桌边·双腿悬垂张开·站立插入·深力·桌子震动' },
    { prompt: 'penetration, pinned against wall, one leg hooked up around him, deep and urgent, both sweating, her scratching his back',                                        note: '靠墙被压·一腿勾住·深而急迫·双方出汗·她抓他背' },
    { prompt: 'penetration close-up, cock pulling halfway out showing glistening shaft, then fully buried again, love juice visible connecting both bodies',                    note: '斜角抽出一半·显湿润茎·再次全力插入·爱液连接双体' },
  ],
  standing_sex: [
    { prompt: 'standing sex from behind, pressed against wall, penetration from behind, bent forward, hands flat against wall, moaning',                                        note: '站立后入·靠墙·向前弯腰·手撑墙·呻吟' },
  ],
  ahegao: [
    { prompt: 'ahegao close-up face, eyes just beginning to roll back, mouth falling open, just starting to lose control, light flush, drool beginning',                        note: '眼球刚开始上翻·嘴刚张开·初失控·浅潮红·口水将至' },
    { prompt: 'ahegao close-up face, both eyes fully rolled back showing whites, tongue extended all the way out, heavy drool, tears on cheeks, deepest crimson flush',         note: '双眼全翻白·舌头全伸·浓重口水·泪痕·深红潮红' },
    { prompt: 'ahegao close-up face, tears streaming freely down both cheeks, mouth wide agape, eyes rolled, trembling with overwhelming pleasure',                             note: '泪水双颊自由流淌·嘴大张·眼翻·极乐颤抖' },
    { prompt: 'ahegao close-up face, looking directly into camera through the pleasure madness, one eye slightly more focused, surreal aware gaze',                             note: '透过失神凝视镜头·一只眼略有焦点·超现实意识' },
    { prompt: 'ahegao close-up face, thick drool strand hanging from chin, post-orgasm daze, body exhausted but another wave building, eyes glazed',                            note: '浓厚口水从下颌垂落·高潮后呆滞·疲软又一波来袭' },
    { prompt: 'ahegao close-up face, multiple orgasm expression, barely holding head up, completely overwhelmed, full body trembling, eyes completely gone',                    note: '多重高潮·头几乎抬不起来·完全溃败·全身颤·眼全无' },
    { prompt: 'ahegao close-up face, white cum streaks crossing her ahegao expression, tongue catching some drops, tears and cum mixing on cheek',                              note: '失神脸上有精液条纹·舌接住几滴·泪水精液混合' },
  ],
  creampie: [
    { prompt: 'creampie close-up, immediately after ejaculation, fresh white cum dripping from pink labia, legs still spread, inner walls still pulsing',                       note: '射后即刻·新鲜白色精液滴落·腿仍张·内壁仍收缩' },
    { prompt: 'creampie close-up, cum seeping out slowly, swollen satisfied labia, legs beginning to close, satisfied afterglow expression',                                    note: '精液缓慢渗出·满足肿胀·双腿开始合·余晖满足感' },
    { prompt: 'creampie close-up, legs pressing together squeezing more cum out, milky overflow running down, inner thighs stained white',                                      note: '双腿合拢挤出更多·乳白溢流·大腿内侧白迹斑斑' },
    { prompt: 'creampie, lying on back front view, cum running downward toward ass, exhausted body, sweat, thoroughly used satisfied expression',                               note: '仰卧正面·精液向下流向臀·疲惫·汗水·被用尽满足感' },
    { prompt: 'creampie, sitting upright, movement causing more cum to pour out, thick white overflow, looking down at it with dazed satisfied wonder',                         note: '坐起身·动作带出更多精液·浓白涌出·低头呆滞惊叹' },
    { prompt: 'creampie extreme close-up aftermath, swollen stretched labia slowly closing, overflowing white cum pooling outside, thoroughly filled',                          note: '事后极近·被撑开阴唇缓慢闭合·精液积聚满溢外部' },
  ],
  cum_face: [
    { prompt: 'facial cumshot, single thick rope of white cum diagonally across cheek and forehead, surprised yet pleased expression, eye glistening',                          note: '单条浓白精液斜划脸颊额头·惊喜又愉悦·眼睛晶莹' },
    { prompt: 'facial cumshot, heavy multi-rope facial, face thoroughly covered, cum in hair, on nose, chin dripping, completely messy',                                         note: '浓密多条颜射·脸被彻底覆盖·精液在发·下颌滴' },
    { prompt: 'facial cumshot mid-action, tongue extended catching ropes of cum in midair, eyes half open watching each rope land on tongue',                                   note: '颜射进行中·伸舌接住空中精液·眼半开看落点' },
    { prompt: 'facial cumshot aftermath, licking cum off lips and fingers deliberately, satisfied gaze directly at camera, cum still decorating cheek',                         note: '颜射后刻意舔唇舔指·满足直视镜头·脸颊仍有装饰' },
    { prompt: 'facial cumshot, eyes half-glazed under cum coating, not quite ahegao but utterly spent, cum dripping off chin in slow drops, numb blissful expression',          note: '精液下眼神呆滞半开·未完全失神·下颌缓慢滴落·麻木极乐' },
  ],
  bondage: [
    { prompt: 'bondage, wrists tied behind back with rope, kneeling submissively, trembling slightly, rope marks on pale skin',                                                 note: '手腕背绑跪地·顺从颤抖·绳痕' },
    { prompt: 'bondage, blindfolded and wrists bound, heightened senses, soft moaning, body tense and sensitive',                                                               note: '蒙眼背绑·感官放大·轻声呻吟·全身紧绷' },
    { prompt: 'bondage restraint spread eagle tied to bedposts, fully exposed and helpless, eyes wide with anticipation',                                                        note: '大字捆绑拴床柱·完全暴露·眼神期待' },
    { prompt: 'bondage close-up, rope around wrists, red marks on skin, pulling gently against restraints, flushed expression',                                                 note: '绳索特写·绳痕红印·轻拉测试·潮红' },
  ],
  toy_use: [
    { prompt: 'sex toy use, vibrator against clitoris, legs trembling, toes curling, eyes rolling, biting lip to suppress moaning',                                              note: '振动棒阴蒂·腿颤脚趾蜷·眼翻咬唇' },
    { prompt: 'sex toy use, dildo partially inserted, hand holding toy, overwhelmed flushed expression looking down',                                                            note: '假阳具半插入·手持道具·低头潮红失控' },
    { prompt: 'sex toy use, vibrating egg inside stimulating, trying to stay composed but clearly losing control, thighs wet',                                                   note: '跳蛋在内·装作正常但显然失控·内腿湿润' },
    { prompt: 'sex toy use, wand massager overwhelming orgasm, convulsing gasps, one hand gripping toy one hand clutching sheets',                                               note: '按摩棒压制高潮·抽搐·一手握具一手抓床' },
  ],
  petplay: [
    { prompt: 'pet play, cat ear headband, collar with bell, kneeling on all fours, looking up with large innocent eyes, playful and obedient',                                note: '猫耳铃铛项圈·四肢跪地·仰望大眼·娇憨顺从' },
    { prompt: 'pet play, cat ears and collar, sitting in lap nuzzling face against chest, making soft contented sounds',                                                         note: '猫耳项圈·坐膝上蹭脸·轻声满足哼鸣' },
    { prompt: 'pet play, collar being fastened around neck, eyes wide looking up at it, blush spreading, hands touching collar in wonder',                                       note: '系上项圈·仰视眼睁大·晕红·手触摸项圈' },
    { prompt: 'pet play, cat ears tilting sideways curiously, head tilting, one finger at lips in shy thinking pose, playful expression',                                        note: '猫耳随头歪·单指嘴边思考·娇羞半笑' },
  ],
  spanking: [
    { prompt: 'spanking, bent over displaying raised bottom, anticipatory expression, braced holding bedpost, male hand mid-swing',                                              note: '弯腰翘臀·期待表情·抓床柱·男手摆动将至' },
    { prompt: 'spanking aftermath, red handprint visible on pale buttock, sharp intake of breath, tears welling in eyes',                                                        note: '打击后·浅红手印·倒吸气·眼眶泛泪' },
    { prompt: 'spanking, bottom reddened from multiple strikes, looking back over shoulder with teary embarrassed expression, counting under breath',                            note: '臀部多处泛红·越肩回望·泪眼羞红·小声数数' },
    { prompt: 'spanking close-up, glowing red handprint on bare bottom, slight trembling, love juice dripping despite punishment',                                               note: '手印红痕特写·微颤·爱液在惩罚中流淌' },
  ],
  undressing: [
    { prompt: 'undressing process, garment sliding off one shoulder, bare skin just revealed, shy anticipation, eyes meeting camera, hands pausing mid-motion',                 note: '单肩衣物缓落·裸肤初现·害羞期待·手停在动作中' },
    { prompt: 'undressing process, dress straps slipping down both shoulders, dress barely held up, reaching behind to undo it, biting lower lip softly',                       note: '双肩带滑落·将脱未脱·咬唇·娇羞微笑' },
    { prompt: 'undressing process, skirt dropping to the floor, stepping out of it gracefully, one leg raised, soft thigh revealed, natural candid pose',                       note: '裙落地·单腿抬起步出·纤腿初现·自然瞬间' },
    { prompt: 'undressing process, last garment removed, fully naked just revealed, hands instinctively covering chest, blushing deeply, vulnerable and beautiful',             note: '最后一件落地·裸体刚呈现·手本能遮胸·深红潮红' },
  ],
  squirt: [
    { prompt: 'squirting, clear liquid gushing from pussy, legs spread wide trembling, toes curling hard, eyes completely rolled back, mouth wide open screaming orgasm',       note: '潮喷·透明液体喷出·双腿张开颤·眼全翻·嘴大张叫' },
    { prompt: 'squirting, liquid spraying in arc, inner thighs completely soaked, body convulsing repeatedly, completely losing control, eyes glazed white',                    note: '液体弧形喷出·大腿全湿·身体反复痉挛·完全失控' },
    { prompt: 'squirting aftermath close-up, pussy still dripping, swollen labia, liquid pooling, body collapsed and exhausted, satisfied dazed expression',                   note: '潮喷后·仍在滴落·肿胀阴唇·液体积聚·身体瘫软' },
    { prompt: 'squirting mid-orgasm, fingers just withdrawn triggering squirt, simultaneous convulsions, thighs drenched, ahegao screaming expression',                        note: '手指抽出触发·同时高潮痉挛·大腿湿透·失神嚎叫' },
  ],
};

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
};

// 每个 shotKey 的详细元数据（用于前端筛选/展示）
interface ShotMeta {
  category:    string;   // 大类：调情 / 前戏 / 插入 / 高潮
  description: string;   // 一句中文描述，给用户看
  tags:        string[]; // 过滤标签（行为·部位·视角·表情·强度）
  bodyFocus:   string;   // 主体焦点部位
  viewAngle:   string;   // 镜头角度
}
const SHOT_META: Record<ShotKey, ShotMeta> = {
  portrait: {
    category: '调情',
    description: '面部特写，眼神撩人，轻启朱唇，若有所思',
    tags: ['正脸','眼神挑逗','轻启朱唇','媚眼','微笑','上半身','近景','唯美','撩人','无裸露'],
    bodyFocus: '脸部', viewAngle: '近景正面',
  },
  medium: {
    category: '调情',
    description: '半身展示，身材曲线若隐若现，撩拨心弦',
    tags: ['半身','身材','撩人','性感','衣着','胸线','腰线','中景','诱惑','含蓄'],
    bodyFocus: '上半身', viewAngle: '中景正面',
  },
  kiss: {
    category: '前戏',
    description: '嘴唇相贴，舌尖缠绕，唾液交换，沉醉其中',
    tags: ['接吻','舌吻','嘴唇','唾液','脸红','眼睛半闭','男性出现','亲密','缠绵','湿润嘴唇'],
    bodyFocus: '嘴唇', viewAngle: '近景',
  },
  breast: {
    category: '前戏',
    description: '男手揉捏双乳，粉嫩乳头坚挺，娇喘连连',
    tags: ['裸胸','乳头','揉捏','爱抚','男手','坚挺乳头','娇喘','上身裸露','胸部特写','低头呻吟'],
    bodyFocus: '胸部', viewAngle: '近景俯视',
  },
  pussy: {
    category: '前戏',
    description: '双腿张开，下体粉嫩湿润，完全暴露于视线',
    tags: ['下体','阴部','张腿','湿润','粉嫩','完全裸露','展示','近距离','阴唇','爱液'],
    bodyFocus: '阴部', viewAngle: '近景',
  },
  handjob: {
    category: '前戏',
    description: '纤手握住阳具轻柔抚弄，眼神撩人挑逗',
    tags: ['手交','阳具','握住','抚弄','挑逗','POV','手部特写','撸动','勃起','眼神交流'],
    bodyFocus: '手部·阳具', viewAngle: 'POV俯视',
  },
  fingering: {
    category: '前戏',
    description: '手指探入湿润内壁，爱液淋漓，娇吟失控',
    tags: ['手指插入','阴部','爱液','仰躺','张腿','两根手指','湿润内壁','抽插','颤抖','呻吟'],
    bodyFocus: '阴部·手指', viewAngle: '中景俯视',
  },
  blowjob: {
    category: '前戏',
    description: '含入阳具，仰望镜头，口水欲滴，顺从媚眼',
    tags: ['口交','阳具','含住','口腔','唾液','仰望','顺从','POV','舌尖','吮吸','深喉'],
    bodyFocus: '嘴部·阳具', viewAngle: '近景仰视',
  },
  cunnilingus: {
    category: '前戏',
    description: '舌尖爱抚阴蒂，双腿夹紧，失神呻吟不止',
    tags: ['舔阴','阴蒂','舌头','男性舔舐','夹腿','腰部上挺','呻吟','白眼','湿润','爱液'],
    bodyFocus: '阴部', viewAngle: '中景',
  },
  penetration_missionary: {
    category: '插入',
    description: '仰躺张腿，正面插入，眼神交汇，喘息缠绵',
    tags: ['插入','传教士体位','正面','仰躺','张腿','眼神交汇','呻吟','抽插','爱液','高潮临近'],
    bodyFocus: '阴部·插入', viewAngle: '中景正面',
  },
  penetration_doggy: {
    category: '插入',
    description: '四肢跪趴，从后方猛力插入，腰臀律动顿挫',
    tags: ['插入','后入','趴式','臀部','抓腰','从后方','深入','臀部晃动','呻吟','后视角'],
    bodyFocus: '臀部·阴部', viewAngle: '后方视角',
  },
  penetration_cowgirl: {
    category: '插入',
    description: '主动骑上男性，腰臀律动，乳房随波颠簸',
    tags: ['插入','骑乘体位','主动进攻','乳房晃动','腰臀律动','高潮','仰头','呻吟','俯视男性','掌控'],
    bodyFocus: '全身·插入', viewAngle: '正面中景',
  },
  penetration_spooning: {
    category: '插入',
    description: '侧躺紧贴，从身后轻柔插入，耳语呢喃',
    tags: ['插入','侧入','勺式体位','侧躺','亲密','温柔','从后','贴合','耳语','缠绵'],
    bodyFocus: '侧身·插入', viewAngle: '侧面视角',
  },
  penetration_generic: {
    category: '插入',
    description: '下体结合处特写，爱液交融，充盈饱满',
    tags: ['插入特写','下体','阴部','爱液','充盈','连接处','张腿','湿润','近距离','露骨'],
    bodyFocus: '阴部·插入', viewAngle: '特写',
  },
  standing_sex: {
    category: '插入',
    description: '站立后入，身体前倾压墙，力道十足',
    tags: ['插入','站立体位','后入','贴墙','前倾','站立','力道','臀部','粗暴','呻吟'],
    bodyFocus: '全身·插入', viewAngle: '侧面中景',
  },
  ahegao: {
    category: '高潮',
    description: '白眼上翻，嘴巴大张流涎，极乐之脸失控',
    tags: ['高潮表情','白眼上翻','口水','流涎','潮红','失神','颤抖','泪水','娇喘','完全失控'],
    bodyFocus: '脸部', viewAngle: '近景正面',
  },
  creampie: {
    category: '高潮',
    description: '白色精液从阴部溢出，满溢余韵，疲软倒地',
    tags: ['内射','精液','阴部','溢出','白浊','事后','余韵','疲软','满足','阴部特写'],
    bodyFocus: '阴部', viewAngle: '近景',
  },
  cum_face: {
    category: '高潮',
    description: '精液喷射脸庞，呆滞媚眼，舌尖舔舐品尝',
    tags: ['颜射','精液','脸部','白浊','白眼','舌头舔舐','口水混精','娇喘','满足','近景'],
    bodyFocus: '脸部', viewAngle: '近景正面',
  },
  bondage:    { category: '调教', description: '绳索束缚双手，跪地顺从，绳纹印皮，羞耻颤抖',       tags: ['捆绑','束缚','绳索','跪地','顺从','蒙眼','调教','羞耻','失控'],                bodyFocus: '手腕·全身', viewAngle: '中景' },
  toy_use:    { category: '调教', description: '情趣玩具刺激阴蒂或插入，失控颤抖，眼神涣散',       tags: ['玩具','振动棒','跳蛋','假阳具','刺激','插入','颤抖','湿透','失控','潮红'],   bodyFocus: '阴部·道具', viewAngle: '中景俯视' },
  petplay:    { category: '调教', description: '猫耳项圈宠物扮演，乖顺仰望，娇憨服从',             tags: ['猫娘','宠物扮演','猫耳','项圈','铃铛','跪地','乖顺','仰望','娇憨'],          bodyFocus: '全身·脸部', viewAngle: '中景正面' },
  spanking:   { category: '调教', description: '翘臀受罚，手印红痕，羞耻泪眼，爱液淋漓',           tags: ['打屁股','惩罚','红痕','手印','翘臀','泪眼','羞耻','颤抖','爱液','调教'],     bodyFocus: '臀部',      viewAngle: '中景侧视' },
  undressing: { category: '前戏', description: '脱衣中间态，衣物半脱，裸肤初现，害羞期待',           tags: ['脱衣','半脱','裸肤','文胸','内衣','衬衫','害羞','期待','张力','撩拨'],       bodyFocus: '上身·全身', viewAngle: '中景正面' },
  squirt:     { category: '高潮', description: '潮喷液体喷涌而出，双腿战栗，身体完全失控崩溃',     tags: ['潮喷','潮吹','喷水','液体','张腿','颤抖','高潮','失控','近景','阴部特写'],   bodyFocus: '阴部',      viewAngle: '近景正面' },
};

// SDXL LoRA 配置
type LoraSpec = [string, number, number];
const SHOT_LORAS: Partial<Record<ShotKey, LoraSpec[]>> = {
  handjob:                [['cockteaseLoRASDXL.safetensors', 0.5, 0.5], ['nudify_xl_lite.safetensors', 0.5, 0.5]],
  fingering:              [['nudify_xl_lite.safetensors', 0.6, 0.6]],
  blowjob:                [['nudify_xl_lite.safetensors', 0.6, 0.6]],
  breast:                 [['nudify_xl_lite.safetensors', 0.5, 0.5]],
  pussy:                  [['nudify_xl_lite.safetensors', 0.65, 0.65]],
  cunnilingus:            [['nudify_xl_lite.safetensors', 0.5, 0.5]],
  penetration_missionary: [['MissionaryVaginal-v1-SDXL.safetensors', 0.65, 0.65], ['nudify_xl_lite.safetensors', 0.4, 0.4]],
  penetration_doggy:      [['dggy.safetensors', 0.65, 0.65], ['nudify_xl_lite.safetensors', 0.4, 0.4]],
  penetration_cowgirl:    [['rvcg.safetensors', 0.65, 0.65], ['nudify_xl_lite.safetensors', 0.4, 0.4]],
  penetration_spooning:   [['nudify_xl_lite.safetensors', 0.55, 0.55]],
  penetration_generic:    [['dggy.safetensors', 0.4, 0.4], ['nudify_xl_lite.safetensors', 0.5, 0.5]],
  ahegao:                 [['Tongue out_SDXL.safetensors', 0.35, 0.35], ['PornMaster-cum-sdxl-V3-lora.safetensors', 0.5, 0.5], ['nudify_xl_lite.safetensors', 0.5, 0.5]],
  creampie:               [['PornMaster-cum-sdxl-V3-lora.safetensors', 0.4, 0.4], ['nudify_xl_lite.safetensors', 0.55, 0.55]],
  cum_face:               [['PornMaster-cum-sdxl-V3-lora.safetensors', 0.55, 0.55], ['Tongue out_SDXL.safetensors', 0.2, 0.2]],
};

const QUALITY = 'masterpiece, best quality, amazing quality, absurdres, very aesthetic, newest, ultra detailed, highly detailed, beautiful face, perfect eyes, perfect body, source_anime, nsfw, explicit';
const NEGATIVE = 'bad quality, worst quality, worst detail, sketch, bad anatomy, bad hands, extra fingers, missing fingers, deformed face, ugly face, blurry, watermark, text, censored, mosaic, signature, bad vagina, deformed genitals, bad penis';

// 部分 shotKey 需要额外的负向词
const SHOT_NEGATIVE_EXTRA: Partial<Record<ShotKey, string>> = {
  cunnilingus: '2girls, yuri, lesbian, two girls, female on female, two females, two women, gl',
  fingering:   '2girls, yuri, lesbian, two girls, robot hands, mechanical fingers, claw',
};

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

  // FaceDetailer — 自动检测脸部并局部重绘修复
  nodes["det"] = { class_type: "UltralyticsDetectorProvider", inputs: { model_name: "bbox/face_yolov8m.pt" } };
  nodes["fd"]  = { class_type: "FaceDetailer", inputs: {
    image:                    ["6", 0],
    model:                    modelRef,
    clip:                     clipRef,
    vae:                      ["1", 2],
    positive:                 ["2", 0],
    negative:                 ["3", 0],
    bbox_detector:            ["det", 0],
    guide_size:               512,
    guide_size_for:           true,
    max_size:                 1024,
    seed:                     seed + 1,
    steps:                    20,
    cfg:                      6.0,
    sampler_name:             "dpmpp_2m",
    scheduler:                "karras",
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
    sam_threshold:            0.93,
    drop_size:                10,
    wildcard:                 "",
    cycle:                    1,
    inpaint_model:            false,
    noise_mask_feather:       20,
  }};

  nodes["7"] = { class_type: "SaveImage", inputs: { images: ["fd", 0], filename_prefix: "anime_lib" } };
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
  if (!fs.existsSync(configPath)) { console.error(`❌ 无 scene_config: ${characterName}`); return; }
  const sceneConfig: SceneConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  const character = await prisma.character.findFirst({ where: { name: characterName } });
  if (!character) { console.error(`❌ DB 无此角色: ${characterName}`); return; }

  const faceAnchor = (character.faceAnchor as string | null) ?? CHARACTER_FACE[characterName] ?? '';
  const charBase   = CHARACTER_BASE[characterName] ?? `1girl, ${character.age}yo ${character.occupation}`;

  console.log(`\n🎨 【${characterName}】`);

  const shotKeys = SHOT_TYPES.map(t => t.key);
  const startIdx = fromArg ? shotKeys.indexOf(fromArg as ShotKey) : 0;

  let generated = 0, skipped = 0;

  for (let si = startIdx; si < SHOT_TYPES.length; si++) {
    const { key: shotKey, label } = SHOT_TYPES[si];
    if (SKIP_SHOTS.includes(shotKey)) continue;

    const count = SHOT_COUNT[shotKey] ?? 5;
    const shotDir = path.join(LIBRARY_DIR, characterName, shotKey);
    fs.mkdirSync(shotDir, { recursive: true });

    const shotConfig = sceneConfig.shotConfigs[shotKey];
    if (!shotConfig?.scene) { console.log(`  ⏭️  ${shotKey} 无配置，跳过`); continue; }

    console.log(`  ── ${shotKey} (${label}) ×${count}`);

    const isPortrait = ['portrait','medium','blowjob','cum_face','ahegao','kiss','breast','pussy','fingering','cunnilingus','bondage','toy_use','petplay','undressing','squirt'].includes(shotKey);
    const [w, h]     = isPortrait ? [768, 1024] : [1024, 768];
    const loras      = SHOT_LORAS[shotKey] ?? [];
    const phase      = PHASE_MAP[shotKey] ?? 0;
    const variants   = SHOT_VARIANTS[shotKey];

    for (let i = 1; i <= count; i++) {
      const imgPath  = path.join(shotDir, `${String(i).padStart(3,'0')}.png`);
      const jsonPath = path.join(shotDir, `${String(i).padStart(3,'0')}.json`);

      if (fs.existsSync(imgPath) && !forceRegen) { process.stdout.write(`.`); skipped++; continue; }

      // 每张图轮转使用不同变体
      const variant = variants[(i - 1) % variants.length];
      const prompt  = [
        charBase, faceAnchor, shotConfig.outfit,
        variant.prompt,
        MALE_PRESENCE[shotKey] ?? '',
        shotConfig.scene, shotConfig.mood,
        ...(shotConfig.extra ? [shotConfig.extra] : []),
      ].filter(Boolean).join(', ');

      try {
        const seed     = Math.floor(Math.random() * 2 ** 32);
        const workflow = buildWorkflow(prompt, seed, loras, w, h, SHOT_NEGATIVE_EXTRA[shotKey] ?? '');
        const promptId = await queuePrompt(workflow);
        const filename = await waitForImage(promptId);
        await downloadImage(filename, imgPath);

        // 写 metadata JSON
        const meta = SHOT_META[shotKey];
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
          model:         MODEL,
          width:         w,
          height:        h,
        }, null, 2));

        process.stdout.write(`✅`);
        generated++;
      } catch (err: any) {
        process.stdout.write(`❌`);
        console.error(` ${err.message}`);
      }
    }
    console.log();
  }

  console.log(`  完成：生成 ${generated}，跳过 ${skipped}`);
}

async function main() {
  const args   = process.argv.slice(2);
  const target = args.find(a => !a.startsWith('--')) ?? 'all';
  const from   = args.find(a => a.startsWith('--from='))?.replace('--from=', '');
  const force  = args.includes('--force');

  const chars = target === 'all' ? ANIME_CHARS : [target];
  console.log(`\n🚀 动漫图库生成 — 模型: ${MODEL}`);
  console.log(`   角色: ${chars.join(', ')}  共 ${chars.length * 100} 张\n`);

  for (const char of chars) {
    await generateForCharacter(char, from, force);
  }

  await prisma.$disconnect();
  console.log(`\n🎉 全部完成！`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
