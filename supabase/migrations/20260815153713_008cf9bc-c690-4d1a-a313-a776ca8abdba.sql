CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL OR NOT public.has_role(caller, 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _user_id = caller THEN
    RAISE EXCEPTION 'You cannot delete your own account.';
  END IF;
  IF public.is_master_admin(_user_id) THEN
    RAISE EXCEPTION 'The master admin cannot be deleted.';
  END IF;

  DELETE FROM public.jobs WHERE shooter_id = _user_id OR created_by = _user_id;
  DELETE FROM public.availability WHERE user_id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.profiles WHERE id = _user_id;
  DELETE FROM auth.users WHERE id = _user_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;