-- Lista pública de profissões da composição SINAPI disponível apenas para sessões autenticadas.
-- SECURITY INVOKER respeita a RLS de public.orcapro_sinapi_reference.
create or replace function public.orcapro_sinapi_worker_roles()
returns table(code text, role text, compositions_count bigint)
language sql stable security invoker
set search_path = ''
as $$
select l->>'code' as code, max(l->>'role') as role, count(distinct r.code) as compositions_count
from public.orcapro_sinapi_reference r
cross join lateral jsonb_array_elements(r.labor) as l
where l->>'code' ~ '^[0-9]{3,8}$'
  and length(trim(coalesce(l->>'role',''))) between 3 and 150
group by l->>'code'
order by compositions_count desc, code
limit 100;
$$;
revoke all on function public.orcapro_sinapi_worker_roles() from public,anon;
grant execute on function public.orcapro_sinapi_worker_roles() to authenticated;