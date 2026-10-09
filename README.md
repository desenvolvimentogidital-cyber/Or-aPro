# OrçaPro — Gestão, Orçamentos e SINAPI (v2.4.1 — correções de homologação)


## v2.4.1 — correção dos erros encontrados na validação Windows

Corrigidos os **14 erros de typecheck** e o bloqueio **TS5112** do comando de testes reportados pelo usuário. O novo `tsconfig.test.json` evita incompatibilidades com o TypeScript 7; incluídos tipos Node.js e o ajuste de preferências no PDF. **96 testes passaram no ambiente de manutenção (TypeScript 5.8)**; ainda é necessário repetir `npm run lint`, `npm run test:logic` e `npm run build` na instalação Windows para confirmar a correção com TypeScript 7. Consulte `RELATORIO_HOMOLOGACAO_CORRECOES_V2_4_1.md`.

## Novidade v2.4 — leitura direta dos custos da planilha SINAPI Referência

No **Catálogo > Custos SINAPI**, selecione **SINAPI Referência XLSX**, informe competência (MM/AAAA), UF e regime (sem/com desoneração), e importe **CSD** ou **CCD** automaticamente. O OrçaPro seleciona o valor de custo da UF correta (não confunde a coluna %AS), recupera códigos que vêm em fórmulas HYPERLINK com cache zero, rejeita valores ausentes/zero, impede referências incompatíveis e não utiliza custos como preços comerciais. O usuário **precisa informar o preço de venda** para salvar o item no catálogo. A importação não faz upload da planilha nem grava automaticamente milhares de composições no banco; o arquivo é processado no navegador e o usuário escolhe o que cadastrar.

O importador de **horas-homem** segue separado em Cronograma SINAPI (aba Analítico). As tabelas de percentuais, manutenção e famílias não são utilizadas como HH ou custos.

Os testes de lógica **95/95** passaram. A extração de dados real do XLSX 08/2026 em ambas as modalidades para SP foi validada; **a aplicação React completa não foi compilada nem homologada em navegador** devido à indisponibilidade de dependências npm e bloqueio de navegação local no Chromium deste ambiente. A validação final ainda precisa ser feita no computador do usuário. Consulte `docs/RELATORIO_HOMOLOGACAO_V24.md`.

## Regra de operação

**Não existe modo demo nem cadastros de exemplo neste pacote.** Sem conexão válida ao Supabase o aplicativo **não abre o painel** nem deixa criar dados que possam ser confundidos com uma conta protegida. Em uma conta nova, clientes, catálogo, orçamentos, despesas e notificações começam vazios.

## Começar com um backend de verdade

1. Instale Node.js 22+ e execute `npm install` no diretório do projeto.
2. Crie um projeto gratuito em [Supabase](https://supabase.com), abra **SQL Editor** e execute `supabase/schema.sql` para criar tabelas, políticas RLS e funções de proposta pública.
3. Copie `.env.example` para `.env.local`. Insira **Project URL** e **anon/publishable key** reais do projeto Supabase. Não insira `service_role`, senha de banco ou token secreto em variáveis `VITE_`.
4. No painel Supabase Authentication, habilite autenticação por Email/Senha e configure URL e redirecionamentos do site. Recomendamos confirmação de e-mail para produção.
5. Rode `npm run dev`. Faça cadastro/login; o workspace real começa vazio.
6. Se os dados locais da versão anterior forem de clientes reais, faça backup e revise primeiro. A migração manual é bloqueada quando identifica IDs típicos dos registros demonstrativos antigos.

## O que é e o que não é real

- **Reais ao configurar Supabase:** login/cadastro, persistência de dados no banco por conta com RLS, cadastro de clientes, catálogo, orçamentos, cálculos de preço, histórico, CSV, modelos de documentos, link público temporário e decisão por posse de link.
- **PDF:** a prévia e a impressão usam o mesmo documento A4 preto e laranja inspirado na imagem fornecida. Exibe dados reais da empresa e do cliente, fotos efetivamente cadastradas, itens por Serviços/Produtos, totais e assinaturas em branco. O navegador gera o PDF em *Salvar como PDF* (não há gerador de PDF no servidor); listas grandes continuam nas páginas seguintes. Preencha a identidade da empresa antes de exportar. As variantes Moderno/Profissional reutilizam a estrutura com outras cores.
- **WhatsApp:** abre o aplicativo com texto pré-preenchido; envio depende do usuário e não há confirmação automática de entrega/leitura.
- **Avisos:** histórico de notificações de operações e de respostas de links públicos é persistido na área da conta; permissão de notificação do navegador funciona **apenas enquanto o site estiver aberto**. Não há Web Push em segundo plano.
- **Aparência:** preferência local do navegador. Não existe administração de outras contas, cobrança, assinatura, planos pagos ou função Super Admin. Não há dados de faturamento recebido: indicadores financeiros correspondem a valores de propostas aprovadas, não comprovantes de pagamento.
- **Aprovação:** resposta por link público aleatório, sem login do cliente ou validação de identidade, **não equivale a assinatura eletrônica qualificada**. O histórico identifica respostas via link; decisões manuais têm rótulo próprio. Links representam o conteúdo compartilhado na data de emissão, e não uma revisão posterior da proposta.
- **Cálculo de preço:** zero dados fictícios. Configure os parâmetros e custos reais. Não se trata de orientação tributária.
- **Templates:** o padrão reproduz o layout preto/laranja enviado; Moderno e Profissional alteram os acentos de cor do mesmo documento e precisam ser aplicados explicitamente a um orçamento existente.

## Validação / implantação

- `npm run test:logic` — testes locais de matemática, CSV, controles antimock e conteúdo/segurança do PDF.
- `npm run lint` — verificação TypeScript (requer dependências instaladas).
- `npm run build` — produção (requer dependências instaladas).
- Deploy recomendado só após rodar os testes do CI e validar manualmente em um Supabase de testes.

### Limites externos ainda pendentes

Sem um projeto Supabase com credenciais reais não foi possível testar autenticação e RLS remotamente nem executar o SQL no banco. Não foi feita implantação. Não há função de pagamento, assinatura, controle multitenant de equipe, push em segundo plano ou email transacional customizado. São integrações **ausentes**, não simuladas.

Esta versão usa apenas um workspace por usuário, sem sistema de organizações. Guarde backups externos e verifique requisitos legais e privacidade antes de armazenar dados de clientes reais.

## Como emitir o PDF no modelo da imagem

1. Em **Dados da Empresa**, preencha o nome verdadeiro da empresa, contatos, endereço, slogan e envie o **logotipo** (JPG, PNG ou WebP). Nenhum nome ou imagem de empresa é criado automaticamente.
2. Em **Catálogo**, cadastre itens reais e, se desejar, envie **fotografias reais** dos produtos/serviços. No orçamento novo, selecione esses itens (as fotos ficam registradas junto ao item do orçamento). Orçamentos anteriores sem foto não recebem imagens fictícias.
3. Em **Novo Orçamento**, escolha o cliente, itens e valores. Complete **Válido até**, **Prazo de execução (opcional)**, **Condições de pagamento** e **Observações**.
4. Salve e abra a pré-visualização. Toque em **Salvar como PDF / Imprimir**, escolha **Salvar como PDF** no diálogo do navegador, com papel A4. O documento usa fundos escuros; mantenha a opção de imprimir gráficos de fundo habilitada se o navegador oferecer essa opção.
5. Encaminhe o arquivo PDF salvo ao seu cliente pelo canal de sua escolha. O botão do WhatsApp apenas abre o mensageiro; não envia um anexo automaticamente.

O bloco de assinatura contém **linhas vazias** para assinatura real. Não há rubricas falsificadas, carimbos criados automaticamente nem alegações de assinatura digital.

### Limitações conhecidas da exportação

- A criação do PDF depende do recurso de impressão do navegador/dispositivo; no Android, a ação pode aparecer como **Imprimir > Salvar como PDF**. Não há botão de download instantâneo de PDF binário sem diálogo.
- A pré-visualização adapta a largura em telas pequenas, mas a impressão usa **A4 em duas colunas**. Tabelas crescem para novas páginas; linhas não são divididas propositalmente entre páginas.
- O acesso a Supabase real continua indispensável para entrar no aplicativo. A versão não faz deploy nem altera dados remotos automaticamente.

## Dashboard financeiro v1.4

A tela inicial foi ampliada com métricas, filtros de período, gráficos e atividade recente, todos calculados com os **orçamentos reais do usuário autenticado**. Não utiliza dados fictícios. A atualização remota ocorre também a cada 30 segundos enquanto a aba está visível e não existem edições pendentes de sincronização.

**Importante:** proposta aprovada não é dinheiro recebido. O resultado apresentado é **estimativa de margem direta**, não lucro líquido contábil. Orçamentos sem custo dos itens declarado (inclusive custo zero herdado sem confirmação) aparecem como **a conferir**. Cadastre o custo no catálogo e recrie/atualize o item do orçamento para ter uma estimativa. Para controle real de faturamento recebido e lucro líquido contabilizado ainda serão necessários módulos de recebimentos, conciliação, despesas por competência e registro de execução.

Leia `RELATORIO_DASHBOARD_V1_4.md` para regras, limitações e testes.

## v1.5 — Cronograma de execução e SINAPI

Abra **Dashboard > Cronograma SINAPI** ou **Mais > Planejamento de obras > Cronograma SINAPI**. Crie a obra, vincule a um orçamento (se quiser) e importe uma planilha compatível (.xlsx, .csv ou .tsv). Use uma planilha que contenha composição analítica com código, descrição, unidade do serviço e insumos de mão de obra em H por unidade; tabela de preços resumida não fornece informação suficiente. O usuário pode baixar o modelo de colunas (CSV vazio) na tela para preparar dados reais extraídos da documentação SINAPI.

Escolha o serviço, informe a quantidade (por exemplo, m² de alvenaria), a jornada, a eficiência e o número de profissionais de cada categoria. O OrçaPro calcula as horas-homem, a duração pela categoria profissional mais sobrecarregada, datas consecutivas em dias úteis, um cronograma gráfico e exportação CSV. Etapas adicionadas ficam salvas no workspace do usuário no Supabase. O arquivo SINAPI inteiro **não é armazenado** e precisa ser reimportado para selecionar mais composições após reiniciar.

O algoritmo pula finais de semana, mas não feriados, chuvas, impedimentos, frentes paralelas, cura de concreto ou outras restrições técnicas. O cronograma é uma estimativa de planejamento e precisa ser validado pelo profissional responsável. **Não há integração automática com API SINAPI, nem coeficientes inventados.**

Leia `RELATORIO_CRONOGRAMA_V1_5.md` para a ficha completa de funcionalidades e limitações.

## v1.6 — SINAPI real (08/2026)

O importador do cronograma foi adaptado aos quatro arquivos SINAPI de agosto/2026 fornecidos durante o desenvolvimento. A planilha de **Referência**, aba **Analítico**, é a fonte de coeficientes H. O importador lê apenas essa aba de arquivos oficiais, expande composições auxiliares e não confunde percentuais de custos de mão de obra ou fatores de famílias com horas-homem. É possível selecionar múltiplos arquivos XLSX no mesmo diálogo; os demais são identificados como não aptos para cálculo de HH. O mês de referência é detectado da aba, sem usar a data de arquivo. Não há dados demonstrativos importados de fábrica: o usuário escolhe os arquivos. Para detalhes e resultados dos testes, veja `RELATORIO_SINAPI_REAL_V1_6.md`.

## Correção da tela de Cronograma v1.7

A seleção inicial agora privilegia um cronograma com etapas, não um cronograma vazio. A lista indica o número de etapas e oferece um atalho para abrir outro cronograma preenchido quando você estiver visualizando um vazio. O banco existente e os cálculos SINAPI não exigem migração adicional.

Para o teste cadastrado remotamente, selecione **[TESTE] Acabamentos — forro e piso podotátil**. O orçamento #001 continua marcado como **rascunho** e deve ser usado apenas para validação. Veja `RELATORIO_FIX_CRONOGRAMA_V1_7.md`.


## Evolução v1.8 — Obras, execução e financeiro real

O projeto inclui a primeira etapa da evolução integrada: **medições reais no Cronograma**, **Obras e execução** e **Controle financeiro** com lançamentos manuais efetivamente realizados. Acesse pelas novas guias na navegação do modo Fluido ou pelo menu **Mais** no celular.

O sistema **não registra recebimentos nem serviços concluídos automaticamente**. Aprovar um orçamento não equivale a pagamento. Veja `RELATORIO_EVOLUCAO_V1_8.md` para limitações, testes e próximas etapas.

### Como iniciar

```bash
npm install
npm run dev
```

Para validar, execute `npm run lint`, `npm run test:logic` e `npm run build`. **Não é necessário alterar o esquema SQL existente**. Salve um backup e não edite com versões antigas ao mesmo tempo.

## Checkpoint de evolução 2.2 (não homologado)

Foram desenvolvidas as melhorias incrementais de v1.9 (dependências, feriados informados e físico-financeiro), v2.0 (diário operacional), v2.1 (calculadora de BDI) e v2.2 (prévia imprimível do cronograma). **Não conclua que a aplicação está pronta para produção** sem finalizar os testes e as pendências registrados em `PLANO_DE_ETAPAS.md`.

O plano sequencial padrão de cronogramas antigos foi preservado. No modo dependências, obras com atividades paralelas **não** possuem nivelamento automático de equipes compartilhadas. Valores físicos-financeiros são proporcionais às medições e só incluem itens explicitamente associados e compatíveis; não representam recebimentos.

## Evolução consolidada v2.3

O cronograma SINAPI agora solicita **competência, UF e regime** antes de vincular uma nova composição. As horas-homem seguem os coeficientes reais da planilha analítica, sem suposições de produtividade. Para importar custos unitários de composições, use a opção **Catálogo → Custos de referência SINAPI — importar CSV** com o cabeçalho em `docs/modelo_importacao_custos_sinapi.csv`. O custo é usado apenas para preparar um item; **um preço de venda precisa ser informado manualmente**.

O modo desktop amplia a navegação; o PDF de cronograma, o financeiro e o controle de obras mantêm os dados atuais. Backups são verificados antes de serem aplicados. Veja `PLANO_DE_ETAPAS.md` e `docs/VALIDACAO_FINAL.md` para o estado exato das etapas e testes pendentes.

Não execute o arquivo `supabase/schema.sql` novamente no banco existente sem revisar as alterações. Nenhuma migração de banco foi necessária para as melhorias v2.3.
