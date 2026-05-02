// ── 剧情脚本 ────────────────────────────────────────────────────────────────
// 5个阶段数组，buildCharacterSystemPrompt 只注入 >= _phaseIndex 的阶段。
// 所有角色剧情已迁移到数据库 character.storyPhases 字段，此处保留空对象作为后备。

export type StoryPhases = [string, string, string, string, string];

export const STORY_PHASES: Record<string, StoryPhases> = {};
