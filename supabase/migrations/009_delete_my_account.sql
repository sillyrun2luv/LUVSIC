-- ======================================================
-- 009：删除自己账户 SECURITY DEFINER RPC
--
-- 需要 SECURITY DEFINER（设为 postgres / service_role 权限）
-- 才能写入 auth.users 表（普通用户默认无权限）。
-- 函数内用 auth.uid() 做身份校验，只能删自己。
-- ======================================================

-- 如果想更稳：把这个函数的 owner 改成 postgres / service_role
-- Supabase SQL Editor 里直接跑这条即可（普通 postgres 权限就够，因为用了 SECURITY DEFINER
-- 且 auth.uid() 内部校验）。
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid uuid;
BEGIN
  -- 1. 只能删当前登录用户
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '未登录';
  END IF;

  -- 2. 删除公开表中该用户的所有数据
  DELETE FROM public.records            WHERE user_id = v_uid;
  DELETE FROM public.user_settings      WHERE user_id = v_uid;
  DELETE FROM public.user_profile       WHERE user_id = v_uid;
  DELETE FROM public.friendships        WHERE from_user_id = v_uid OR to_user_id = v_uid;

  -- 3. 删除身份系统里的用户（auth.users）
  --    级联会清理 auth.identities、sessions、refresh_tokens 等
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

-- 默认执行权限给所有已登录用户（函数内 auth.uid() 再做一次校验，所以安全）
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
