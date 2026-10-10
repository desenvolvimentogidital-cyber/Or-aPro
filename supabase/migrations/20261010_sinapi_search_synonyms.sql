-- Busca mais intuitiva na composição analítica validada: monofásico/monofásica
-- e "padrão monofásico" priorizando entradas de energia, sem gerar HH artificiais.
-- Substitui apenas a função de busca, mantendo RLS/tabelas/usuários e registros.
create or replace function public.orcapro_find_sinapi(p_query text, p_reference text default null, p_limit integer default 40)
returns table (code text, description text, unit text, labor jsonb, "sourceFile" text, "sourceSheet" text, reference text)
language sql stable security invoker set search_path=''
as $sinapi$
  with pool as (
    select c.code,c.description,c.unit,c.labor,c.source_file,c.source_sheet,c.reference,0 as priority
    from public.orcapro_sinapi_compositions c where c.user_id=(select auth.uid())
    union all
    select r.code,r.description,r.unit,r.labor,r.source_file,r.source_sheet,r.reference,1 as priority
    from public.orcapro_sinapi_reference r
  ), ranked as (
    select p.*,row_number() over(partition by p.reference,p.code order by p.priority) as rank
    from pool p
  )
  select c.code,c.description,c.unit,c.labor,c.source_file,c.source_sheet,c.reference
  from ranked c
  where c.rank=1
    and length(trim(coalesce(p_query,''))) between 2 and 100
    and (p_reference is null or p_reference='' or c.reference=p_reference)
    and (
      c.code=trim(p_query)
      or c.code like trim(p_query)||'%'
      or c.code = regexp_replace(lower(trim(p_query)), '^sinapi[[:space:]]+', '')
      or (
        exists (
          select 1 from regexp_split_to_table(
            translate(lower(trim(p_query)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),
            '[^a-z0-9]+') as token
          where length(token)>=4 and token not in ('sinapi','servico','servicos','para','com','sem','padrao')
        )
        and not exists (
          select 1 from regexp_split_to_table(
            translate(lower(trim(p_query)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),
            '[^a-z0-9]+') as token
          where length(token)>=4 and token not in ('sinapi','servico','servicos','para','com','sem','padrao')
            and translate(lower(c.description),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')
                not like '%'||(case when token in ('monofasico','monofasica') then 'monofasic' else token end)||'%'
        )
      )
    )
  order by (c.code=trim(p_query)) desc,
           (c.code like trim(p_query)||'%') desc,
           (lower(p_query) like '%padrao%' and
              (lower(c.description) like '%entrada de energia%'
               or lower(c.description) like '%medidor monof%')) desc,
           substring(c.reference from 4 for 4) desc,
           substring(c.reference from 1 for 2) desc,
           c.priority,c.code
  limit least(greatest(coalesce(p_limit,40),1),80);
$sinapi$;

revoke all on function public.orcapro_find_sinapi(text,text,integer) from public, anon;
grant execute on function public.orcapro_find_sinapi(text,text,integer) to authenticated;
