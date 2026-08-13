import { supabase, isSupabaseConfigured } from "./supabase";
import type { FriendshipStatus, PublicUser } from "@/types";

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
  if (!isSupabaseConfigured) throw new Error("未配置 Supabase，社交功能不可用");
}

async function getUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) throw new Error("未登录");
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
  if (error) throw new Error("搜索失败：" + error.message);

  return (data as Row[] ?? []).map((row: Row) => ({
    userId: row.user_id,
    name: row.name ?? "用户",
    avatar: row.avatar ?? "🌙",
    relation: (row.relation as PublicUser["relation"]) ?? "stranger",
  }));
}

/** 获取当前登录用户的好友列表（仅 accepted） */
export async function getFriendList(): Promise<PublicUser[]> {
  assertConfigured();
  await getUserId();
  const { data, error } = await supabase.rpc("my_friends");
  if (error) throw new Error("获取好友列表失败：" + error.message);

  return (data as Row[] ?? []).map((row: Row) => ({
    userId: row.user_id,
    name: row.name ?? "用户",
    avatar: row.avatar ?? "🌙",
    relation: "friend" as const,
  }));
}

/** 获取收到的好友申请 */
export async function getIncomingRequests(): Promise<PendingRequest[]> {
  assertConfigured();
  await getUserId();
  const { data, error } = await supabase.rpc("incoming_requests");
  if (error) throw new Error("获取收到的申请失败：" + error.message);

  return (data as Row[] ?? []).map((row: Row) => ({
    friendshipId: row.friendship_id,
    user: {
      userId: row.user_id,
      name: row.name ?? "用户",
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
  if (error) throw new Error("获取发出的申请失败：" + error.message);

  return (data as Row[] ?? []).map((row: Row) => ({
    friendshipId: row.friendship_id,
    user: {
      userId: row.user_id,
      name: row.name ?? "用户",
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
  if (toUserId === me) throw new Error("不能加自己为好友");

  // 1. 检查是否已经互有 pending：对方发给我了 → 直接 accept 对方那条
  const { data: crossPending, error: crossErr } = await supabase
    .from("friendships")
    .select("id, status")
    .eq("from_user_id", toUserId)
    .eq("to_user_id", me)
    .eq("status", "pending")
    .maybeSingle();
  if (crossErr) throw new Error("检查好友关系失败：" + crossErr.message);
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
  if (existErr) throw new Error("检查好友关系失败：" + existErr.message);

  if (existing) {
    if (existing.status === "accepted") return; // 已经是好友
    if (existing.status === "pending") return;  // 已经发送过
    // rejected / cancelled：覆盖重发
    const { error: upsErr } = await supabase
      .from("friendships")
      .update({ status: "pending" as FriendshipStatus, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (upsErr) throw new Error("重新发送失败：" + upsErr.message);
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
      throw new Error("发送申请失败：" + insErr.message);
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
  if (error) throw new Error("接受失败：" + error.message);
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
  if (error) throw new Error("拒绝失败：" + error.message);
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
  if (error) throw new Error("撤销失败：" + error.message);
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
  if (error) throw new Error("删除好友失败：" + error.message);
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
    console.warn("[checkNameConflict] RPC error:", error.message);
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
