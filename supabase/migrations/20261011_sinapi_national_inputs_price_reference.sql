-- Estrutura da tabela nacional de INSUMOS; a de COMPOSIÇÕES já existe.
-- Dados oficiais são importados somente em etapa autorizada de publicação.
-- Valores ausentes ficam ausentes no JSONB; nunca são representados como custo zero.
create table if not exists public.orcapro_sinapi_published_inputs (
  reference text not null check(reference ~ '^(0[1-9]|1[0-2])/20[0-9]{2}$'),
  code text not null check(code ~ '^[0-9]{1,8}$'),
  unit text not null check(length(trim(unit)) between 1 and 30),
  classification text not null check(length(trim(classification)) between 1 and 80),
  costs_in_cents jsonb not null check(jsonb_typeof(costs_in_cents)='object'),
  source_file text not null check(length(trim(source_file)) between 1 and 200),
  primary key (reference,code,unit)
);
alter table public.orcapro_sinapi_published_inputs enable row level security;
revoke all on public.orcapro_sinapi_published_inputs from public,anon,authenticated;
grant select on public.orcapro_sinapi_published_inputs to authenticated;
drop policy if exists sinapi_inputs_authenticated_read on public.orcapro_sinapi_published_inputs;
create policy sinapi_inputs_authenticated_read on public.orcapro_sinapi_published_inputs
for select to authenticated using (true);
comment on table public.orcapro_sinapi_published_inputs is
  'Insumos nacionais oficiais SINAPI separados de composições. Cada preço traz UF/regime e competência; acesso autenticado somente leitura, importação administrativa.';
