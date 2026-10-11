-- Rodar apenas em banco efêmero CI; NÃO executa migrações em produção.
do $$
begin
  if (select not relrowsecurity from pg_class where oid='public.orcapro_sinapi_published_inputs'::regclass) then
    raise exception 'SINAPI inputs RLS desligado';
  end if;
  if (select not relrowsecurity from pg_class where oid='public.orcapro_sinapi_published_analytical'::regclass) then
    raise exception 'SINAPI analytical RLS desligado';
  end if;
  if has_table_privilege('anon','public.orcapro_sinapi_published_inputs','SELECT') or
     has_table_privilege('anon','public.orcapro_sinapi_published_analytical','SELECT') then
    raise exception 'SINAPI national reference visible to anonymous API';
  end if;
  if not has_table_privilege('authenticated','public.orcapro_sinapi_published_inputs','SELECT') or
     not has_table_privilege('authenticated','public.orcapro_sinapi_published_analytical','SELECT') then
    raise exception 'Authenticated users cannot read SINAPI national reference';
  end if;
  if has_table_privilege('authenticated','public.orcapro_sinapi_published_inputs','INSERT') or
     has_table_privilege('authenticated','public.orcapro_sinapi_published_analytical','UPDATE') or
     has_table_privilege('anon','public.orcapro_sinapi_published_inputs','INSERT') then
    raise exception 'National SINAPI data can be altered by browser accounts';
  end if;
end $$;
select 'SINAPI national read-only RLS OK' as result;
