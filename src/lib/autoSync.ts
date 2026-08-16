import { useRecordStore } from "@/store/useRecordStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useThemeStore } from "@/store/useThemeStore";
import { supabase, isSupabaseConfigured } from "./supabase";
import { isSyncing } from "./sync";
import { toast } from "@/store/useToastStore";
import type { RecordEntry } from "@/types";
import { t } from "@/store/useI18nStore";

export type AutoSyncStatus =
  | "idle"          // 未登录 / 未启动
  | "waiting"       // debounce 等待中（已标记 dirty）
  | "syncing"       // 正在与云端同步
  | "synced"        // 最近一次同步成功
  | "error";        // 最近一次同步失败

let started = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;
let forceFull = false;        // 下一次走"整批替换"（和手动上传一致）
let _status: AutoSyncStatus = "idle";
const statusListeners = new Set<(s: AutoSyncStatus) => void>();
let errorMessage: string | null = null;

function setStatus(s: AutoSyncStatus) {
  _status = s;
  statusListeners.forEach((l) => {
    try { l(s); } catch { /* ignore */ }
  });
}

export function getAutoSyncStatus(): AutoSyncStatus {
  return _status;
}
export function getAutoSyncError(): string | null {
  return errorMessage;
}

export function onAutoSyncStatusChange(cb: (s: AutoSyncStatus) => void): () => void {
  statusListeners.add(cb);
  return () => statusListeners.delete(cb);
}

/** 把本地单条记录 → 云端行（duration 存秒） */
function toRow(r: RecordEntry, userId: string) {
  return {
    user_id: userId,
    local_id: r.id,
    timestamp: Number(r.timestamp) || 0,
    duration: Math.round((Number(r.duration) || 0) * 60),
    forms: Array.isArray(r.forms) ? r.forms : [],
    tools: Array.isArray(r.tools) ? r.tools : [],
    note: r.note ?? null,
    created_at: Number(r.createdAt) || 0,
    deleted_at: null,
    is_timer_entry: Boolean(r.isTimerEntry),
  };
}

async function getUserId(): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * 增量同步：
 *  - records：本地 vs 云端(local_id) 做 diff → upsert 新增/修改
 *              zwba_deleted 里存在的本地 id → 软删除云端
 *  - settings / profile：全量 upsert
 *  - 若 forceFull=true：走原来的清空→重传策略（和手动上传一致）
 */
async function doSync() {
  if (!isSupabaseConfigured) return;
  if (isSyncing()) return; // 手动同步进行中，交给它
  const userId = await getUserId();
  if (!userId) return;

  setStatus("syncing");
  errorMessage = null;

  try {
    // 0) 安全检查：本地记录少于云端时，不自动覆盖云端
    const localRecordCount = useRecordStore.getState().records.length;
    const { count: cloudCount, error: cntErr } = await supabase
      .from("records")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (!cntErr && typeof cloudCount === "number" && localRecordCount < cloudCount) {
      setStatus("error");
      errorMessage = t('settings.cloudSync.localLessThanCloud', localRecordCount, cloudCount);
      toast(
        t('settings.cloudSync.localLessThanCloudWarn', localRecordCount, cloudCount),
        "warn",
      );
      setTimeout(() => {
        if (_status === "error") setStatus("idle");
      }, 10_000);
      return;
    }
    // 1) 设置 + 主题
    const { settings } = useRecordStore.getState();
    const { themeId, customColor } = useThemeStore.getState();
    await supabase.from("user_settings").upsert({
      user_id: userId,
      reminder: settings.reminder as any,
      theme_id: themeId,
      custom_color: customColor,
    });

    // 2) 个人资料
    const { name, avatar, searchable, showAggregatesToFriends } = useProfileStore.getState();
    await supabase.from("user_profile").upsert({
      user_id: userId,
      name,
      avatar,
      searchable,
      show_aggregates_to_friends: showAggregatesToFriends,
    }, { onConflict: "user_id" });

    // 3) 记录
    const localRecords = useRecordStore.getState().records;
    let deleted: string[] = [];
    try {
      deleted = JSON.parse(localStorage.getItem("zwba_deleted") || "[]");
    } catch { /* ignore */ }

    if (forceFull) {
      // 清空云端 → 重传（和手动上传一致）
      const { error: delErr } = await supabase
        .from("records")
        .delete()
        .eq("user_id", userId);
      if (delErr) throw new Error(t('settings.cloudSync.clearCloudFailed', delErr.message));
      const rows = localRecords.map((r) => toRow(r, userId));
      if (rows.length > 0) {
        const { error: upErr } = await supabase
          .from("records")
          .upsert(rows, { onConflict: "user_id,local_id" });
        if (upErr) throw new Error(t('settings.cloudSync.uploadFailed', upErr.message));
      }
      forceFull = false;
    } else {
      // 软删除：zwba_deleted 中的 id
      if (deleted.length > 0) {
        const { error: dErr } = await supabase
          .from("records")
          .update({ deleted_at: Date.now() })
          .eq("user_id", userId)
          .in("local_id", deleted);
        if (dErr) throw new Error(t('settings.cloudSync.uploadFailed', dErr.message));
        // 同步成功后清空 deleted 集合
        try { localStorage.removeItem("zwba_deleted"); } catch { /* ignore */ }
      }

      // upsert：当前本地所有记录（会覆盖之前被软删后又恢复的）
      if (localRecords.length > 0) {
        const rows = localRecords.map((r) => toRow(r, userId));
        const CHUNK = 200;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          const { error: upErr } = await supabase
            .from("records")
            .upsert(chunk, { onConflict: "user_id,local_id" });
          if (upErr) throw new Error(t('settings.cloudSync.uploadFailed', upErr.message));
        }
      }
    }

    setStatus("synced");
    // 3 秒后回到 idle，方便下次"刚同步成功"的视觉反馈不一直显示
    setTimeout(() => {
      if (_status === "synced") setStatus("idle");
    }, 3000);
  } catch (e: any) {
    errorMessage = e?.message || t('settings.cloudSync.syncFailed');
    setStatus("error");
    // 10 秒后切回 idle，允许用户后续操作再触发
    setTimeout(() => {
      if (_status === "error") setStatus("idle");
    }, 10_000);
  }
}

function schedule() {
  if (!isSupabaseConfigured) return;
  // debounce 1.5s：用户连续新增/编辑/改设置只触发一次
  if (debounceTimer) clearTimeout(debounceTimer);
  setStatus("waiting");
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    dirty = false;
    void doSync();
  }, 1500);
}

function markDirty() {
  dirty = true;
  schedule();
}

/** 手动触发一次同步（比如登录后立即），可选强制整批替换 */
export function triggerAutoSync({ full = false }: { full?: boolean } = {}) {
  if (full) forceFull = true;
  if (debounceTimer) clearTimeout(debounceTimer);
  dirty = true;
  schedule();
}

/**
 * 启动自动云同步监听。
 *  - 订阅 records/settings/profile 变化 → debounce 后增量上传
 *  - 登录后第一次立即传一次（全量，安全）
 *  - 只初始化一次
 */
export function startAutoSync() {
  if (started) return;
  started = true;

  // 登录态变化：如果 user 出现，立刻做一次全量同步（保证云端覆盖完整）
  let lastUid: string | null = null;
  const pollUid = async () => {
    const uid = await getUserId();
    if (uid && uid !== lastUid) {
      lastUid = uid;
      triggerAutoSync({ full: true });
    }
    if (!uid) lastUid = null;
  };

  // 每次 auth state change 之后检查
  supabase.auth.onAuthStateChange(() => {
    void pollUid();
  });
  // 启动时立刻检查一次（可能刷新页面时已有 session）
  void pollUid();

  // records 变化（新增/删除/编辑/导入/清空）
  useRecordStore.subscribe((_next, prev) => {
    const n = useRecordStore.getState();
    if (
      prev.records.length !== n.records.length ||
      prev.settings !== n.settings ||
      JSON.stringify(prev.settings) !== JSON.stringify(n.settings)
    ) {
      markDirty();
    }
  });

  // profile 变化（昵称/头像/隐私）
  useProfileStore.subscribe((next, prev) => {
    if (
      next.name !== prev.name ||
      next.avatar !== prev.avatar ||
      next.searchable !== prev.searchable ||
      next.showAggregatesToFriends !== prev.showAggregatesToFriends
    ) {
      // profile setter 本身也会立刻自己上传一次，这里再兜底
      markDirty();
    }
  });

  // theme 变化
  useThemeStore.subscribe((next, prev) => {
    if (next.themeId !== prev.themeId || next.customColor !== prev.customColor) {
      markDirty();
    }
  });
}
