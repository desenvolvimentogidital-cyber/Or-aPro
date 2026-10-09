# OrçaPro — Orçamento → SINAPI → Equipes → Cronograma

## O que mudou
- No **Cronograma de execução**, associe um **orçamento existente** e importe a planilha oficial **SINAPI Referência → Analítico**.
- Em **Do orçamento para o cronograma**, cada item (alvenaria, porcelanato, drywall, pintura etc.) mostra sua quantidade e unidade.
- A busca propõe descrições compatíveis com a **unidade** de cada item. O responsável **seleciona e confirma** o código/descrição da composição; similaridade textual nunca determina automaticamente a técnica executiva.
- O sistema exibe os coeficientes `HH/unidade` de cada profissional e calcula a necessidade de horas pelo quantitativo real do item.
- Opcionalmente indique o **prazo desejado em dias úteis**. A equipe ilustrativa é calculada por função por `teto((coeficiente HH/unidade × quantidade) / (prazo × jornada × eficiência))`. Sem prazo, mostra um cenário com uma pessoa por função, **não uma equipe contratada ou disponível**.
- Ao confirmar, a etapa é criada com `quoteItemId` e quantidade herdada do orçamento: o vínculo passa a integrar o físico-financeiro sem contar o mesmo item duas vezes.
- Equipes e durações continuam editáveis na área **Etapas e equipes**; o Gantt e o PDF usam as mesmas durações e datas.

## Limites e proteção contra estimativas falsas
1. **SINAPI não escolhe sozinho a composição exata.** Drywall varia por altura, faces, número de chapas, estrutura, isolamento; porcelanato por dimensão e substrato; pintura por superfície e preparação; alvenaria por bloco e espessura. Confira o código no relatório da CAIXA.
2. O importador usa **horas-homem das composições analíticas**, não percentual de mão de obra nem produtividade inventada.
3. O dimensionamento não comprova **material, equipamento ou disponibilidade efetiva** das equipes. Não há nivelamento automático de recursos entre atividades paralelas.
4. Não há alteração dos preços ou quantidades do orçamento, nem de registros existentes. Para novas composições, reimporte a planilha oficial após abrir uma nova sessão (só as etapas escolhidas são persistidas).
5. Datas não úteis são cadastradas manualmente. Sem equipe/previsão validada, não use o PDF para firmar prazo contratual.
6. Se o código não aparece no mecanismo de sugestão, digite-o na busca; composições em m³ não são equivalentes a serviços medidos em m².

## Como testar
1. Abra **Cronograma SINAPI**, clique **Novo** e vincule o orçamento existente.
2. Importe o XLSX oficial no botão **Selecionar planilhas do SINAPI**. Informe competência, UF e encargos corretos da referência.
3. Na seção **Do orçamento para o cronograma**, abra um item; busque e escolha a composição exata.
4. Confira cada coeficiente HH/unidade, experimente um prazo desejado e revise a equipe simulada.
5. Clique **Adicionar etapa com equipe simulada**. Repita por serviço. Na seção **Etapas e equipes**, ajuste responsáveis, dependências e equipe real.
6. Confira Gantt e PDF antes de apresentar a previsão.

## Verificações automatizadas
- Testes lógicos de equivalência de unidades, escolha explícita, quatro serviços, dimensionamento e físico-financeiro.
- Playwright com API REST **em memória** percorre quatro itens de orçamento e confirma quantidades, equipes e vínculos após recarregar a página.
- O CSV do teste contém coeficientes **inteiramente fictícios para validação**, sem pretensão de representar o SINAPI oficial.

O sistema não transforma automaticamente custos SINAPI em preço de venda e não gera movimentações financeiras a partir de uma previsão.
