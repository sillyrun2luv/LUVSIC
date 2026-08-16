-- =====================================================================
-- 「提醒好友自卫」功能 B 方案：好友 App 内提醒
-- 执行方式：Supabase → SQL Editor → 全选粘贴执行（含 tables + indexes + rpc）
-- 依赖：已有 friendships 表（from_user_id/to_user_id/status）。
-- 注意：本项目没有 public.profiles 表；用户身份统一用 auth.users(id)
-- （friendships 表的外键即引用 auth.users(id)；用户资料表为 user_profile，但它用 user_id 列，不作为好友关系的身份外键）。
-- 保留策略：已读超过 90 天的提醒会在 send_friend_remind 内机会性清理（免费档无 pg_cron，故不入定时任务）。
-- =====================================================================

-- ---------- 1. 提醒消息表 ----------
create table if not exists public.friend_reminders (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id   uuid not null references auth.users(id) on delete cascade,
  category     text not null check (category in ('care_health', 'remember_relax')),
  message      text not null,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);

create index if not exists idx_friend_reminders_to_created
  on public.friend_reminders (to_user_id, created_at desc);
create index if not exists idx_friend_reminders_from_created
  on public.friend_reminders (from_user_id, created_at);

-- 行级安全：只能看自己相关的消息（发给我的/我发的）
alter table public.friend_reminders enable row level security;

drop policy if exists "friend_reminders_self" on public.friend_reminders;
create policy "friend_reminders_self" on public.friend_reminders
  for all
  using (auth.uid() = from_user_id or auth.uid() = to_user_id)
  with check (auth.uid() = from_user_id);


-- ---------- 2. 发送好友提醒 RPC ----------
-- 入参：
--   p_to_uid   UUID     接收方 user id（必须是 accepted 好友）
--   p_category TEXT     'care_health' | 'remember_relax'
--   p_message  TEXT     提醒正文（前端从 i18n 模板随机选好传过来，保证多语言一致）
-- 返回：
--   sent            boolean   是否成功
--   remaining_today integer   今天还剩几次
--   message         text      成功=实际写入的那条；失败=空
--   error           text      空 / 'NOT_LOGGED_IN' / 'NOT_FRIENDS' / 'DAILY_LIMIT' / 'INVALID_CATEGORY' / 'INVALID_MESSAGE'
create or replace function public.send_friend_remind(
  p_to_uid   uuid,
  p_category text,
  p_message  text
)
returns table (
  sent boolean,
  remaining_today integer,
  message text,
  error text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me        uuid  := auth.uid();
  v_today     date  := (now() at time zone 'Asia/Shanghai')::date;
  v_count_today int := 0;
  v_msg       text  := btrim(coalesce(p_message, ''));
  v_is_friend boolean;
begin
  sent            := false;
  remaining_today := 0;
  message         := '';
  error           := '';

  -- 机会性清理已读超过 90 天的旧提醒（免费档无 pg_cron，借此保持表体积有界）
  perform public.cleanup_old_friend_reminders();

  -- a. 登录校验
  if v_me is null then
    error := 'NOT_LOGGED_IN';
    return next;
    return;
  end if;

  -- 不能发自己
  if v_me = p_to_uid then
    error := 'NOT_FRIENDS';
    return next;
    return;
  end if;

  -- b. category 合法性
  if p_category not in ('care_health', 'remember_relax') then
    error := 'INVALID_CATEGORY';
    return next;
    return;
  end if;

  -- c. message 合法性：非空 1~200 字
  if length(v_msg) < 1 or length(v_msg) > 200 then
    error := 'INVALID_MESSAGE';
    return next;
    return;
  end if;

  -- d. 好友关系校验（双向 accepted）
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and (
        (f.from_user_id = v_me      and f.to_user_id   = p_to_uid) or
        (f.from_user_id = p_to_uid  and f.to_user_id   = v_me)
      )
    limit 1
  ) into v_is_friend;
  if not v_is_friend then
    error := 'NOT_FRIENDS';
    return next;
    return;
  end if;

  -- e. 今日已发送数（来自 Asia/Shanghai 当日，针对「我对这位好友」这一对关系）
  select count(*) into v_count_today
  from public.friend_reminders r
  where r.from_user_id = v_me
    and r.to_user_id = p_to_uid
    and (r.created_at at time zone 'Asia/Shanghai')::date = v_today;

  if v_count_today >= 2 then
    error           := 'DAILY_LIMIT';
    remaining_today := 0;
    return next;
    return;
  end if;

  -- f. 写入
  insert into public.friend_reminders(from_user_id, to_user_id, category, message)
  values (v_me, p_to_uid, p_category, v_msg);

  sent            := true;
  remaining_today := 2 - (v_count_today + 1);
  message         := v_msg;
  error           := '';
  return next;
end;
$$;

-- 给 postgres/anon/authenticated 授权（security definer 内部用 superuser，但调用者要能执行 function）
revoke all on function public.send_friend_remind(uuid, text, text) from public;
grant  execute on function public.send_friend_remind(uuid, text, text) to authenticated;


-- ---------- 3.（可选）查询「我对某位好友」今日剩余提醒次数 —— 前端打开 Sheet 时调用 ----------
-- 注意：限额是「对每个好友 2 次/天」，所以必须传入 p_to_uid 才能算出针对该好友的配额。
drop function if exists public.get_friend_remind_quota_today();
create or replace function public.get_friend_remind_quota_today(p_to_uid uuid)
returns table (remaining_today integer, used_today integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me        uuid := auth.uid();
  v_today     date := (now() at time zone 'Asia/Shanghai')::date;
  v_used      int  := 0;
begin
  if v_me is null then
    remaining_today := 0;
    used_today      := 0;
    return next;
    return;
  end if;

  select count(*) into v_used
  from public.friend_reminders r
  where r.from_user_id = v_me
    and r.to_user_id = p_to_uid
    and (r.created_at at time zone 'Asia/Shanghai')::date = v_today;

  remaining_today := greatest(0, 2 - v_used);
  used_today      := v_used;
  return next;
end;
$$;

revoke all on function public.get_friend_remind_quota_today(uuid) from public;
grant  execute on function public.get_friend_remind_quota_today(uuid) to authenticated;


-- ---------- 4.（可选）对方拉未读提醒 + 标记已读 ----------
create or replace function public.mark_friend_reminders_read(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then return; end if;
  update public.friend_reminders r
  set read_at = now()
  where r.id = any(p_ids)
    and r.to_user_id = v_me
    and r.read_at is null;
end;
$$;
revoke all on function public.mark_friend_reminders_read(uuid[]) from public;
grant  execute on function public.mark_friend_reminders_read(uuid[]) to authenticated;


-- ---------- 4.（收件方）查询「我收到的」好友提醒（收件箱） ----------
-- 联 user_profile 取出发件人昵称/头像（user_profile.user_id = r.from_user_id）。
-- 返回按时间倒序的提醒列表，前端自行做分页（limit/offset）。
create or replace function public.get_received_friend_reminders(
  p_limit  int default 50,
  p_offset int default 0
)
returns table (
  id           uuid,
  from_user_id uuid,
  from_name    text,
  from_avatar  text,
  category     text,
  message      text,
  created_at   timestamptz,
  read_at      timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then return; end if;
  return query
  select
    r.id,
    r.from_user_id,
    coalesce(up.name, '???')::text,
    coalesce(up.avatar, '🌙')::text,
    r.category,
    r.message,
    r.created_at,
    r.read_at
  from public.friend_reminders r
  left join public.user_profile up on up.user_id = r.from_user_id
  where r.to_user_id = v_me
  order by r.created_at desc
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.get_received_friend_reminders(int, int) from public;
grant  execute on function public.get_received_friend_reminders(int, int) to authenticated;


-- ---------- 4.（收件方）我收到的未读提醒数（红点） ----------
create or replace function public.get_friend_reminder_unread_count()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  n    integer;
begin
  if v_me is null then return 0; end if;
  select count(*) into n
  from public.friend_reminders r
  where r.to_user_id = v_me
    and r.read_at is null;
  return coalesce(n, 0);
end;
$$;

revoke all on function public.get_friend_reminder_unread_count() from public;
grant  execute on function public.get_friend_reminder_unread_count() to authenticated;


-- ---------- 5. 保留策略：清理已读超过 90 天的旧提醒 ----------
-- 免费档无 pg_cron，故不依赖定时任务：
--   (a) 在 send_friend_remind 内机会性调用，发送时顺手清理；
--   (b) 也可在 Supabase SQL Editor 手动执行，或用外部定时任务(如 GitHub Actions)调用。
-- 仅删除「已读且超过 90 天」的记录，未读提醒一律保留（避免误删对方还没看到的提醒）。
create or replace function public.cleanup_old_friend_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  delete from public.friend_reminders
  where read_at is not null
    and read_at < (now() - interval '90 days');
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_old_friend_reminders() from public;
grant  execute on function public.cleanup_old_friend_reminders() to authenticated;


-- ---------- 6.（收件方）删除单条收到的提醒 ----------
-- 仅收件人本人可删除自己收件箱里的这条（to_user_id = auth.uid()）。
-- 前端在「星球 → 提醒」里对每条提醒提供删除按钮，会同时清云端 + 本机缓存。
create or replace function public.delete_friend_reminder(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.friend_reminders
  where id = p_id
    and to_user_id = auth.uid();
end;
$$;

revoke all on function public.delete_friend_reminder(uuid) from public;
grant  execute on function public.delete_friend_reminder(uuid) to authenticated;
