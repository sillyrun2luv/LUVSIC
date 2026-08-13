-- ======================================================
-- 排行榜诊断脚本：为什么"排行榜里没有任何人"？
--
-- 使用方法（Supabase SQL Editor）：
--   1. 先在前端登录任意账号，让 auth.uid() 有值
--   2. 在 SQL Editor 中整段粘贴 → Run
--   3. 依次看下方 Results 的 7 个查询结果
--
-- 根因（按发生概率从高到低）：
--   A. records 表是空的 → 没有上传云端
--   B. user_profile 里 show_aggregates_to_friends = false → 不上榜
--   C. 没有 accepted 的好友 → 好友榜只看到自己
--   D. leaderboard_friends() / leaderboard_global() 函数不存在 → 005 没跑
--   E. RLS 阻止了 records SELECT
-- ======================================================

-- ===== 1. 当前用户是谁？ =====
SELECT '1️⃣ 登录用户（auth.uid()）' AS step;
SELECT auth.uid() AS current_user_id;

-- ===== 2. 当前用户的 user_profile 存在吗？隐私设置值是什么？ =====
SELECT '2️⃣  user_profile：名字/头像/隐私开关' AS step;
SELECT
  up.user_id,
  up.name,
  up.avatar,
  up.searchable,
  up.show_aggregates_to_friends,
  CASE WHEN up.show_aggregates_to_friends = true THEN '✅ 上榜' ELSE '❌ 未开启「好友可见统计」→ 不上榜' END AS can_leaderboard
FROM user_profile up
WHERE up.user_id = auth.uid();

-- ===== 3. 云端 records 表有多少记录？ =====
SELECT '3️⃣  云端 records 表（按用户汇总）' AS step;
SELECT
  r.user_id,
  up.name,
  COUNT(*) AS record_count,
  COALESCE(SUM(r.duration), 0) AS total_seconds,
  CASE WHEN up.show_aggregates_to_friends = true THEN '✅' ELSE '❌ 隐私关' END AS visible_flag
FROM records r
LEFT JOIN user_profile up ON up.user_id = r.user_id
WHERE r.deleted_at IS NULL
GROUP BY r.user_id, up.name, up.show_aggregates_to_friends
ORDER BY total_seconds DESC
LIMIT 50;

-- ===== 4. 当前用户的好友情况 =====
SELECT '4️⃣  好友关系' AS step;
SELECT
  CASE
    WHEN f.status = 'accepted' THEN '✅ 已确认'
    WHEN f.status = 'pending'  THEN '⏳ 待确认'
    WHEN f.status = 'rejected' THEN '❌ 已拒绝'
    WHEN f.status = 'cancelled'THEN '↩️  已撤销'
    ELSE f.status::text
  END AS status_label,
  f.from_user_id,
  f.to_user_id,
  from_p.name AS from_name,
  to_p.name   AS to_name,
  f.created_at
FROM friendships f
LEFT JOIN user_profile from_p ON from_p.user_id = f.from_user_id
LEFT JOIN user_profile to_p   ON to_p.user_id   = f.to_user_id
WHERE f.from_user_id = auth.uid() OR f.to_user_id = auth.uid()
ORDER BY f.created_at DESC;

-- ===== 5. 直接跑 RPC：好友榜结果 =====
SELECT '5️⃣  leaderboard_friends() 直接执行结果' AS step;
SELECT *
FROM public.leaderboard_friends();

-- ===== 6. 全球榜直接执行结果 =====
SELECT '6️⃣  leaderboard_global(50) 直接执行结果' AS step;
SELECT *
FROM public.leaderboard_global(50);

-- ===== 7. RLS 检查：records 表是否有 SELECT 策略 =====
SELECT '7️⃣  检查 records 表的 RLS 策略' AS step;
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'records';
