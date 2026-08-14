-- ======================================================
-- 公告系统：应用内公告弹窗
-- 在 Supabase 后台管理公告内容，App 启动时拉取最新一条 active 公告
-- ======================================================

CREATE TABLE IF NOT EXISTS public.announcements (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  content     text        NOT NULL,
  -- 类型：info 普通 / update 更新 / warn 提醒
  type        text        NOT NULL DEFAULT 'info',
  -- 已读标识：改公告内容时换一个 key，所有用户会重新看到
  dismiss_key text        NOT NULL DEFAULT gen_random_uuid()::text,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 启用 RLS：所有人可读 active 公告，仅 service_role 可写（后台管理）
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_public_read"
  ON public.announcements
  FOR SELECT TO anon, authenticated
  USING (active = true);

GRANT SELECT ON public.announcements TO anon, authenticated;

-- ======================================================
-- 管理公告（在 Supabase Dashboard → SQL Editor 用 service_role 执行）：
--
-- 发新公告：
--   INSERT INTO public.announcements (title, content, type)
--   VALUES ('标题', '正文内容', 'update');
--
-- 改公告内容并让所有人重新看到（dismiss_key 会自动生成新值）：
--   UPDATE public.announcements SET title='新标题', content='新内容', dismiss_key=gen_random_uuid()::text
--   WHERE active = true;
--
-- 下线公告：
--   UPDATE public.announcements SET active = false WHERE active = true;
-- ======================================================
