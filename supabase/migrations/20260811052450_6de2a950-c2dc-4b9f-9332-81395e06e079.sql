REVOKE ALL ON FUNCTION public.protect_master_admin_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_master_admin_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_master_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_master_admin(uuid) TO authenticated;