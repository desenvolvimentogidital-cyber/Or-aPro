#!/usr/bin/env bash
# SOMENTE CI: nunca conectar o banco real. O workflow configura banco efêmero.
set -euo pipefail
if [[ "$PGHOST" != "127.0.0.1" || "$PGDATABASE" != "orcapro_ci" ]]; then
  echo "::error::Contrato nacional exige PostgreSQL efêmero do CI"
  exit 1
fi
python3 - <<'PY'
from pathlib import Path
import sys
sys.path.insert(0,'test')
from test_sinapi_national_prices import fixture,p
folder=Path('/tmp/orcapro-sinapi-contract')
folder.mkdir(exist_ok=True)
source=folder/'SINAPI_2026_09.xlsx'
fixture(source)
rows,report=p.extract(source)
for kind,items in rows.items():
    p.csv_file(folder/(kind+'.csv'),items,source.name)
(folder/'import.sql').write_text(p.sql_import(folder,report['reference']),encoding='utf-8')
assert report['composition_rows']==10000
assert report['input_rows']==4000
PY
# O CI começa com 11 preços reais exemplificativos. O XLSX sintético deve
# CONFLITAR com eles e ser integralmente recusado (nenhuma sobregravação).
if psql -v ON_ERROR_STOP=1 -f /tmp/orcapro-sinapi-contract/import.sql > /tmp/orcapro-sinapi-conflict.log 2>&1; then
  echo "::error::Importador aceitou preços divergentes já publicados"
  exit 1
fi
if ! grep -q "Preço publicado divergente" /tmp/orcapro-sinapi-conflict.log; then
  cat /tmp/orcapro-sinapi-conflict.log
  echo "::error::Falha inesperada no teste de conflitos"
  exit 1
fi
# Liberar somente os registros de exemplo do BANCO TEMPORÁRIO DO CI.
psql -v ON_ERROR_STOP=1 -c 'TRUNCATE public.orcapro_sinapi_published_unit_costs;'
psql -v ON_ERROR_STOP=1 -f /tmp/orcapro-sinapi-contract/import.sql
# Segunda importação comprova idempotência e ausência de preços duplicados.
psql -v ON_ERROR_STOP=1 -f /tmp/orcapro-sinapi-contract/import.sql
# Se o mesmo código+unidade já estiver classificado de modo diferente,
# abortar TODA a transação sem sobrescrever os dados existentes.
psql -v ON_ERROR_STOP=1 -c "UPDATE public.orcapro_sinapi_published_inputs SET classification='OUTROS' WHERE reference='09/2026' AND code='1000' AND unit='UN';"
if psql -v ON_ERROR_STOP=1 -f /tmp/orcapro-sinapi-contract/import.sql > /tmp/orcapro-sinapi-classification.log 2>&1; then
  echo "::error::Importação aceitou classificação de insumo divergente"
  exit 1
fi
if ! grep -q 'Classificação de insumo publicado divergente' /tmp/orcapro-sinapi-classification.log; then
  cat /tmp/orcapro-sinapi-classification.log
  echo "::error::Erro inesperado no contrato de classificação"
  exit 1
fi
psql -v ON_ERROR_STOP=1 <<'SQL'
DO $BEGIN
 IF (SELECT classification FROM public.orcapro_sinapi_published_inputs
     WHERE reference='09/2026' AND code='1000' AND unit='UN') <> 'OUTROS' THEN
    RAISE EXCEPTION 'Conflito alterou classificação original';
 END IF;
END $;
UPDATE public.orcapro_sinapi_published_inputs SET classification='MATERIAL'
 WHERE reference='09/2026' AND code='1000' AND unit='UN';
SQL
psql -v ON_ERROR_STOP=1 -f /tmp/orcapro-sinapi-contract/import.sql
psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF (SELECT count(*) FROM public.orcapro_sinapi_published_unit_costs WHERE reference='09/2026')<>10000
     OR (SELECT count(*) FROM public.orcapro_sinapi_published_inputs WHERE reference='09/2026')<>4000
  THEN RAISE EXCEPTION 'Carga nacional incompleta ou não idempotente'; END IF;
  IF (SELECT costs_in_cents #>> '{sem_desoneracao,PR}'
      FROM public.orcapro_sinapi_published_unit_costs
      WHERE reference='09/2026' AND code='100000' AND unit='M2')::integer <>10170
  THEN RAISE EXCEPTION 'Preço de composição PR incorreto'; END IF;
  IF (SELECT costs_in_cents ? 'com_desoneracao'
      FROM public.orcapro_sinapi_published_inputs
      WHERE reference='09/2026' AND code='1000' AND unit='UN') IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'Custo de insumos do segundo regime ausente'; END IF;
END $$;
SQL
echo "PASS importação nacional: 27 UFs, dois regimes e repetição idempotente"
