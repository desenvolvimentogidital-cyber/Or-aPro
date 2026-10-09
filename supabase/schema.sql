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
