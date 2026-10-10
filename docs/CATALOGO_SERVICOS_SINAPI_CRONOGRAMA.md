# OrçaPro — Catálogo de serviços → composição SINAPI → cronograma

## Erro corrigido
Antes, cadastrar um serviço em **Serviços** não o tornava selecionável no módulo **Cronograma SINAPI**. A seleção de composições exigia reimportar a planilha em cada sessão e a conversão do orçamento só buscava por unidades idênticas. Serviços criados por padrão na unidade genérica `serviço` não encontravam composições SINAPI `UN`, por exemplo.

## Novo fluxo mobile e web
1. Cadastre **Instalar tomada** (ou outro serviço real) em **Serviços** com seu preço comercial e unidade.
2. Em **Cronograma SINAPI**, selecione ou crie um cronograma.
3. Importe **SINAPI Referência, aba Analítico** para carregar coeficientes de mão de obra quando ainda não existir uma associação guardada. **Ao navegar entre Serviços, Orçamentos e Cronograma, as composições importadas permanecem na memória da mesma sessão autenticada**; o importador não é reiniciado ao trocar de módulo.
4. No quadro **Meus serviços → SINAPI**, busque o nome salvo no catálogo e escolha o serviço.
5. Busque por termos simples (ex.: `tomada`, `instalação tomada`, código) e selecione a **composição desejada** da fonte importada. A lista é sugestiva; o sistema nunca vincula automaticamente um serviço apenas por nome.
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
