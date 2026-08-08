REVOKE ALL ON FUNCTION public.claim_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_admin() TO authenticated;