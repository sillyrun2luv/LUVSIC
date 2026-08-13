-- ======================================================
-- 阶段 1：好友社交基础（SQL 迁移脚本）
-- 适用：Supabase Postgres
--
-- 使用方法：
--   1. 打开 Supabase Dashboard → 你的项目 → SQL Editor
--   2. 新建 Query，把本文件内容整段粘贴
--   3. 点击「Run」执行
--   4. 看到 "Success. No rows returned" 就 OK
--
-- 幂等性：表/字段/函数/策略都有 IF NOT EXISTS 保护，可重复执行
-- ======================================================

-- ------------------------------------------------------
-- 1. ENUM 类型：好友申请状态
-- ------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------
-- 2. 扩展 user_profile 表：加隐私字段
--    （前提：项目里已经有 user_profile 表。sync.ts 里在 upsert）
-- ------------------------------------------------------
ALTER TABLE IF EXISTS public.user_profile
  ADD COLUMN IF NOT EXISTS searchable boolean NOT NULL DEFAULT true;

ALTER TABLE IF EXISTS public.user_profile
  ADD COLUMN IF NOT EXISTS show_aggregates_to_friends boolean NOT NULL DEFAULT true;

-- 给已存在的记录补默认值（防止老数据是 null，虽然上面有 DEFAULT）
UPDATE public.user_profile SET searchable = true WHERE searchable IS NULL;
UPDATE public.user_profile SET show_aggregates_to_friends = true WHERE show_aggregates_to_friends IS NULL;

-- ------------------------------------------------------
-- 3. 新建 friendships 表
-- ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       friendship_status NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_no_self CHECK (from_user_id <> to_user_id),
  CONSTRAINT friendships_unique_pair UNIQUE (from_user_id, to_user_id)
);

CREATE INDEX IF NOT EXISTS friendships_from_user_idx ON public.friendships(from_user_id);
CREATE INDEX IF NOT EXISTS friendships_to_user_idx   ON public.friendships(to_user_id);
CREATE INDEX IF NOT EXISTS friendships_status_idx    ON public.friendships(status);

-- 自动更新 updated_at 的触发器
CREATE OR REPLACE FUNCTION public.set_timestamp_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_friendships_updated_at ON public.friendships;
CREATE TRIGGER trg_friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.set_timestamp_updated_at();

-- ------------------------------------------------------
-- 4. RLS 开启 + 策略（隐私安全核心，不能漏）
-- ------------------------------------------------------
ALTER TABLE IF EXISTS public.friendships ENABLE ROW LEVEL SECURITY;

-- 4a. friendships select：只能看到和自己有关的记录
DROP POLICY IF EXISTS friendships_select_self ON public.friendships;
CREATE POLICY friendships_select_self ON public.friendships
  FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- 4b. friendships insert：只能插入申请人=自己
DROP POLICY IF EXISTS friendships_insert_self ON public.friendships;
CREATE POLICY friendships_insert_self ON public.friendships
  FOR INSERT
  WITH CHECK (
    auth.uid() = from_user_id
    AND status = 'pending'::friendship_status
  );

-- 4c. friendships update：
--      申请人  → 只能撤销 (status → cancelled)
--      被申请人 → 只能接受/拒绝 (pending → accepted/rejected)
DROP POLICY IF EXISTS friendships_update_self ON public.friendships;
CREATE POLICY friendships_update_self ON public.friendships
  FOR UPDATE
  USING (
    (auth.uid() = from_user_id AND status = 'pending'::friendship_status)
    OR
    (auth.uid() = to_user_id   AND status = 'pending'::friendship_status)
  )
  WITH CHECK (
    CASE
      WHEN auth.uid() = from_user_id THEN
        -- 申请人撤销
        status = 'cancelled'::friendship_status
      WHEN auth.uid() = to_user_id THEN
        -- 被申请人接受或拒绝
        status IN ('accepted'::friendship_status, 'rejected'::friendship_status)
      ELSE false
    END
  );

-- 4d. user_profile 扩展字段 RLS（只允许自己改自己，所有人可选地看公开字段）
ALTER TABLE IF EXISTS public.user_profile ENABLE ROW LEVEL SECURITY;

-- 删除旧策略（避免名字冲突）
DROP POLICY IF EXISTS user_profile_select_own ON public.user_profile;
DROP POLICY IF EXISTS user_profile_update_own ON public.user_profile;

-- 自己能看到自己全部
CREATE POLICY user_profile_select_own ON public.user_profile
  FOR SELECT
  USING (user_id = auth.uid());

-- 自己只能改自己
CREATE POLICY user_profile_update_own ON public.user_profile
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ------------------------------------------------------
-- 5. Security Definer Functions（前端只读这些接口，不直接查表）
--    所有函数都 SECURITY DEFINER，并且 SET search_path = public
--    内部严格限制只返回公开字段 (name/avatar)，绝不暴露其他数据
-- ------------------------------------------------------

-- 5a. 搜索用户（昵称关键字，含去重和关系判断）
--     输入 keyword：昵称关键字（ILIKE 匹配，%keyword%）
--     输出：符合条件且 searchable=true 的用户，最多 50 条
CREATE OR REPLACE FUNCTION public.search_users(keyword text)
RETURNS TABLE (
  user_id uuid,
  name    text,
  avatar  text,
  relation text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RETURN; -- 未登录直接返回空
  END IF;

  keyword := coalesce(trim(keyword), '');
  IF keyword = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH mine AS (
    SELECT f.from_user_id, f.to_user_id, f.status
    FROM friendships f
    WHERE f.from_user_id = me OR f.to_user_id = me
  )
  SELECT
    up.user_id,
    up.name,
    coalesce(up.avatar, '🌙')::text AS avatar,
    CASE
      WHEN up.user_id = me THEN 'self'::text
      WHEN EXISTS (
        SELECT 1 FROM mine m
        WHERE (m.from_user_id = up.user_id OR m.to_user_id = up.user_id)
          AND m.status = 'accepted'::friendship_status
        LIMIT 1
      ) THEN 'friend'
      WHEN EXISTS (
        SELECT 1 FROM mine m
        WHERE m.from_user_id = me AND m.to_user_id = up.user_id
          AND m.status = 'pending'::friendship_status
        LIMIT 1
      ) THEN 'pending_from_me'
      WHEN EXISTS (
        SELECT 1 FROM mine m
        WHERE m.from_user_id = up.user_id AND m.to_user_id = me
          AND m.status = 'pending'::friendship_status
        LIMIT 1
      ) THEN 'pending_to_me'
      ELSE 'stranger'
    END::text AS relation
  FROM user_profile up
  WHERE up.searchable = true
    AND up.name ILIKE '%' || keyword || '%'
    AND up.user_id <> me
  ORDER BY char_length(up.name) ASC, up.name ASC
  LIMIT 50;
END; $$;

-- 5b. 好友列表（只返回 status=accepted 的好友，含聚合信息占位）
CREATE OR REPLACE FUNCTION public.my_friends()
RETURNS TABLE (
  user_id uuid,
  name    text,
  avatar  text,
  relation text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    up.user_id,
    up.name,
    coalesce(up.avatar, '🌙')::text AS avatar,
    'friend'::text AS relation
  FROM friendships f
  JOIN user_profile up
    ON  up.user_id = CASE WHEN f.from_user_id = me THEN f.to_user_id ELSE f.from_user_id END
  WHERE f.status = 'accepted'::friendship_status
    AND (f.from_user_id = me OR f.to_user_id = me)
  ORDER BY up.name ASC;
END; $$;

-- 5c. 收到的好友申请（别人发给我的 pending）
CREATE OR REPLACE FUNCTION public.incoming_requests()
RETURNS TABLE (
  friendship_id uuid,
  user_id       uuid,
  name          text,
  avatar        text,
  created_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    f.id          AS friendship_id,
    up.user_id,
    up.name,
    coalesce(up.avatar, '🌙')::text AS avatar,
    f.created_at
  FROM friendships f
  JOIN user_profile up ON up.user_id = f.from_user_id
  WHERE f.to_user_id = me
    AND f.status = 'pending'::friendship_status
  ORDER BY f.created_at DESC;
END; $$;

-- 5d. 发出的好友申请（我发给别人的 pending）
CREATE OR REPLACE FUNCTION public.outgoing_requests()
RETURNS TABLE (
  friendship_id uuid,
  user_id       uuid,
  name          text,
  avatar        text,
  created_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    f.id          AS friendship_id,
    up.user_id,
    up.name,
    coalesce(up.avatar, '🌙')::text AS avatar,
    f.created_at
  FROM friendships f
  JOIN user_profile up ON up.user_id = f.to_user_id
  WHERE f.from_user_id = me
    AND f.status = 'pending'::friendship_status
  ORDER BY f.created_at DESC;
END; $$;

-- 5e. 未读申请数量（给前端做红点）
CREATE OR REPLACE FUNCTION public.pending_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  n  integer;
BEGIN
  IF me IS NULL THEN RETURN 0; END IF;
  SELECT COUNT(*) INTO n FROM friendships
   WHERE to_user_id = me AND status = 'pending'::friendship_status;
  RETURN coalesce(n, 0);
END; $$;

-- ------------------------------------------------------
-- 6. （可选）自动互加好友：若 A→B pending，B→A 也发 pending，则自动 accept 两边
--    触发逻辑放在 friends.ts 前端（sendFriendRequest 里检测并接受），
--    这样更可控，不用数据库触发器。这里留占位说明。
-- ------------------------------------------------------

-- ======================================================
-- 执行完毕 → 在 Supabase Dashboard 里再做一个快速验证：
--
--   登录用户 A（浏览器里或在 SQL 里 SET LOCAL role = postgres 模拟一下即可不必），
--   然后运行：
--     SELECT * FROM public.search_users('test');  -- 验证搜索函数
--     SELECT * FROM public.my_friends();           -- 验证好友列表
--     SELECT * FROM public.incoming_requests();    -- 验证收到申请
--     SELECT public.pending_count();              -- 验证红点数量
--
--   不报错 = RLS + 函数没问题
-- ======================================================
