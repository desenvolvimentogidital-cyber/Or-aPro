# Consulta SINAPI online — busca por nome e código no Android

## Problema registrado pelo usuário
Capturas Android mostram: serviços **Chuveiro** (22 un) e **Padrão monofásico** (6 un) cadastrados; em **Meus serviços → SINAPI**, o campo ficava bloqueado; em **Do orçamento para o cronograma**, a lista de composições era vazia porque nenhum analítico havia sido carregado. A correção da edição do campo (#16) não cria uma base de dados e ainda não estava publicada na Vercel (limite de compilações).

## Abordagem sem dados fictícios e sem alterar Supabase
- A rota serverless **GET /api/sinapi-search?q=...** consulta a API pública **SINPRES**, mantida por terceiros e independente da CAIXA/IBGE, na rota pública documentada `https://api.sinpres.com.br/api/v1/sectors/civil-construction/compositions`.
- A rota restringe origem, campos, formato, quantidade de resultados, tamanho de resposta e timeout. Não envia cliente, orçamento, valores financeiros, usuário nem credenciais. Rate limits/indisponibilidade são expostos à interface e o usuário pode continuar usando planilhas locais.
- Buscas por texto e código SINAPI completo retornam catálogo textual (código, descrição, unidade). Os dados provêm de uma API independente que declara ter extraído publicações SINAPI; **não** são uma resposta da CAIXA nem são verificados diretamente pelo OrçaPro.
- Ao abrir **Configurar** para Chuveiro/Padrão monofásico, botão **Pesquisar este serviço no catálogo SINAPI online** envia o termo digitado ou a descrição do item ao quadro de busca. Os resultados possuem escolha humana.
- É possível registrar uma composição online como **etapa pendente**, ligada ao orçamento **apenas se** unidade e quantidade forem exatamente iguais. Sua fonte é identificada e `composition.labor=[]`, `crew={}`, `reference`/UF/regime ausentes; o cronograma informa prazo e horas-homem **a definir**, sem inventar produtividade.
- Quando um relatório analítico compatível for importado, o usuário pode aplicar coeficientes para o **mesmo código e unidade**, confirmar UF/regime/competência, e receber uma equipe inicial simulada, sempre revisável. A etapa conserva o id, vínculo financeiro, quantitativo, progresso e dependências.

## Limite essencial: analítico da CAIXA em PDF
A CAIXA informa que os **relatórios analíticos mensais a partir de 2025** são distribuídos em PDF, e os XLSX distribuem outras tabelas, inclusive custos/percentuais. O importador atual aceita XLSX/CSV/TSV **estruturados**, não PDF. Portanto, a API online **não** deve ser descrita como fonte de horas-homem oficial e não preenche produtividade automaticamente. Também não altera os preços de orçamento nem consulta custos ou preços.

Fonte oficial: https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx
API de terceiros: https://github.com/sinpres/sinpres-api

## Testes
- `test/sinapi-online.test.mjs` garante que uma composição textual online não gera HH, datas ou equipes.
- `test/e2e/sinapi-online.mjs` simula Android de 390px, dados do orçamento e uma resposta online controlada **fictícia**; verifica os dois serviços, navegação, quantidade, vinculação explícita, persistência e etapa sem HH.
- `npm run lint`, `npm run test:logic`, `npm run build`, PostgreSQL Security Contract e Browser Smoke.
- A disponibilidade do endpoint de terceiros **não foi confirmada em rede pública real nesta sessão**; o fluxo automatizado valida contrato simulado, não garante SLA, CORS ou disponibilidade do upstream.
- Validar a rota serverless na Vercel **em preview** e só depois integrar e promover para produção. O projeto enfrenta limite de builds Vercel; não pressionar o usuário com deploys repetidos.
