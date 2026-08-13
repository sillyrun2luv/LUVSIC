-- ======================================================
-- 阶段 2 v3：修复 "column reference user_id is ambiguous"
--
-- 根因：RETURNS TABLE (user_id uuid, ...) 中 user_id 会成为 PL/pgSQL OUT 变量，
-- 在 RETURN QUERY 内 SQL 里如果没有显式表前缀，就会和 SELECT 列冲突。
-- 解决：所有子查询都给列加表前缀（vu.user_id / up.user_id / r.user_id）。
-- 同时保留 v2 修复：auth.uid() 为 null 时全球榜仍返回数据。
-- ======================================================

DROP FUNCTION IF EXISTS public.leaderboard_friends();
DROP FUNCTION IF EXISTS public.leaderboard_global(int);

-- ------------------------------------------------------
-- 1. 好友时长榜
-- ------------------------------------------------------
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
      up.user_id        AS vu_user_id,
      up.name           AS vu_name,
      up.avatar         AS vu_avatar,
      up.show_aggregates_to_friends AS vu_show
    FROM user_profile up
    WHERE up.user_id IN (SELECT fi.uid FROM friend_ids fi)
      AND (up.user_id = v_me OR up.show_aggregates_to_friends = true)
  ),
  user_stats AS (
    SELECT
      r.user_id         AS us_user_id,
      COALESCE(SUM(r.duration), 0) AS us_total_seconds,
      COUNT(*)::bigint  AS us_record_count
    FROM records r
    WHERE r.deleted_at IS NULL
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

-- ------------------------------------------------------
-- 2. 全球时长榜
-- ------------------------------------------------------
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
      r.user_id         AS us_user_id,
      COALESCE(SUM(r.duration), 0) AS us_total_seconds,
      COUNT(*)::bigint  AS us_record_count
    FROM records r
    WHERE r.deleted_at IS NULL
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

GRANT EXECUTE ON FUNCTION public.leaderboard_friends() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard_global(int) TO anon, authenticated;

-- ======================================================
-- 验证（SQL Editor 里）：
--   未登录也能跑：
--     SELECT * FROM public.leaderboard_global(50);
--   好友榜需要先模拟登录：
--     SELECT set_config('request.jwt.claim.sub', '你的UUID', false);
--     SELECT * FROM public.leaderboard_friends();
-- ======================================================
