# OrçaPro 1.4 — Dashboard financeiro com dados reais

## Implementado

- Períodos: mês atual, últimos 3 meses, ano atual, todo histórico.
- Indicadores: propostas emitidas (valor), aguardando resposta (valor), aprovadas (valor), resultado estimado, total de orçamentos criados e taxa de aprovação entre propostas decididas.
- Gráfico de barras com valor atual dos emitidos, aprovados e pendentes, agrupado por mês (últimos 6/12 meses).
- Gráfico de rosca com quantidades de aprovados, enviados, recusados e rascunhos no período de emissão.
- Atividades recentes ordenadas pela última alteração registrada, com acesso à prévia.
- Atalhos para orçamentos e relatórios.
- Atualização a cada 30 s enquanto a aba está visível (somente quando não há sincronização pendente), além das atualizações por foco.
- Campos de custo em branco agora permanecem **não informados**, em vez de virar zero automaticamente. Custo zero explícito fica confirmado no catálogo e no snapshot do orçamento. Orçamentos antigos com custo zero sem confirmação são tratados como custo desconhecido.
- Não há dados exemplificativos nem números inventados no dashboard.

## Política financeira — sem falsa receita ou lucro

- `Aguardando resposta` = situação **enviado**. Rascunhos não contam como pendentes nem como emitidos.
- `Emitidos` = situação atual diferente de rascunho, agrupada por **data de emissão**. Inclui aprovados e recusados criados naquele período.
- `Aprovados` = valor atual das propostas com situação aprovado, agrupadas pela **última aprovação registrada no histórico**; na ausência desse evento, utiliza data de emissão e informa o fallback na interface.
- `Lucro estimado` = total aprovado - custos unitários informados * quantidade - deslocamento - custos adicionais - imposto estimado do orçamento. Pode ser negativo. Fica oculto se qualquer custo estiver não informado/ambíguo.
- A margem estimada é o lucro estimado dividido pelo total aprovado.
- O lucro mostrado **não é lucro líquido contábil**: não desconta todas as despesas fixas gerais, despesas posteriores, taxas de recebimento, impostos efetivamente apurados ou inadimplência. O sistema ainda não registra pagamentos recebidos nem conclusão do serviço. **Aprovação não equivale a recebimento.**
- Status aprovado pode ser inserido manualmente ou via link. O histórico identifica a origem, mas acesso a um link não autentica a identidade civil do cliente.
- Não são fornecidas séries históricas transacionais imutáveis de receita realizada. As barras representam o **estado atual** das propostas, agrupado por suas datas.

## Compatibilidade e dados

- Nenhuma migração SQL necessária: dados continuam no `orcapro_workspaces.payload` do Supabase, via estruturas JSON existentes.
- Campo novo `costConfirmed?: boolean` é opcional e compatível com registros antigos. A intenção é evitar supor custo zero em dados antigos ambíguos.
- Não há alteração nas URLs, nas permissões ou nas chaves da integração Supabase.
- Nenhum deploy executado, nenhuma alteração em registros da conta Supabase.

## Validação e limitações

- `npm run test:logic` cobre 30 testes (cálculos, PDF, dados não simulados e dashboard), aprovados nesta versão.
- 33 arquivos TypeScript/TSX passaram na verificação de sintaxe com compilador TypeScript.
- `npm install` não completou neste ambiente (timeout); por isso `npm run lint` acusa falta de `vite/client` e o build completo não pôde ser validado aqui.
- Validar manualmente na sua instalação onde `npm install` funciona: cadastro de custo, criar/enviar/aprovar/recusar proposta, atualizar o dashboard, alterar período, abrir cartões, testar com dispositivo móvel e conferir a persistência no Supabase.
