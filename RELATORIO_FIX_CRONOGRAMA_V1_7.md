# OrçaPro v1.7 — correção da seleção do cronograma de teste

## Problema confirmado

O banco continha dois cronogramas: o primeiro, **Novo cronograma**, sem etapas, e o segundo, **[TESTE] Acabamentos — forro e piso podotátil**, com duas etapas. A interface abria o primeiro registro automaticamente, criando a impressão de que o teste não havia sido salvo.

## Correções

- Sem seleção manual, abre primeiro um cronograma que contenha etapas.
- Seleção explícita de cronograma vazio continua permitida.
- Lista agora mostra quantas etapas cada cronograma contém.
- Ao acessar um cronograma vazio, oferece atalho para abrir outro com etapas.
- Rótulo da versão atualizado de v1.4 para v1.7 (o valor anterior era fixo na interface).
- Adicionados testes específicos de seleção.

## Correção dos dados remotos

Os registros existentes no Supabase foram **apenas reordenados**: o cronograma preenchido agora fica na primeira posição. Nenhum registro foi excluído, e o orçamento permaneceu em rascunho.

## Operação local

Substitua a pasta antiga pela pasta do ZIP novo; rode `npm install` e `npm run dev` (ou mantenha `node_modules` já instalado, caso compatível). Recarregue o navegador.

Não é necessário executar SQL nem configurar outro projeto Supabase.
