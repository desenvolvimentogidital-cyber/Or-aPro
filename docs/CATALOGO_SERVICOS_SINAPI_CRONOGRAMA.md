# OrçaPro — Catálogo de serviços → composição SINAPI → cronograma

## Erro corrigido
Antes, cadastrar um serviço em **Serviços** não o tornava selecionável no módulo **Cronograma SINAPI**. A seleção de composições exigia reimportar a planilha em cada sessão e a conversão do orçamento só buscava por unidades idênticas. Serviços criados por padrão na unidade genérica `serviço` não encontravam composições SINAPI `UN`, por exemplo.

## Novo fluxo mobile e web
1. Cadastre **Instalar tomada** (ou outro serviço real) em **Serviços** com seu preço comercial e unidade.
2. Em **Cronograma SINAPI**, selecione ou crie um cronograma.
3. Importe **SINAPI Referência, aba Analítico** para carregar coeficientes de mão de obra quando ainda não existir uma associação guardada. **Ao navegar entre Serviços, Orçamentos e Cronograma, as composições importadas permanecem na memória da mesma sessão autenticada**; o importador não é reiniciado ao trocar de módulo.
4. No quadro **Meus serviços → SINAPI**, digite diretamente o nome ou código no campo **Buscar composição SINAPI por nome ou código**, sem precisar selecionar um serviço antes ou ter criado um cronograma. O campo permanece habilitado mesmo quando não existem composições disponíveis.
5. Se desejar salvar a associação no catálogo, selecione também um serviço em **Serviço do catálogo (opcional)**. A busca aceita termos simples (ex.: `tomada`, `instalação tomada`), código inteiro, prefixo de código e `SINAPI 91996`. Se houver composições carregadas, a lista mostra os resultados; a seleção é sempre humana.
6. Informe **quantidade real na unidade SINAPI** e, se desejar, um prazo para simulação inicial de equipe. Confirme UF, competência e encargos do arquivo quando estiver usando uma composição recém-importada.
7. Toque em **Adicionar etapa ao cronograma e salvar vínculo SINAPI**. A etapa guarda composição, HH por profissão, quantidade e equipe simulada, e o próprio serviço do catálogo passa a guardar a referência completa.
8. Ao abrir novamente no Android, a composição já vinculada reaparece sem reimportar o arquivo — continua sendo possível trocar por outra após importação.

## Orçamento → cronograma
Itens novos criados a partir do catálogo guardam o ID da origem e, quando existe, o snapshot da composição confirmada. A conversão de itens do orçamento também pode reutilizar uma referência analítica anteriormente salva.

Uma unidade de orçamento genérica (`serviço`) **não** vira automaticamente `UN`, `M²` ou `M³`. Quando são diferentes, o usuário pode criar uma etapa independente pela nova área do catálogo, informar quantidade explicitamente e vincular o financeiro somente após corrigir as unidades. Isso impede valores físico-financeiros incorretos.

## Integridade
- Sem atualização de schema/RLS, chave, endpoint ou autenticação. A memória da planilha é temporária, associada ao componente AppProvider do usuário e descartada no logout; não é salva integralmente no servidor. O campo `sinapiComposition` é opcional em cada item de catálogo/quote do workspace JSONB já existente.
- Composição salva precisa de código, descrição, unidade, planilha, aba, mês, UF, regime e **coeficientes HH válidos**. Não aceita custo CSD/CCD isolado como produtividade.
- **Não** consulta uma API SINAPI externa por nome, nem finge ter todos os serviços oficiais sem fonte importada. O usuário precisa ter importado a referência Analítico ao menos uma vez para vincular um serviço novo.
- Preço de venda e custo do catálogo não são modificados ao vincular SINAPI. Materiais/equipamentos detalhados não são deduzidos dos HH.
- A equipe é explicitamente **simulada** e deve ser revisada. Sem nivelamento automático de recursos compartilhados.

## Testes
- `test/catalog-sinapi.test.mjs` — nome "instalar tomada", plural, acentos, código exato, origem HH válida, persistência de vínculo e rejeição de custo sem HH.
- `test/e2e/catalog-sinapi.mjs` — fluxo real de interface mobile, serviço salvo → planilha analítica fictícia → composição escolhida → equipe e etapa → catálogo salvo → recarga de página e reutilização sem planilha. API REST interceptada em memória; **não** toca no Supabase de produção.
- CI: `npm run lint`, `npm run test:logic`, `npm run build`, browser smoke e contrato PostgreSQL. A confirmação em Android real com dados da obra fica a cargo da homologação.

## Refinamento Android — busca desativada (09/10/2026)
O campo antigo tinha `disabled={!selectedCatalogService}` e por isso nem abria o teclado sem escolher um serviço. A busca agora está sempre habilitada, e a seção aparece mesmo antes da criação do cronograma. Composições carregadas ou já vinculadas podem ser selecionadas independentemente do catálogo; ao adicioná-las sem serviço, a etapa permanece sem associação financeira automática. Se não houver fonte importada, o campo aceita digitação e mostra a razão para não haver resultados, com botão que abre o seletor de arquivo **mesmo quando o painel de importação está fechado** e link para a fonte CAIXA.

A consulta local **não é uma API SINAPI pública online**. Sem composição analítica importada/armazenada, o aplicativo não possui códigos/HH para retornar. O relatório oficial em PDF não é lido por este importador, que aceita XLSX, CSV ou TSV analíticos compatíveis. A consulta de preços e custos da CAIXA pode não conter coeficientes analíticos necessários para estimar a equipe. Nunca simular HH a partir da descrição.
