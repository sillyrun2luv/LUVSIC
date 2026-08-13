import { supabase, isSupabaseConfigured } from "./supabase";

/** 排行榜单条记录 */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatar: string;
  totalSeconds: number;
  recordCount: number;
  isMe: boolean;
}

/** 排行榜范围 */
export type LeaderboardScope = "friends" | "global";

function assertConfigured() {
  if (!isSupabaseConfigured) throw new Error("未配置 Supabase，排行榜不可用");
}

async function getUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) throw new Error("未登录");
  return uid;
}

// Supabase RPC 返回的原始行类型
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

function rowToEntry(row: Row): LeaderboardEntry {
  return {
    rank: Number(row.rank) || 0,
    userId: String(row.user_id ?? ""),
    name: String(row.name ?? "用户"),
    avatar: String(row.avatar ?? "🌙"),
    totalSeconds: Number(row.total_seconds) || 0,
    recordCount: Number(row.record_count) || 0,
    isMe: Boolean(row.is_me),
  };
}

/** 好友时长榜（含我自己） */
export async function fetchFriendsLeaderboard(): Promise<LeaderboardEntry[]> {
  assertConfigured();
  await getUserId();
  const { data, error } = await supabase.rpc("leaderboard_friends");
  if (error) throw new Error("获取好友榜失败：" + error.message);
  return (data as Row[] ?? []).map(rowToEntry);
}

/** 全球时长榜（默认 100 条，保证自己在榜内） */
export async function fetchGlobalLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
  assertConfigured();
  await getUserId();
  const { data, error } = await supabase.rpc("leaderboard_global", { p_limit: limit });
  if (error) throw new Error("获取全球榜失败：" + error.message);
  return (data as Row[] ?? []).map(rowToEntry);
}

/**
 * 把秒数格式化为人类可读时长
 *  - < 60s → "45 秒"
 *  - < 60min → "12 分"
 *  - < 24h → "3 小时 20 分"
 *  - ≥ 24h → "2 天 5 小时"
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0 分";
  const totalMin = Math.floor(seconds / 60);
  if (totalMin < 1) return `${seconds} 秒`;
  if (totalMin < 60) return `${totalMin} 分`;
  const hours = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (hours < 24) return min > 0 ? `${hours} 小时 ${min} 分` : `${hours} 小时`;
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  return h > 0 ? `${days} 天 ${h} 小时` : `${days} 天`;
}

/** 好友近 N 小时统计（RPC 返回 first_at_ms / last_at_ms 毫秒 bigint，避免 timestamptz 隐式转换越界） */
export interface FriendStats {
  totalSeconds: number;
  recordCount: number;
  firstAtMs: number | null;
  lastAtMs: number | null;
  byDay: { day: string; count: number; seconds: number }[];
}

// ---------- PK 对比 ----------
export interface PKStatsSide {
  userId: string;
  isMe: boolean;
  name: string;
  avatar: string;
  totalSecondsAll: number;
  recordCountAll: number;
  totalSecondsRecent: number;
  recordCountRecent: number;
}

export async function fetchPKStats(
  friendUserId: string,
  recentHours = 100,
): Promise<{ me: PKStatsSide | null; friend: PKStatsSide | null }> {
  assertConfigured();
  await getUserId();
  const { data, error } = await supabase.rpc("pk_stats", {
    p_friend_uuid: friendUserId,
    p_hours_for_recent: recentHours,
  });
  if (error) throw new Error("获取 PK 数据失败：" + error.message);
  const rows = Array.isArray(data) ? (data as any[]) : [];
  let me: PKStatsSide | null = null;
  let friend: PKStatsSide | null = null;
  for (const row of rows) {
    const side: PKStatsSide = {
      userId: String(row.user_id ?? ""),
      isMe: Boolean(row.is_me),
      name: String(row.name ?? "用户"),
      avatar: String(row.avatar ?? "🌙"),
      totalSecondsAll: Number(row.total_seconds_all) || 0,
      recordCountAll: Number(row.record_count_all) || 0,
      totalSecondsRecent: Number(row.total_seconds_recent) || 0,
      recordCountRecent: Number(row.record_count_recent) || 0,
    };
    if (side.isMe) me = side;
    else friend = side;
  }
  return { me, friend };
}

/**
 * 获取好友近 N 小时内的统计（默认 100h）。
 * 隐私由后端 RPC 控制：必须是 accepted 好友且对方开启 show_aggregates_to_friends。
 * 不满足时返回 null（前端显示"对方未开放"）。
 */
export async function fetchFriendStats(
  friendUserId: string,
  hours = 100,
): Promise<FriendStats | null> {
  assertConfigured();
  await getUserId();
  const { data, error } = await supabase.rpc("friend_stats", {
    p_friend_uuid: friendUserId,
    p_hours: hours,
  });
  if (error) throw new Error("获取好友统计失败：" + error.message);
  // 不满足隐私条件时 RPC 返回空行
  if (!data || (Array.isArray(data) && data.length === 0)) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  const byDay: { day: string; count: number; seconds: number }[] = Array.isArray(row.by_day)
    ? row.by_day.map((d: any) => ({
        day: String(d.day ?? ""),
        count: Number(d.count) || 0,
        seconds: Number(d.seconds) || 0,
      }))
    : [];

  return {
    totalSeconds: Number(row.total_seconds) || 0,
    recordCount: Number(row.record_count) || 0,
    firstAtMs: row.first_at_ms ? Number(row.first_at_ms) : null,
    lastAtMs: row.last_at_ms ? Number(row.last_at_ms) : null,
    byDay,
  };
}
