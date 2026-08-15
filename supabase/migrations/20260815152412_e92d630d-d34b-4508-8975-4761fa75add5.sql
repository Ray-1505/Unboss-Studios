CREATE OR REPLACE FUNCTION public.registration_roster()
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tm.id, tm.full_name
  FROM public.team_members tm
  ORDER BY tm.sort_order
$$;

REVOKE ALL ON FUNCTION public.registration_roster() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registration_roster() TO anon, authenticated;