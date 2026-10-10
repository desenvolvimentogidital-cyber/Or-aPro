-- RLS e RPC validos executados somente no Postgres efemero do GitHub Actions.
BEGIN;
INSERT INTO auth.users(id) VALUES
 ('00000000-0000-4000-8000-00000000000a'),
 ('00000000-0000-4000-8000-00000000000b');
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.orcapro_workspaces', 'SELECT') OR
     has_table_privilege('anon', 'public.orcapro_shared_quotes', 'SELECT') OR
     has_table_privilege('anon', 'public.orcapro_sinapi_compositions', 'SELECT') THEN
    RAISE EXCEPTION 'Anon nao pode ter SELECT nas tabelas privadas';
  END IF;
END $$;

SET request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
SET ROLE authenticated;
INSERT INTO public.orcapro_workspaces (user_id, payload)
VALUES ('00000000-0000-4000-8000-00000000000a',
 '{"quotes":[{"id":"orc-qa-a","status":"enviado","number":"#QA-A","history":[]}],"notifications":[]}'::jsonb);
INSERT INTO public.orcapro_sinapi_compositions
(user_id,reference,code,description,unit,labor,source_file,source_sheet)
values ('00000000-0000-4000-8000-00000000000a','09/2026','100860',
 'COMPOSICAO DE TESTE SINAPI', 'UN',
 '[{"code":"qa","role":"Profissional de teste","hoursPerUnit":1.2}]'::jsonb,
 'planilha_qa.xlsx','Analítico');
DO $ BEGIN
 IF (SELECT count(*) FROM public.orcapro_find_sinapi('100860'))<>1 THEN
   RAISE EXCEPTION 'A conta dona nao consegue pesquisar sua composição SINAPI';
 END IF;
END $;

INSERT INTO public.orcapro_shared_quotes
(token, user_id, quote_id, payload, expires_at)
VALUES
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  '00000000-0000-4000-8000-00000000000a',
  'orc-qa-a',
  '{"quote":{"id":"orc-qa-a","number":"#QA-A","validUntil":"2099-12-31"}}'::jsonb,
  now() + interval '2 days'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '00000000-0000-4000-8000-00000000000a',
  'orc-qa-a',
  '{"quote":{"id":"orc-qa-a","number":"#QA-A","validUntil":"2099-12-31"}}'::jsonb,
  now() - interval '1 minute');
DO $$
BEGIN
  IF (SELECT count(*) FROM public.orcapro_workspaces) <> 1 THEN
    RAISE EXCEPTION 'O dono deve ler seu workspace';
  END IF;
  IF (SELECT count(*) FROM public.orcapro_shared_quotes) <> 2 THEN
    RAISE EXCEPTION 'O dono deve ler suas propostas';
  END IF;
END $$;
RESET ROLE;

SET request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000b';
SET ROLE authenticated;
DO $$
DECLARE changed integer;
BEGIN
  IF (SELECT count(*) FROM public.orcapro_workspaces) <> 0 OR
     (SELECT count(*) FROM public.orcapro_shared_quotes) <> 0 OR
     (SELECT count(*) FROM public.orcapro_sinapi_compositions) <> 0 OR
     (SELECT count(*) FROM public.orcapro_find_sinapi('100860')) <> 0 THEN
    RAISE EXCEPTION 'RLS permitiu ao usuario B ler dados do usuario A';
  END IF;
  UPDATE public.orcapro_workspaces SET revision=revision+1
  WHERE user_id='00000000-0000-4000-8000-00000000000a';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN
    RAISE EXCEPTION 'RLS permitiu alterar o workspace de outra conta';
  END IF;
END $$;
RESET ROLE;

SET ROLE anon;
DO $$
DECLARE p jsonb;
BEGIN
  IF public.orcapro_public_quote('token-malformado') IS NOT NULL OR
     public.orcapro_public_quote('ffffffff-ffff-4fff-8fff-ffffffffffff') IS NOT NULL OR
     public.orcapro_public_quote('dddddddd-dddd-4ddd-8ddd-dddddddddddd') IS NOT NULL THEN
    RAISE EXCEPTION 'Token malformado, ausente ou expirado vazou proposta';
  END IF;
  IF public.orcapro_decide_quote('token-malformado', 'aprovado') OR
     public.orcapro_decide_quote('ffffffff-ffff-4fff-8fff-ffffffffffff', 'aprovado') OR
     public.orcapro_decide_quote('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'aprovado') OR
     public.orcapro_decide_quote('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'cancelado') THEN
    RAISE EXCEPTION 'Uma decisao invalida foi aceita';
  END IF;
  p := public.orcapro_public_quote('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  IF p IS NULL OR p->>'status' <> 'pendente' THEN
    RAISE EXCEPTION 'Token valido nao abriu a proposta pendente';
  END IF;
  IF NOT public.orcapro_decide_quote('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'aprovado') THEN
    RAISE EXCEPTION 'Aprovacao valida nao foi registrada';
  END IF;
  IF public.orcapro_decide_quote('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'recusado') THEN
    RAISE EXCEPTION 'Token foi usado duas vezes para decidir';
  END IF;
END $$;
RESET ROLE;

SET request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
SET ROLE authenticated;
DO $$
DECLARE workspace_record record;
BEGIN
  SELECT revision, payload INTO workspace_record
  FROM public.orcapro_workspaces
  WHERE user_id='00000000-0000-4000-8000-00000000000a';
  IF workspace_record.revision <> 2 OR
     workspace_record.payload->'quotes'->0->>'status' <> 'aprovado' OR
     jsonb_array_length(workspace_record.payload->'notifications') <> 1 THEN
    RAISE EXCEPTION 'Aceite nao atualizou status, revisao e notificacao exatamente uma vez';
  END IF;
  IF (SELECT status FROM public.orcapro_shared_quotes
      WHERE token='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') <> 'aprovado' THEN
    RAISE EXCEPTION 'Aceite nao atualizou o registro publico';
  END IF;
END $$;
RESET ROLE;
ROLLBACK;
\echo 'PASS: RLS de duas contas, tokens invalidos e expirados, aceite valido e idempotencia'
