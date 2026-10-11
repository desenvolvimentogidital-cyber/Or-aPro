-- Analítico SINAPI original por composição, distinto de custos e referências horárias.
-- Usado para decomposição recursiva; não inventa itens/coeficientes ausentes.
create table if not exists public.orcapro_sinapi_published_analytical (
  reference text not null check(reference ~ '^(0[1-9]|1[0-2])/20[0-9]{2}$'),
  code text not null check(code ~ '^[0-9]{3,8}$'),
  unit text not null check(length(trim(unit)) between 1 and 30),
  items jsonb not null check(jsonb_typeof(items)='array'),
  source_file text not null check(length(trim(source_file)) between 1 and 200),
  primary key (reference,code,unit)
);
alter table public.orcapro_sinapi_published_analytical enable row level security;
revoke all on public.orcapro_sinapi_published_analytical from public,anon,authenticated;
grant select on public.orcapro_sinapi_published_analytical to authenticated;
drop policy if exists sinapi_analytical_authenticated_read on public.orcapro_sinapi_published_analytical;
create policy sinapi_analytical_authenticated_read
on public.orcapro_sinapi_published_analytical for select to authenticated using (true);
comment on table public.orcapro_sinapi_published_analytical is
  'Itens da planilha Analítico SINAPI com coeficientes oficiais e situação; validação da decomposição exige preços de insumos, auxiliares e custo global da mesma UF/regime.';
