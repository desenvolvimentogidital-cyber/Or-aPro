-- Execute once in Supabase SQL Editor. Only publishable/anon key goes into Vite.
create table if not exists public.orcapro_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.orcapro_shared_quotes (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quote_id text not null,
  payload jsonb not null,
  status text not null default 'pendente' check(status in ('pendente','aprovado','recusado')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  responded_at timestamptz
);
create index if not exists orcapro_shared_quotes_user_id_idx on public.orcapro_shared_quotes(user_id);

alter table public.orcapro_workspaces enable row level security;
alter table public.orcapro_shared_quotes enable row level security;
revoke all on public.orcapro_workspaces from public, anon;
revoke all on public.orcapro_shared_quotes from public, anon;
grant select, insert, update, delete on public.orcapro_workspaces to authenticated;
grant select, insert, update, delete on public.orcapro_shared_quotes to authenticated;

drop policy if exists "owners manage workspaces" on public.orcapro_workspaces;
create policy "owners manage workspaces" on public.orcapro_workspaces
for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "owners manage shared quotes" on public.orcapro_shared_quotes;
create policy "owners manage shared quotes" on public.orcapro_shared_quotes
for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Public access is ONLY through a lookup by unpredictable UUID; never give anon SELECT on table.
create or replace function public.orcapro_public_quote(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null; end if;
  select jsonb_build_object('payload', payload, 'status', status, 'expires_at', expires_at)
    into result from public.orcapro_shared_quotes
    where token = p_token::uuid and expires_at > now();
  return result;
end;
$$;
revoke all on function public.orcapro_public_quote(text) from public;
grant execute on function public.orcapro_public_quote(text) to anon, authenticated;

-- A client's decision is a token-based acceptance, NOT a verified digital signature.
create or replace function public.orcapro_decide_quote(p_token text, p_status text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare share public.orcapro_shared_quotes%rowtype;
begin
  if p_status not in ('aprovado', 'recusado') or p_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  select * into share from public.orcapro_shared_quotes where token = p_token::uuid for update;
  if not found or share.status <> 'pendente' or share.expires_at <= now() then return false; end if;
  if (share.payload->'quote'->>'validUntil') ~ '^\d{4}-\d{2}-\d{2}$' and (share.payload->'quote'->>'validUntil')::date < current_date then return false; end if;
  -- Serialize competing decisions for different links that refer to one quote.
  perform 1 from public.orcapro_workspaces where user_id = share.user_id for update;
  if not found then return false; end if;
  -- Reject acceptance if the quote was deleted or already decided in the owner's account.
  if not exists (
    select 1 from public.orcapro_workspaces w,
      jsonb_array_elements(coalesce(w.payload->'quotes','[]'::jsonb)) q
    where w.user_id = share.user_id and q->>'id' = share.quote_id
      and q->>'status' in ('rascunho','enviado')
  ) then return false; end if;
  update public.orcapro_shared_quotes set status = p_status, responded_at = now() where token = share.token;
  update public.orcapro_shared_quotes set status = p_status, responded_at = now()
    where user_id = share.user_id and quote_id = share.quote_id and status = 'pendente';
  update public.orcapro_workspaces
  set payload = jsonb_set(
    jsonb_set(payload, '{quotes}', coalesce((
      select jsonb_agg(case when q.item ->> 'id' = share.quote_id then
        jsonb_set(
          jsonb_set(q.item, '{status}', to_jsonb(p_status)),
          '{history}', coalesce(q.item->'history','[]'::jsonb) || jsonb_build_array(jsonb_build_object(
            'date', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'action', 'Resposta registrada no link público: ' || p_status || ' (identidade não verificada)',
            'user', 'Visitante com link público'
          ))
        ) else q.item end order by q.position)
      from jsonb_array_elements(coalesce(payload->'quotes','[]'::jsonb)) with ordinality as q(item, position)
    ), '[]'::jsonb)),
    '{notifications}', coalesce(payload->'notifications','[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text,
      'title', case when p_status = 'aprovado' then 'Proposta aprovada por link' else 'Proposta recusada por link' end,
      'message', 'A proposta ' || coalesce(share.payload->'quote'->>'number', share.quote_id) || ' recebeu a resposta ' || p_status || ' por link público (identidade não verificada).',
      'timestamp', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'read', false, 'type', case when p_status = 'aprovado' then 'success' else 'warning' end,
      'quoteId', share.quote_id
    ))
  ), revision = revision + 1, updated_at = now()
  where user_id = share.user_id;
  return true;
end;
$$;
revoke all on function public.orcapro_decide_quote(text,text) from public;
grant execute on function public.orcapro_decide_quote(text,text) to anon, authenticated;

-- Biblioteca analítica SINAPI; manter este trecho alinhado com migrations/20261010_sinapi_library.sql.
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

-- Catálogo global somente leitura autenticada; mesma DDL da segunda migração.
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
