import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Megaphone,
  Sparkles,
  AlertCircle,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Save,
  ChevronLeft,
  Users,
  Trash2,
} from "lucide-react";
import {
  useAnnouncementStore,
  type Announcement,
  type AnnouncementType,
} from "@/store/useAnnouncementStore";
import { toast } from "@/store/useToastStore";
import { cn } from "@/lib/utils";
import { t } from "@/store/useI18nStore";

const STYLES: Record<
  AnnouncementType,
  { Icon: typeof Megaphone; color: string; bg: string; labelKey: string }
> = {
  info: { Icon: Megaphone, color: "text-mist", bg: "bg-mist/15", labelKey: "announcement.title" },
  update: { Icon: Sparkles, color: "text-amber-glow", bg: "bg-amber/15", labelKey: "announcement.typeUpdate" },
  warn: { Icon: AlertCircle, color: "text-amber-glow", bg: "bg-amber/15", labelKey: "announcement.typeNotice" },
};

export default function AnnouncementSheet() {
  const mode = useAnnouncementStore((s) => s.sheetMode);
  if (mode === "none") return null;
  return (
    <SheetShell>
      {mode === "single" && <SingleView />}
      {mode === "list" && <ListView />}
      {mode === "admin" && <AdminView />}
    </SheetShell>
  );
}

/* ========== 外壳 ========== */
function SheetShell({ children }: { children: React.ReactNode }) {
  const close = useAnnouncementStore((s) => s.close);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return createPortal(
    <div className="fixed inset-0 z-[130] pb-[72px] flex items-end justify-center">
      <div
        className="absolute inset-0 animate-fadeIn bg-ink-950/70 backdrop-blur-sm"
        onClick={close}
      />
      <div className="relative w-full max-w-md animate-slideUp rounded-t-3xl border-t border-line/80 bg-ink-900/95 p-6 backdrop-blur-md max-h-[88vh] overflow-y-auto">
        <button
          onClick={close}
          className="absolute right-4 top-4 z-10 text-muted hover:text-mist"
          aria-label={t('announcement.close')}
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ========== 单条公告视图（首次弹） ========== */
function SingleView() {
  const a = useAnnouncementStore((s) => s.activeAnnouncement);
  const dismiss = useAnnouncementStore((s) => s.dismiss);
  if (!a) return null;
  const { Icon, color, bg } = STYLES[a.type] ?? STYLES.info;
  return (
    <>
      <div className="mb-5 text-center">
        <div className={`mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full ${bg} ${color}`}>
          <Icon size={22} />
        </div>
        <p className="font-display text-lg text-cream">{a.title}</p>
      </div>
      <div className="mb-6 max-h-[40vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-mist">
        {a.content}
      </div>
      <button
        onClick={dismiss}
        className="w-full rounded-full bg-cream py-3 text-sm font-medium text-ink-900 transition-colors hover:bg-mist"
      >
        {t('announcement.gotIt')}
      </button>
    </>
  );
}

/* ========== 公告列表（设置→公告中心，常驻入口） ========== */
function ListView() {
  const all = useAnnouncementStore((s) => s.allAnnouncements);
  const loading = useAnnouncementStore((s) => s.loading);
  const [detail, setDetail] = useState<Announcement | null>(null);

  if (detail) return <ListDetailView item={detail} onBack={() => setDetail(null)} />;

  return (
    <>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber/15 text-amber-glow">
          <Megaphone size={20} />
        </div>
        <div>
          <h3 className="font-display text-lg text-cream">{t('announcement.centerTitle')}</h3>
          <p className="text-xs text-muted">{t('announcement.centerDesc')}</p>
        </div>
      </div>
      {loading ? (
        <div className="py-10 text-center text-xs text-muted">{t('announcement.loading')}</div>
      ) : all.length === 0 ? (
        <div className="py-10 text-center text-xs text-muted">{t('announcement.empty')}</div>
      ) : (
        <ul className="space-y-2">
          {all.map((a) => {
            const s = STYLES[a.type] ?? STYLES.info;
            return (
              <li key={a.id}>
                <button
                  onClick={() => setDetail(a)}
                  className="flex w-full items-center gap-3 rounded-xl border border-line bg-ink-850/50 p-4 text-left transition-colors hover:border-amber/40"
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                      s.bg,
                      s.color,
                    )}
                  >
                    <s.Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm text-cream">{a.title}</div>
                      {a.active && (
                        <span className="rounded-full bg-amber/15 px-1.5 py-0.5 text-[9px] text-amber-glow ring-1 ring-amber/30">
                          {t('announcement.currentTag')}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                      <span>{formatDate(a.created_at)}</span>
                      <span>{t('announcement.dateSeparator')}</span>
                      <span>{t(s.labelKey)}</span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function ListDetailView({ item, onBack }: { item: Announcement; onBack: () => void }) {
  const s = STYLES[item.type] ?? STYLES.info;
  return (
    <>
      <button
        onClick={onBack}
        className="mb-3 flex items-center gap-1 text-xs text-muted hover:text-mist"
      >
        <ChevronLeft size={14} /> {t('announcement.backToList')}
      </button>
      <div className="mb-4 flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            s.bg,
            s.color,
          )}
        >
          <s.Icon size={20} />
        </div>
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg text-cream">{item.title}</h3>
          <p className="text-[11px] text-muted">
            {formatDate(item.created_at)} {t('announcement.dateSeparator')} {t(s.labelKey)}
          </p>
        </div>
      </div>
      <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-mist rounded-xl border border-line bg-ink-850/50 p-4">
        {item.content}
      </div>
    </>
  );
}

/* ========== 管理视图 ========== */
function AdminView() {
  const all = useAnnouncementStore((s) => s.allAnnouncements);
  const loading = useAnnouncementStore((s) => s.loading);
  const saving = useAnnouncementStore((s) => s.saving);
  const editingId = useAnnouncementStore((s) => s.editingId);
  const form = useAnnouncementStore((s) => s.form);
  const setFormField = useAnnouncementStore((s) => s.setFormField);
  const newForm = useAnnouncementStore((s) => s.newForm);
  const loadForEdit = useAnnouncementStore((s) => s.loadForEdit);
  const save = useAnnouncementStore((s) => s.save);
  const activate = useAnnouncementStore((s) => s.activate);
  const deactivate = useAnnouncementStore((s) => s.deactivate);
  const deleteAnnouncement = useAnnouncementStore((s) => s.deleteAnnouncement);
  const [tab, setTab] = useState<"edit" | "list">("edit");
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  return (
    <>
      {/* 头部 */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber/15 text-amber-glow">
          <Pencil size={20} />
        </div>
        <div>
          <h3 className="font-display text-lg text-cream">{t('announcement.editTitle')}</h3>
          <p className="text-xs text-muted">{t('profile.announcementManageDesc')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <TabBtn active={tab === "edit"} onClick={() => setTab("edit")}>
          <Plus size={12} />
          {editingId ? t('announcement.editTitle') : t('announcement.publishNew')}
        </TabBtn>
        <TabBtn active={tab === "list"} onClick={() => setTab("list")}>
          <Users size={12} />
          {t('announcement.historyTab')}
        </TabBtn>
      </div>

      {tab === "edit" ? (
        <div className="space-y-3">
          {/* 类型选择 */}
          <div>
            <div className="mb-1.5 text-xs text-muted">{t('announcement.type')}</div>
            <div className="flex gap-2">
              {(["update", "info", "warn"] as AnnouncementType[]).map((type) => {
                const s = STYLES[type];
                const active = form.type === type;
                return (
                  <button
                    key={type}
                    onClick={() => setFormField("type", type)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                      active
                        ? "border-amber/60 bg-amber/15 text-amber-glow"
                        : "border-line text-muted hover:border-amber/40 hover:text-mist",
                    )}
                  >
                    <s.Icon size={13} />
                    {t(s.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs text-muted">{t('announcement.titleField')}</div>
            <input
              value={form.title}
              onChange={(e) => setFormField("title", e.target.value)}
              maxLength={80}
              placeholder={t('announcement.titleField')}
              className="w-full rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm text-cream outline-none transition-colors focus:border-amber/50"
            />
          </div>

          <div>
            <div className="mb-1.5 text-xs text-muted">{t('announcement.content')}</div>
            <textarea
              value={form.content}
              onChange={(e) => setFormField("content", e.target.value)}
              maxLength={2000}
              rows={7}
              placeholder={t('announcement.content')}
              className="w-full resize-none rounded-lg border border-line bg-ink-800 px-3 py-2 text-sm leading-relaxed text-cream outline-none transition-colors focus:border-amber/50"
            />
            <div className="mt-1 text-right text-[10px] text-muted">
              {t('announcement.charCount', form.content.length)}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => newForm()}
              className="flex-1 rounded-full border border-line px-4 py-2.5 text-sm text-mist hover:bg-ink-800"
            >
              {t('announcement.clear')}
            </button>
            <button
              onClick={async () => {
                if (saving) return;
                if (!form.title.trim() || !form.content.trim()) {
                  toast(t('announcement.titleField') + t('announcement.content'), "warn");
                  return;
                }
                const ok = await save();
                toast(ok ? (editingId ? t('announcement.saveChanges') : t('announcement.publishNow')) : t('common.processing'), ok ? "success" : "warn");
              }}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-amber px-4 py-2.5 text-sm text-ink-950 hover:bg-amber-glow disabled:opacity-60"
            >
              <Save size={14} />
              {saving ? t('announcement.saving') : editingId ? t('announcement.saveChanges') : t('announcement.publishNow')}
            </button>
          </div>
          <p className="pt-1 text-[11px] leading-relaxed text-muted/80">
            {t('announcement.publishNote')}
          </p>
        </div>
      ) : (
        <>
          {loading ? (
            <div className="py-10 text-center text-xs text-muted">{t('announcement.loading')}</div>
          ) : all.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted">{t('announcement.empty')}</div>
          ) : (
            <ul className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {all.map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-line bg-ink-850/50 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "truncate text-sm",
                            a.active ? "text-cream" : "text-muted/80",
                          )}
                        >
                          {a.title}
                        </div>
                        {a.active && (
                          <span className="rounded-full bg-amber/15 px-1.5 py-0.5 text-[9px] text-amber-glow ring-1 ring-amber/30 shrink-0">
                            {t('announcement.currentTag')}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[11px] text-muted">
                        {formatDate(a.created_at)} {t('announcement.dateSeparator')} {t((STYLES[a.type] ?? STYLES.info).labelKey)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <button
                      onClick={() => {
                        loadForEdit(a.id);
                        setTab("edit");
                      }}
                      className="flex items-center gap-1 rounded-full border border-line px-3 py-1 text-[11px] text-mist hover:border-amber/40 hover:text-amber-glow"
                    >
                      <Pencil size={11} /> {t('announcement.editTitle')}
                    </button>
                    {a.active ? (
                      <button
                        onClick={async () => {
                          const ok = await deactivate(a.id);
                          toast(ok ? t('announcement.offline') : t('common.processing'), ok ? "success" : "warn");
                        }}
                        className="flex items-center gap-1 rounded-full border border-line px-3 py-1 text-[11px] text-mist hover:border-rose-500/40 hover:text-rose-300"
                      >
                        <PowerOff size={11} /> {t('announcement.offline')}
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          const ok = await activate(a.id);
                          toast(ok ? t('announcement.online') : t('common.processing'), ok ? "success" : "warn");
                        }}
                        className="flex items-center gap-1 rounded-full border border-line px-3 py-1 text-[11px] text-mist hover:border-emerald-500/40 hover:text-emerald-300"
                      >
                        <Power size={11} /> {t('announcement.online')}
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteTarget(a)}
                      className="flex items-center gap-1 rounded-full border border-rose-500/30 px-3 py-1 text-[11px] text-rose-300/80 hover:border-rose-500/60 hover:text-rose-300"
                    >
                      <Trash2 size={11} /> {t('announcement.delete')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <DeleteConfirm
          title={deleteTarget.title}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            const ok = await deleteAnnouncement(deleteTarget.id);
            setDeleteTarget(null);
            toast(ok ? t('announcement.permanentDelete') : t('common.processing'), ok ? "success" : "warn");
          }}
        />
      )}
    </>
  );
}

/* ========== 小组件 ========== */
function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs transition-colors",
        active
          ? "border-amber/60 bg-amber/15 text-amber-glow"
          : "border-line text-muted hover:border-amber/40 hover:text-mist",
      )}
    >
      {children}
    </button>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

function DeleteConfirm({
  title,
  onCancel,
  onConfirm,
}: {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 p-6" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-2xl border border-rose-500/30 bg-ink-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">
            <Trash2 size={20} />
          </div>
          <h3 className="text-base font-medium text-cream">{t('announcement.permanentDelete')}</h3>
        </div>
        <p className="mb-5 text-sm leading-relaxed text-muted">
          {t('announcement.deleteConfirm', title)}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-full border border-line bg-ink-800 py-2.5 text-sm text-mist transition-colors hover:bg-ink-700 disabled:opacity-60"
          >
            {t('announcement.cancel')}
          </button>
          <button
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              setBusy(false);
            }}
            disabled={busy}
            className="flex-1 rounded-full bg-rose-500/80 px-4 py-2.5 text-sm text-white transition-colors hover:bg-rose-500 disabled:opacity-60"
          >
            {busy ? t('announcement.deleting') : t('announcement.confirmDelete')}
          </button>
        </div>
      </div>
    </div>
  );
}
