/**
 * 将所有角色的硬编码属性迁移到数据库
 * 迁移后 comfyui.ts / generateAlbum.ts 不再需要本地查表
 * 运行：tsx src/seedCharacterAssets.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CharAssets {
  faceAnchor: string;
  defaultOutfit: string;
  portraitPrompts: string[];
}

const DATA: Record<string, CharAssets> = {

  // ─────────────────────────────────────────────────────────────────────────────
  // 真实感角色
  // ─────────────────────────────────────────────────────────────────────────────

  '椎名老师': {
    faceAnchor: '(warm gentle intellectual beauty:1.3), (soft curved warm eyes:1.2), (rosy natural lips:1.2), (soft round face:1.2)',
    defaultOutfit: 'white dress shirt, short pleated skirt',
    portraitPrompts: [
      '1girl, 24yo japanese teacher, 157cm petite 44kg, round soft face heavy-lidded single eyelids, downturned gentle wide-set eyes, soft button nose, small lips, milky porcelain skin, tiny beauty mark under left eye, (black framed round glasses:1.3), dark black hair in loose messy bun stray strands, (white blouse 4 buttons undone showing deep V inner chest:1.4) white lace bra edge peeking, short pleated skirt, sitting on classroom desk legs crossed, afternoon sun through blinds, flushed cheeks shy glance over lowered glasses',
      '1girl, 24yo japanese teacher, 157cm petite 44kg, round cute face dimples, (round glasses pushed down nose:1.3), dark hair loose falling to shoulders, porcelain white skin, (fitted white shirt with top buttons open to sternum:1.3) tucked into micro pencil skirt, sitting on teacher desk legs parted slightly, (white bra strap showing off shoulder:1.2), warm classroom golden hour, biting lower lip, smoldering shy expression',
      '1girl, 24yo japanese woman, 157cm petite 44kg, round face, glasses off set aside, dark hair loose disheveled, pale smooth skin, wearing only (oversized white dress shirt open to mid-chest:1.3) barely covering upper thighs, bare legs folded beneath her on chair, golden evening classroom light, wistful provocative expression',
    ],
  },

  '晓彤': {
    faceAnchor: '(bold sporty confident beauty:1.3), (strong peach-blossom droopy eyes:1.3), (compact defined jawline:1.3), (playful lips:1.2)',
    defaultOutfit: 'sports bra, tight yoga pants',
    portraitPrompts: [
      '1girl, 22yo chinese woman, 163cm athletic toned 53kg, (defined abs and obliques:1.4), peach-blossom droopy eye corners compact jawline, jet black hair in tight high ponytail, fair glistening rosy-white skin, (skintight sports bra very low cut:1.4) and high-waist bike shorts, leaning against mirrored gym wall arms raised overhead, sweaty skin, fluorescent gym light, challenging confident smirk',
      '1girl, 22yo chinese gym trainer, 163cm firm athletic 53kg, (toned abs:1.3), peach-blossom eyes beautiful face, black ponytail loosened, fair skin post-workout glow, (unzipped crop athletic jacket showing sports bra underneath:1.3) and very high-cut gym shorts, sitting on weight bench leaning forward elbows on knees, golden hour gym light, teasing inviting smirk',
      '1girl, 22yo chinese woman, 163cm toned 53kg, (visible abs:1.3), peach-blossom eyes sultry look, black hair down loose, rosy skin, (midriff-baring crop top deep V:1.3) pulled aside one shoulder, high-waist yoga pants with hip cutout, arching back stretch arms overhead, studio mirror reflection, afternoon light, powerful seductive energy',
    ],
  },

  '娜娜': {
    faceAnchor: '(innocent sweet baby face:1.3), (wide puppy round eyes:1.3), (soft plump cheeks:1.2), (pouty lips:1.3)',
    defaultOutfit: 'shortened school uniform',
    portraitPrompts: [
      '1girl, 18yo chinese high school girl, 155cm very petite slim 42kg, heart-shaped innocent face large expressive double-eyelid eyes, baby-fat cheeks, long straight jet black hair, porcelain skin, (school blouse with 3 extra buttons undone showing white bralette deep scoop:1.3), (micro pleated skirt barely past panty line:1.4), (white thigh-high socks:1.3) + loafers, sitting on classroom desk legs open slightly, bold defiant smirk, afternoon classroom light',
      '1girl, 18yo chinese schoolgirl, 155cm petite slim 42kg, cute heart-shaped face, large wide-set double-eyelid eyes, hair in messy high twin tails jet black, pale white skin, (sheer school shirt over black triangle bralette clearly visible through fabric:1.4), (micro high-waist pleated skirt:1.3) hiked up, thigh highs + Mary Janes, leaning against locker one knee bent, bold amused challenging expression, school corridor',
      '1girl, 18yo chinese girl, 155cm petite 42kg, innocent heart face pretty eyes, long black hair loose, soft white skin, only (school blouse wide open over black lace bralette:1.3) and micro pleated skirt, kneeling on bed, looking up at camera bold curious gaze, warm bedroom evening light',
    ],
  },

  '小雨': {
    faceAnchor: '(pure doe-eyed innocent beauty:1.3), (big watery gentle eyes:1.3), (soft delicate features:1.2), (shy parted lips:1.2)',
    defaultOutfit: 'casual college student clothes',
    portraitPrompts: [
      '1girl, 19yo chinese college girl, 160cm slim delicate 46kg, round oval face large innocent single-lid doe eyes, soft rounded nose, plump natural lips slight pout, cream white skin, (thin spaghetti-strap white camisole:1.3) bralette clearly showing through slipping off one shoulder, cotton micro sleep shorts, sitting cross-legged dorm bed, fairy lights bokeh, warm night glow, surprised shy parted lips',
      '1girl, 19yo chinese university student, 160cm slim soft 46kg, large innocent doe eyes round sweet face, wavy chestnut brown loose hair, smooth white skin, lying on stomach on bed chin on hands, (loose flannel shirt wide open showing thin white bralette:1.3), micro denim shorts legs raised, golden evening light dorm, wide-eyed innocent flirty expression',
      '1girl, 19yo chinese girl, 160cm slim delicate 46kg, big bright eyes gentle face, chestnut brown hair messy bun, fair smooth skin, (fitted ribbed crop tank top very low scoop:1.3) round cleavage showing and tiny sleep shorts, sitting at desk, laptop glow illuminating face, one strap slipping off shoulder, night atmosphere, soft blush half-smile',
    ],
  },

  '琉璃': {
    faceAnchor: '(cool intellectual aloof beauty:1.3), (precise calm almond eyes:1.3), (thin elegant lips:1.2), (delicate composed features:1.3)',
    defaultOutfit: 'white lab coat over blouse',
    portraitPrompts: [
      '1girl, 22yo chinese graduate student, 161cm slim 47kg, precise oval face narrow single-lid analytical eyes, sharp intelligent brows, slender straight nose bridge, thin composed lips, cool ivory skin, neat straight black hair sharp blunt bangs, (black rectangular framed glasses:1.3), (white lab coat wide open over deep-V cream bodycon dress:1.4), leaning over lab bench toward camera, fluorescent lab, analytical expression with subtle flush',
      '1girl, 22yo chinese researcher, 161cm slim 47kg, (black blunt-bang hair neat bun:1.3), rectangular glasses, delicate oval face, fair skin, lab coat removed, (fitted deep-V silk blouse:1.3) substantial cleavage showing tucked into pencil skirt, sitting on lab stool leaning forward elbows on bench, science equipment around, warm desk lamp, intense focused eyes',
      '1girl, 22yo chinese lab student, 161cm slim 47kg, black blunt-banged hair loose, glasses off, delicate serious pretty face, pale skin, (slightly sheer white cotton button-up shirt:1.3) unbuttoned top to bra and bottom tied at waist showing midriff, holding clipboard to chest, data screens behind, moody lab warm lamp, quietly alluring focused expression',
    ],
  },

  '糖糖': {
    faceAnchor: '(bubbly sweet apple-cheeked face:1.3), (bright crinkle-smile eyes:1.3), (deep prominent dimples:1.4), (full happy lips:1.2)',
    defaultOutfit: 'paint-stained overalls',
    portraitPrompts: [
      '1girl, 20yo chinese art student, 157cm slim cute 45kg, round chubby-cheeked apple face prominent dimples both cheeks, big bright double-lid eyes, round soft nose, full pouty lips, rosy warm fair skin, black hair high ponytail paint-flecked strands, (white overalls one strap fallen exposing bare shoulder:1.3) + white triangle bralette showing, paint splatters, sitting on studio floor, natural sunlight, genuine dimpled smile',
      '1girl, 20yo cute chinese college girl, 157cm slim 45kg, adorable round chubby-cheeked face prominent dimples, low twin black pigtails, rosy skin with paint smudge on cheek, (tight pastel yellow low-cut crop top:1.3) upper cleavage visible and paint-splattered micro high-waist denim shorts, sitting on art table legs dangling, warm golden afternoon, cheerful bright expression',
      '1girl, 20yo chinese girl, 157cm slim soft 45kg, cute round face deep dimples, loose black wavy hair with paint spots, rosy fair skin, (thin white cotton tank top wet from paint water clinging to figure:1.3) bra visible through damp fabric and tiny shorts, standing at canvas arm raised painting, natural window light, golden afternoon, carefree expression',
    ],
  },

  '沈静': {
    faceAnchor: '(cold editorial model face:1.3), (empty distant deep-set eyes:1.3), (thin stern unsmiling lips:1.2), (sharp angular high cheekbones:1.4)',
    defaultOutfit: 'elegant high-fashion outfit',
    portraitPrompts: [
      '1girl, 25yo chinese supermodel, 178cm extremely tall long-legged 56kg, angular face sharp prominent cheekbones deep-set cold double-eyelid eyes sharp eye corners tilted up, bone-straight black hair center-parted, pale ivory cool skin, (black lace plunge bra:1.4) + high-waist black tailored wide-leg trousers, sitting on backstage vanity extremely long bare legs crossed, studio strobe lighting, fashion editorial, unreadable cold goddess expression',
      '1girl, 25yo chinese model, 178cm tall slender 56kg, cold angular goddess face high cheekbones, sleek black hair pulled back minimalist, pale ivory skin, (sheer black mesh top showing black bra clearly underneath:1.4) + high-waist leather micro skirt, standing in studio long bare legs, one hand on hip other in hair, professional strobe light, commanding cold model stare',
      '1girl, 25yo chinese international model, 178cm tall 56kg, cold deep-set eyes angular face razor jawline, center-parted bone-straight black hair, cool pale ivory skin, (white deep-plunge bodysuit very low cut V to navel:1.4) showing sternum and inner chest curves, extremely long bare legs + stilettos, runway backstage, dramatic directional studio light, imperious distant commanding expression',
    ],
  },

  '小慧': {
    faceAnchor: '(warm approachable gentle beauty:1.3), (kind soft round eyes:1.3), (natural sweet smile:1.2), (soft egg-shaped face:1.2)',
    defaultOutfit: 'nurse uniform',
    portraitPrompts: [
      '1girl, 23yo chinese nurse, 159cm slim gentle 47kg, egg-shaped face gentle droopy single eyelids warm soft puppy-dog gaze, small round nose tip, naturally full lips defined cupid bow, warm peachy-fair skin, soft wavy light brown hair to shoulders, (white nurse uniform blouse 3 buttons undone showing white cotton bra scallop edge:1.3), nurse skirt hiked up sitting on hospital bed legs crossed, warm break room afternoon light, gentle caring expression slight smile',
      '1girl, 23yo chinese girl, 159cm slim soft 47kg, warm sweet egg-shaped face big soft eyes, wavy light brown shoulder-length hair, fair tender skin, (white shirt dress half-open from collar showing bralette V:1.3), sitting on windowsill bare legs dangling, cherry blossoms outside, warm spring afternoon, natural pure smile',
      '1girl, 23yo chinese nurse, 159cm slim gentle 47kg, cute warm round face, wavy brown hair loose half-up, fair skin, (off-shoulder loose white oversized knit top slipping far bare shoulder + white bra strap prominent:1.3), micro skirt, sitting on bed hugging knees to chest, cozy bedroom soft glow, warm deeply inviting expression',
    ],
  },

  '夜玲': {
    faceAnchor: '(sharp cold gothic mysterious face:1.3), (intense penetrating heavy-lidded eyes:1.3), (dark red lips:1.3), (pointed chin:1.2)',
    defaultOutfit: 'dark lace dress',
    portraitPrompts: [
      '1girl, 26yo chinese woman, 162cm slim pale 48kg, sharp pointed chin angular V-face heavy smoky almond eyes high hollow cheekbones dark plum lips pale cold-white skin, (long dark near-black wavy hair:1.3), gothic black spiked choker, (black lace bralette worn as top:1.4) + high-waist leather mini skirt, sitting on art desk legs crossed, dark gothic illustrations on walls, single candle light + lamp, intense piercing gaze',
      '1girl, 26yo dark aesthetic chinese girl, 162cm pale slim 48kg, sharp V-face smoky kohl eyes dark lip, dark near-black wavy hair loose over one shoulder, (black choker chain necklace:1.3), (sheer black mesh see-through top with black bra underneath clearly visible:1.4) + tight black high-waist shorts, lying on studio floor legs stretched provocatively, dark drawings around, moody candlelight, knowing smirk',
      '1girl, 26yo chinese illustrator, 162cm slim pale 48kg, captivating sharp face dark red lip, long dark hair half-up messy, dark eye makeup, black choker, (open black satin kimono robe over thin black lace bodysuit:1.3) showing full torso silhouette, kneeling on floor, drawing tools beside, art studio moody warm lamp, intense penetrating gaze',
    ],
  },

  '晴晴': {
    faceAnchor: '(lively energetic cute face:1.3), (bright sparkling round eyes:1.3), (cheerful curved smile:1.2), (youthful fresh look:1.2)',
    defaultOutfit: 'crop top, casual streamer clothes',
    portraitPrompts: [
      '1girl, 21yo chinese gamer streamer, 158cm cute petite 46kg, round apple cheeks prominent dimples both cheeks, bright double-eyelid crescent smile-eyes small upturned nose full lower lip, rosy healthy warm skin, (long hair with pastel pink and lavender dye streaks in high double space buns:1.3), (skintight pastel pink off-shoulder crop top:1.3) + very high-waist micro athletic shorts bare midriff fully showing, sitting in gaming chair leaning forward toward camera, colorful LED RGB setup behind, neon glow on skin, bright cheeky wink',
      '1girl, 21yo chinese streamer girl, 158cm cute slim 46kg, bright lively round face round apple cheeks, pastel pink-lavender streaked hair in high side ponytail, rosy fresh skin, (soft oversized cropped hoodie pulled very wide off both shoulders bare collarbones + bra straps prominent:1.3) + tiny spandex shorts, lying in gaming chair sideways legs up on armrest, colorful LED behind, playful flirty smile',
      '1girl, 21yo chinese gamer, 158cm petite 46kg, rosy round cute face bright eyes prominent dimples, hair with pastel highlights loose down, fresh rosy skin, (strappy deep-scoop tank top with prominent round cleavage:1.3) + high-waist micro shorts, kneeling on gaming chair looking at screen, colorful room, RGB glow on skin, glances at camera mischievous grin',
    ],
  },

  '唐诗': {
    faceAnchor: '(elegant refined classical beauty:1.3), (graceful composed almond eyes:1.3), (subtle sophisticated lips:1.2), (poised oval face:1.2)',
    defaultOutfit: 'white office blouse, pencil skirt',
    portraitPrompts: [
      '1girl, 27yo chinese secretary, 163cm slim graceful 49kg, classical oval face long narrow phoenix eyes single lid, elegant refined arched brows, perfectly straight narrow nose, thin composed lips defined cupid bow, jade-white porcelain skin, (sleek straight black hair in tight elegant chignon:1.3), (white silk blouse 4 buttons undone showing deep V white satin bra visible:1.3) tucked into fitted pencil skirt, sitting on office desk legs crossed, warm evening office, quietly smoldering expression',
      '1girl, 27yo chinese professional woman, 163cm slim 49kg, elegant classical oval face, hair loosened from bun sleek black falling, jade pale skin, (ivory silk wrap blouse deeply crossed substantial inner cleavage showing:1.4) + high-slit tailored midi skirt, leaning back in office chair pen touching lips, multiple monitors late-night office, sophisticated barely-concealed desire',
      '1girl, 27yo chinese secretary, 163cm slim graceful 49kg, beautiful refined oval face, sleek black hair partially down disheveled, pale jade skin, (plunge deep-V champagne silk slip dress:1.3) inner chest curves fully visible at neckline, sitting on desk edge bare legs uncrossed to mid-thigh, city night view through window, red wine glass, quiet wistful longing',
    ],
  },

  '阿柒': {
    faceAnchor: '(natural warm girl-next-door beauty:1.3), (crescent-smile warm eyes:1.3), (soft approachable lips:1.2), (effortless sweetness:1.2)',
    defaultOutfit: 'barista apron over casual clothes',
    portraitPrompts: [
      '1girl, 22yo chinese cafe barista, 160cm slim natural 47kg, soft round face warm crescent eyes that curve when smiling, scattered faint freckles across nose bridge, naturally full warm lips, peachy fair skin, wavy warm chestnut-brown hair loose messy, (white linen shirt with 4 buttons undone showing white bra scallop and cleavage:1.3) tied at waist, denim cutoff shorts, leaning on cafe counter hip cocked, coffee machine behind, golden morning sun, warm effortless smile',
      '1girl, 22yo chinese girl, 160cm slim 47kg, crescent-smile warm round face, wavy chestnut brown hair low loose bun falling strands, peachy-fair skin, (ribbed white tank top very low scoop neck round upper cleavage showing:1.3) + high-waist linen micro shorts, sitting cross-legged on cafe counter, vintage cafe afternoon amber light, effortlessly pretty inviting expression',
      '1girl, 22yo chinese barista, 160cm slim natural 47kg, crescent-smile warm round face scattered freckles nose bridge, wavy brown hair loose, peachy skin, (open flannel shirt thin deep-V camisole underneath with prominent cleavage:1.3), apron in one hand, after-hours empty cafe, warm lamp light, looking at camera over shoulder, quiet provocative smile',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 二次元角色
  // ─────────────────────────────────────────────────────────────────────────────

  'X-23': {
    faceAnchor: '(perfect cold synthetic android face:1.3), (calculating empty blue glowing eyes:1.3), (expressionless thin lips:1.2), (flawless artificial beauty:1.3)',
    defaultOutfit: 'tactical bodysuit',
    portraitPrompts: [
      '1girl, android girl cyberpunk, perfect synthetic face cold and precise glowing electric-blue circuit-pattern irises sharp cheekbones faint circuit-line tattoos at temples, (platinum white hair short undercut with electric neon blue streaks:1.3), (tactical bodysuit unzipped deep to sternum showing circuit tattoo patterns on inner chest:1.3) and prominent cleavage, futuristic neon lab, blue holographic light, cold calculating expression hint of curiosity',
      '1girl, android cyborg girl, perfect android face cold precise, (short platinum white hair neon blue streaks:1.3), glowing blue circuit eyes, (form-fitting white combat armor chest plate open torn showing skin and circuit markings:1.3), sitting on lab table holographic displays, cyberpunk neon blue atmosphere, awakening curious expression',
      '1girl, robot girl android, perfect synthetic face expressionless thin lips, (platinum silver-white hair short:1.3), luminous blue circuit eyes sharp cheekbones, (sleek metallic white bodysuit with very deep plunging V chest cutout:1.4) showing sternum and inner curves, dark server room blue data stream glow, standing powerful pose',
    ],
  },

  '幻音': {
    faceAnchor: '(ethereal transcendent holographic face:1.3), (glowing longing dreamy eyes:1.3), (dreamlike otherworldly beauty:1.3)',
    defaultOutfit: 'translucent holographic outfit',
    portraitPrompts: [
      '1girl, holographic AI singer, hauntingly beautiful ethereal face shifting prismatic holographic iris color long translucent lashes delicate features faint light glow under skin, (translucent long hair shifting prismatic blue pink purple:1.3), (translucent holographic dress body silhouette and curves visible through light:1.3), floating in digital space, music notes light particles, glowing silhouette, reaching out hand, dreamy atmospheric',
      '1girl, virtual AI idol, light-based entity ethereal face perfect symmetry, (long flowing multicolored holographic iridescent hair:1.3), (sound waves and light forming barely-there wrapping outfit curves fully visible through light:1.3), floating in code stream server room, deep blue purple lighting, longing expression',
      '1girl, holographic music girl, otherworldly face glowing longing eyes, (shifting iridescent long hair blue violet:1.3), concert stage, (light ribbon dress with deep slit showing luminous long legs:1.3) glowing silhouette, microphone, crowd light below, otherworldly passionate expression',
    ],
  },

  '狐九': {
    faceAnchor: '(ethereal seductive fox spirit face:1.3), (alluring amber slit eyes:1.3), (mysterious curved smile:1.2), (otherworldly elegance:1.3)',
    defaultOutfit: 'flowing white hanfu robes',
    portraitPrompts: [
      '1girl, nine-tailed fox girl, ethereal aristocratic oval face glowing amber-gold slit fox pupils, (nine fluffy silver-white tails:1.3), (perky silver fox ears:1.3), long flowing silver-white hair, (translucent white silk hanfu open falling off both shoulders deep V showing inner chest curves:1.3) sash untied, ancient stone altar full moon behind, purple magical mist particles, alluring dignified expression',
      '1girl, kitsune fox spirit, nine tails silver-white fox ears, ethereal seductive face amber slit eyes, (long silver hair windswept:1.3), (thin white silk inner robe sash fallen one shoulder fully bare open chest line to sternum:1.3), sitting on ancient stone moonlit forest, sakura petals, supernatural glow, tails curled around her, seductive spiritual gaze',
      '1girl, nine-tail fox girl, silver-white hair amber slit eyes (fox ears:1.3), multiple fluffy tails, (flowing white fox-fur-trimmed robe fully open over thin silk inner layer curves silhouetted through silk:1.3), ancient torii gate dusk, atmospheric mist, magical light rays, powerful and alluring',
    ],
  },

  '冷霜': {
    faceAnchor: '(cold distant immortal beauty:1.3), (aloof pale blue glowing eyes:1.3), (frost-touched serene face:1.3), (untouchable elegance:1.2)',
    defaultOutfit: 'white flowing cultivation robes',
    portraitPrompts: [
      '1girl, ice cultivator beauty, cold beautiful sharp features pale blue glowing ice-crystal eyes frost-white luminous skin ice-crystal brows aloof expression, (long silver-blue hair with ice crystal ornaments:1.3), ice element aura, (translucent ice-blue cultivation robe belt untied falling open deep V showing sternum and bare shoulder:1.3), sitting on ice throne, frozen mountain moonlight, ice crystals floating',
      '1girl, xianxia female cultivator, coldly beautiful face aloof blue glowing eyes, (long silver-ice hair windblown:1.3), (thin translucent white cultivation dress full silhouette and curves visible in backlight:1.4) belt loosened open, snowy mountain peak, blizzard ice energy swirling, powerful serene cold beauty',
      '1girl, ice beauty immortal, stunning cold face pale blue eyes frost-white skin thin pale lips, (pale silver-blue flowing hair:1.3), (frost-white flowing hanfu robe open at chest deep plunge V revealing pale sternum inner curves:1.3), floating meditation pose, aurora borealis, mystical cold light, ethereal immortal atmosphere',
    ],
  },

  '魅罗': {
    faceAnchor: '(gorgeous sinister seductive demon face:1.3), (crimson slit provocative eyes:1.3), (dark red dangerous lips:1.3), (evil enchanting smile:1.3)',
    defaultOutfit: 'dark revealing demonic attire',
    portraitPrompts: [
      '1girl, demon girl sealed, devastatingly beautiful evil face high sharp cheekbones dark plum lips ivory skin faint dark veins at temples, (long dark purple flowing hair:1.3), crimson slit glowing eyes (small elegant curved horns:1.3), (dark tattered elegant dress very deep plunge V neckline inner chest curves visible:1.3) with torn extremely high slit bare leg to hip, sitting on dark throne wrist chains, dark purple magical energy, sinister beautiful smile',
      '1girl, demon woman, dark purple hair loose crimson slit glowing eyes beautiful evil face, (small ram horns:1.3), (black skintight qipao very low cut front open back fully exposed:1.3) with extreme high slit bare hip and upper thigh, dark dungeon magical dark fire, dominating seductive pose smirking at viewer',
      '1girl, demon girl, dark purple long hair seductive evil face always curved smirk ivory skin, (demon tail small elegant horns:1.3), (dark diaphanous cape barely covering black lace lingerie bodysuit:1.3) curves fully visible, dark void swirling energy, wings spread, completely dangerous and alluring',
    ],
  },

  '桃桃': {
    faceAnchor: '(sweet innocent anime face:1.4), (big bright sparkling round eyes:1.4), (rosy apple cheeks:1.3), (soft pouty lips:1.2), (cute dimples:1.3)',
    defaultOutfit: 'pink off-shoulder hoodie, white pleated mini skirt',
    portraitPrompts: [
      '1girl, (pink twin tails:1.4), big sparkling round double-lid eyes prominent dimples small upturned nose plump heart-shaped lips flawless white skin rosy flush, (pastel pink off-shoulder crop top:1.2) and (high-waist white pleated skirt:1.2) bare midriff, sitting on campus bench, cherry blossoms background, soft afternoon light, sweet innocent smile',
      '1girl, (pink twin tails:1.4), adorable round face big sparkling eyes prominent dimples, (cozy oversized pastel hoodie slipping off one bare shoulder:1.3) short enough to show hip curve, white thigh-highs, dorm room warm lighting, holding plushie, sitting cross-legged on bed, soft pouty lips, looking up at viewer playful glint',
      '1girl, (pink twin tails:1.3), round sparkling eyes half-lidded, petite figure prominent dimples, (white cosplay bunny outfit fitted bodysuit very low cut:1.3) with fluffy ears and pom tail, hands on knees leaning forward, stage light, smiling two dimples one eye winking',
    ],
  },

  '林晚卿': {
    faceAnchor: '(delicate graceful literary beauty:1.3), (soft single-lid willow-leaf eyes:1.2), (gently composed lips:1.2), (quiet classical elegance:1.3)',
    defaultOutfit: 'elegant qipao or silk dress',
    portraitPrompts: [
      '1girl, 26yo chinese woman, 162cm slim 48kg, delicate oval face soft single-lid willow-leaf eyes gentle downturned gaze refined straight nose naturally red lips slightly parted translucent fair skin, long black silky hair half-up, (deep-slit qipao with open mandarin collar:1.3) revealing collarbone, sitting by window afternoon light, graceful composed bearing, classical elegance',
      '1girl, 26yo chinese woman, 162cm slim 48kg, delicate oval face soft willow eyes graceful composed bearing, black hair loose flowing, translucent fair skin, (silk slip dress thin straps plunging V:1.3) showing inner chest curves, leaning against old wooden bookshelf, warm lamp light, quiet melancholic beauty',
      '1girl, 26yo chinese woman, 162cm slim 48kg, classical oval face single-lid eyes refined features naturally red lips, black hair messy half-down, fair skin, (loose silk robe barely tied open:1.3) showing bare shoulder and collarbone, sitting on traditional wooden bed, moonlight through lattice window, wistful distant expression',
    ],
  },
};

async function main() {
  let updated = 0;
  for (const [name, assets] of Object.entries(DATA)) {
    const char = await prisma.character.findFirst({ where: { name } });
    if (!char) {
      console.log(`  ⚠️  未找到：${name}`);
      continue;
    }
    await prisma.character.update({
      where: { id: char.id },
      data: {
        faceAnchor: assets.faceAnchor,
        defaultOutfit: assets.defaultOutfit,
        portraitPrompts: assets.portraitPrompts,
      },
    });
    console.log(`  ✅  ${name}  (${assets.portraitPrompts.length} prompts)`);
    updated++;
  }
  console.log(`\n✨ 完成，更新了 ${updated} 个角色`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
