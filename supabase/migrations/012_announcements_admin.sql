-- ======================================================
-- 公告系统 Part 2：管理员写权限
-- 仅指定管理员 user_id 才能 INSERT/UPDATE/DELETE announcements
-- ======================================================

DROP POLICY IF EXISTS "announcements_admin_write" ON public.announcements;

CREATE POLICY "announcements_admin_write"
  ON public.announcements
  FOR ALL TO authenticated
  USING (auth.uid() = '519c260f-2033-4c86-88f8-be5745d08111'::uuid)
  WITH CHECK (auth.uid() = '519c260f-2033-4c86-88f8-be5745d08111'::uuid);
