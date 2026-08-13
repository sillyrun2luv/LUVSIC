-- ======================================================
-- 好友详情统计 v2：修复 "date/time field value out of range"
--
-- 问题根因：sync.ts 里 createdAt 是毫秒 bigint，但 records.created_at
-- 列类型是 timestamptz，两者混用导致隐式类型转换越界。
--
-- 修复：所有时间筛选 / 聚合都基于 records.timestamp（毫秒 bigint）。
-- 返回的 first_at_ms / last_at_ms 也是毫秒 bigint，前端自行格式化。
-- ======================================================

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
  me uuid := auth.uid();
  v_hours int := LEAST(GREATEST(COALESCE(p_hours, 100), 1), 24 * 365);
  v_since_ms bigint := (EXTRACT(EPOCH FROM now() - (v_hours || ' hours')::interval) * 1000)::bigint;
  v_visible boolean := false;
  v_total bigint;
  v_count bigint;
  v_first_ms bigint;
  v_last_ms  bigint;
  v_by_day jsonb;
BEGIN
  IF me IS NULL OR p_friend_uuid IS NULL THEN
    RETURN;
  END IF;

  IF p_friend_uuid = me THEN
    v_visible := true;
  ELSE
    -- 1. accepted 好友
    PERFORM 1
    FROM friendships f
    WHERE f.status = 'accepted'::friendship_status
      AND ((f.from_user_id = me AND f.to_user_id = p_friend_uuid)
        OR (f.from_user_id = p_friend_uuid AND f.to_user_id = me))
    LIMIT 1;
    IF NOT FOUND THEN RETURN; END IF;

    -- 2. 对方开启 show_aggregates_to_friends
    SELECT COALESCE(up.show_aggregates_to_friends, false) INTO v_visible
    FROM user_profile up WHERE up.user_id = p_friend_uuid;
    IF v_visible = false THEN RETURN; END IF;
  END IF;

  -- 聚合：SUM(duration 秒)、COUNT、最早/最晚 timestamp（毫秒）
  SELECT
    COALESCE(SUM(r.duration), 0)::bigint,
    COUNT(*)::bigint,
    MIN(r.timestamp),
    MAX(r.timestamp)
  INTO v_total, v_count, v_first_ms, v_last_ms
  FROM records r
  WHERE r.user_id = p_friend_uuid
    AND r.deleted_at IS NULL
    AND r.timestamp >= v_since_ms;

  -- 按日分布（用 timestamp / 1000.0 转秒后再格式化）
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

GRANT EXECUTE ON FUNCTION public.friend_stats(uuid, int) TO anon, authenticated;
