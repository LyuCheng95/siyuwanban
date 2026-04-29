// ── 状态颜色 & 标签 ────────────────────────────────────────────────────────────
export function intimacyColor(v: number) {
  if (v < 30) return 'linear-gradient(90deg,#6366f1,#8b5cf6)';
  if (v < 60) return 'linear-gradient(90deg,#a855f7,#ec4899)';
  if (v < 85) return 'linear-gradient(90deg,#ec4899,#ff3d7f)';
  return 'linear-gradient(90deg,#ff3d7f,#ef4444)';
}
export function intimacyLabel(v: number) {
  if (v < 20) return '初识'; if (v < 40) return '熟悉';
  if (v < 60) return '亲近'; if (v < 80) return '亲密';
  if (v < 95) return '深爱'; return '灵魂伴侣';
}
export function dominanceColor(v: number) {
  if (v < 40) return 'linear-gradient(90deg,#6366f1,#8b5cf6)';
  if (v < 70) return 'linear-gradient(90deg,#f59e0b,#ef4444)';
  return 'linear-gradient(90deg,#ef4444,#dc2626)';
}
export function dominanceLabel(v: number) {
  if (v < 30) return '温顺'; if (v < 55) return '主动';
  if (v < 80) return '强势'; return '支配';
}
export function desireColor(v: number) {
  if (v < 25) return 'linear-gradient(90deg,#334155,#475569)';
  if (v < 50) return 'linear-gradient(90deg,#f59e0b,#f97316)';
  if (v < 75) return 'linear-gradient(90deg,#ef4444,#dc2626)';
  return 'linear-gradient(90deg,#dc2626,#991b1b)';
}
export function desireLabel(v: number) {
  if (v < 20) return '平静'; if (v < 50) return '心动';
  if (v < 75) return '炽热'; return '燃烧';
}
export function attachColor(v: number) {
  if (v < 30) return 'linear-gradient(90deg,#22c55e,#16a34a)';
  if (v < 60) return 'linear-gradient(90deg,#06b6d4,#0891b2)';
  if (v < 80) return 'linear-gradient(90deg,#a855f7,#9333ea)';
  return 'linear-gradient(90deg,#ec4899,#db2777)';
}
export function attachLabel(v: number) {
  if (v < 25) return '独立'; if (v < 50) return '在意';
  if (v < 75) return '依赖'; return '占有';
}
