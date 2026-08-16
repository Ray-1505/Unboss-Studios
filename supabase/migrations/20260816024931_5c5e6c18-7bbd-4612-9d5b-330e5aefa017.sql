CREATE OR REPLACE FUNCTION public.admin_set_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL OR NOT public.is_master_admin(caller) THEN
    RAISE EXCEPTION 'Only the master admin can change roles.';
  END IF;
  IF public.is_master_admin(_user_id) AND _role <> 'admin' THEN
    RAISE EXCEPTION 'The master admin cannot be demoted.';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id AND role <> _role;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, public.app_role) TO authenticated;