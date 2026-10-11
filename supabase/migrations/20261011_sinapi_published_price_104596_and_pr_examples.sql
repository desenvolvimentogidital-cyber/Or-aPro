-- Referências monetárias públicas verificadas no SINAPI Referência 09/2026.
-- Diferentes dos coeficientes HH: custo unitário por UF e desoneração.
-- Dados de usuário permanecem em orcapro_sinapi_unit_costs, com prioridade.
create table if not exists public.orcapro_sinapi_published_unit_costs (
  reference text not null check (reference ~ '^(0[1-9]|1[0-2])/20[0-9]{2}$'),
  code text not null check (code ~ '^[0-9]{3,8}$'),
  unit text not null check (length(trim(unit)) between 1 and 30),
  costs_in_cents jsonb not null check (jsonb_typeof(costs_in_cents) = 'object'),
  source_file text not null,
  primary key(reference,code,unit)
);
alter table public.orcapro_sinapi_published_unit_costs enable row level security;
drop policy if exists sinapi_published_prices_authenticated_read
  on public.orcapro_sinapi_published_unit_costs;
create policy sinapi_published_prices_authenticated_read
  on public.orcapro_sinapi_published_unit_costs
  for select to authenticated using (true);
revoke all on public.orcapro_sinapi_published_unit_costs from public,anon,authenticated;
grant select on public.orcapro_sinapi_published_unit_costs to authenticated;

-- Os custos são extraídos da aba CSD/CCD da planilha SINAPI_Referência_2026_09.xlsx,
-- em centavos, não representam BDI nem preço de venda.
insert into public.orcapro_sinapi_published_unit_costs
(reference,code,unit,costs_in_cents,source_file) values
('09/2026','104596','M2',
'{"sem_desoneracao":{"AC":17171,"AL":15148,"AM":17221,"AP":17903,"BA":13890,"CE":16068,"DF":14805,"ES":13754,"GO":13425,"MA":17535,"MG":15853,"MS":16593,"MT":19071,"PA":16678,"PB":15928,"PE":15486,"PI":15386,"PR":15151,"RJ":17020,"RN":14505,"RO":17628,"RR":18863,"RS":15006,"SC":14608,"SE":14996,"SP":14713,"TO":15150},"com_desoneracao":{"AC":16908,"AL":14925,"AM":16934,"AP":17631,"BA":13628,"CE":15824,"DF":14556,"ES":13505,"GO":13172,"MA":17303,"MG":15568,"MS":16354,"MT":18833,"PA":16448,"PB":15685,"PE":15242,"PI":15158,"PR":14829,"RJ":16689,"RN":14293,"RO":17358,"RR":18557,"RS":14751,"SC":14267,"SE":14772,"SP":14422,"TO":14925}}'::jsonb,
'SINAPI_Referência_2026_09.xlsx (CSD/CCD)'),
('09/2026','91991','UN','{"sem_desoneracao":{"PR":4962},"com_desoneracao":{"PR":4747}}','SINAPI_Referência_2026_09.xlsx (CSD/CCD)'),
('09/2026','100860','UN','{"sem_desoneracao":{"PR":18194},"com_desoneracao":{"PR":17844}}','SINAPI_Referência_2026_09.xlsx (CSD/CCD)'),
('09/2026','100859','UN','{"sem_desoneracao":{"PR":155030},"com_desoneracao":{"PR":154364}}','SINAPI_Referência_2026_09.xlsx (CSD/CCD)'),
('09/2026','104595','M2','{"sem_desoneracao":{"PR":6414},"com_desoneracao":{"PR":6320}}','SINAPI_Referência_2026_09.xlsx (CSD/CCD)'),
('09/2026','104597','M2','{"sem_desoneracao":{"PR":13237},"com_desoneracao":{"PR":13002}}','SINAPI_Referência_2026_09.xlsx (CSD/CCD)'),
('09/2026','91990','UN','{"sem_desoneracao":{"PR":4746},"com_desoneracao":{"PR":4531}}','SINAPI_Referência_2026_09.xlsx (CSD/CCD)'),
('09/2026','91992','UN','{"sem_desoneracao":{"PR":6177},"com_desoneracao":{"PR":5909}}','SINAPI_Referência_2026_09.xlsx (CSD/CCD)'),
('09/2026','104658','M2','{"sem_desoneracao":{"PR":16116},"com_desoneracao":{"PR":15754}}','SINAPI_Referência_2026_09.xlsx (CSD/CCD)'),
('09/2026','103328','M2','{"sem_desoneracao":{"PR":12831},"com_desoneracao":{"PR":12306}}','SINAPI_Referência_2026_09.xlsx (CSD/CCD)'),
('09/2026','87246','M2','{"sem_desoneracao":{"PR":7471},"com_desoneracao":{"PR":7282}}','SINAPI_Referência_2026_09.xlsx (CSD/CCD)')
on conflict (reference,code,unit)
do update set costs_in_cents = excluded.costs_in_cents, source_file=excluded.source_file;
