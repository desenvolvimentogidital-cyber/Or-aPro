-- Custos monetários oficiais SINAPI separados dos coeficientes analíticos HH.
-- O arquivo de composições Analítico não tem custo por UF/regime;
-- valores são gravados somente quando importados das abas CSD/CCD ou CSV validado.
create table if not exists public.orcapro_sinapi_unit_costs (
  user_id uuid not null references auth.users(id) on delete cascade,
  reference text not null check(reference ~ '^(0[1-9]|1[0-2])/20[0-9]{2}$'),
  uf text not null check(uf in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  regime text not null check(regime in ('sem_desoneracao','com_desoneracao')),
  code text not null check(code ~ '^[0-9]{3,8}$'),
  unit text not null check(length(trim(unit)) between 1 and 30),
  unit_cost numeric(16,4) not null check(unit_cost>0 and unit_cost<=1000000000),
  source_file text not null check(length(source_file) between 1 and 200),
  updated_at timestamptz not null default now(),
  primary key (user_id,reference,uf,regime,code,unit)
);
alter table public.orcapro_sinapi_unit_costs enable row level security;
drop policy if exists sinapi_unit_costs_self_read on public.orcapro_sinapi_unit_costs;
create policy sinapi_unit_costs_self_read on public.orcapro_sinapi_unit_costs
  for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists sinapi_unit_costs_self_insert on public.orcapro_sinapi_unit_costs;
create policy sinapi_unit_costs_self_insert on public.orcapro_sinapi_unit_costs
  for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists sinapi_unit_costs_self_update on public.orcapro_sinapi_unit_costs;
create policy sinapi_unit_costs_self_update on public.orcapro_sinapi_unit_costs
  for update to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
revoke all on public.orcapro_sinapi_unit_costs from anon,public;
grant select,insert,update on public.orcapro_sinapi_unit_costs to authenticated;
