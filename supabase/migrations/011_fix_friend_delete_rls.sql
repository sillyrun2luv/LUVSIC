-- 011_fix_friend_delete_rls.sql
-- 修复「删除好友无效」：原 friendships_update_self 的 USING 只允许更新 status='pending' 的行，
-- 导致删除好友（把 accepted 改为 cancelled）被 RLS 静默拦截（影响 0 行、无报错），
-- 前端显示删除成功但好友仍在列表中。
-- 本迁移放宽策略：任一方都可对 status='accepted' 的好友记录改为 'cancelled'。

-- 4c. friendships update：
--      申请人  → 只能撤销 (pending → cancelled)
--      被申请人 → 只能接受/拒绝 (pending → accepted/rejected)
--      双方任一方 → 可删除好友 (accepted → cancelled)   ← 新增
DROP POLICY IF EXISTS friendships_update_self ON public.friendships;
CREATE POLICY friendships_update_self ON public.friendships
  FOR UPDATE
  USING (
    (auth.uid() = from_user_id OR auth.uid() = to_user_id)
    AND (status = 'pending'::friendship_status OR status = 'accepted'::friendship_status)
  )
  WITH CHECK (
    (auth.uid() = from_user_id AND status = 'cancelled'::friendship_status)
    OR
    (auth.uid() = to_user_id AND status IN ('accepted'::friendship_status, 'rejected'::friendship_status, 'cancelled'::friendship_status))
  );
