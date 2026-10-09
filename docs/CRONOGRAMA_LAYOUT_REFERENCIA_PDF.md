# Painel executivo de cronograma — referência visual do usuário

## Alteração no aplicativo

A tela **Cronograma SINAPI** mantém as áreas editáveis já existentes (importar planilha, selecionar composições, informar equipe, vincular item de orçamento, registrar medição, corrigir dependências e exportar CSV), mas agora abre com **um painel executivo fiel à organização da referência enviada**:

- Cabeçalho com marca verdadeira da empresa cadastrada, obra, local opcional, início, término e prazo.
- Resumo de etapas com etiquetas coloridas, pesos físicos em **horas-homem (HH)**, coeficientes e medição.
- Gantt mensal colorido com barras posicionadas por **datas calculadas**. O Gantt diário antigo continua abaixo da edição para confirmar dias úteis exatos.
- Tabela de detalhamento (serviço, quantitativo, início, fim, duração em dias úteis e status).
- Donut de avanço **físico** ponderado por HH de cada composição, com classes concluído, em andamento e ainda não medido.
- Curva S mensal planejada pelo consumo de HH distribuído nos dias úteis da previsão; curva realizada baseada apenas em medições com data.
- Controle de prazos: atividades com fim previsto já passado e ainda incompletas são marcadas como **previsão vencida**, não como atraso contratual comprovado.
- Painel de maiores durações (não simula um caminho crítico CPM que não existe no código).
- Indicadores físicos, financeiros **somente de itens vinculados**, qualidade e segurança como **não informado** quando não existem medições específicas.

O fundo escuro, bordas técnicas azuis, laranja em destaques, Gantt multicolorido e organização das regiões seguem a composição da referência. O aplicativo usa **ORÇAPRO** e a empresa configurada, não a marca "Elétrica Plus" da imagem de exemplo. Uma foto da obra não é inventada: há o símbolo de construção no topo. Campos de **Local / endereço da obra** foram adicionados como opcionais, sem converter endereços comerciais em endereços de execução.

## PDF para envio

O botão **Gerar relatório PDF** no painel chama o gerador já existente e abre a prévia do navegador.

Agora a impressão inicia por uma **capa/página panorâmica escura**, com a mesma hierarquia do painel, resumo, Gantt, serviços, físico, curva S, prazos e indicadores. Depois vêm as páginas existentes com **detalhamento integral**, equipe e HH por função, correspondência físico-financeira e calendário por dias úteis, preservando o formato A4 paisagem e a compatibilidade com orçamentos antigos.

- Em obras com muitas etapas, a capa resume as **9 primeiras etapas** e identifica que as demais constam nas páginas seguintes. Não corta o detalhamento integral.
- No resumo mensal, aparecem no máximo os **12 primeiros meses**; o quadro técnico completo conserva as datas e a série é limitada em tela para legibilidade.
- O arquivo final é gerado com o fluxo "Imprimir / Salvar PDF" do próprio navegador, sem upload para outro servidor.

## Cuidados e critérios de dados

Os números **não** vêm da imagem de referência. Percentuais, datas, progresso, status e valores são derivados das entradas do usuário. Não serão mostrados "100% de qualidade", "0 acidentes", "12% de custos executados" ou outra métrica que ainda não exista na aplicação.

Mão de obra vem da composição analítica SINAPI escolhida e gravada; horas/dia, equipe, eficiência e feriados são premissas. **Não há nivelamento automático de recursos paralelos nem análise de caminho crítico CPM**. O relatório é uma ferramenta de planejamento e controle e exige revisão humana antes de assumir compromissos contratuais.

## Como testar

1. Abra [OrçaPro](https://or-a-pro-seven.vercel.app) → Cronograma SINAPI.
2. Selecione um cronograma existente, ou clique Novo e vincule um orçamento.
3. Observe o painel executivo no topo, depois preencha **Local / endereço da obra** em Obra / cronograma.
4. Registre ou revise equipes, medidas e datas não úteis. Retorne ao topo para conferir indicadores.
5. Clique **Gerar relatório PDF** e depois **Imprimir / Salvar PDF**.
6. Confirme a capa e todas as páginas técnicas do relatório antes de enviar ao cliente.

## Validação
- Testes de cálculo da curva S, pesos HH, ausência de dados fictícios, situação de prazo, HTML seguro e fidelidade da capa.
- Chromium: conferência do painel e da capa no iframe junto com Gantt diário e geração de PDF multipágina.
- PostgreSQL local/CI: proteções e políticas antigas continuam sendo testadas.
