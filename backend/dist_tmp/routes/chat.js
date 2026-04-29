"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.chatRouter = void 0;
var express_1 = require("express");
var auth_1 = require("../middleware/auth");
var prisma_1 = require("../utils/prisma");
var grok_1 = require("../services/grok");
var comfyui_1 = require("../services/comfyui");
exports.chatRouter = (0, express_1.Router)();
exports.chatRouter.use(auth_1.authMiddleware);
var CONTEXT_WINDOW = 30;
// GET /api/chat — list all conversations for current user (for chat history)
exports.chatRouter.get('/', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var conversations;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma_1.prisma.conversation.findMany({
                    where: { userId: req.userId },
                    orderBy: { updatedAt: 'desc' },
                    include: {
                        character: {
                            select: { id: true, name: true, avatarEmoji: true, occupation: true, portraitUrl: true },
                        },
                        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
                    },
                })];
            case 1:
                conversations = _a.sent();
                res.json(conversations.map(function (c) {
                    var _a, _b, _c, _d, _e;
                    return ({
                        id: c.id,
                        totalTurns: c.totalTurns,
                        updatedAt: c.updatedAt,
                        character: c.character,
                        lastMessage: (_a = c.messages[0]) !== null && _a !== void 0 ? _a : null,
                        intimacy: (_c = (_b = c.userMemory) === null || _b === void 0 ? void 0 : _b._intimacyLevel) !== null && _c !== void 0 ? _c : 0,
                        mood: (_e = (_d = c.userMemory) === null || _d === void 0 ? void 0 : _d._mood) !== null && _e !== void 0 ? _e : '期待✨',
                    });
                }));
                return [2 /*return*/];
        }
    });
}); });
// GET /api/chat/:characterId — get or create conversation
exports.chatRouter.get('/:characterId', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var characterId, character, conversation, user, userMemory;
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    return __generator(this, function (_o) {
        switch (_o.label) {
            case 0:
                characterId = req.params.characterId;
                return [4 /*yield*/, prisma_1.prisma.character.findUnique({ where: { id: characterId } })];
            case 1:
                character = _o.sent();
                if (!character) {
                    res.status(404).json({ error: 'Character not found' });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, prisma_1.prisma.conversation.findUnique({
                        where: { userId_characterId: { userId: req.userId, characterId: characterId } },
                        include: {
                            messages: { orderBy: { createdAt: 'asc' }, take: 50 },
                        },
                    })];
            case 2:
                conversation = _o.sent();
                return [4 /*yield*/, prisma_1.prisma.user.findUnique({ where: { id: req.userId } })];
            case 3:
                user = _o.sent();
                userMemory = (_a = conversation === null || conversation === void 0 ? void 0 : conversation.userMemory) !== null && _a !== void 0 ? _a : {};
                res.json({
                    conversation: conversation !== null && conversation !== void 0 ? conversation : null,
                    character: character,
                    credits: {
                        free: (_b = user === null || user === void 0 ? void 0 : user.freeCredits) !== null && _b !== void 0 ? _b : 0,
                        paid: (_c = user === null || user === void 0 ? void 0 : user.paidCredits) !== null && _c !== void 0 ? _c : 0,
                    },
                    intimacy: (_d = userMemory._intimacyLevel) !== null && _d !== void 0 ? _d : 0,
                    dominance: (_e = userMemory._dominanceLevel) !== null && _e !== void 0 ? _e : 0,
                    desire: (_f = userMemory._desireLevel) !== null && _f !== void 0 ? _f : 0,
                    attach: (_g = userMemory._attachLevel) !== null && _g !== void 0 ? _g : 0,
                    mood: (_h = userMemory._mood) !== null && _h !== void 0 ? _h : '期待✨',
                    openingScene: (_j = character.openingScene) !== null && _j !== void 0 ? _j : null,
                    phase: (_k = userMemory._phaseIndex) !== null && _k !== void 0 ? _k : 0,
                    questionCount: (_l = userMemory._questionCount) !== null && _l !== void 0 ? _l : 0,
                    albumImages: (_m = userMemory._albumImages) !== null && _m !== void 0 ? _m : [],
                });
                return [2 /*return*/];
        }
    });
}); });
// POST /api/chat/:characterId/save-image — save a generated image URL to the user's album
exports.chatRouter.post('/:characterId/save-image', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var imageUrl, conv, userMemory, existing;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                imageUrl = req.body.imageUrl;
                if (!imageUrl) {
                    res.status(400).json({ error: 'imageUrl required' });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, prisma_1.prisma.conversation.findUnique({
                        where: { userId_characterId: { userId: req.userId, characterId: req.params.characterId } },
                    })];
            case 1:
                conv = _c.sent();
                if (!conv) {
                    res.status(404).json({ error: 'conversation not found' });
                    return [2 /*return*/];
                }
                userMemory = (_a = conv.userMemory) !== null && _a !== void 0 ? _a : {};
                existing = (_b = userMemory._albumImages) !== null && _b !== void 0 ? _b : [];
                if (!!existing.includes(imageUrl)) return [3 /*break*/, 3];
                return [4 /*yield*/, prisma_1.prisma.conversation.update({
                        where: { id: conv.id },
                        data: { userMemory: __assign(__assign({}, userMemory), { _albumImages: __spreadArray(__spreadArray([], existing, true), [imageUrl], false) }) },
                    })];
            case 2:
                _c.sent();
                _c.label = 3;
            case 3:
                res.json({ ok: true, total: existing.length + (existing.includes(imageUrl) ? 0 : 1) });
                return [2 /*return*/];
        }
    });
}); });
// POST /api/chat/:characterId — send a message (SSE streaming)
exports.chatRouter.post('/:characterId', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var characterId, message, user, character, conversation, existingContext, userMemory, systemPrompt, contextWindow, messages, fullReply, _a, _b, cleanReply, meta, prevIntimacy, newIntimacy, prevDominance, newDominance, prevDesire, newDesire, prevAttach, newAttach, existingActs, newUnlockedActs, existingPhase, newPhaseIndex, existingQn, newQuestionCount, newContext, updatedUserMemory, recentForImage, _c, imageDecision, _d, updatedConversation, updatedUser, recentMessages;
    var _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    return __generator(this, function (_q) {
        switch (_q.label) {
            case 0:
                characterId = req.params.characterId;
                message = req.body.message;
                if (!(message === null || message === void 0 ? void 0 : message.trim())) {
                    res.status(400).json({ error: 'message required' });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, prisma_1.prisma.user.findUnique({ where: { id: req.userId } })];
            case 1:
                user = _q.sent();
                if (!user) {
                    res.status(401).json({ error: 'User not found' });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, prisma_1.prisma.character.findUnique({ where: { id: characterId } })];
            case 2:
                character = _q.sent();
                if (!character) {
                    res.status(404).json({ error: 'Character not found' });
                    return [2 /*return*/];
                }
                if (!character.isPublic && character.creatorId !== req.userId) {
                    res.status(403).json({ error: 'Private character' });
                    return [2 /*return*/];
                }
                return [4 /*yield*/, prisma_1.prisma.conversation.findUnique({
                        where: { userId_characterId: { userId: req.userId, characterId: characterId } },
                    })];
            case 3:
                conversation = _q.sent();
                existingContext = (_e = conversation === null || conversation === void 0 ? void 0 : conversation.contextJson) !== null && _e !== void 0 ? _e : [];
                userMemory = (_f = conversation === null || conversation === void 0 ? void 0 : conversation.userMemory) !== null && _f !== void 0 ? _f : {};
                systemPrompt = (0, grok_1.buildCharacterSystemPrompt)(character, userMemory);
                contextWindow = existingContext.slice(-CONTEXT_WINDOW);
                messages = __spreadArray(__spreadArray([
                    { role: 'system', content: systemPrompt }
                ], contextWindow, true), [
                    { role: 'user', content: message },
                ], false);
                // SSE headers
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                fullReply = '';
                _q.label = 4;
            case 4:
                _q.trys.push([4, 6, , 7]);
                return [4 /*yield*/, (0, grok_1.chatStream)(messages, function (chunk) {
                        res.write("data: ".concat(JSON.stringify({ type: 'chunk', text: chunk }), "\n\n"));
                    })];
            case 5:
                fullReply = _q.sent();
                return [3 /*break*/, 7];
            case 6:
                _a = _q.sent();
                res.write("data: ".concat(JSON.stringify({ type: 'error', message: 'AI error' }), "\n\n"));
                res.end();
                return [2 /*return*/];
            case 7:
                _b = (0, grok_1.parseMeta)(fullReply), cleanReply = _b.cleanReply, meta = _b.meta;
                prevIntimacy = (_g = userMemory._intimacyLevel) !== null && _g !== void 0 ? _g : 0;
                newIntimacy = Math.max(0, Math.min(100, prevIntimacy + meta.delta));
                prevDominance = (_h = userMemory._dominanceLevel) !== null && _h !== void 0 ? _h : 0;
                newDominance = Math.max(0, Math.min(100, prevDominance + meta.controlDelta));
                prevDesire = (_j = userMemory._desireLevel) !== null && _j !== void 0 ? _j : 0;
                newDesire = Math.max(0, Math.min(100, prevDesire + meta.desireDelta));
                prevAttach = (_k = userMemory._attachLevel) !== null && _k !== void 0 ? _k : 0;
                newAttach = Math.max(0, Math.min(100, prevAttach + meta.attachDelta));
                existingActs = (_l = userMemory._unlockedActs) !== null && _l !== void 0 ? _l : [];
                newUnlockedActs = Array.from(new Set(__spreadArray(__spreadArray([], existingActs, true), meta.acts, true)));
                existingPhase = (_m = userMemory._phaseIndex) !== null && _m !== void 0 ? _m : 0;
                newPhaseIndex = Math.max(existingPhase, meta.phase);
                existingQn = (_o = userMemory._questionCount) !== null && _o !== void 0 ? _o : 0;
                newQuestionCount = meta.qn !== null ? Math.max(existingQn, meta.qn) : existingQn;
                // Send replace event so frontend shows clean text
                res.write("data: ".concat(JSON.stringify({ type: 'replace', text: cleanReply }), "\n\n"));
                newContext = __spreadArray(__spreadArray([], existingContext, true), [
                    { role: 'user', content: message },
                    { role: 'assistant', content: cleanReply },
                ], false);
                updatedUserMemory = __assign(__assign({}, userMemory), { _intimacyLevel: newIntimacy, _dominanceLevel: newDominance, _desireLevel: newDesire, _attachLevel: newAttach, _mood: meta.mood, _unlockedActs: newUnlockedActs, _phaseIndex: newPhaseIndex, _questionCount: newQuestionCount });
                recentForImage = [
                    { role: 'user', content: message },
                    { role: 'assistant', content: cleanReply },
                ];
                return [4 /*yield*/, Promise.all([
                        (0, comfyui_1.shouldGenerateImage)(character.name, recentForImage, character, newIntimacy),
                        Promise.all([
                            conversation
                                ? prisma_1.prisma.conversation.update({
                                    where: { id: conversation.id },
                                    data: {
                                        contextJson: newContext,
                                        totalTurns: { increment: 1 },
                                        userMemory: updatedUserMemory,
                                    },
                                })
                                : prisma_1.prisma.conversation.create({
                                    data: {
                                        userId: req.userId,
                                        characterId: characterId,
                                        contextJson: newContext,
                                        totalTurns: 1,
                                        userMemory: updatedUserMemory,
                                    },
                                }),
                            Promise.resolve(user),
                            prisma_1.prisma.character.update({
                                where: { id: characterId },
                                data: { usageCount: { increment: 1 } },
                            }),
                        ]),
                    ])];
            case 8:
                _c = _q.sent(), imageDecision = _c[0], _d = _c[1], updatedConversation = _d[0], updatedUser = _d[1];
                // Send meta event — include imagePrompt if scene is spicy
                res.write("data: ".concat(JSON.stringify({
                    type: 'meta',
                    mood: meta.mood,
                    suggestions: meta.suggestions,
                    intimacy: newIntimacy,
                    dominance: newDominance,
                    desire: newDesire,
                    attach: newAttach,
                    imagePrompt: imageDecision.generate ? imageDecision.prompt : null,
                    imageTwoShot: imageDecision.generate ? ((_p = imageDecision.twoShot) !== null && _p !== void 0 ? _p : false) : false,
                    phase: newPhaseIndex,
                    questionCount: newQuestionCount,
                }), "\n\n"));
                // Save messages to DB (fire and forget)
                prisma_1.prisma.message.createMany({
                    data: [
                        { conversationId: updatedConversation.id, role: 'user', content: message },
                        { conversationId: updatedConversation.id, role: 'assistant', content: cleanReply },
                    ],
                }).catch(function () { });
                // Send done event
                res.write("data: ".concat(JSON.stringify({
                    type: 'done',
                    credits: { free: updatedUser.freeCredits, paid: updatedUser.paidCredits },
                }), "\n\n"));
                // Periodically extract user memory (every 5 turns)
                if (updatedConversation.totalTurns % 5 === 0) {
                    recentMessages = newContext.slice(-10);
                    (0, grok_1.extractUserMemory)(userMemory, recentMessages).then(function (newMemory) {
                        prisma_1.prisma.conversation.update({
                            where: { id: updatedConversation.id },
                            data: { userMemory: __assign(__assign({}, newMemory), { _intimacyLevel: newIntimacy, _dominanceLevel: newDominance, _desireLevel: newDesire, _attachLevel: newAttach, _mood: meta.mood }) },
                        }).catch(function () { });
                    });
                }
                res.end();
                return [2 /*return*/];
        }
    });
}); });
