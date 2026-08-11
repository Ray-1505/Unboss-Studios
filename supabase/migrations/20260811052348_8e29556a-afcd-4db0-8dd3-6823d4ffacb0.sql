-- 1. Master admin registry
CREATE TABLE public.master_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.master_admins TO authenticated;
GRANT ALL ON public.master_admins TO service_role;
ALTER TABLE public.master_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view master admin" ON public.master_admins FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.master_admins WHERE user_id = _user_id)
$$;

-- Seed with Muhd Amirul Hakim if already registered
INSERT INTO public.master_admins (user_id)
SELECT id FROM public.profiles WHERE full_name = 'Muhd Amirul Hakim'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::app_role FROM public.master_admins
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Auto-assign on registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username, team_member_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), 'member-' || left(NEW.id::text, 8)),
    (SELECT id FROM public.team_members WHERE full_name = NEW.raw_user_meta_data->>'full_name')
  )
  ON CONFLICT (id) DO NOTHING;

  IF NEW.raw_user_meta_data->>'full_name' = 'Muhd Amirul Hakim' THEN
    INSERT INTO public.master_admins (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'shooter')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Only the master admin manages roles; master admin's own role is protected
DROP POLICY IF EXISTS "Admins insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins delete roles" ON public.user_roles;

CREATE POLICY "Master admin inserts roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_master_admin(auth.uid()));
CREATE POLICY "Master admin updates roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_master_admin(auth.uid())) WITH CHECK (public.is_master_admin(auth.uid()));
CREATE POLICY "Master admin deletes roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_master_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.protect_master_admin_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.is_master_admin(OLD.user_id) AND OLD.role = 'admin' THEN
      RAISE EXCEPTION 'The master admin cannot be demoted.';
    END IF;
    RETURN OLD;
  ELSE
    IF public.is_master_admin(OLD.user_id) AND OLD.role = 'admin' AND NEW.role <> 'admin' THEN
      RAISE EXCEPTION 'The master admin cannot be demoted.';
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS protect_master_admin ON public.user_roles;
CREATE TRIGGER protect_master_admin
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_master_admin_role();

-- Protect the master admin's profile from deactivation
CREATE OR REPLACE FUNCTION public.protect_master_admin_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_master_admin(NEW.id) AND NEW.is_active = false THEN
    RAISE EXCEPTION 'The master admin cannot be deactivated.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_master_admin_profile ON public.profiles;
CREATE TRIGGER protect_master_admin_profile
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_master_admin_profile();

-- 4. Remove gendering
ALTER TABLE public.team_members DROP COLUMN IF EXISTS gender_label;

-- 5. State team leaders
CREATE TABLE public.state_leaders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code text NOT NULL UNIQUE,
  state_name text NOT NULL,
  leader_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.state_leaders TO authenticated;
GRANT SELECT ON public.state_leaders TO anon;
GRANT ALL ON public.state_leaders TO service_role;
ALTER TABLE public.state_leaders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "State leaders readable by everyone" ON public.state_leaders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins insert state leaders" ON public.state_leaders FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update state leaders" ON public.state_leaders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete state leaders" ON public.state_leaders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_state_leaders_updated_at
BEFORE UPDATE ON public.state_leaders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.state_leaders (state_code, state_name) VALUES
  ('PLS', 'Perlis'),
  ('KDH', 'Kedah'),
  ('PNG', 'Pulau Pinang'),
  ('PRK', 'Perak'),
  ('KTN', 'Kelantan'),
  ('TRG', 'Terengganu'),
  ('PHG', 'Pahang'),
  ('SGR', 'Selangor'),
  ('KUL', 'Kuala Lumpur'),
  ('PJY', 'Putrajaya'),
  ('NSN', 'Negeri Sembilan'),
  ('MLK', 'Melaka'),
  ('JHR', 'Johor')
ON CONFLICT (state_code) DO NOTHING;