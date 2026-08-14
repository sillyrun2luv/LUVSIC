import { create } from "zustand";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type AnnouncementType = "info" | "update" | "warn";

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  dismiss_key: string;
}

const READ_KEY = "zwba_read_announcements";
const MAX_READ = 50;

function getReadKeys(): string[] {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function markRead(key: string) {
  try {
    const keys = getReadKeys();
    if (!keys.includes(key)) {
      keys.push(key);
      localStorage.setItem(READ_KEY, JSON.stringify(keys.slice(-MAX_READ)));
    }
  } catch {
    /* 忽略存储错误 */
  }
}

interface AnnouncementState {
  announcement: Announcement | null;
  sheetOpen: boolean;
  /** 拉取最新一条活跃公告，已读则不弹 */
  fetchActive: () => Promise<void>;
  /** 关闭弹窗并标记已读 */
  dismiss: () => void;
}

export const useAnnouncementStore = create<AnnouncementState>((set, get) => ({
  announcement: null,
  sheetOpen: false,

  fetchActive: async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, content, type, dismiss_key")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("[announcement]", error.message);
        return;
      }
      if (!data) return;

      // 已读则不弹
      if (getReadKeys().includes(data.dismiss_key)) return;

      set({ announcement: data as Announcement, sheetOpen: true });
    } catch {
      /* 忽略网络错误 */
    }
  },

  dismiss: () => {
    const a = get().announcement;
    if (a) markRead(a.dismiss_key);
    set({ sheetOpen: false });
  },
}));
