"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSceneImage = generateSceneImage;
exports.shouldGenerateImage = shouldGenerateImage;
var node_fetch_1 = require("node-fetch");
var fs_1 = require("fs");
var path_1 = require("path");
var characterFace_1 = require("../characterFace");
var COMFYUI_URL = process.env.COMFYUI_URL || 'http://localhost:7188';
var IMAGE_SAVE_DIR = process.env.IMAGE_SAVE_DIR || '/var/www/siyuwanban/images';
var IMAGE_PUBLIC_URL = process.env.FRONTEND_URL || 'https://www.shangzongcai.com';
// ── 模型常量 ──────────────────────────────────────────────────────────────────
var MODEL_JUGGER = 'juggernautXL_juggXIByRundiffusion.safetensors';
var MODEL_LEOSAM = 'leosamsHelloworldXL_helloworldXL70.safetensors';
var MODEL_NOOB = 'noobaiXLNAIXL_epsilonPred11Version.safetensors';
// ── 角色 → 模型映射（与 generateAlbum.ts 保持一致）─────────────────────────
var CHARACTER_MODEL = {
    // Juggernaut XI — 高端写实
    '沈静': MODEL_JUGGER, '晓彤': MODEL_JUGGER,
    // LEOSAM — 细腻白瘦幼
    '椎名老师': MODEL_LEOSAM, '娜娜': MODEL_LEOSAM, '小雨': MODEL_LEOSAM,
    '琉璃': MODEL_LEOSAM, '小慧': MODEL_LEOSAM, '阿柒': MODEL_LEOSAM,
    '糖糖': MODEL_LEOSAM, '晴晴': MODEL_LEOSAM, '夜玲': MODEL_LEOSAM,
    '唐诗': MODEL_LEOSAM,
    // NoobAI — 二次元 Illustrious
    'X-23': MODEL_NOOB, '幻音': MODEL_NOOB, '狐九': MODEL_NOOB,
    '冷霜': MODEL_NOOB, '魅罗': MODEL_NOOB,
};
// ── 质量前缀 ──────────────────────────────────────────────────────────────────
var QUALITY_REAL = '(photorealistic:1.4), (hyperrealistic:1.3), RAW photo, 8k uhd, masterpiece, (Asian beauty:1.4), (porcelain fair skin:1.5), (flawless pale white skin:1.4), (youthful:1.3), (perfect face:1.5), (explicit:1.4), (nsfw:1.4)';
var QUALITY_NOOB_SCENE = 'masterpiece, best quality, amazing quality, very aesthetic, newest, ultra detailed, source_anime, nsfw, explicit';
var NEGATIVE_REAL = '(worst quality:1.6), (low quality:1.6), bad anatomy, bad face, ugly face, deformed, blurry, watermark, text, censored, mosaic, (dark skin:1.5), (tanned skin:1.5), (yellowish skin:1.4)';
var NEGATIVE_NOOB_SCENE = 'worst quality, bad quality, lowres, bad anatomy, bad face, ugly face, deformed, blurry, watermark, text, censored, mosaic';
// ── 工作流构建 ────────────────────────────────────────────────────────────────
function buildWorkflow(prompt, negativePrompt, seed, modelName) {
    var model = modelName !== null && modelName !== void 0 ? modelName : MODEL_JUGGER;
    var isNoob = model === MODEL_NOOB;
    var qualityPrefix = isNoob ? QUALITY_NOOB_SCENE : QUALITY_REAL;
    var negPrefix = isNoob ? NEGATIVE_NOOB_SCENE : NEGATIVE_REAL;
    var cfg = isNoob ? 6.0 : 6.5;
    var steps = isNoob ? 28 : 30;
    var fullPrompt = "".concat(qualityPrefix, ", ").concat(prompt);
    var fullNeg = "".concat(negPrefix, ", ").concat(negativePrompt);
    return {
        "4": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": { "ckpt_name": model }
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": { "text": fullPrompt, "clip": ["4", 1] }
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": { "text": fullNeg, "clip": ["4", 1] }
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": { "width": 768, "height": 1024, "batch_size": 1 }
        },
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0],
                "seed": seed,
                "steps": steps,
                "cfg": cfg,
                "sampler_name": "dpm_2_ancestral",
                "scheduler": "karras",
                "denoise": 1.0
            }
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": { "samples": ["3", 0], "vae": ["4", 2] }
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": { "images": ["8", 0], "filename_prefix": "chat" }
        }
    };
}
// Queue a prompt and return prompt_id
function queuePrompt(workflow) {
    return __awaiter(this, void 0, void 0, function () {
        var res, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, node_fetch_1.default)("".concat(COMFYUI_URL, "/prompt"), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt: workflow }),
                    })];
                case 1:
                    res = _a.sent();
                    if (!res.ok)
                        throw new Error("ComfyUI queue failed: ".concat(res.status));
                    return [4 /*yield*/, res.json()];
                case 2:
                    data = _a.sent();
                    return [2 /*return*/, data.prompt_id];
            }
        });
    });
}
// Poll until image is ready (max 120s)
function waitForImage(promptId) {
    return __awaiter(this, void 0, void 0, function () {
        var deadline, res, history_1, entry, _i, _a, nodeOut;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    deadline = Date.now() + 120000;
                    _c.label = 1;
                case 1:
                    if (!(Date.now() < deadline)) return [3 /*break*/, 5];
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2000); })];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, (0, node_fetch_1.default)("".concat(COMFYUI_URL, "/history/").concat(promptId))];
                case 3:
                    res = _c.sent();
                    if (!res.ok)
                        return [3 /*break*/, 1];
                    return [4 /*yield*/, res.json()];
                case 4:
                    history_1 = _c.sent();
                    entry = history_1[promptId];
                    if (!(entry === null || entry === void 0 ? void 0 : entry.outputs))
                        return [3 /*break*/, 1];
                    for (_i = 0, _a = Object.values(entry.outputs); _i < _a.length; _i++) {
                        nodeOut = _a[_i];
                        if ((_b = nodeOut === null || nodeOut === void 0 ? void 0 : nodeOut.images) === null || _b === void 0 ? void 0 : _b.length) {
                            return [2 /*return*/, nodeOut.images[0].filename];
                        }
                    }
                    return [3 /*break*/, 1];
                case 5: throw new Error('ComfyUI timeout');
            }
        });
    });
}
// Download image from ComfyUI and save to public directory
function downloadImage(filename) {
    return __awaiter(this, void 0, void 0, function () {
        var res, buffer, saveName, savePath;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, node_fetch_1.default)("".concat(COMFYUI_URL, "/view?filename=").concat(filename, "&type=output"))];
                case 1:
                    res = _a.sent();
                    if (!res.ok)
                        throw new Error("Failed to fetch image: ".concat(res.status));
                    return [4 /*yield*/, res.buffer()];
                case 2:
                    buffer = _a.sent();
                    saveName = "".concat(Date.now(), "_").concat(filename);
                    savePath = path_1.default.join(IMAGE_SAVE_DIR, saveName);
                    fs_1.default.mkdirSync(IMAGE_SAVE_DIR, { recursive: true });
                    fs_1.default.writeFileSync(savePath, buffer);
                    return [2 /*return*/, "".concat(IMAGE_PUBLIC_URL, "/images/").concat(saveName)];
            }
        });
    });
}
// Main entry: generate image from scene description
function generateSceneImage(scenePrompt_1) {
    return __awaiter(this, arguments, void 0, function (scenePrompt, negative, characterName) {
        var seed, model, workflow, promptId, filename, url;
        var _a;
        if (negative === void 0) { negative = ''; }
        if (characterName === void 0) { characterName = ''; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    seed = Math.floor(Math.random() * Math.pow(2, 32));
                    model = (_a = CHARACTER_MODEL[characterName]) !== null && _a !== void 0 ? _a : MODEL_JUGGER;
                    workflow = buildWorkflow(scenePrompt, negative, seed, model);
                    return [4 /*yield*/, queuePrompt(workflow)];
                case 1:
                    promptId = _b.sent();
                    return [4 /*yield*/, waitForImage(promptId)];
                case 2:
                    filename = _b.sent();
                    return [4 /*yield*/, downloadImage(filename)];
                case 3:
                    url = _b.sent();
                    return [2 /*return*/, url];
            }
        });
    });
}
// Physical anchor — face/hair/build ONLY, no clothing (clothing comes from context)
var CHARACTER_BODY = {
    '椎名老师': '24yo japanese woman, black-framed glasses, smooth black hair tied back, slender waist, fair skin',
    '晓彤': '22yo chinese woman, athletic toned body, ponytail, fit figure, fair skin',
    '娜娜': '18yo chinese girl, half-dyed hair, ear piercings, cute petite face, slender',
    '小雨': '19yo chinese girl, wavy chestnut hair, innocent doe eyes, slender petite',
    '琉璃': '22yo chinese woman, straight black hair, oval glasses, slender fair skin',
    '沈静': '25yo tall chinese model, high cheekbones, bone-straight black hair, long legs',
    '小慧': '23yo chinese woman, soft round face, gentle smile, fair skin',
    '夜玲': '26yo chinese woman, dark wavy hair, sharp eyes, slender ink-stained fingers',
    '晴晴': '21yo chinese girl, pastel dyed hair, bright round eyes, cute face',
    '唐诗': '27yo chinese woman, elegant hair bun, sharp refined features, slender',
    '阿柒': '22yo chinese girl, wavy brown shoulder-length hair, warm smile, slender',
    '糖糖': '20yo chinese girl, messy chestnut bun, dimples, slender',
    'X-23': 'android girl, platinum white hair with neon streaks, glowing blue circuit eyes, slim',
    '幻音': 'holographic AI girl, prismatic shifting long hair, glowing ethereal eyes',
    '狐九': 'fox girl, fox ears, nine white fluffy tails, silver-white flowing hair, glowing amber eyes',
    '冷霜': 'ice cultivator girl, silver-blue long hair, cold pale blue glowing eyes, luminous pale skin',
    '魅罗': 'demon girl, dark purple flowing hair, crimson slit eyes, small horns, beautiful face',
};
// Default outfit — only used when context has no clothing changes
var CHARACTER_DEFAULT_OUTFIT = {
    '椎名老师': 'white dress shirt, short pleated skirt',
    '晓彤': 'sports bra, tight yoga pants',
    '娜娜': 'shortened school uniform',
    '小雨': 'casual college student clothes',
    '琉璃': 'white lab coat over blouse',
    '沈静': 'elegant high-fashion outfit',
    '小慧': 'nurse uniform',
    '夜玲': 'dark lace dress',
    '晴晴': 'crop top, casual streamer clothes',
    '唐诗': 'white office blouse, pencil skirt',
    '阿柒': 'barista apron over casual clothes',
    '糖糖': 'paint-stained overalls',
    'X-23': 'tactical bodysuit',
    '幻音': 'translucent holographic outfit',
    '狐九': 'flowing white hanfu robes',
    '冷霜': 'white flowing cultivation robes',
    '魅罗': 'dark revealing demonic attire',
};
// Use Grok to decide if scene warrants an image and build the image prompt
function shouldGenerateImage(characterName_1, recentMessages_1, character_1) {
    return __awaiter(this, arguments, void 0, function (characterName, recentMessages, character, intimacyLevel) {
        var bodyAnchor, defaultOutfit, faceAnchor, fullBodyAnchor, explicitRule, systemContent, res, data, content, cleaned, parsed, _a;
        var _b, _c, _d, _e;
        if (intimacyLevel === void 0) { intimacyLevel = 0; }
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    bodyAnchor = CHARACTER_BODY[characterName] || "1girl, ".concat(characterName);
                    defaultOutfit = CHARACTER_DEFAULT_OUTFIT[characterName] || 'casual clothes';
                    faceAnchor = characterFace_1.CHARACTER_FACE[characterName];
                    fullBodyAnchor = faceAnchor ? "".concat(faceAnchor, ", ").concat(bodyAnchor) : bodyAnchor;
                    if (intimacyLevel < 20) {
                        explicitRule = '只在有明显肢体接触或强烈视觉暗示时生成。prompt保持衣着完整，侧重氛围和情绪，不含任何裸露。';
                    }
                    else if (intimacyLevel < 40) {
                        explicitRule = '有亲密肢体接触时生成。prompt可含 crumpled clothing、exposed shoulders/collarbone、disheveled clothes，不露胸不露下体。';
                    }
                    else if (intimacyLevel < 60) {
                        explicitRule = '有强烈性暗示场景时生成。prompt可含 (bare breasts:1.5), (erect nipples:1.4)，下体不露出。';
                    }
                    else {
                        explicitRule = '有性行为描写时生成。prompt必须完整体现当前性行为，含 (bare breasts:1.5), (erect nipples:1.5), (pussy visible:1.5) 及所有相关部位和动作。';
                    }
                    systemContent = "\u4F60\u662F\u4E00\u4E2A\u4E13\u4E1A\u7684\u56FE\u7247\u751F\u6210\u51B3\u7B56\u5668\uFF0C\u6839\u636E\u5BF9\u8BDD\u5185\u5BB9\u51B3\u5B9A\u662F\u5426\u751F\u6210\u56FE\u7247\u53CA\u751F\u6210\u5185\u5BB9\u3002\n\n\u3010\u89D2\u8272\u56FA\u5B9A\u4F53\u8C8C \u2014 \u5FC5\u987B\u4FDD\u7559\uFF0C\u4E0D\u53EF\u4FEE\u6539\u3011\n".concat(fullBodyAnchor, "\n\n\u3010\u4EFB\u52A1\uFF1A\u4ECE\u5BF9\u8BDD\u4E2D\u63D0\u53D6\u4EE5\u4E0B4\u4E2A\u7EF4\u5EA6\uFF0C\u6784\u5EFA\u7CBE\u786E\u7684\u56FE\u7247prompt\u3011\n\n1. \u7740\u88C5\u72B6\u6001\n   - \u4ED4\u7EC6\u9605\u8BFB\u5BF9\u8BDD\uFF0C\u5982\u679C\u660E\u786E\u63CF\u8FF0\u4E86\u8131\u4E0B/\u6380\u8D77/\u6495\u5F00/\u9732\u51FA\u67D0\u4EF6\u8863\u7269 \u2192 prompt\u4E2D\u53CD\u6620\u5F53\u524D\u771F\u5B9E\u72B6\u6001\uFF08naked, topless, bottomless, half-undressed\u7B49\uFF09\n   - \u5982\u65E0\u7740\u88C5\u53D8\u5316 \u2192 \u4F7F\u7528\u9ED8\u8BA4\u670D\u88C5\uFF1A").concat(defaultOutfit, "\n\n2. \u52A8\u4F5C/\u59FF\u52BF\n   - \u63D0\u53D6\u89D2\u8272\u5F53\u524D\u7684\u80A2\u4F53\u52A8\u4F5C\uFF08lying on bed, pinned against wall, riding on top, kneeling, hands tied\u7B49\uFF09\n   - \u5982\u6709\u4E24\u4EBA\u4E92\u52A8\uFF1A\u63D0\u53D6\u53CC\u4EBA\u4E92\u52A8\u59FF\u52BF\uFF08missionary position, cowgirl position, doggy style, embracing\u7B49\uFF09\n\n3. \u795E\u6001/\u8868\u60C5\n   - \u63D0\u53D6\u89D2\u8272\u5F53\u524D\u60C5\u7EEA\u4E0E\u9762\u90E8\u8868\u60C5\uFF08flushed cheeks, teary eyes, mouth open moaning, biting lip, eyes rolled back, pleading eyes\u7B49\uFF09\n\n4. \u662F\u5426\u53CC\u4EBA\u573A\u666F\n   - \u5BF9\u8BDD\u4E2D\u662F\u5426\u6B63\u5728\u53D1\u751F\u6027\u884C\u4E3A\u6216\u5F3A\u70C8\u80A2\u4F53\u4E92\u52A8\uFF1F\n   - \u662F \u2192 twoShot: true\uFF0Cprompt\u52A0\u5165 1boy 1girl, \u5E76\u63CF\u8FF0\u4E92\u52A8\u52A8\u4F5C\n   - \u5426 \u2192 twoShot: false\uFF0Cprompt\u53EA\u542B1girl\n\n\u3010\u5F53\u524D\u4EB2\u5BC6\u5EA6\u3011").concat(intimacyLevel, "/100\n\u3010\u88F8\u9732\u4E0E\u751F\u6210\u89C4\u5219\u3011").concat(explicitRule, "\n\n\u3010\u8F93\u51FA\u683C\u5F0F\u3011\u53EA\u8FD4\u56DEJSON\uFF0C\u4E0D\u542B\u4EFB\u4F55\u5176\u4ED6\u6587\u5B57\uFF1A\n{\"generate\": true/false, \"twoShot\": true/false, \"prompt\": \"\u5B8C\u6574\u82F1\u6587prompt\"}\n\nprompt\u7ED3\u6784\uFF1A[\u4F53\u8C8C\u951A] + [\u7740\u88C5\u72B6\u6001] + [\u52A8\u4F5C/\u59FF\u52BF] + [\u8868\u60C5\u795E\u6001] + [\u573A\u666F\u73AF\u5883] + [\u753B\u9762\u6784\u56FE]");
                    return [4 /*yield*/, (0, node_fetch_1.default)('https://api.x.ai/v1/chat/completions', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': "Bearer ".concat(process.env.GROK_API_KEY),
                            },
                            body: JSON.stringify({
                                model: 'grok-3',
                                messages: __spreadArray([
                                    { role: 'system', content: systemContent }
                                ], recentMessages.slice(-6), true),
                                max_tokens: 350,
                                temperature: 0.2,
                            }),
                        })];
                case 1:
                    res = _f.sent();
                    _f.label = 2;
                case 2:
                    _f.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, res.json()];
                case 3:
                    data = _f.sent();
                    content = (_e = (_d = (_c = (_b = data.choices) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content) !== null && _e !== void 0 ? _e : '{}';
                    cleaned = content.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
                    parsed = JSON.parse(cleaned);
                    return [2 /*return*/, parsed];
                case 4:
                    _a = _f.sent();
                    return [2 /*return*/, { generate: false }];
                case 5: return [2 /*return*/];
            }
        });
    });
}
