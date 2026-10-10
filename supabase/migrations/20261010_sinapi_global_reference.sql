-- Biblioteca analítica global, importada de fonte SINAPI fornecida pelo responsável.
-- Somente o backend administrativo sem papel authenticated pode inserir/atualizar.
create table if not exists public.orcapro_sinapi_reference (
  reference text not null check (reference ~ '^(0[1-9]|1[0-2])/20[0-9]{2}$'),
  code text not null check (code ~ '^[0-9]{3,8}$'),
  description text not null check (length(description) between 3 and 1500),
  unit text not null check (length(unit) between 1 and 30),
  labor jsonb not null check (jsonb_typeof(labor)='array' and jsonb_array_length(labor) between 1 and 50),
  source_file text not null check (length(source_file) between 1 and 200),
  source_sheet text not null check (length(source_sheet) between 1 and 100),
  imported_at timestamptz not null default now(),
  primary key (reference,code)
);
create index if not exists orcapro_sinapi_reference_code_idx on public.orcapro_sinapi_reference (code);
alter table public.orcapro_sinapi_reference enable row level security;
revoke all on public.orcapro_sinapi_reference from public, anon, authenticated;
grant select on public.orcapro_sinapi_reference to authenticated;
drop policy if exists "authenticated read sinapi reference" on public.orcapro_sinapi_reference;
create policy "authenticated read sinapi reference" on public.orcapro_sinapi_reference for select to authenticated using (true);

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
      or c.code = regexp_replace(lower(trim(p_query)), '^sinapi\\s+', '')
      or (
        exists (
          select 1 from regexp_split_to_table(
            translate(lower(trim(p_query)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),
            '[^a-z0-9]+') as token
          where length(token)>=4 and token not in ('sinapi','servico','servicos','para','com','sem')
        )
        and not exists (
          select 1 from regexp_split_to_table(
            translate(lower(trim(p_query)),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),
            '[^a-z0-9]+') as token
          where length(token)>=4 and token not in ('sinapi','servico','servicos','para','com','sem')
            and translate(lower(c.description),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')
                not like '%'||token||'%'
        )
      )
    )
  order by (c.code=trim(p_query)) desc,
           (c.code like trim(p_query)||'%') desc,
           substring(c.reference from 4 for 4) desc,
           substring(c.reference from 1 for 2) desc,
           c.priority,c.code
  limit least(greatest(coalesce(p_limit,40),1),80);
$sinapi$;
revoke all on function public.orcapro_find_sinapi(text,text,integer) from public, anon;
grant execute on function public.orcapro_find_sinapi(text,text,integer) to authenticated;

create or replace function public.orcapro_sinapi_library_count()
returns integer language sql stable security invoker set search_path=''
as $sinapi$
  select ((select count(*) from public.orcapro_sinapi_reference)
    +(select count(*) from public.orcapro_sinapi_compositions where user_id=(select auth.uid())))::int;
$sinapi$;
revoke all on function public.orcapro_sinapi_library_count() from public, anon;
grant execute on function public.orcapro_sinapi_library_count() to authenticated;
