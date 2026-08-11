import { supabase } from "./supabase";
import { useRecordStore } from "@/store/useRecordStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useThemeStore } from "@/store/useThemeStore";
import { toast } from "@/store/useToastStore";
import type { RecordEntry } from "@/types";

let syncing = false;

/** 本地记录 → 云端行（duration 存秒，避免 integer 精度丢失） */
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
  };
}

/** 云端行 → 本地记录（duration 秒→分钟） */
function fromRow(row: any): RecordEntry {
  return {
    id: row.local_id ?? row.id,
    timestamp: Number(row.timestamp) || 0,
    duration: (Number(row.duration) || 0) / 60,
    forms: Array.isArray(row.forms) ? row.forms : [],
    tools: Array.isArray(row.tools) ? row.tools : [],
    note: row.note ?? undefined,
    createdAt: Number(row.created_at) || 0,
  };
}

/** 备份云端所有记录（用于撤销上传） */
async function backupCloudRecords(userId: string) {
  const { data, error } = await supabase
    .from("records")
    .select("*")
    .eq("user_id", userId);
  if (error) throw new Error("备份云端数据失败: " + error.message);
  return data ?? [];
}

/** 恢复云端备份（撤销上传时用） */
async function restoreCloudRecords(userId: string, backup: any[]) {
  // 先清空云端
  await supabase.from("records").delete().eq("user_id", userId);
  // 再写回备份
  if (backup.length > 0) {
    await supabase.from("records").upsert(backup, { onConflict: "user_id,local_id" });
  }
}

/**
 * 上传到云端（本地 → 云端，覆盖云端）
 * 返回备份供撤销使用
 */
export async function uploadToCloud(userId: string) {
  if (syncing) throw new Error("正在同步中");
  if (!userId) throw new Error("未登录");
  syncing = true;

  try {
    // 1. 备份云端
    const backup = await backupCloudRecords(userId);

    // 2. 清空云端记录
    const { error: delErr } = await supabase
      .from("records")
      .delete()
      .eq("user_id", userId);
    if (delErr) throw new Error("清空云端记录失败: " + delErr.message);

    // 3. 上传本地所有记录
    const localRecords = useRecordStore.getState().records;
    const toUpsert = localRecords.map((r) => toRow(r, userId));
    if (toUpsert.length > 0) {
      const { error: upErr } = await supabase
        .from("records")
        .upsert(toUpsert, { onConflict: "user_id,local_id" });
      if (upErr) {
        // 上传失败，尝试恢复备份
        await restoreCloudRecords(userId, backup);
        throw new Error("上传记录失败: " + upErr.message);
      }
    }

    // 4. 上传设置（不含密码锁）
    const { settings } = useRecordStore.getState();
    const { themeId, customColor } = useThemeStore.getState();
    await supabase.from("user_settings").upsert({
      user_id: userId,
      reminder: settings.reminder as any,
      theme_id: themeId,
      custom_color: customColor,
    });

    // 5. 上传个人资料
    const { name, avatar } = useProfileStore.getState();
    await supabase.from("user_profile").upsert({
      user_id: userId,
      name,
      avatar,
    });

    // 返回撤销函数
    return () => restoreCloudRecords(userId, backup);
  } finally {
    syncing = false;
  }
}

/**
 * 下载到本地（云端 → 本地，覆盖本地）
 * 返回备份供撤销使用
 */
export async function downloadFromCloud(userId: string) {
  if (syncing) throw new Error("正在同步中");
  if (!userId) throw new Error("未登录");
  syncing = true;

  try {
    // 1. 备份本地记录
    const localBackup = useRecordStore.getState().records.slice();
    const settingsBackup = useRecordStore.getState().settings;
    const themeBackup = { themeId: useThemeStore.getState().themeId, customColor: useThemeStore.getState().customColor };

    // 2. 拉取云端所有记录（不含已软删除的）
    const { data: remoteRows, error } = await supabase
      .from("records")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (error) throw new Error("拉取记录失败: " + error.message);

    // 3. 用云端记录替换本地
    const cloudRecords = (remoteRows ?? []).map(fromRow);
    useRecordStore.setState({ records: cloudRecords });

    // 4. 下载设置
    const { data: remoteSettings } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (remoteSettings) {
      if (remoteSettings.reminder) {
        useRecordStore.getState().setReminder(remoteSettings.reminder);
      }
      if (remoteSettings.theme_id) {
        useThemeStore.getState().setTheme(remoteSettings.theme_id);
      }
      if (remoteSettings.custom_color) {
        useThemeStore.getState().setCustomColor(remoteSettings.custom_color);
      }
    }

    // 5. 下载个人资料
    const { data: remoteProfile } = await supabase
      .from("user_profile")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (remoteProfile) {
      if (remoteProfile.name !== undefined) useProfileStore.getState().setName(remoteProfile.name);
      if (remoteProfile.avatar !== undefined) useProfileStore.getState().setAvatar(remoteProfile.avatar);
    }

    // 返回撤销函数
    return () => {
      useRecordStore.setState({ records: localBackup, settings: settingsBackup });
      useThemeStore.getState().setTheme(themeBackup.themeId);
      useThemeStore.getState().setCustomColor(themeBackup.customColor);
    };
  } finally {
    syncing = false;
  }
}

export function isSyncing() {
  return syncing;
}

/** 获取云端记录数 */
export async function getCloudRecordCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("records")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null);
  if (error) return 0;
  return count ?? 0;
}
