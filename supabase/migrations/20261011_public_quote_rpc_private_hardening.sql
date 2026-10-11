-- OrçaPro: minimize exposed SECURITY DEFINER functions without breaking
-- existing public links (/rest/v1/rpc/orcapro_public_quote and orcapro_decide_quote).
-- The existing definitions are moved unchanged, including search_path='', status
-- validation and atomic locking. ONLY the entrypoint remains in the exposed schema.
-- IMPORTANT: never add orcapro_internal to the PostgREST exposed schemas.
BEGIN;
DO $guard$
BEGIN
  IF to_regprocedure('public.orcapro_public_quote(text)') IS NULL OR
     to_regprocedure('public.orcapro_decide_quote(text,text)') IS NULL OR
     NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.orcapro_public_quote(text)'::regprocedure) OR
     NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.orcapro_decide_quote(text,text)'::regprocedure)
  THEN RAISE EXCEPTION 'Expected privileged proposal RPCs not found in public'; END IF;
  IF to_regnamespace('orcapro_internal') IS NOT NULL
  THEN RAISE EXCEPTION 'Internal schema already exists; review before migration'; END IF;
END $guard$;
CREATE SCHEMA orcapro_internal;
REVOKE ALL ON SCHEMA orcapro_internal FROM PUBLIC;
GRANT USAGE ON SCHEMA orcapro_internal TO anon, authenticated, service_role;
ALTER FUNCTION public.orcapro_public_quote(text) SET SCHEMA orcapro_internal;
ALTER FUNCTION public.orcapro_decide_quote(text,text) SET SCHEMA orcapro_internal;
REVOKE ALL ON FUNCTION orcapro_internal.orcapro_public_quote(text),
 orcapro_internal.orcapro_decide_quote(text,text)
 FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION orcapro_internal.orcapro_public_quote(text),
 orcapro_internal.orcapro_decide_quote(text,text)
 TO anon, authenticated, service_role;
CREATE FUNCTION public.orcapro_public_quote(p_token text)
 RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
 AS $wrap$ SELECT orcapro_internal.orcapro_public_quote(p_token) $wrap$;
CREATE FUNCTION public.orcapro_decide_quote(p_token text,p_status text)
 RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=''
 AS $wrap$ SELECT orcapro_internal.orcapro_decide_quote(p_token,p_status) $wrap$;
REVOKE ALL ON FUNCTION public.orcapro_public_quote(text),
 public.orcapro_decide_quote(text,text)
 FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orcapro_public_quote(text),
 public.orcapro_decide_quote(text,text)
 TO anon, authenticated, service_role;
DO $check$
BEGIN
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname IN ('orcapro_public_quote','orcapro_decide_quote')
     AND NOT p.prosecdef)<>2
 OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='orcapro_internal' AND p.proname IN ('orcapro_public_quote','orcapro_decide_quote')
     AND p.prosecdef)<>2
 THEN RAISE EXCEPTION 'Proposal function security mode mismatch'; END IF;
END $check$;
COMMIT;
