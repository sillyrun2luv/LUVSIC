import { useEffect, useMemo, useState } from "react";
import {
  Users,
  UserPlus,
  Search,
  Clock,
  UserCheck,
  UserX,
  ArrowLeft,
  LogIn,
  Loader2,
  XCircle,
  CheckCircle2,
  Send,
  MoreHorizontal,
  Sparkles,
  Trophy,
  Swords,
  Bell,
} from "lucide-react";
import { useFriendStore } from "@/store/useFriendStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { PublicUser } from "@/types";
import type { PendingRequest } from "@/lib/friends";
import { cn } from "@/lib/utils";
import LeaderboardPanel from "@/components/LeaderboardPanel";
import ReminderList from "@/components/ReminderList";
import Avatar, { buildTextAvatar } from "@/components/Avatar";
import { t } from "@/store/useI18nStore";

type TabKey = "friends" | "pending" | "search" | "reminders";
type MainView = "social" | "leaderboard";

export default function Friends() {
  const view = useUIStore((s) => s.view);
  const openSettings = useUIStore((s) => s.openSettings);
  const openAuth = useUIStore((s) => s.openAuth);
  const openProfileSetup = useUIStore((s) => s.openProfileSetup);
  const openPK = useUIStore((s) => s.openPK);
  const isLoggedIn = useAuthStore((s) => !!s.user?.id);
  const canRemind = isSupabaseConfigured && isLoggedIn;
  const profileName = useProfileStore((s) => s.name);

  const loading = useFriendStore((s) => s.loading);
  const initialLoaded = useFriendStore((s) => s.initialLoaded);
  const refreshAll = useFriendStore((s) => s.refreshAll);

  const friends = useFriendStore((s) => s.friends);
  const incoming = useFriendStore((s) => s.incoming);
  const outgoing = useFriendStore((s) => s.outgoing);
  const pendingCount = useFriendStore((s) => s.pendingCount);
  const reminderUnread = useFriendStore((s) => s.reminderUnread);

  const searchKeyword = useFriendStore((s) => s.searchKeyword);
  const searching = useFriendStore((s) => s.searching);
  const searchResults = useFriendStore((s) => s.searchResults);
  const searchUsers = useFriendStore((s) => s.searchUsers);
  const clearSearch = useFriendStore((s) => s.clearSearch);

  const sendRequest = useFriendStore((s) => s.sendRequest);
  const accept = useFriendStore((s) => s.accept);
  const reject = useFriendStore((s) => s.reject);
  const cancel = useFriendStore((s) => s.cancel);
  const removeFriend = useFriendStore((s) => s.removeFriend);

  const openFriendDetail = useUIStore((s) => s.openFriendDetail);

  const [mainView, setMainView] = useState<MainView>("social");
  const [tab, setTab] = useState<TabKey>("friends");

  const [localKw, setLocalKw] = useState(searchKeyword);

  // 删除好友确认弹窗（自制，不用 window.confirm）
  const [deleteTarget, setDeleteTarget] = useState<{ userId: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const commitDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await removeFriend(deleteTarget.userId, deleteTarget.name);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => searchUsers(localKw), 280);
    return () => clearTimeout(t);
  }, [localKw, searchUsers]);

  useEffect(() => {
    if (isLoggedIn && view === "friends" && !initialLoaded) {
      refreshAll();
    }
  }, [isLoggedIn, view, initialLoaded, refreshAll]);

  const pendingTabLabel = useMemo(() => {
    if (pendingCount > 0) return t("friends.pendingReview", pendingCount);
    return t("friends.pendingTab");
  }, [pendingCount]);

  const incomingIdByFrom = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of incoming) m.set(r.user.userId, r.friendshipId);
    return m;
  }, [incoming]);
  const outgoingIdByTo = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of outgoing) m.set(r.user.userId, r.friendshipId);
    return m;
  }, [outgoing]);

  return (
    <div className="space-y-5">
      {/* 标题 */}
      <header className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <Users size={14} className="text-teal-300" />
            {t("friends.title")}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-cream">
            {t("friends.subtitle")}
          </h1>
          <p className="mt-1 text-xs text-muted">
            {t("friends.description")}
          </p>
        </div>
        {mainView === "social" && (
          <button
            onClick={refreshAll}
            title={t("friends.refresh")}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border border-line/70 bg-ink-900/70 text-mist transition-colors hover:border-teal-500/40 hover:text-teal-300",
              loading && "pointer-events-none opacity-70",
            )}
          >
            <Loader2 size={16} className={cn(loading && "animate-spin")} />
          </button>
        )}
      </header>

      {/* 一级 Tab：社交 / 排行榜 */}
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-line/70 bg-ink-900/50 p-1.5">
        <button
          onClick={() => setMainView("social")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all",
            mainView === "social"
              ? "bg-teal-500/15 text-teal-200 ring-1 ring-teal-500/30"
              : "text-muted hover:text-mist",
          )}
        >
          <Users size={14} />
          {t("friends.social")}
          {pendingCount > 0 && (
            <span className="ml-0.5 rounded-full bg-rose-500/80 px-1.5 py-0.5 text-[9px] font-semibold text-white">
              {pendingCount > 99 ? t("friends.pendingBadge") : pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setMainView("leaderboard")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all",
            mainView === "leaderboard"
              ? "bg-amber/15 text-amber-glow ring-1 ring-amber/30"
              : "text-muted hover:text-mist",
          )}
        >
          <Trophy size={14} />
          {t("friends.leaderboard")}
        </button>
      </div>

      {/* 内容区 */}
      {mainView === "leaderboard" ? (
        <LeaderboardPanel />
      ) : (
        <>
          {/* 登录提示（未登录不可用） */}
          {!isLoggedIn ? (
            <LoggedOutGate onLogin={openAuth} onGoSettings={openSettings} />
          ) : (
            <>
              {/* 搜索条 + 未设置昵称提示：收件箱 Tab 不需要 */}
              {tab !== "reminders" && (
                <>
                  {/* 搜索条 */}
                  <SearchBar
                    value={localKw}
                    onChange={(v) => {
                      setLocalKw(v);
                      if (v.trim()) setTab("search");
                    }}
                    onClear={() => {
                      setLocalKw("");
                      clearSearch();
                      setTab("friends");
                    }}
                    pendingCount={pendingCount}
                  />

                  {/* 未设置昵称提示 */}
                  {profileName === "我" && (
                    <div className="flex items-center gap-3 rounded-xl border border-amber/30 bg-amber/[0.07] p-3.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber/15 text-amber-glow">
                        <Sparkles size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-cream">{t("profileSetup.title")}</div>
                        <div className="text-xs text-muted">{t("profileSetup.nicknameDesc")}</div>
                      </div>
                      <button
                        onClick={openProfileSetup}
                        className="shrink-0 rounded-lg bg-amber px-3 py-2 text-sm font-medium text-ink-950 transition-colors hover:bg-amber-glow"
                      >
                        {t("common.edit")}
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Tab 切换 */}
              <Tabs
                value={tab}
                onChange={setTab}
                tabs={[
                  {
                    key: "friends",
                    label: t("friends.myFriends", friends.length),
                    icon: UserCheck,
                    accent: "teal",
                  },
                  {
                    key: "pending",
                    label: pendingTabLabel,
                    icon: Clock,
                    accent: "amber",
                    badge: pendingCount,
                  },
                  {
                    key: "search",
                    label: t("common.search"),
                    icon: Search,
                    accent: "violet",
                  },
                  {
                    key: "reminders",
                    label: t("bottomNav.reminders"),
                    icon: Bell,
                    accent: "rose",
                    badge: reminderUnread,
                  },
                ]}
              />

              {/* Tab 内容 */}
              {tab === "friends" && (
                <FriendsList
                  loading={loading}
                  initialLoaded={initialLoaded}
                  items={friends}
                  onRequestRemove={(uid, name) => setDeleteTarget({ userId: uid, name })}
                  onOpenDetail={openFriendDetail}
                  onOpenPK={openPK}
                  canRemind={canRemind}
                />
              )}
              {tab === "pending" && (
                <PendingList
                  loading={loading}
                  initialLoaded={initialLoaded}
                  incoming={incoming}
                  outgoing={outgoing}
                  onAccept={accept}
                  onReject={reject}
                  onCancel={cancel}
                />
              )}
              {tab === "search" && (
                <SearchResults
                  searching={searching}
                  keyword={localKw.trim()}
                  results={searchResults}
                  onSend={sendRequest}
                  onAccept={accept}
                  onPendingCancel={cancel}
                  incomingIdByFrom={incomingIdByFrom}
                  outgoingIdByTo={outgoingIdByTo}
                />
              )}
              {tab === "reminders" && <ReminderList />}
            </>
          )}
        </>
      )}

      {/* 删除好友确认对话框 */}
      {deleteTarget && (
        <RemoveFriendDialog
          name={deleteTarget.name}
          busy={deleting}
          onCancel={() => !deleting && setDeleteTarget(null)}
          onConfirm={commitDelete}
        />
      )}
    </div>
  );
}

/* ============================ 子组件 ============================ */

function LoggedOutGate({ onLogin, onGoSettings }: { onLogin: () => void; onGoSettings: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-500/10 via-ink-900/40 to-ink-900/40 p-6">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-500/10 blur-3xl" />
      <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-md">
          <div className="mb-2 flex items-center gap-2 text-teal-300">
            <Users size={16} />
            <span className="text-xs font-medium uppercase tracking-wider text-teal-300/80">
              {t("friends.needLogin")}
            </span>
          </div>
          <h2 className="text-xl font-semibold text-cream">{t("friends.loginToAddFriends")}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {t("friends.loginBenefits")}
          </p>
          <ul className="mt-3 space-y-1 text-xs text-muted">
            <li className="flex items-center gap-2">
              <CheckCircle2 size={12} className="text-teal-300 shrink-0" />
              {t("friends.searchFriendsHint")}
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={12} className="text-teal-300 shrink-0" />
              {t("friends.requestActions")}
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 size={12} className="text-teal-300 shrink-0" />
              {t("friends.privacyToggle")}
            </li>
          </ul>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={onLogin}
            className="flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-teal-500/20 transition hover:bg-teal-400"
          >
            <LogIn size={16} />
            {t("friends.loginOrRegister")}
          </button>
          <button
            onClick={onGoSettings}
            className="rounded-xl border border-line/80 bg-ink-900/80 px-4 py-2.5 text-sm text-mist transition hover:border-amber/40 hover:text-amber-glow"
          >
            {t("friends.openSettings")}
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchBar({
  value,
  onChange,
  onClear,
  pendingCount,
}: {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
  pendingCount: number;
}) {
  return (
    <div className="relative rounded-2xl border border-line/70 bg-ink-900/70 p-2">
      <div className="flex items-center gap-2 rounded-xl bg-ink-800/60 px-3 py-2">
        <Search size={16} className="shrink-0 text-muted" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("friends.searchPlaceholder")}
          className="w-full bg-transparent text-sm text-cream placeholder:text-muted/80 focus:outline-none"
        />
        {value && (
          <button
            onClick={onClear}
            title={t("common.back")}
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition hover:bg-ink-700 hover:text-mist"
          >
            <ArrowLeft size={14} />
          </button>
        )}
      </div>
      {pendingCount > 0 && (
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-amber/10 px-3 py-2 text-xs text-amber-glow ring-1 ring-amber/20">
          <Clock size={14} />
          {t("friends.pendingNotice", pendingCount)}
        </div>
      )}
    </div>
  );
}

interface TabDef {
  key: TabKey;
  label: string;
  icon: typeof Users;
  accent: "teal" | "amber" | "violet" | "rose";
  badge?: number;
}
function Tabs({
  value,
  onChange,
  tabs,
}: {
  value: TabKey;
  onChange: (k: TabKey) => void;
  tabs: TabDef[];
}) {
  const activeBg: Record<TabDef["accent"], string> = {
    teal: "bg-teal-500/15 text-teal-200 ring-1 ring-teal-500/30",
    amber: "bg-amber/15 text-amber-glow ring-1 ring-amber/30",
    violet: "bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30",
    rose: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",
  };
  return (
    <div className="grid grid-cols-4 gap-1.5 rounded-2xl border border-line/70 bg-ink-900/50 p-1.5">
      {tabs.map((t) => {
        const active = value === t.key;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              "relative flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium transition-all",
              active ? activeBg[t.accent] : "text-muted hover:text-mist",
            )}
          >
            <Icon size={14} />
            <span className="truncate">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- 好友列表 ---------- */
function FriendsList({
  loading,
  initialLoaded,
  items,
  onRequestRemove,
  onOpenDetail,
  onOpenPK,
  canRemind,
}: {
  loading: boolean;
  initialLoaded: boolean;
  items: PublicUser[];
  onRequestRemove: (uid: string, name: string) => void;
  onOpenDetail: (userId: string, name: string, avatar: string) => void;
  onOpenPK: (userId: string, name: string, avatar: string) => void;
  canRemind: boolean;
}) {
  if (!initialLoaded || (loading && items.length === 0)) {
    return <SkeletonCard count={3} title={t("common.loading")} />;
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={t("friends.noFriends")}
        desc={t("friends.noFriendsHint")}
        accent="teal"
      />
    );
  }
  return (
    <div className="space-y-2">
      {items.map((u) => (
        <FriendRow
          key={u.userId}
          user={u}
          onAvatarClick={() => onOpenPK(u.userId, u.name, u.avatar)}
          action={
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={() => onOpenPK(u.userId, u.name, u.avatar)}
                title={t("pk.title")}
                className="flex h-8 items-center gap-1 rounded-lg bg-amber px-2.5 text-xs font-semibold text-ink-950 transition hover:bg-amber-glow"
              >
                <Swords size={13} />
                PK
              </button>
              <button
                onClick={() => onRequestRemove(u.userId, u.name)}
                title={t("common.delete")}
                className="flex h-8 items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 text-xs text-rose-300 transition hover:bg-rose-500/20"
              >
                <UserX size={13} />
                {t("common.delete")}
              </button>
              <button
                onClick={() => onOpenDetail(u.userId, u.name, u.avatar)}
                disabled={!canRemind}
                title={canRemind ? t("friendReminder.title") : t("friendReminder.lockedHint")}
                className="flex h-8 items-center gap-1 rounded-lg border border-teal-500/20 bg-teal-500/10 px-2.5 text-xs text-teal-200 transition hover:bg-teal-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={13} />
                {t("friendReminder.buttonLabel")}
              </button>
            </div>
          }
        />
      ))}
    </div>
  );
}

/* ---------- 待审核列表 ---------- */
function PendingList({
  loading,
  initialLoaded,
  incoming,
  outgoing,
  onAccept,
  onReject,
  onCancel,
}: {
  loading: boolean;
  initialLoaded: boolean;
  incoming: PendingRequest[];
  outgoing: PendingRequest[];
  onAccept: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}) {
  if (!initialLoaded || (loading && incoming.length === 0 && outgoing.length === 0)) {
    return <SkeletonCard count={3} title={t("common.loading")} />;
  }
  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title={t("friends.noPending")}
        desc={t("friends.noPendingHint")}
        accent="amber"
      />
    );
  }
  return (
    <div className="space-y-5">
      {incoming.length > 0 && (
        <section>
          <SectionLabel icon={<UserPlus size={12} />} color="amber" count={incoming.length}>
            {t("friends.incomingRequests")}
          </SectionLabel>
          <div className="space-y-2">
            {incoming.map((r) => (
              <FriendRow
                key={r.friendshipId}
                user={r.user}
                meta={`${formatDate(r.createdAt)}`}
                action={
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => onReject(r.friendshipId)}
                      className="flex h-8 items-center gap-1 rounded-lg border border-line/70 bg-ink-800/60 px-2.5 text-xs text-muted transition hover:border-rose-500/30 hover:text-rose-300"
                    >
                      <XCircle size={13} />
                      {t("common.reject")}
                    </button>
                    <button
                      onClick={() => onAccept(r.friendshipId)}
                      className="flex h-8 items-center gap-1 rounded-lg bg-teal-500 px-2.5 text-xs font-medium text-white transition hover:bg-teal-400"
                    >
                      <CheckCircle2 size={13} />
                      {t("common.accept")}
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        </section>
      )}
      {outgoing.length > 0 && (
        <section>
          <SectionLabel icon={<Send size={12} />} color="violet" count={outgoing.length}>
            {t("friends.outgoingRequests")}
          </SectionLabel>
          <div className="space-y-2">
            {outgoing.map((r) => (
              <FriendRow
                key={r.friendshipId}
                user={r.user}
                meta={`${formatDate(r.createdAt)}`}
                action={
                  <button
                    onClick={() => onCancel(r.friendshipId)}
                    className="flex h-8 items-center gap-1 rounded-lg border border-line/70 bg-ink-800/60 px-2.5 text-xs text-muted transition hover:border-violet-500/30 hover:text-violet-300"
                  >
                    <XCircle size={13} />
                    {t("friends.cancelRequest")}
                  </button>
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------- 搜索结果 ---------- */
function SearchResults({
  searching,
  keyword,
  results,
  onSend,
  onAccept,
  onPendingCancel,
  incomingIdByFrom,
  outgoingIdByTo,
}: {
  searching: boolean;
  keyword: string;
  results: PublicUser[];
  onSend: (uid: string) => Promise<boolean>;
  onAccept: (id: string) => Promise<void>;
  onPendingCancel: (id: string) => Promise<void>;
  incomingIdByFrom: Map<string, string>;
  outgoingIdByTo: Map<string, string>;
}) {
  if (!keyword) {
    return (
      <EmptyState
        icon={Search}
        title={t("friends.startSearching")}
        desc={t("friends.searchHint")}
        accent="violet"
      />
    );
  }
  if (searching) {
    return <SkeletonCard count={3} title={t("friends.searching", keyword)} />;
  }
  if (results.length === 0) {
    return (
      <EmptyState
        icon={MoreHorizontal}
        title={t("friends.noSearchResults")}
        desc={t("friends.noSearchHint", keyword)}
        accent="violet"
      />
    );
  }
  return (
    <div className="space-y-2">
      {results.map((u) => {
        const incId = incomingIdByFrom.get(u.userId);
        const outId = outgoingIdByTo.get(u.userId);
        let action: React.ReactNode;
        switch (u.relation) {
          case "self":
            action = <Pill color="ink">{t("friends.thisIsYou")}</Pill>;
            break;
          case "friend":
            action = <Pill color="teal">{t("friends.alreadyFriend")}</Pill>;
            break;
          case "pending_to_me":
            action = incId ? (
              <button
                onClick={() => onAccept(incId)}
                className="flex h-8 items-center gap-1 rounded-lg bg-teal-500 px-2.5 text-xs font-medium text-white transition hover:bg-teal-400"
              >
                <CheckCircle2 size={13} />
                {t("friends.acceptRequest")}
              </button>
            ) : (
              <Pill color="amber">{t("friends.alreadyApplied")}</Pill>
            );
            break;
          case "pending_from_me":
            action = outId ? (
              <button
                onClick={() => onPendingCancel(outId)}
                className="flex h-8 items-center gap-1 rounded-lg border border-line/70 bg-ink-800/60 px-2.5 text-xs text-muted transition hover:border-violet-500/30 hover:text-violet-300"
              >
                <XCircle size={13} />
                {t("friends.cancelRequest")}
              </button>
            ) : (
              <Pill color="violet">{t("friends.waitingApproval")}</Pill>
            );
            break;
          case "stranger":
          default:
            action = (
              <button
                onClick={() => onSend(u.userId)}
                className="flex h-8 items-center gap-1 rounded-lg bg-amber px-2.5 text-xs font-medium text-ink-950 transition hover:bg-amber-glow"
              >
                <UserPlus size={13} />
                {t("friends.addFriend")}
              </button>
            );
        }
        return <FriendRow key={u.userId} user={u} action={action} />;
      })}
    </div>
  );
}

/* ---------- 通用：好友行 ---------- */
function FriendRow({
  user,
  action,
  meta,
  onAvatarClick,
}: {
  user: Pick<PublicUser, "userId" | "name" | "avatar" | "relation">;
  action: React.ReactNode;
  meta?: string;
  onAvatarClick?: () => void;
}) {
  const rel = relationBadge(user.relation);
  const isFriend = user.relation === "friend";
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line/70 bg-ink-900/60 p-3">
      {onAvatarClick && isFriend ? (
        <button
          onClick={onAvatarClick}
          title={t("pk.title")}
          className="group shrink-0 transition hover:scale-105 active:scale-100"
        >
          <Avatar
            value={user.avatar}
            size={44}
            ringClass="ring-1 ring-line/60 group-hover:ring-amber/60 transition"
          />
        </button>
      ) : (
        <Avatar value={user.avatar} size={44} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="break-words text-sm font-medium leading-snug text-cream">{user.name}</span>
          {rel && <span className="shrink-0">{rel}</span>}
        </div>
        <div className="mt-0.5 break-words text-[11px] leading-snug text-muted">
          {meta || relationDesc(user.relation)}
        </div>
      </div>
      {action}
    </div>
  );
}

function relationBadge(r: PublicUser["relation"]) {
  switch (r) {
    case "friend":
      return <Pill color="teal">{t("common.friend")}</Pill>;
    case "pending_from_me":
      return <Pill color="violet">{t("common.sentByMe")}</Pill>;
    case "pending_to_me":
      return <Pill color="amber">{t("common.receivedByMe")}</Pill>;
    case "self":
      return <Pill color="ink">{t("common.me")}</Pill>;
    default:
      return null;
  }
}
function relationDesc(r: PublicUser["relation"]) {
  switch (r) {
    case "friend":
      return t("friends.mutualFriends");
    case "pending_from_me":
      return t("friends.waitingForOther");
    case "pending_to_me":
      return t("friends.waitingForYou");
    case "self":
      return t("friends.currentAccount");
    default:
      return "";
  }
}

function Pill({
  color,
  children,
}: {
  color: "ink" | "teal" | "amber" | "violet";
  children: React.ReactNode;
}) {
  const map: Record<string, string> = {
    ink: "bg-ink-700/80 text-mist",
    teal: "bg-teal-500/15 text-teal-200 ring-1 ring-teal-500/30",
    amber: "bg-amber/15 text-amber-glow ring-1 ring-amber/30",
    violet: "bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", map[color])}>
      {children}
    </span>
  );
}

function SectionLabel({
  icon,
  color,
  count,
  children,
}: {
  icon: React.ReactNode;
  color: "amber" | "violet" | "teal";
  count?: number;
  children: React.ReactNode;
}) {
  const dot: Record<string, string> = {
    amber: "bg-amber",
    violet: "bg-violet-400",
    teal: "bg-teal-400",
  };
  return (
    <div className="mb-2 flex items-center gap-2 px-1">
      <span className={cn("h-1.5 w-1.5 rounded-full", dot[color])} />
      <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted/90">
        {icon}
        {children}
      </span>
      {typeof count === "number" && (
        <span className="ml-0.5 rounded-full bg-ink-800/80 px-1.5 py-0.5 text-[10px] text-muted">
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  desc,
  accent,
}: {
  icon: typeof Users;
  title: string;
  desc: string;
  accent: "teal" | "amber" | "violet";
}) {
  const cls = {
    teal: "text-teal-300 bg-teal-500/10 ring-teal-500/30",
    amber: "text-amber-glow bg-amber/10 ring-amber/30",
    violet: "text-violet-300 bg-violet-500/10 ring-violet-500/30",
  }[accent];
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line/80 bg-ink-900/40 px-5 py-10 text-center">
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-full ring-1", cls)}>
        <Icon size={22} />
      </div>
      <div className="text-sm font-medium text-cream">{title}</div>
      <p className="max-w-sm text-xs leading-relaxed text-muted">{desc}</p>
    </div>
  );
}

function SkeletonCard({ count, title }: { count: number; title: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1 text-xs text-muted">
        <Loader2 size={12} className="animate-spin" />
        {title}
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-line/70 bg-ink-900/60 p-3"
        >
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-ink-800" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded bg-ink-800" />
            <div className="h-2 w-2/3 animate-pulse rounded bg-ink-800/80" />
          </div>
          <div className="h-7 w-16 shrink-0 animate-pulse rounded-lg bg-ink-800" />
        </div>
      ))}
    </div>
  );
}

/* ---------- 工具 ---------- */
function formatDate(ts: number) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return t("common.justNow");
    if (diff < 3600) return t("date.intervalMinutesAgo", Math.floor(diff / 60));
    if (diff < 86400) return t("date.intervalHoursAgo", Math.floor(diff / 3600));
    if (diff < 86400 * 7) return t("date.intervalDaysAgo", Math.floor(diff / 86400));
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  } catch {
    return "";
  }
}

/* ---------- 删除好友对话框 ---------- */
function RemoveFriendDialog({
  name,
  busy,
  onCancel,
  onConfirm,
}: {
  name: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[110] pb-[72px] sm:pb-0 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 animate-fadeIn bg-ink-950/75 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative z-10 m-4 w-full max-w-sm animate-slideUp overflow-hidden rounded-3xl border border-rose-500/30 bg-ink-900 shadow-2xl">
        <div className="p-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30">
              <UserX size={20} />
            </div>
            <div>
              <div className="font-display text-lg text-cream">{t("friends.removeFriend")}</div>
              <div className="mt-0.5 text-xs text-muted">{t("friends.reversibleHint")}</div>
            </div>
          </div>
          <p className="mb-5 rounded-xl border border-line/70 bg-ink-800/50 p-3 text-sm leading-relaxed text-mist">
            {t("friends.removeConfirm", name)}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              disabled={busy}
              className="flex-1 rounded-full border border-line bg-ink-800 px-4 py-2.5 text-sm text-mist transition hover:bg-ink-700 disabled:opacity-60"
            >
              {t("friends.thinkAgain")}
            </button>
            <button
              onClick={onConfirm}
              disabled={busy}
              className="flex-1 rounded-full bg-rose-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-400 disabled:opacity-60"
            >
              {busy ? t("friends.processing") : t("friends.confirmRemove")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
