-- 开启 user_profile 表的 Realtime 订阅
-- 多端登录时，一端改昵称/头像/隐私 → 另一端实时同步
-- 需要在 Supabase SQL Editor 中执行一次

-- 1. 把 user_profile 加入 supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profile;

-- 2. 让 UPDATE 事件携带完整的前后镜像（filter 需要）
ALTER TABLE public.user_profile REPLICA IDENTITY FULL;
