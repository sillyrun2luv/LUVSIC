import { create } from "zustand";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type AnnouncementType = "info" | "update" | "warn";

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  dismiss_key: string;
  active: boolean;
  created_at: string;
}

// 管理员 user_id 白名单（仅你本人的 Supabase 账号可以写公告）
const ADMIN_USER_IDS = new Set(["519c260f-2033-4c86-88f8-be5745d08111"]);

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

export type SheetMode = "none" | "single" | "list" | "admin";

interface AnnouncementState {
  // 数据
  activeAnnouncement: Announcement | null;
  allAnnouncements: Announcement[];

  // UI
  sheetMode: SheetMode;
  /** 管理模式下正在编辑的公告（null 表示发布新的） */
  editingId: string | null;
  form: { title: string; content: string; type: AnnouncementType };

  isAdmin: boolean;
  loading: boolean;
  saving: boolean;

  /** 拉取当前活跃公告（App 启动用，已读不弹） */
  fetchActive: () => Promise<void>;
  /** 拉取全部公告（管理员/用户查看列表） */
  fetchAll: () => Promise<void>;
  /** 判断当前登录用户是否是管理员并写入 isAdmin */
  refreshAdmin: () => Promise<void>;

  /** 打开单条公告弹窗（未读自动弹走这个） */
  openSingle: () => void;
  /** 打开公告列表（设置里的常驻入口） */
  openList: () => Promise<void>;
  /** 打开管理面板（仅管理员可见入口） */
  openAdmin: () => Promise<void>;
  /** 关闭所有公告 sheet */
  close: () => void;
  /** 关闭并标记当前单条为已读 */
  dismiss: () => void;

  /** 管理：初始化一个新公告表单 */
  newForm: () => void;
  /** 管理：加载指定 id 公告到表单 */
  loadForEdit: (id: string) => void;
  /** 管理：编辑表单字段 */
  setFormField: <K extends keyof AnnouncementState["form"]>(
    key: K,
    val: AnnouncementState["form"][K],
  ) => void;
  /** 管理：保存（upsert）当前表单公告并立即激活；若 active=true 会让其他公告下线 */
  save: () => Promise<boolean>;
  /** 管理：把某条公告下线（active=false） */
  deactivate: (id: string) => Promise<boolean>;
  /** 管理：把某条公告重新上线 */
  activate: (id: string) => Promise<boolean>;
  /** 管理：彻底删除一条公告（所有用户不可再见） */
  deleteAnnouncement: (id: string) => Promise<boolean>;
}

async function getCurrentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export const useAnnouncementStore = create<AnnouncementState>((set, get) => ({
  activeAnnouncement: null,
  allAnnouncements: [],
  sheetMode: "none",
  editingId: null,
  form: { title: "", content: "", type: "update" },
  isAdmin: false,
  loading: false,
  saving: false,

  fetchActive: async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return;

      const a = data as Announcement;
      const isRead = getReadKeys().includes(a.dismiss_key);
      set({ activeAnnouncement: a });
      // 已读则不自动弹，但 activeAnnouncement 仍然用于列表和管理员视图
      if (!isRead) set({ sheetMode: "single" });
    } catch {
      /* 忽略 */
    }
  },

  fetchAll: async () => {
    if (!isSupabaseConfigured) return;
    set({ loading: true });
    try {
      const isAdmin = get().isAdmin;
      let q = supabase.from("announcements").select("*");
      // 非管理员只看 active 公告；管理员看全部
      if (!isAdmin) q = q.eq("active", true);
      const { data, error } = await q
        .order("created_at", { ascending: false })
        .limit(100);
      if (!error && data) set({ allAnnouncements: data as Announcement[] });
    } finally {
      set({ loading: false });
    }
  },

  refreshAdmin: async () => {
    const uid = await getCurrentUserId();
    set({ isAdmin: !!uid && ADMIN_USER_IDS.has(uid) });
  },

  openSingle: () => set({ sheetMode: "single" }),

  openList: async () => {
    await get().fetchAll();
    set({ sheetMode: "list" });
  },

  openAdmin: async () => {
    await get().refreshAdmin();
    if (!get().isAdmin) return;
    await get().fetchAll();
    set({ sheetMode: "admin", editingId: null, form: { title: "", content: "", type: "update" } });
  },

  close: () => set({ sheetMode: "none", editingId: null }),

  dismiss: () => {
    const a = get().activeAnnouncement;
    if (a) markRead(a.dismiss_key);
    set({ sheetMode: "none" });
  },

  newForm: () =>
    set({
      editingId: null,
      form: { title: "", content: "", type: "update" },
    }),

  loadForEdit: (id) => {
    const a = get().allAnnouncements.find((x) => x.id === id);
    if (!a) return;
    set({
      editingId: id,
      form: { title: a.title, content: a.content, type: a.type },
    });
  },

  setFormField: (key, val) =>
    set((s) => ({ form: { ...s.form, [key]: val } })),

  save: async () => {
    await get().refreshAdmin();
    if (!get().isAdmin) return false;
    const { form, editingId } = get();
    if (!form.title.trim() || !form.content.trim()) return false;
    set({ saving: true });
    try {
      // 若为发布新公告，先把其他 active 公告都设为 inactive（始终只保留 1 条 active）
      // 注意：先保存（它会 dismiss_key 重新生成 + active=true），再旧的下线，方便前端下次触发弹窗
      const upsertPayload: Record<string, unknown> = {
        title: form.title.trim(),
        content: form.content.trim(),
        type: form.type,
        active: true,
      };
      if (editingId) {
        upsertPayload.id = editingId;
        // 编辑已有公告时也要重置 dismiss_key，确保所有用户重新看到
        upsertPayload.dismiss_key = crypto.randomUUID();
      }
      const { error } = await supabase
        .from("announcements")
        .upsert(upsertPayload as any, { onConflict: "id" });
      if (error) return false;

      // 把其他同类型以外的 active 公告下线
      const { data: current } = await supabase
        .from("announcements")
        .select("id")
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (current && current.length > 1) {
        const newestId = current[0].id;
        const olderIds = current.slice(1).map((r) => r.id);
        if (olderIds.length) {
          await supabase
            .from("announcements")
            .update({ active: false })
            .in("id", olderIds);
        }
        void newestId;
      }
      // 刷新本地
      await get().fetchActive();
      await get().fetchAll();
      get().newForm();
      return true;
    } finally {
      set({ saving: false });
    }
  },

  deactivate: async (id) => {
    await get().refreshAdmin();
    if (!get().isAdmin) return false;
    try {
      const { error } = await supabase
        .from("announcements")
        .update({ active: false })
        .eq("id", id);
      if (error) return false;
      await get().fetchActive();
      await get().fetchAll();
      return true;
    } catch {
      return false;
    }
  },

  activate: async (id) => {
    await get().refreshAdmin();
    if (!get().isAdmin) return false;
    try {
      // 重置 dismiss_key 确保用户会重新看到，同时把其他 active 的下线
      const { error } = await supabase
        .from("announcements")
        .update({ active: true, dismiss_key: crypto.randomUUID() })
        .eq("id", id);
      if (error) return false;
      const { data: current } = await supabase
        .from("announcements")
        .select("id")
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (current && current.length > 1) {
        const olderIds = current.slice(1).map((r) => r.id);
        if (olderIds.length) {
          await supabase
            .from("announcements")
            .update({ active: false })
            .in("id", olderIds);
        }
      }
      await get().fetchActive();
      await get().fetchAll();
      return true;
    } catch {
      return false;
    }
  },

  deleteAnnouncement: async (id) => {
    await get().refreshAdmin();
    if (!get().isAdmin) return false;
    try {
      const { error } = await supabase
        .from("announcements")
        .delete()
        .eq("id", id);
      if (error) return false;
      await get().fetchActive();
      await get().fetchAll();
      return true;
    } catch {
      return false;
    }
  },
}));
