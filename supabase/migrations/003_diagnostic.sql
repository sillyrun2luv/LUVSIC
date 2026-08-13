-- ======================================================
-- 诊断脚本：排查好友搜索不工作的问题
-- 在 Supabase SQL Editor 粘贴执行，看输出结果
-- ======================================================

-- 1. 检查 user_profile 表是否存在、有哪些字段
SELECT '1. user_profile 表结构' AS section;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_profile' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. 检查 user_id 是否有唯一约束（upsert 必需）
SELECT '2. user_id 唯一约束' AS section;
SELECT conname, contype
FROM pg_constraint
JOIN pg_class ON pg_class.oid = conrelid
JOIN pg_namespace ON pg_namespace.oid = relnamespace
WHERE relname = 'user_profile' AND nspname = 'public';

-- 3. 检查 RLS 策略
SELECT '3. RLS 策略' AS section;
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr, pg_get_expr(polwithcheck, polrelid) AS check_expr
FROM pg_policy
JOIN pg_class ON pg_class.oid = polrelid
WHERE relname = 'user_profile';

-- 4. 检查 user_profile 里有多少条记录
SELECT '4. user_profile 记录数' AS section;
SELECT count(*) AS total_profiles FROM public.user_profile;

-- 5. 查看所有 user_profile 记录（昵称、头像、searchable）
SELECT '5. 所有 user_profile 记录' AS section;
SELECT user_id, name, avatar, searchable, show_aggregates_to_friends
FROM public.user_profile
ORDER BY name;

-- 6. 检查 search_users 函数是否存在
SELECT '6. search_users 函数' AS section;
SELECT proname, prosrc IS NOT NULL AS function_exists
FROM pg_proc
WHERE proname = 'search_users';

-- 7. 直接用 postgres 角色测试搜索函数（绕过 RLS）
SELECT '7. 测试搜索（关键词: 我）' AS section;
SELECT * FROM public.search_users('我');

-- 8. 检查 friendships 表
SELECT '8. friendships 表记录' AS section;
SELECT count(*) AS total_friendships FROM public.friendships;
