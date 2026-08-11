// 日期与时间相关工具

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 当天 0 点的时间戳（毫秒） */
export function startOfDay(d: Date | number): number {
  const date = typeof d === "number" ? new Date(d) : d;
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** 本周一 0 点的时间戳（毫秒），周一作为一周起点 */
export function startOfWeek(d: Date = new Date()): number {
  const date = typeof d === "number" ? new Date(d) : new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0=周日 … 6=周六
  const diff = day === 0 ? -6 : 1 - day; // 回到周一
  date.setDate(date.getDate() + diff);
  return date.getTime();
}

/** 获取某天 0 点 */
export function dayStart(d: Date | number): Date {
  const date = typeof d === "number" ? new Date(d) : new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** 两个日期是否同一天 */
export function isSameDay(a: Date | number, b: Date | number): boolean {
  const da = typeof a === "number" ? new Date(a) : a;
  const db = typeof b === "number" ? new Date(b) : b;
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/** 返回近 N 天（含今天）每日的 0 点时间戳数组，旧 → 新 */
export function lastNDays(n: number, today: Date = new Date()): number[] {
  const base = startOfDay(today);
  const arr: number[] = [];
  for (let i = n - 1; i >= 0; i--) {
    arr.push(base - i * 86400000);
  }
  return arr;
}

/** 星期几的中文 */
export function weekdayShort(d: Date | number): string {
  const date = typeof d === "number" ? new Date(d) : d;
  return WEEKDAYS[date.getDay()];
}

/** 时段问候：返回时段名与一句陪伴的话 */
export function greeting(d: Date = new Date()): { period: string; subtitle: string } {
  const h = d.getHours();
  if (h < 5) return { period: "深夜", subtitle: "太晚了，先照顾好自己" };
  if (h < 11) return { period: "早晨", subtitle: "新的一天，从容开始" };
  if (h < 13) return { period: "中午", subtitle: "稍作停顿，也挺好" };
  if (h < 18) return { period: "下午", subtitle: "把节奏还给自己" };
  if (h < 22) return { period: "晚上", subtitle: "夜色温柔，与自己相处" };
  return { period: "深夜", subtitle: "太晚了，先照顾好自己" };
}

/** 格式化日期：2026年8月10日 */
export function formatDateCN(d: Date | number): string {
  const date = typeof d === "number" ? new Date(d) : d;
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/** 格式化日期：8月10日 */
export function formatDateShort(d: Date | number): string {
  const date = typeof d === "number" ? new Date(d) : d;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/** 格式化完整日期时间：2026-08-10 14:08 */
export function formatDateTime(d: Date | number): string {
  const date = typeof d === "number" ? new Date(d) : d;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 格式化时间：14:08 */
export function formatTime(d: Date | number): string {
  const date = typeof d === "number" ? new Date(d) : d;
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** 用于 datetime-local input 的值：2026-08-10T14:08 */
export function toDatetimeLocalValue(d: Date | number): string {
  const date = typeof d === "number" ? new Date(d) : new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 把 datetime-local 的值解析为时间戳 */
export function fromDatetimeLocalValue(v: string): number {
  return new Date(v).getTime();
}

/** 把分钟时长格式化为可读：1小时20分 / 45分 / 30秒 / 刚刚 */
export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "刚刚";
  const totalSec = Math.round(minutes * 60);
  if (totalSec < 60) return `${totalSec}秒`;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0 && m > 0 && s > 0) return `${h}时${m}分${s}秒`;
  if (h > 0 && m > 0) return `${h}时${m}分`;
  if (h > 0) return `${h}小时`;
  if (m > 0 && s > 0) return `${m}分${s}秒`;
  return `${m}分`;
}

/** 把毫秒间隔格式化为：3小时20分 / 2天 / 刚刚 */
export function formatInterval(ms: number): string {
  if (ms < 0) ms = 0;
  const min = Math.floor(ms / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min}分钟前`;
  const hours = Math.floor(min / 60);
  if (hours < 24) {
    const m = min % 60;
    return m > 0 ? `${hours}小时${m}分前` : `${hours}小时前`;
  }
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  if (days < 30) return h > 0 ? `${days}天${h}小时前` : `${days}天前`;
  const months = Math.floor(days / 30);
  return `${months}个月前`;
}

/** 相对当前的时间描述（用于记录项） */
export function relativeTime(ts: number, now: Date = new Date()): string {
  const diff = now.getTime() - ts;
  if (isSameDay(ts, now)) return `今天 ${formatTime(ts)}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(ts, yesterday)) return `昨天 ${formatTime(ts)}`;
  return `${formatDateShort(ts)} ${formatTime(ts)}`;
}
