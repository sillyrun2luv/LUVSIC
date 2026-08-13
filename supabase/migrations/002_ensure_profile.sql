-- ======================================================
-- 补丁 002：修复 user_profile 的 INSERT 策略
-- 问题：001_social_phase1.sql 只加了 SELECT/UPDATE 策略，
--       新注册用户无法 INSERT user_profile，导致搜索搜不到。
-- 使用方法：在 Supabase SQL Editor 粘贴执行即可。
-- ======================================================

-- 允许用户 INSERT 自己的 user_profile 记录
DROP POLICY IF EXISTS user_profile_insert_own ON public.user_profile;
CREATE POLICY user_profile_insert_own ON public.user_profile
  FOR INSERT
  WITH CHECK (user_id = auth.uid());
