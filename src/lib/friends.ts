import { supabase, isSupabaseConfigured } from "./supabase";
import type { FriendshipStatus, PublicUser } from "@/types";
import { lookupArray, t } from "@/store/useI18nStore";

/** 提醒类别：注意身体 / 记得放松（不可 DIY，仅 2 类） */
export type FriendReminderCategory = "care_health" | "remember_relax";

export interface SendFriendReminderResult {
  sent: boolean;
  remaining_today: number;
  message?: string;
  error?: string;
}

export interface FriendReminderQuota {
  remaining_today: number;
  used_today: number;
}

/** 收到的好友提醒（收件箱用） */
export interface ReceivedFriendReminder {
  id: string;
  fromUserId: string;
  fromName: string;
  fromAvatar: string;
  category: FriendReminderCategory;
  message: string;
  createdAt: number; // ms; 0 表示未知
  readAt: number | null; // ms 或 null（未读）
}

function _getAssertSupabase() {
  if (!isSupabaseConfigured) return null;
  return supabase;
}

async function _requireMe(): Promise<string | null> {
  const s = _getAssertSupabase();
  if (!s) return null;
  try {
    const { data: { user } } = await s.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/** 从 i18n 的 10 句模板随机选一条（三语各自独立） */
export function pickRandomReminderMessage(category: FriendReminderCategory): string {
  const key = category === "care_health"
    ? "friendReminder.templates.careHealth"
    : "friendReminder.templates.rememberRelax";
  const arr = lookupArray(key);
  if (arr.length === 0) {
    return category === "care_health"
      ? "Take care of yourself."
      : "Take a moment to relax.";
  }
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 发送好友提醒：
 * - 必须是 accepted 双向好友
 * - 每日限 2 次（由 send_friend_remind RPC 限频）
 * - message 由前端通过 pickRandomReminderMessage 选好传入（保证多语言一致）
 */
export async function sendFriendReminder(
  toUserId: string,
  category: FriendReminderCategory,
  message: string,
): Promise<SendFriendReminderResult> {
  const s = _getAssertSupabase();
  if (!s) {
    return { sent: false, remaining_today: 0, error: "NOT_LOGGED_IN" };
  }
  const me = await _requireMe();
  if (!me) {
    return { sent: false, remaining_today: 0, error: "NOT_LOGGED_IN" };
  }
  try {
    const { data, error } = await s.rpc("send_friend_remind", {
      p_to_uid: toUserId,
      p_category: category,
      p_message: message,
    });
    if (error) {
      console.warn("[sendFriendReminder] rpc error:", error.message);
      return { sent: false, remaining_today: 0, error: error.message };
    }
    const row = (Array.isArray(data) ? data[0] : (data as any)) as
      | { sent: boolean; remaining_today: number; message?: string; error?: string }
      | undefined;
    return {
      sent: !!row?.sent,
      remaining_today: Number(row?.remaining_today ?? 0),
      message: row?.message,
      error: row?.error || undefined,
    };
  } catch (e: any) {
    return { sent: false, remaining_today: 0, error: e?.message || "UNKNOWN" };
  }
}

/** 打开 Sheet 时调用：我对「某位好友」今日还剩几次 + 已用几次（每好友 2 次/天） */
export async function getFriendRemindQuotaToday(toUserId: string): Promise<FriendReminderQuota> {
  const s = _getAssertSupabase();
  if (!s) return { remaining_today: 2, used_today: 0 };
  try {
    await _requireMe();
    const { data, error } = await s.rpc("get_friend_remind_quota_today", { p_to_uid: toUserId });
    if (error) return { remaining_today: 2, used_today: 0 };
    const row = (Array.isArray(data) ? data[0] : (data as any)) as
      | { remaining_today: number; used_today: number }
      | undefined;
    return {
      remaining_today: Number(row?.remaining_today ?? 2),
      used_today: Number(row?.used_today ?? 0),
    };
  } catch {
    return { remaining_today: 2, used_today: 0 };
  }
}

/** 收件箱：拉取「我收到的」好友提醒（按时间倒序） */
export async function getReceivedFriendReminders(limit = 50, offset = 0): Promise<ReceivedFriendReminder[]> {
  const s = _getAssertSupabase();
  if (!s) return [];
  try {
    const { data, error } = await s.rpc("get_received_friend_reminders", {
      p_limit: limit,
      p_offset: offset,
    });
    if (error) throw error;
    return (data as Row[] ?? []).map((row: Row) => ({
      id: row.id,
      fromUserId: row.from_user_id,
      fromName: row.from_name ?? t("friendsLib.unknownUser"),
      fromAvatar: row.from_avatar ?? "🌙",
      category: (row.category as FriendReminderCategory) ?? "care_health",
      message: row.message ?? "",
      createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
      readAt: row.read_at ? new Date(row.read_at).getTime() : null,
    }));
  } catch (e: any) {
    console.warn("[getReceivedFriendReminders]", e?.message);
    return [];
  }
}

/** 收件箱：我收到的未读提醒数量（红点用） */
export async function getFriendReminderUnreadCount(): Promise<number> {
  const s = _getAssertSupabase();
  if (!s) return 0;
  try {
    const { data, error } = await s.rpc("get_friend_reminder_unread_count");
    if (error) return 0;
    return Number(data) || 0;
  } catch {
    return 0;
  }
}

/** 收件箱：批量标记已读（已有 RPC mark_friend_reminders_read） */
export async function markFriendRemindersRead(ids: string[]): Promise<void> {
  const s = _getAssertSupabase();
  if (!s || ids.length === 0) return;
  try {
    const { error } = await s.rpc("mark_friend_reminders_read", { p_ids: ids });
    if (error) throw error;
  } catch (e: any) {
    console.warn("[markFriendRemindersRead]", e?.message);
  }
}

/** 收件箱：删除单条收到的提醒（已加 RPC delete_friend_reminder，仅收件人本人可删） */
export async function deleteFriendReminder(id: string): Promise<void> {
  const s = _getAssertSupabase();
  if (!s) return;
  try {
    const { error } = await s.rpc("delete_friend_reminder", { p_id: id });
    if (error) throw error;
  } catch (e: any) {
    console.warn("[deleteFriendReminder]", e?.message);
  }
}

/** 待审核（收到的 + 发出的）前端用数据结构 */
export interface PendingRequest {
  friendshipId: string;
  user: PublicUser;
  createdAt: number;
  direction: "incoming" | "outgoing";
}

// RPC 返回的原始行类型（Supabase RPC 返回 any[]，这里给内部用一个弱类型）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

function assertConfigured() {
  if (!isSupabaseConfigured) throw new Error(t('friendsLib.notConfigured'));
}

async function getUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) throw new Error(t('friendsLib.notLoggedIn'));
  return uid;
}

/**
 * 搜索用户（通过昵称关键字）。
 * 只会返回开启了「允许被搜索」的用户，不含自己，含 relation 标记。
 */
export async function searchUsers(keyword: string): Promise<PublicUser[]> {
  assertConfigured();
  await getUserId();
  const trimmed = keyword.trim();
  if (trimmed.length < 2) return [];

  const { data, error } = await supabase.rpc("search_users", { keyword: trimmed });
  if (error) throw new Error(t('friendsLib.searchFailed', error.message));

  return (data as Row[] ?? []).map((row: Row) => ({
    userId: row.user_id,
    name: row.name ?? t('friendsLib.notConfigured'),
    avatar: row.avatar ?? "🌙",
    relation: (row.relation as PublicUser["relation"]) ?? "stranger",
  }));
}

/** 获取当前登录用户的好友列表（仅 accepted） */
export async function getFriendList(): Promise<PublicUser[]> {
  assertConfigured();
  await getUserId();
  const { data, error } = await supabase.rpc("my_friends");
  if (error) throw new Error(t('friendsLib.getFriendListFailed', error.message));

  return (data as Row[] ?? []).map((row: Row) => ({
    userId: row.user_id,
    name: row.name ?? t('friendsLib.notConfigured'),
    avatar: row.avatar ?? "🌙",
    relation: "friend" as const,
  }));
}

/** 获取收到的好友申请 */
export async function getIncomingRequests(): Promise<PendingRequest[]> {
  assertConfigured();
  await getUserId();
  const { data, error } = await supabase.rpc("incoming_requests");
  if (error) throw new Error(t('friendsLib.getIncomingFailed', error.message));

  return (data as Row[] ?? []).map((row: Row) => ({
    friendshipId: row.friendship_id,
    user: {
      userId: row.user_id,
      name: row.name ?? t('friendsLib.notConfigured'),
      avatar: row.avatar ?? "🌙",
      relation: "pending_to_me",
    },
    createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
    direction: "incoming" as const,
  }));
}

/** 获取发出的好友申请 */
export async function getOutgoingRequests(): Promise<PendingRequest[]> {
  assertConfigured();
  await getUserId();
  const { data, error } = await supabase.rpc("outgoing_requests");
  if (error) throw new Error(t('friendsLib.getOutgoingFailed', error.message));

  return (data as Row[] ?? []).map((row: Row) => ({
    friendshipId: row.friendship_id,
    user: {
      userId: row.user_id,
      name: row.name ?? t('friendsLib.notConfigured'),
      avatar: row.avatar ?? "🌙",
      relation: "pending_from_me",
    },
    createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
    direction: "outgoing" as const,
  }));
}

/** 待审核数量（红点用） */
export async function getPendingCount(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) return 0;
  const { data, error } = await supabase.rpc("pending_count");
  if (error) return 0;
  return Number(data) || 0;
}

/**
 * 发起好友申请。
 * 注意：如果对方已经给我发了申请（B→A pending 时 A→B 再发），
 * 我们直接先 accept 对方那条 pending，跳过这次发送（结果等价于互加好友）。
 */
export async function sendFriendRequest(toUserId: string): Promise<void> {
  assertConfigured();
  const me = await getUserId();
  if (toUserId === me) throw new Error(t('friendsLib.cannotAddSelf'));

  // 1. 检查是否已经互有 pending：对方发给我了 → 直接 accept 对方那条
  const { data: crossPending, error: crossErr } = await supabase
    .from("friendships")
    .select("id, status")
    .eq("from_user_id", toUserId)
    .eq("to_user_id", me)
    .eq("status", "pending")
    .maybeSingle();
  if (crossErr) throw new Error(t('friendsLib.checkRelationFailed', crossErr.message));
  if (crossPending) {
    // 对方已给我发 pending → 我 accept 这条，就变成 accepted 了
    await acceptFriendRequest(crossPending.id);
    return;
  }

  // 2. 检查是否已经存在同方向关系（accepted 或 pending），避免重复申请
  const { data: existing, error: existErr } = await supabase
    .from("friendships")
    .select("id, status")
    .eq("from_user_id", me)
    .eq("to_user_id", toUserId)
    .maybeSingle();
  if (existErr) throw new Error(t('friendsLib.checkRelationFailed', existErr.message));

  if (existing) {
    if (existing.status === "accepted") return; // 已经是好友
    if (existing.status === "pending") return;  // 已经发送过
    // rejected / cancelled：覆盖重发
    const { error: upsErr } = await supabase
      .from("friendships")
      .update({ status: "pending" as FriendshipStatus, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (upsErr) throw new Error(t('friendsLib.resendFailed', upsErr.message));
    return;
  }

  // 3. 插入新申请
  const { error: insErr } = await supabase.from("friendships").insert({
    from_user_id: me,
    to_user_id: toUserId,
    status: "pending" as FriendshipStatus,
  });
  if (insErr) {
    // unique 冲突也当成成功（可能对方同时发过来，最终状态看查询）
    if (String(insErr.code) !== "23505") {
      throw new Error(t('friendsLib.sendRequestFailed', insErr.message));
    }
  }
}

/** 接受好友申请（只能是 to_user_id = 我的那条 pending） */
export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  assertConfigured();
  await getUserId();
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" as FriendshipStatus })
    .eq("id", friendshipId)
    .eq("status", "pending" as FriendshipStatus);
  if (error) throw new Error(t('friendsLib.acceptFailed', error.message));
}

/** 拒绝好友申请 */
export async function rejectFriendRequest(friendshipId: string): Promise<void> {
  assertConfigured();
  await getUserId();
  const { error } = await supabase
    .from("friendships")
    .update({ status: "rejected" as FriendshipStatus })
    .eq("id", friendshipId)
    .eq("status", "pending" as FriendshipStatus);
  if (error) throw new Error(t('friendsLib.rejectFailed', error.message));
}

/** 撤销自己发出的申请 */
export async function cancelFriendRequest(friendshipId: string): Promise<void> {
  assertConfigured();
  await getUserId();
  const { error } = await supabase
    .from("friendships")
    .update({ status: "cancelled" as FriendshipStatus })
    .eq("id", friendshipId)
    .eq("status", "pending" as FriendshipStatus);
  if (error) throw new Error(t('friendsLib.cancelFailed', error.message));
}

/**
 * 删除好友（软删除 = 把双方都看到的那条 accepted 改成 cancelled）
 * 前端传 friendUserId，函数内部自动找 id
 */
export async function removeFriend(friendUserId: string): Promise<void> {
  assertConfigured();
  const me = await getUserId();
  if (friendUserId === me) return;

  // 无论 A→B 还是 B→A，只要 status=accepted 就置为 cancelled
  const { error } = await supabase
    .from("friendships")
    .update({ status: "cancelled" as FriendshipStatus })
    .eq("status", "accepted" as FriendshipStatus)
    .or(`and(from_user_id.eq.${me},to_user_id.eq.${friendUserId}),and(from_user_id.eq.${friendUserId},to_user_id.eq.${me})`);
  if (error) throw new Error(t('friendsLib.removeFailed', error.message));
}

/**
 * 昵称重名检测。
 * @param targetName 新昵称
 * @param excludeUserId 自己的 user id（可选，为了改名时允许自己的昵称不算冲突）
 * @returns { conflict: boolean, conflictName?: string }
 */
export async function checkNameConflict(
  targetName: string,
  excludeUserId?: string,
): Promise<{ conflict: boolean; conflictName?: string }> {
  if (!isSupabaseConfigured) {
    // 离线/没配置：不做冲突拦截，让用户继续（最终云端 UNIQUE 还会兜底）
    return { conflict: false };
  }
  const { data, error } = await supabase.rpc("check_name_conflict", {
    p_target_name: targetName,
    p_exclude_user: excludeUserId ?? null,
  });
  if (error) {
    console.warn("[checkNameConflict] " + t('friendsLib.rpcError'), error.message);
    return { conflict: false }; // RPC 失败也放行，云端 UNIQUE 兜底
  }
  const row = (Array.isArray(data) ? data[0] : (data as any)) as
    | { conflict: boolean; conflict_name?: string | null }
    | undefined;
  return {
    conflict: Boolean(row?.conflict),
    conflictName: row?.conflict_name ?? undefined,
  };
}
