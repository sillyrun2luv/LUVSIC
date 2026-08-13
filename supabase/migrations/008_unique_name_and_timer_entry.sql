-- ======================================================
-- 阶段 2 v4：不允许重名 + 区分计时按钮记录 vs 补录
--
-- 1. user_profile.name 加 UNIQUE 约束（不允许用户重名）
--    - 用小写规范化存储：name_norm = lower(trim(name))
--    - 唯一约束加在 name_norm 上，避免"小明"和" 小明 "算不同的人
-- 2. records 表加 is_timer_entry 布尔列（true = 计时按钮产生的）
--    - 补录 = is_timer_entry = false（手动填写时间和时长）
--    - 排行榜只计入 is_timer_entry = true 的记录
-- 3. 重建 leaderboard_friends / leaderboard_global / friend_stats，
--    只统计 is_timer_entry = true 的记录
-- ======================================================

-- ------------------------------------------------------
-- 1. user_profile：name 规范化 + 唯一约束
-- ------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profile' AND column_name = 'name_norm'
  ) THEN
    ALTER TABLE public.user_profile
      ADD COLUMN name_norm text GENERATED ALWAYS AS (lower(btrim(name))) STORED;
  END IF;
END $$;

-- 去重：如果现在有重名，保留每组里的第一条（按 user_id 排序），其他加后缀 _2 _3...
-- 注意：UUID 没有 MIN() 聚合，改用 ROW_NUMBER() OVER (ORDER BY user_id) 选第一条
DO $$
DECLARE
  dup RECORD;
  v_suffix int;
  v_target text;
  v_exists boolean;
BEGIN
  FOR dup IN
    SELECT up.user_id, up.name, up.name_norm, w.rn
    FROM public.user_profile up
    INNER JOIN (
      SELECT
        w.user_id,
        ROW_NUMBER() OVER (PARTITION BY w.name_norm ORDER BY w.user_id) AS rn
      FROM public.user_profile w
      WHERE w.name_norm IS NOT NULL AND w.name_norm <> ''
    ) w ON w.user_id = up.user_id
    INNER JOIN (
      SELECT name_norm FROM public.user_profile
      WHERE name_norm IS NOT NULL AND name_norm <> ''
      GROUP BY name_norm HAVING COUNT(*) > 1
    ) d ON d.name_norm = up.name_norm
    ORDER BY up.name_norm, w.rn
  LOOP
    -- rn = 1 的那条作为"原版"保留，剩下的改名
    IF dup.rn = 1 THEN CONTINUE; END IF;

    -- 循环尝试 _2 _3... 直到不冲突
    v_suffix := 2;
    LOOP
      v_target := dup.name || '_' || v_suffix;
      SELECT EXISTS(
        SELECT 1 FROM public.user_profile
        WHERE lower(btrim(v_target)) = name_norm AND user_id <> dup.user_id
      ) INTO v_exists;
      IF NOT v_exists THEN EXIT; END IF;
      v_suffix := v_suffix + 1;
      IF v_suffix > 1000 THEN EXIT; END IF; -- 防死循环
    END LOOP;

    UPDATE public.user_profile
    SET name = v_target
    WHERE user_id = dup.user_id;
  END LOOP;
END $$;

-- 加唯一索引（空 name_norm 的不计入唯一，防止全是默认"我"的历史用户冲突）
DROP INDEX IF EXISTS user_profile_name_norm_key;
CREATE UNIQUE INDEX user_profile_name_norm_key
  ON public.user_profile(name_norm)
  WHERE name_norm IS NOT NULL AND name_norm <> ''
    AND name_norm <> lower('我');   -- 允许多个"我"（他们没设置昵称，后续会被引导）;

-- ------------------------------------------------------
-- 2. records：加 is_timer_entry
-- ------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'records' AND column_name = 'is_timer_entry'
  ) THEN
    ALTER TABLE public.records ADD COLUMN is_timer_entry boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_records_user_timer
  ON public.records(user_id, is_timer_entry)
  WHERE deleted_at IS NULL;

-- 回溯更新：如果没有任何历史信息，全标为 false（因为无法判断是不是计时按钮来的）
-- 之后新记录会由前端明确标记 isTimerEntry

-- ------------------------------------------------------
-- 3. 重建排行榜 RPC（只计入 is_timer_entry = true）
-- ------------------------------------------------------
DROP FUNCTION IF EXISTS public.leaderboard_friends();
DROP FUNCTION IF EXISTS public.leaderboard_global(int);
DROP FUNCTION IF EXISTS public.friend_stats(uuid, int);

-- 好友榜
CREATE OR REPLACE FUNCTION public.leaderboard_friends()
RETURNS TABLE (
  rank          integer,
  user_id       uuid,
  name          text,
  avatar        text,
  total_seconds bigint,
  record_count  bigint,
  is_me         boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH friend_ids AS (
    SELECT CASE WHEN f.from_user_id = v_me THEN f.to_user_id ELSE f.from_user_id END AS uid
    FROM friendships f
    WHERE f.status = 'accepted'::friendship_status
      AND (f.from_user_id = v_me OR f.to_user_id = v_me)
    UNION
    SELECT v_me
  ),
  visible_users AS (
    SELECT
      up.user_id                         AS vu_user_id,
      up.name                            AS vu_name,
      up.avatar                          AS vu_avatar,
      up.show_aggregates_to_friends      AS vu_show
    FROM user_profile up
    WHERE up.user_id IN (SELECT fi.uid FROM friend_ids fi)
      AND (up.user_id = v_me OR up.show_aggregates_to_friends = true)
  ),
  user_stats AS (
    SELECT
      r.user_id                         AS us_user_id,
      COALESCE(SUM(r.duration), 0)      AS us_total_seconds,
      COUNT(*)::bigint                   AS us_record_count
    FROM records r
    WHERE r.deleted_at IS NULL
      AND r.is_timer_entry = true
      AND r.user_id IN (SELECT vu.vu_user_id FROM visible_users vu)
    GROUP BY r.user_id
  )
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY COALESCE(us.us_total_seconds, 0) DESC, us.us_record_count DESC
    )::int,
    vu.vu_user_id,
    vu.vu_name,
    COALESCE(vu.vu_avatar, '🌙')::text,
    COALESCE(us.us_total_seconds, 0)::bigint,
    COALESCE(us.us_record_count, 0)::bigint,
    (vu.vu_user_id = v_me)::boolean
  FROM visible_users vu
  LEFT JOIN user_stats us ON us.us_user_id = vu.vu_user_id
  ORDER BY COALESCE(us.us_total_seconds, 0) DESC,
           COALESCE(us.us_record_count, 0) DESC,
           vu.vu_name ASC;
END; $$;

-- 全球榜
CREATE OR REPLACE FUNCTION public.leaderboard_global(p_limit int DEFAULT 100)
RETURNS TABLE (
  rank          integer,
  user_id       uuid,
  name          text,
  avatar        text,
  total_seconds bigint,
  record_count  bigint,
  is_me         boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me    uuid := auth.uid();
  v_limit int  := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
BEGIN
  RETURN QUERY
  WITH visible_users AS (
    SELECT
      up.user_id  AS vu_user_id,
      up.name     AS vu_name,
      up.avatar   AS vu_avatar
    FROM user_profile up
    WHERE up.show_aggregates_to_friends = true
       OR up.user_id = v_me
  ),
  user_stats AS (
    SELECT
      r.user_id                     AS us_user_id,
      COALESCE(SUM(r.duration), 0)  AS us_total_seconds,
      COUNT(*)::bigint              AS us_record_count
    FROM records r
    WHERE r.deleted_at IS NULL
      AND r.is_timer_entry = true
      AND r.user_id IN (SELECT vu.vu_user_id FROM visible_users vu)
    GROUP BY r.user_id
  ),
  ranked AS (
    SELECT
      vu.vu_user_id,
      vu.vu_name,
      vu.vu_avatar,
      COALESCE(us.us_total_seconds, 0)::bigint AS total_sec,
      COALESCE(us.us_record_count, 0)::bigint  AS rec_cnt,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(us.us_total_seconds, 0) DESC, us.us_record_count DESC
      )::int AS rk
    FROM visible_users vu
    LEFT JOIN user_stats us ON us.us_user_id = vu.vu_user_id
  )
  SELECT
    rd.rk,
    rd.vu_user_id,
    rd.vu_name,
    COALESCE(rd.vu_avatar, '🌙')::text,
    rd.total_sec,
    rd.rec_cnt,
    (rd.vu_user_id = v_me)::boolean
  FROM ranked rd
  WHERE rd.rk <= v_limit
     OR rd.vu_user_id = v_me
  ORDER BY rd.rk ASC;
END; $$;

-- 好友近 100h 统计
CREATE OR REPLACE FUNCTION public.friend_stats(
  p_friend_uuid uuid,
  p_hours int DEFAULT 100
)
RETURNS TABLE (
  total_seconds  bigint,
  record_count   bigint,
  first_at_ms    bigint,
  last_at_ms     bigint,
  by_day         jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_hours int := LEAST(GREATEST(COALESCE(p_hours, 100), 1), 24 * 365);
  v_since_ms bigint := (EXTRACT(EPOCH FROM now() - (v_hours || ' hours')::interval) * 1000)::bigint;
  v_visible boolean := false;
  v_total bigint;
  v_count bigint;
  v_first_ms bigint;
  v_last_ms  bigint;
  v_by_day jsonb;
BEGIN
  IF v_me IS NULL OR p_friend_uuid IS NULL THEN RETURN; END IF;

  IF p_friend_uuid = v_me THEN
    v_visible := true;
  ELSE
    PERFORM 1
    FROM friendships f
    WHERE f.status = 'accepted'::friendship_status
      AND ((f.from_user_id = v_me AND f.to_user_id = p_friend_uuid)
        OR (f.from_user_id = p_friend_uuid AND f.to_user_id = v_me))
    LIMIT 1;
    IF NOT FOUND THEN RETURN; END IF;

    SELECT COALESCE(up.show_aggregates_to_friends, false) INTO v_visible
    FROM user_profile up WHERE up.user_id = p_friend_uuid;
    IF v_visible = false THEN RETURN; END IF;
  END IF;

  SELECT
    COALESCE(SUM(r.duration), 0)::bigint,
    COUNT(*)::bigint,
    MIN(r.timestamp),
    MAX(r.timestamp)
  INTO v_total, v_count, v_first_ms, v_last_ms
  FROM records r
  WHERE r.user_id = p_friend_uuid
    AND r.deleted_at IS NULL
    AND r.is_timer_entry = true
    AND r.timestamp >= v_since_ms;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'day', d.day,
    'count', d.cnt,
    'seconds', d.sec
  ) ORDER BY d.day DESC), '[]'::jsonb) INTO v_by_day
  FROM (
    SELECT
      to_char(
        to_timestamp(r.timestamp::double precision / 1000.0)
          AT TIME ZONE 'UTC',
        'YYYY-MM-DD'
      ) AS day,
      COUNT(*)::int AS cnt,
      COALESCE(SUM(r.duration), 0)::bigint AS sec
    FROM records r
    WHERE r.user_id = p_friend_uuid
      AND r.deleted_at IS NULL
      AND r.is_timer_entry = true
      AND r.timestamp >= v_since_ms
    GROUP BY day
  ) d;

  RETURN QUERY
  SELECT
    COALESCE(v_total, 0),
    COALESCE(v_count, 0),
    v_first_ms,
    v_last_ms,
    COALESCE(v_by_day, '[]'::jsonb);
END; $$;

-- 授权
GRANT EXECUTE ON FUNCTION public.leaderboard_friends() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard_global(int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.friend_stats(uuid, int) TO anon, authenticated;

-- ======================================================
-- 4. 重名检测 RPC：修改昵称时调用
--    输入：target_name，excluded_user_id（可选，自己的名字不算冲突）
--    输出：conflict boolean, conflict_name text
-- ======================================================
DROP FUNCTION IF EXISTS public.check_name_conflict(text, uuid);

CREATE OR REPLACE FUNCTION public.check_name_conflict(
  p_target_name text,
  p_exclude_user uuid DEFAULT NULL
)
RETURNS TABLE (
  conflict      boolean,
  conflict_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
  v_existing text;
BEGIN
  v_norm := lower(btrim(COALESCE(p_target_name, '')));
  -- 空名直接通过
  IF v_norm = '' THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;
  -- 默认昵称"我"不做冲突限制（系统默认）
  IF v_norm = lower('我') THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;

  SELECT up.name INTO v_existing
  FROM public.user_profile up
  WHERE up.name_norm = v_norm
    AND (p_exclude_user IS NULL OR up.user_id <> p_exclude_user)
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT true, v_existing;
  ELSE
    RETURN QUERY SELECT false, NULL::text;
  END IF;
END; $$;

GRANT EXECUTE ON FUNCTION public.check_name_conflict(text, uuid) TO anon, authenticated;
