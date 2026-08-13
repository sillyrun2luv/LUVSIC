-- ============================================================
-- 010_pk_stats.sql
-- 新增用于「好友 PK」界面的统计 RPC
--   pk_stats(p_friend_uuid, p_hours_for_recent)
--     → 返回 我 + 好友 的两个用户的：
--       - total_seconds_all（所有计时记录累计）
--       - total_seconds_recent（近 p_hours 小时内计时记录）
--       - record_count_all
--       - record_count_recent
-- ============================================================

-- 如果函数已存在，先 drop（重建权限/安全定义）
DROP FUNCTION IF EXISTS public.pk_stats(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.pk_stats(
    p_friend_uuid UUID,
    p_hours_for_recent INTEGER DEFAULT 100
)
RETURNS TABLE (
    user_id         UUID,
    is_me           BOOLEAN,
    name            TEXT,
    avatar          TEXT,
    total_seconds_all    BIGINT,
    record_count_all     BIGINT,
    total_seconds_recent BIGINT,
    record_count_recent  BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_my_uuid       UUID := auth.uid();
    v_friend_status friendships.status%TYPE;
    v_s1_ms         BIGINT;
    v_s2            RECORD;
BEGIN
    IF v_my_uuid IS NULL THEN
        -- 未登录：空结果
        RETURN NEXT;
        RETURN;
    END IF;

    -- 必须是 accepted 好友
    SELECT f.status INTO v_friend_status
    FROM   public.friendships f
    WHERE  (f.from_user_id = v_my_uuid   AND f.to_user_id = p_friend_uuid)
       OR  (f.to_user_id   = v_my_uuid   AND f.from_user_id = p_friend_uuid)
    LIMIT  1;

    IF v_friend_status IS NULL OR v_friend_status <> 'accepted' THEN
        -- 非好友：直接空结果
        RETURN NEXT;
        RETURN;
    END IF;

    -- recent 窗口起始时间（毫秒）
    v_s1_ms := (EXTRACT(EPOCH FROM (now() - (p_hours_for_recent || ' hours')::INTERVAL)) * 1000)::BIGINT;

    -- 批量把两个人算出来
    FOR v_s2 IN
        SELECT
            up.user_id,
            up.name,
            COALESCE(up.avatar, '🌙') AS avatar,
            COALESCE(SUM(CASE WHEN r.is_timer_entry = TRUE THEN r.duration ELSE 0 END), 0)::BIGINT           AS all_sec,
            COALESCE(COUNT(CASE WHEN r.is_timer_entry = TRUE THEN 1 END), 0)::BIGINT                           AS all_cnt,
            COALESCE(SUM(CASE WHEN r.is_timer_entry = TRUE AND r.timestamp >= v_s1_ms THEN r.duration ELSE 0 END), 0)::BIGINT AS r_sec,
            COALESCE(COUNT(CASE WHEN r.is_timer_entry = TRUE AND r.timestamp >= v_s1_ms THEN 1 END), 0)::BIGINT             AS r_cnt
        FROM      public.user_profile up
        LEFT JOIN public.records      r
               ON r.user_id = up.user_id
              AND r.deleted_at IS NULL
        WHERE up.user_id IN (v_my_uuid, p_friend_uuid)
        GROUP BY up.user_id, up.name, up.avatar
    LOOP
        user_id              := v_s2.user_id;
        is_me                := (v_s2.user_id = v_my_uuid);
        name                 := v_s2.name;
        avatar               := v_s2.avatar;
        total_seconds_all    := v_s2.all_sec;
        record_count_all     := v_s2.all_cnt;
        total_seconds_recent := v_s2.r_sec;
        record_count_recent  := v_s2.r_cnt;
        RETURN NEXT;
    END LOOP;

    RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pk_stats(UUID, INTEGER) TO authenticated, anon;

COMMENT ON FUNCTION public.pk_stats(UUID, INTEGER) IS
'返回「我 + 指定好友」的两组统计：累计总时长/次数 + 近 N 小时时长/次数。用于 PK 弹窗。必须是 accepted 好友。';
