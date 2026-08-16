import type { ReceivedFriendReminder } from "./friends";

/**
 * 收到的好友提醒：本地缓存层。
 *
 * 设计：
 * - 云端负责「接收新提醒」「标记已读」，仍是权威来源；
 * - 但每次打开提醒 Tab 都会把云端的一份同步持久化到本机 localStorage，
 *   因此离线也能看、云端 90 天清理也不会丢（本地是超集）。
 * - 按 user_id 命名空间，避免同设备多账号串扰。
 */

const CACHE_PREFIX = "zwba_reminders_";
const MAX_CACHED = 1000; // 上限保护，正常用量远不会触顶

function keyFor(userId: string | null): string {
  return CACHE_PREFIX + (userId ?? "anon");
}

/** 读取本机缓存（按当前登录用户） */
export function loadCachedReminders(userId: string | null): ReceivedFriendReminder[] {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const arr = JSON.parse(raw) as ReceivedFriendReminder[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** 写入本机缓存（按当前登录用户，超上限截断最旧） */
export function saveCachedReminders(userId: string | null, items: ReceivedFriendReminder[]): void {
  try {
    const trimmed = items.slice(0, MAX_CACHED);
    localStorage.setItem(keyFor(userId), JSON.stringify(trimmed));
  } catch {
    /* 存储不可用或超额时静默跳过 */
  }
}

/**
 * 云端为准合并：按 id 取并集，云端字段覆盖本地（含 read_at）。
 * 云端没有但本地有的项（如云端已清理的已读记录）保留在本地。
 */
export function mergeReminders(
  cached: ReceivedFriendReminder[],
  incoming: ReceivedFriendReminder[],
): ReceivedFriendReminder[] {
  const map = new Map<string, ReceivedFriendReminder>();
  for (const r of cached) map.set(r.id, r);
  for (const r of incoming) map.set(r.id, r); // 云端覆盖
  const all = Array.from(map.values());
  all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return all;
}

/** 本地把指定 id 标记为已读（与云端标记并行） */
export function markCachedRead(userId: string | null, ids: string[]): void {
  if (ids.length === 0) return;
  const cached = loadCachedReminders(userId);
  const set = new Set(ids);
  const now = Date.now();
  const updated = cached.map((r) => (set.has(r.id) ? { ...r, readAt: now } : r));
  saveCachedReminders(userId, updated);
}

/** 本地删除单条提醒（与云端删除并行） */
export function removeCachedReminder(userId: string | null, id: string): void {
  const cached = loadCachedReminders(userId);
  const updated = cached.filter((r) => r.id !== id);
  saveCachedReminders(userId, updated);
}

/** 清空本机全部提醒缓存（仅本地；云端仍在，下次打开会重新同步） */
export function clearCachedReminders(userId: string | null): void {
  try {
    localStorage.removeItem(keyFor(userId));
  } catch {
    /* 忽略 */
  }
}
