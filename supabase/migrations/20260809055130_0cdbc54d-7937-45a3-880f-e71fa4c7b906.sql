-- 1. username on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
UPDATE public.profiles SET username = COALESCE(username, 'member-' || left(id::text, 8));
ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx ON public.profiles (lower(username));

-- 2. registration trigger stores the chosen username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, username, team_member_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), 'member-' || left(NEW.id::text, 8)),
    (SELECT id FROM public.team_members WHERE full_name = NEW.raw_user_meta_data->>'full_name')
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'shooter')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 3. admins manage the roster
GRANT INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
DROP POLICY IF EXISTS "Admins insert roster" ON public.team_members;
CREATE POLICY "Admins insert roster" ON public.team_members
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins update roster" ON public.team_members;
CREATE POLICY "Admins update roster" ON public.team_members
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins delete roster" ON public.team_members;
CREATE POLICY "Admins delete roster" ON public.team_members
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. job visibility: admins all, shooters own only
DROP POLICY IF EXISTS "Team can view jobs" ON public.jobs;
CREATE POLICY "Admins view all jobs, shooters view own" ON public.jobs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = shooter_id OR auth.uid() = created_by);
