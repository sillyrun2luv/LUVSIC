import type { RecordEntry } from "@/types";
import { isSameDay, lastNDays, startOfDay } from "./date";

export interface DayCount {
  day: number; // 当天 0 点时间戳
  count: number;
  totalMinutes: number;
}

/** 近 N 天每日统计 */
export function dailyStats(records: RecordEntry[], days: number, now: Date = new Date()): DayCount[] {
  const daysArr = lastNDays(days, now);
  return daysArr.map((day) => {
    const list = records.filter((r) => isSameDay(r.timestamp, day));
    return {
      day,
      count: list.length,
      totalMinutes: list.reduce((s, r) => s + r.duration, 0),
    };
  });
}

/** 今日统计 */
export function todayStats(records: RecordEntry[], now: Date = new Date()) {
  const list = records.filter((r) => isSameDay(r.timestamp, now));
  return {
    count: list.length,
    totalMinutes: list.reduce((s, r) => s + r.duration, 0),
  };
}

/** 距上一次的间隔（毫秒），无记录返回 null */
export function sinceLast(records: RecordEntry[], now: Date = new Date()): number | null {
  if (records.length === 0) return null;
  const latest = [...records].sort((a, b) => b.timestamp - a.timestamp)[0];
  return now.getTime() - latest.timestamp;
}

/** 总统计 */
export function totalStats(records: RecordEntry[]) {
  const count = records.length;
  const totalMinutes = records.reduce((s, r) => s + r.duration, 0);
  const avgMinutes = count > 0 ? Math.round(totalMinutes / count) : 0;

  // 平均间隔
  let avgIntervalMs = 0;
  if (records.length >= 2) {
    const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp);
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(sorted[i].timestamp - sorted[i - 1].timestamp);
    }
    avgIntervalMs = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  }

  return { count, totalMinutes, avgMinutes, avgIntervalMs };
}

/** 24 小时时段分布，返回长度 24 的数组，每项为该时段次数 */
export function hourlyDistribution(records: RecordEntry[]): number[] {
  const buckets = new Array(24).fill(0);
  for (const r of records) {
    buckets[new Date(r.timestamp).getHours()]++;
  }
  return buckets;
}

/** 形式使用频次，返回 [{ name, count }] 按次数降序 */
export function formFrequency(records: RecordEntry[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of records) {
    for (const m of r.forms ?? []) {
      map.set(m, (map.get(m) ?? 0) + 1);
    }
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/** 道具使用频次，返回 [{ name, count }] 按次数降序 */
export function toolFrequency(records: RecordEntry[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of records) {
    for (const m of r.tools ?? []) {
      map.set(m, (map.get(m) ?? 0) + 1);
    }
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 规律性评分（0-100）
 * 基于近 30 天相邻记录间隔的标准差：标准差越小越规律，分数越高。
 * 记录少于 3 条不评分。
 */
export function regularityScore(records: RecordEntry[], now: Date = new Date()): number | null {
  const since = startOfDay(now) - 29 * 86400000;
  const recent = records.filter((r) => r.timestamp >= since).sort((a, b) => a.timestamp - b.timestamp);
  if (recent.length < 3) return null;

  const gaps: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    gaps.push(recent[i].timestamp - recent[i - 1].timestamp);
  }
  const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  const variance = gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length;
  const std = Math.sqrt(variance);

  if (mean === 0) return 0;
  const cv = std / mean; // 变异系数
  // cv 越小越规律。cv=0 → 100分；cv>=1 → 0分
  const score = Math.max(0, Math.min(100, Math.round((1 - Math.min(cv, 1)) * 100)));
  return score;
}

/** 根据评分给出建议文案 */
export function regularityAdvice(score: number | null, avgIntervalMs: number): string {
  if (score === null) return "再记录几次，就能看出你的节律了。";
  if (avgIntervalMs === 0) return "继续记录，让数据说话。";
  const intervalDays = avgIntervalMs / 86400000;
  if (score >= 75) {
    return intervalDays > 0
      ? `节律稳定，平均约每 ${intervalDays.toFixed(1)} 天一次，身体有自己的节奏。`
      : "节律稳定，身体有自己的节奏。";
  }
  if (score >= 45) {
    return "基本规律，偶尔波动很正常，不必苛责自己。";
  }
  return "间隔起伏较大，可以试着让作息更稳定一些。";
}

/** 连续记录天数（streak）：连续有记录的天数，含今天或昨天 */
export function streakDays(records: RecordEntry[], now: Date = new Date()): number {
  if (records.length === 0) return 0;
  const daysWithRecords = new Set(
    records.map((r) => startOfDay(r.timestamp)),
  );
  let streak = 0;
  let cursor = startOfDay(now);
  // 若今天还没记录，从昨天开始算（保留连续记录的认定）
  if (!daysWithRecords.has(cursor)) {
    cursor -= 86400000;
  }
  while (daysWithRecords.has(cursor)) {
    streak++;
    cursor -= 86400000;
  }
  return streak;
}
