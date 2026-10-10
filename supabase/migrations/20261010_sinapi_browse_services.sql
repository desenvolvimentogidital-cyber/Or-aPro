-- Navegação paginada de TODA a biblioteca SINAPI, sem copiar os 9.136 registros
-- para cada orçamento ou workspace. Exige JWT autenticado; RLS permanece ativa.
-- Preserva a preferência por uma composição pessoal quando código e competência coincidem.
create or replace function public.orcapro_browse_sinapi(
  p_query text default '',
  p_category text default 'todas',
  p_offset integer default 0,
  p_limit integer default 30
)
returns table(
  code text, description text, unit text, labor jsonb,
  "sourceFile" text, "sourceSheet" text, reference text,
  category text, total_count bigint
)
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
  ), tagged as (
    select r.*,
      upper(translate(r.labor::text,'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) as roles,
      translate(lower(r.description),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc') as normalized_description
    from ranked r where r.rank=1
  ), typed as (
    select t.*,
      case
        when t.roles ~ '(ELETRICISTA|ELETROTECNICO|INSTALADOR ELETRICO|CABISTA)'
             and t.roles ~ '(ENCANADOR|BOMBEIRO HIDRAULICO|INSTALADOR HIDRAULICO)' then 'mista'
        when t.roles ~ '(ELETRICISTA|ELETROTECNICO|INSTALADOR ELETRICO|CABISTA)' then 'eletrica'
        when t.roles ~ '(ENCANADOR|BOMBEIRO HIDRAULICO|INSTALADOR HIDRAULICO)' then 'hidraulica'
        when t.roles ~ 'PINTOR' then 'pintura'
        when t.roles ~ '(AZULEJISTA|LADRILHISTA|REVESTIDOR|ASSENTADOR)' then 'revestimento'
        when t.roles ~ 'PEDREIRO' and t.normalized_description ~ '(alvenaria|tijolo|bloco)' then 'alvenaria'
        when t.roles ~ '(PEDREIRO|CARPINTEIRO|ARMADOR|MESTRE DE OBRAS)' then 'civil'
        else 'outras'
      end as specialty
    from tagged t
  ), matching as (
    select t.* from typed t
    where (coalesce(p_category,'todas')='todas' or t.specialty=p_category)
      and (
        trim(coalesce(p_query,''))=''
        or t.code=trim(p_query)
        or t.code like trim(p_query)||'%'
        or (
          exists (
            select 1 from regexp_split_to_table(
              translate(lower(trim(p_query)),'áàâãäéèêëíìîïóòôõöúùûüç',
                'aaaaaeeeeiiiiooooouuuuc'), '[^a-z0-9]+') as token
            where length(token)>=3
              and token not in ('sinapi','servico','servicos','para','com','sem','padrao','instalacao')
          )
          and not exists (
            select 1 from regexp_split_to_table(
              translate(lower(trim(p_query)),'áàâãäéèêëíìîïóòôõöúùûüç',
                'aaaaaeeeeiiiiooooouuuuc'), '[^a-z0-9]+') as token
            where length(token)>=3
              and token not in ('sinapi','servico','servicos','para','com','sem','padrao','instalacao')
              and t.normalized_description not like '%'||
                (case when token in ('monofasico','monofasica') then 'monofasic'
                      when token in ('eletrico','eletrica') then 'eletric'
                      when token in ('hidraulico','hidraulica') then 'hidraulic'
                      else token end)||'%'
          )
        )
      )
  )
  select m.code,m.description,m.unit,m.labor,m.source_file,m.source_sheet,
         m.reference,m.specialty,count(*) over() as total_count
  from matching m
  order by (m.code=trim(coalesce(p_query,''))) desc,
           (m.code like trim(coalesce(p_query,''))||'%') desc,
           (lower(p_query) like '%padrao%' and
             (m.normalized_description like '%entrada de energia%' or
              m.normalized_description like '%medidor monof%')) desc,
           substring(m.reference from 4 for 4) desc,
           substring(m.reference from 1 for 2) desc,
           m.code
  limit least(greatest(coalesce(p_limit,30),1),60)
  offset least(greatest(coalesce(p_offset,0),0),20000);
$sinapi$;

revoke all on function public.orcapro_browse_sinapi(text,text,integer,integer) from public, anon;
grant execute on function public.orcapro_browse_sinapi(text,text,integer,integer) to authenticated;
