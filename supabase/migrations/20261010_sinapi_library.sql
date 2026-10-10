-- Biblioteca SINAPI analítica por conta. Não modifica orçamentos, cronogramas ou RLS existentes.
create table if not exists public.orcapro_sinapi_compositions (
  user_id uuid not null references auth.users(id) on delete cascade,
  reference text not null check (reference ~ '^(0[1-9]|1[0-2])/20[0-9]{2}$'),
  code text not null check (code ~ '^[0-9]{3,8}$'),
  description text not null check (length(description) between 3 and 1500),
  unit text not null check (length(unit) between 1 and 30),
  labor jsonb not null check (jsonb_typeof(labor) = 'array' and jsonb_array_length(labor) between 1 and 50),
  source_file text not null check (length(source_file) between 1 and 200),
  source_sheet text not null check (length(source_sheet) between 1 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, reference, code)
);
create index if not exists orcapro_sinapi_code_idx on public.orcapro_sinapi_compositions(user_id,code);
alter table public.orcapro_sinapi_compositions enable row level security;
revoke all on public.orcapro_sinapi_compositions from public, anon;
grant select, insert, update, delete on public.orcapro_sinapi_compositions to authenticated;
drop policy if exists "owners manage sinapi library" on public.orcapro_sinapi_compositions;
create policy "owners manage sinapi library" on public.orcapro_sinapi_compositions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.orcapro_find_sinapi(p_query text, p_reference text default null, p_limit integer default 40)
returns table (code text, description text, unit text, labor jsonb, "sourceFile" text, "sourceSheet" text, reference text)
language sql stable security invoker set search_path = ''
as $$
  select c.code,c.description,c.unit,c.labor,c.source_file,c.source_sheet,c.reference
  from public.orcapro_sinapi_compositions c
  where c.user_id = (select auth.uid())
    and length(trim(coalesce(p_query,''))) between 2 and 100
    and (p_reference is null or p_reference = '' or c.reference = p_reference)
    and (
      c.code = trim(p_query)
      or c.code like trim(p_query) || '%'
      or c.code = regexp_replace(lower(trim(p_query)), '^sinapi\\s+', '')
      or (
        -- Pesquisa palavras independentemente da ordem: "instalação de chuveiro"
        -- deve encontrar "CHUVEIRO ... FORNECIMENTO E INSTALAÇÃO".
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
                not like '%' || token || '%'
        )
      )
    )
  order by (c.code = trim(p_query)) desc,
           (c.code like trim(p_query)||'%') desc,
           substring(c.reference from 4 for 4) desc,
           substring(c.reference from 1 for 2) desc,
           c.code
  limit least(greatest(coalesce(p_limit,40),1),80);
$$;
revoke all on function public.orcapro_find_sinapi(text,text,integer) from public, anon;
grant execute on function public.orcapro_find_sinapi(text,text,integer) to authenticated;
