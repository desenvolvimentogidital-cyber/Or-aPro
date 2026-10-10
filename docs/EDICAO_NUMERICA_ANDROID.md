# OrçaPro — edição de campos numéricos (Android e web)

## Problema reproduzido
O usuário informou que tocava no valor já preenchido, mas precisava mover o cursor e apagar dígito por dígito. Em outros campos, ao apagar tudo o React retornava imediatamente o valor `0`, impedindo substituir o conteúdo.

## Comportamento implementado
- Ao focar um campo com `type=number`, `inputMode=decimal` ou `inputMode=numeric`, o valor preenchido é **selecionado**. Não zera nem grava um novo valor só porque recebeu foco.
- Os editores `EditableNumericInput` mantêm o **rascunho de texto** localmente, inclusive vazio, durante a digitação; aceitam decimais com vírgula (ex.: `250,75`). O dado numérico é confirmado ao sair do campo (blur), nunca durante um apagamento intermediário.
- Em campos obrigatórios, sair sem informar número válido preserva o dado anterior. Faixas mínimas e máximas são conferidas antes de confirmar.
- Em campos opcionais (ex.: frete e desconto), apagar e sair define valor zero, mas a interface o apresenta **em branco**, sem um zero que atrapalhe a digitação.
- Orçamentos: valor de frete e desconto. Catálogo: preço de venda e custo do item. Formação de Preço: valor de despesa, custo de materiais, horas, margem e tributos. Cronograma: jornada, eficiência, quantitativos e equipe. Obras: número de trabalhadores no diário. Valores digitados em campos de entrada de medição e financeiro já utilizam strings e são selecionados no foco.
- Campos existentes do app (inclusive os de dias e horas da PR #20) recebem o foco/seleção numérica global assim que as telas forem integradas.
- Não selecionar automaticamente senhas, datas nem campos textuais comuns; não alterar cálculos, sessões, APIs, schemas, autenticação nem dados históricos.

## Garantias
- O usuário pode escrever `0,5`, `7,5`, `1200` ou `250,75` sem que a interface force o zero antigo de volta.
- Quantidade já medida no cronograma nunca é reduzida abaixo do executado.
- Os coeficientes SINAPI, progressos, custo do orçamento e banco de dados não são modificados só porque um campo recebeu foco.
- Para valores confirmados, o banco usa valores numéricos, nunca strings com vírgula.

## Testes
- `test/numeric-editing.test.mjs`: rascunhos vazios e parciais, decimais pt-BR, rejeição de NaN e números ambíguos.
- `test/e2e/numeric-editing.mjs`: navegador Android simulado, catálogo com preço real do ambiente QA, seleção completa ao tocar, Backspace apaga o campo, novo valor `450,75` salva como `450.75`, custos da formação de preço e jornada do cronograma, persistência depois de recarregar; backend REST interceptado em memória. Não usa banco nem conta reais.
- CI, Browser Smoke, contrato PostgreSQL e TypeScript, executados no GitHub Actions.

## Publicação
Manter em PR até os testes ficarem verdes. A Vercel estava com limite de compilação nas consultas anteriores; não repetir deploys. Coordenar uma publicação final com as outras correções pendentes.
