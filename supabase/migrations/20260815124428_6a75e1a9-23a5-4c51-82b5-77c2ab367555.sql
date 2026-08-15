-- team_members: authenticated only
DROP POLICY IF EXISTS "Roster is readable by everyone" ON public.team_members;
CREATE POLICY "Roster readable by team" ON public.team_members
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.team_members FROM anon;

-- state_leaders: authenticated only
DROP POLICY IF EXISTS "State leaders readable by everyone" ON public.state_leaders;
CREATE POLICY "State leaders readable by team" ON public.state_leaders
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.state_leaders FROM anon;

-- availability: own rows or admins
DROP POLICY IF EXISTS "Team can view availability" ON public.availability;
CREATE POLICY "Own or admin view availability" ON public.availability
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- profiles: own row or admins
DROP POLICY IF EXISTS "Team can view profiles" ON public.profiles;
CREATE POLICY "Own or admin view profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- user_roles: own rows or admins
DROP POLICY IF EXISTS "Team can view roles" ON public.user_roles;
CREATE POLICY "Own or admin view roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- master_admins: own row or admins
DROP POLICY IF EXISTS "Team can view master admin" ON public.master_admins;
CREATE POLICY "Own or admin view master admins" ON public.master_admins
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Lock down SECURITY DEFINER functions that must never be called by app users
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_master_admin_profile() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_master_admin_role() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.is_master_admin(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE ALL ON FUNCTION public.claim_admin() FROM anon;