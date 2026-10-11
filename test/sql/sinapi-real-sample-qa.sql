-- OrçaPro: validar a AMOSTRA SINAPI REAL 09/2026 publicada SOMENTE em homologação.
-- Read-only: executar com acesso administrativo após a carga de QA.
-- Não confundir aprovação desta amostra com importação nacional completa.
DO $qa$
DECLARE bad integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.orcapro_sinapi_published_unit_costs
      WHERE reference='09/2026' AND code='88316' AND unit='H'
      AND costs_in_cents #>> '{com_desoneracao,PR}'='3112') THEN
    RAISE EXCEPTION 'SINAPI QA: custo oficial 88316 PR CCD não confere';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.orcapro_sinapi_published_inputs
      WHERE reference='09/2026' AND code='6111' AND unit='H'
      AND classification='MAO DE OBRA'
      AND costs_in_cents #>> '{com_desoneracao,PR}'='2018') THEN
    RAISE EXCEPTION 'SINAPI QA: preço oficial da mão de obra não confere';
  END IF;
  IF NOT has_table_privilege('authenticated','public.orcapro_sinapi_published_inputs','SELECT')
     OR has_table_privilege('anon','public.orcapro_sinapi_published_inputs','SELECT')
     OR has_table_privilege('authenticated','public.orcapro_sinapi_published_inputs','INSERT')
     OR has_table_privilege('anon','public.orcapro_sinapi_published_analytical','SELECT') THEN
    RAISE EXCEPTION 'SINAPI QA: permissões de catálogo nacional inseguras';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN (
        'orcapro_sinapi_published_inputs','orcapro_sinapi_published_analytical')
        AND NOT c.relrowsecurity) THEN
    RAISE EXCEPTION 'SINAPI QA: falta RLS em tabela nacional';
  END IF;
  WITH RECURSIVE part AS (
    SELECT a.code AS root,a.unit AS root_unit,
       child.value->>'type' AS kind, child.value->>'code' AS code,
       child.value->>'unit' AS unit,
       (child.value->>'coefficient')::numeric AS qty,
       ARRAY[a.code] AS visited,1 AS depth
    FROM public.orcapro_sinapi_published_analytical a
    CROSS JOIN LATERAL jsonb_array_elements(a.items) child(value)
    WHERE a.reference='09/2026' AND a.code IN ('88316','103666','92715','107717')
    UNION ALL
    SELECT p.root,p.root_unit,ch.value->>'type',ch.value->>'code',
       ch.value->>'unit',p.qty*(ch.value->>'coefficient')::numeric,
       p.visited||a.code,p.depth+1
    FROM part p JOIN public.orcapro_sinapi_published_analytical a
       ON a.reference='09/2026' AND a.code=p.code AND a.unit=p.unit
    CROSS JOIN LATERAL jsonb_array_elements(a.items) ch(value)
    WHERE p.kind='composition' AND p.depth<12 AND NOT a.code=ANY(p.visited)
  ), totals AS (
    SELECT p.root,p.root_unit,
       count(*) FILTER (WHERE p.kind='input' AND i.code IS NULL) AS missing_inputs,
       sum(p.qty*(i.costs_in_cents #>> '{com_desoneracao,PR}')::numeric)
          FILTER (WHERE p.kind='input') AS calculated
    FROM part p LEFT JOIN public.orcapro_sinapi_published_inputs i
      ON p.kind='input' AND i.reference='09/2026' AND i.code=p.code AND i.unit=p.unit
    GROUP BY p.root,p.root_unit
  )
  SELECT count(*) INTO bad FROM totals t JOIN public.orcapro_sinapi_published_unit_costs c
    ON c.reference='09/2026' AND c.code=t.root AND c.unit=t.root_unit
    WHERE t.missing_inputs>0 OR t.calculated IS NULL
      OR abs(t.calculated-(c.costs_in_cents #>> '{com_desoneracao,PR}')::numeric)>2;
  IF bad>0 THEN
    RAISE EXCEPTION 'SINAPI QA: insumos ausentes ou diferença superior a 2 centavos em % serviços',bad;
  END IF;
  IF (SELECT count(*) FROM public.orcapro_sinapi_published_analytical
       WHERE reference='09/2026' AND code IN ('88316','103666','92715','107717'))<>4 THEN
    RAISE EXCEPTION 'SINAPI QA: quatro amostras analíticas não encontradas';
  END IF;
END $qa$;
