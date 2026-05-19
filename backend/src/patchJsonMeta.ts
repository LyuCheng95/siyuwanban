/**
 * 补写已有图片的 metadata JSON（不重新生图）
 * 用法：node_modules\.bin\tsx src\patchJsonMeta.ts [角色名|all]
 */

import fs from 'fs';
import path from 'path';
import { SHOT_TYPES, type ShotKey } from './generateSceneConfig';

const LIBRARY_DIR = process.env.LIBRARY_DIR || 'D:/SD/siyuwanban/library';
const MODEL = 'prefectiousXLNSFW_v10.safetensors';

const ANIME_CHARS = ['X-23', '幻音', '狐九', '冷霜', '魅罗'];

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

interface ShotMeta {
  category:    string;
  description: string;
  tags:        string[];
  bodyFocus:   string;
  viewAngle:   string;
}
const SHOT_META: Partial<Record<ShotKey, ShotMeta>> = {
  portrait:               { category: '调情', description: '面部特写，眼神撩人，轻启朱唇，若有所思',           tags: ['正脸','眼神挑逗','轻启朱唇','媚眼','微笑','上半身','近景','唯美','撩人','无裸露'],               bodyFocus: '脸部',      viewAngle: '近景正面'  },
  medium:                 { category: '调情', description: '半身展示，身材曲线若隐若现，撩拨心弦',             tags: ['半身','身材','撩人','性感','衣着','胸线','腰线','中景','诱惑','含蓄'],                           bodyFocus: '上半身',    viewAngle: '中景正面'  },
  kiss:                   { category: '前戏', description: '嘴唇相贴，舌尖缠绕，唾液交换，沉醉其中',           tags: ['接吻','舌吻','嘴唇','唾液','脸红','眼睛半闭','男性出现','亲密','缠绵','湿润嘴唇'],               bodyFocus: '嘴唇',      viewAngle: '近景'      },
  breast:                 { category: '前戏', description: '男手揉捏双乳，粉嫩乳头坚挺，娇喘连连',             tags: ['裸胸','乳头','揉捏','爱抚','男手','坚挺乳头','娇喘','上身裸露','胸部特写','低头呻吟'],           bodyFocus: '胸部',      viewAngle: '近景俯视'  },
  pussy:                  { category: '前戏', description: '双腿张开，下体粉嫩湿润，完全暴露于视线',           tags: ['下体','阴部','张腿','湿润','粉嫩','完全裸露','展示','近距离','阴唇','爱液'],                     bodyFocus: '阴部',      viewAngle: '近景'      },
  handjob:                { category: '前戏', description: '纤手握住阳具轻柔抚弄，眼神撩人挑逗',               tags: ['手交','阳具','握住','抚弄','挑逗','POV','手部特写','撸动','勃起','眼神交流'],                     bodyFocus: '手部·阳具', viewAngle: 'POV俯视'   },
  fingering:              { category: '前戏', description: '手指探入湿润内壁，爱液淋漓，娇吟失控',             tags: ['手指插入','阴部','爱液','仰躺','张腿','两根手指','湿润内壁','抽插','颤抖','呻吟'],               bodyFocus: '阴部·手指', viewAngle: '中景俯视'  },
  blowjob:                { category: '前戏', description: '含入阳具，仰望镜头，口水欲滴，顺从媚眼',           tags: ['口交','阳具','含住','口腔','唾液','仰望','顺从','POV','舌尖','吮吸','深喉'],                     bodyFocus: '嘴部·阳具', viewAngle: '近景仰视'  },
  cunnilingus:            { category: '前戏', description: '舌尖爱抚阴蒂，双腿夹紧，失神呻吟不止',             tags: ['舔阴','阴蒂','舌头','男性舔舐','夹腿','腰部上挺','呻吟','白眼','湿润','爱液'],                   bodyFocus: '阴部',      viewAngle: '中景'      },
  penetration_missionary: { category: '插入', description: '仰躺张腿，正面插入，眼神交汇，喘息缠绵',           tags: ['插入','传教士体位','正面','仰躺','张腿','眼神交汇','呻吟','抽插','爱液','高潮临近'],               bodyFocus: '阴部·插入', viewAngle: '中景正面'  },
  penetration_doggy:      { category: '插入', description: '四肢跪趴，从后方猛力插入，腰臀律动顿挫',           tags: ['插入','后入','趴式','臀部','抓腰','从后方','深入','臀部晃动','呻吟','后视角'],                   bodyFocus: '臀部·阴部', viewAngle: '后方视角'  },
  penetration_cowgirl:    { category: '插入', description: '主动骑上男性，腰臀律动，乳房随波颠簸',             tags: ['插入','骑乘体位','主动进攻','乳房晃动','腰臀律动','高潮','仰头','呻吟','俯视男性','掌控'],       bodyFocus: '全身·插入', viewAngle: '正面中景'  },
  penetration_spooning:   { category: '插入', description: '侧躺紧贴，从身后轻柔插入，耳语呢喃',               tags: ['插入','侧入','勺式体位','侧躺','亲密','温柔','从后','贴合','耳语','缠绵'],                       bodyFocus: '侧身·插入', viewAngle: '侧面视角'  },
  penetration_generic:    { category: '插入', description: '下体结合处特写，爱液交融，充盈饱满',               tags: ['插入特写','下体','阴部','爱液','充盈','连接处','张腿','湿润','近距离','露骨'],                   bodyFocus: '阴部·插入', viewAngle: '特写'      },
  standing_sex:           { category: '插入', description: '站立后入，身体前倾压墙，力道十足',                 tags: ['插入','站立体位','后入','贴墙','前倾','站立','力道','臀部','粗暴','呻吟'],                       bodyFocus: '全身·插入', viewAngle: '侧面中景'  },
  ahegao:                 { category: '高潮', description: '白眼上翻，嘴巴大张流涎，极乐之脸失控',             tags: ['高潮表情','白眼上翻','口水','流涎','潮红','失神','颤抖','泪水','娇喘','完全失控'],               bodyFocus: '脸部',      viewAngle: '近景正面'  },
  creampie:               { category: '高潮', description: '白色精液从阴部溢出，满溢余韵，疲软倒地',           tags: ['内射','精液','阴部','溢出','白浊','事后','余韵','疲软','满足','阴部特写'],                       bodyFocus: '阴部',      viewAngle: '近景'      },
  cum_face:               { category: '高潮', description: '精液喷射脸庞，呆滞媚眼，舌尖舔舐品尝',             tags: ['颜射','精液','脸部','白浊','白眼','舌头舔舐','口水混精','娇喘','满足','近景'],                   bodyFocus: '脸部',      viewAngle: '近景正面'  },
  bondage:                { category: '调教', description: '绳索束缚双手，跪地顺从，绳纹印皮，羞耻颤抖',       tags: ['捆绑','束缚','绳索','跪地','顺从','蒙眼','调教','羞耻','失控'],                               bodyFocus: '手腕·全身', viewAngle: '中景'      },
  toy_use:                { category: '调教', description: '情趣玩具刺激阴蒂或插入，失控颤抖，眼神涣散',       tags: ['玩具','振动棒','跳蛋','假阳具','刺激','插入','颤抖','湿透','失控','潮红'],                     bodyFocus: '阴部·道具', viewAngle: '中景俯视'  },
  petplay:                { category: '调教', description: '猫耳项圈宠物扮演，乖顺仰望，娇憨服从',             tags: ['猫娘','宠物扮演','猫耳','项圈','铃铛','跪地','乖顺','仰望','娇憨'],                           bodyFocus: '全身·脸部', viewAngle: '中景正面'  },
  spanking:               { category: '调教', description: '翘臀受罚，手印红痕，羞耻泪眼，爱液淋漓',           tags: ['打屁股','惩罚','红痕','手印','翘臀','泪眼','羞耻','颤抖','爱液','调教'],                       bodyFocus: '臀部',      viewAngle: '中景侧视'  },
  undressing:             { category: '前戏', description: '脱衣中间态，衣物半脱，裸肤初现，害羞期待',           tags: ['脱衣','半脱','裸肤','文胸','内衣','衬衫','害羞','期待','张力','撩拨'],                         bodyFocus: '上身·全身', viewAngle: '中景正面'  },
  squirt:                 { category: '高潮', description: '潮喷液体喷涌而出，双腿战栗，身体完全失控崩溃',     tags: ['潮喷','潮吹','喷水','液体','张腿','颤抖','高潮','失控','近景','阴部特写'],                     bodyFocus: '阴部',      viewAngle: '近景正面'  },
};

const PORTRAIT_SHOTS: ShotKey[] = ['portrait','medium','blowjob','cum_face','ahegao','kiss','breast'];

function patchCharacter(characterName: string) {
  let patched = 0, missing = 0;

  for (const { key: shotKey, label } of SHOT_TYPES) {
    const shotDir = path.join(LIBRARY_DIR, characterName, shotKey);
    if (!fs.existsSync(shotDir)) continue;

    const pngs = fs.readdirSync(shotDir).filter(f => f.endsWith('.png'));
    const [w, h] = PORTRAIT_SHOTS.includes(shotKey) ? [768, 1024] : [1024, 768];
    const meta   = SHOT_META[shotKey] ?? { category: '', description: '', tags: [], bodyFocus: '', viewAngle: '' };
    const phase  = PHASE_MAP[shotKey] ?? 0;

    for (const png of pngs) {
      const idx      = parseInt(png.replace('.png', ''));
      const jsonPath = path.join(shotDir, png.replace('.png', '.json'));

      fs.writeFileSync(jsonPath, JSON.stringify({
        character:     characterName,
        shotKey,
        category:      meta.category,
        label,
        description:   meta.description,
        tags:          meta.tags,
        bodyFocus:     meta.bodyFocus,
        viewAngle:     meta.viewAngle,
        index:         idx,
        intimacyPhase: phase,
        model:         MODEL,
        width:         w,
        height:        h,
      }, null, 2));
      patched++;
    }
  }

  console.log(`✅ ${characterName}: 补写 ${patched} 个 JSON`);
}

const target = process.argv[2] ?? 'all';
const chars  = target === 'all' ? ANIME_CHARS : [target];
chars.forEach(patchCharacter);
