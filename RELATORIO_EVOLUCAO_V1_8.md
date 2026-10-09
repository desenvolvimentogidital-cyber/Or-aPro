# OrçaPro v1.8 — Evolução integrada, etapa 1

## Entregue nesta versão

1. **Execução física verificada por medição**: o cronograma mantém registros de quantidade executada, data, observação e ID; não permite medição negativa ou soma superior ao quantitativo da etapa. Percentuais são derivados dessas quantidades; não há progresso inventado.
2. **Cronograma Gantt**: duração sequencial prevista em dias úteis baseada nas composições SINAPI e equipes atuais, com sobreposição visual do percentual de quantidade já medida. Não é um registro de datas efetivas de execução nem considera feriados, sobreposição de frentes ou dependências entre tarefas.
3. **Obras**: visão central de cronogramas cadastrados, orçamento vinculado, status do orçamento, porcentagem média por etapa, datas previstas e movimentações financeiras relacionadas. A lista não cria obras automaticamente ao aprovar orçamento: só mostra cronogramas efetivamente existentes.
4. **Financeiro**: novo formulário de recebimentos efetivos e despesas pagas; vinculação opcional a orçamento; saldo de caixa, contas a receber relativas a orçamentos aprovados, alertas de lançamentos inválidos e possíveis pagamentos acima do valor contratado. Exclui registros somente com confirmação.
5. **Dashboard**: seção financeira realizada separada de proposta aprovada e lucro estimado; seus indicadores de caixa referem-se a todos os lançamentos históricos, não ao filtro de propostas.
6. **UI**: modo fluido iniciado automaticamente em desktops grandes, aumento da largura útil, navegação desktop e menus Obras/Financeiro. O usuário ainda pode escolher a moldura celular.
7. **Segurança de interface**: remove da barra de endereço tokens de callback quando existe sessão autenticada (exceto fluxo de recuperação de senha). Não modifica JWTs ou a política do Supabase.

## Persistência, compatibilidade e recursos gratuitos

- Reutiliza `public.orcapro_workspaces.payload` (JSONB, política RLS existente); **não requer migração SQL ou criação de novo Supabase**.
- Acrescenta `financeEntries?: FinanceEntry[]` e `tasks[].progress?: TaskProgressEntry[]`. Ambos opcionais; registros das versões antigas continuam legíveis. Para registrar dados reais, somente o usuário preenche os campos.
- Suas propostas, clientes, catálogos, parâmetros de preço, SINAPI, PDF e dados de empresa permanecem no espaço de trabalho atual.
- Alterações foram feitas em **cópia local**. Não houve migração, upload ou deploy na conta em nuvem.
- Não mantenha a v1.7 aberta simultaneamente com a v1.8 durante edições: um cliente antigo desconhece os novos campos. Exporte um backup antes da substituição e confirme que a barra de sincronização mostra 'Dados na nuvem'.

## Definições financeiras importantes

- **Valor aprovado:** proposta contratada/aceita; ainda não significa recebimento.
- **Recebido:** entrada declarada pelo usuário como efetivamente paga.
- **Despesa paga:** saída declarada pelo usuário como efetivamente desembolsada.
- **Saldo de caixa:** recebimentos registrados menos despesas pagas registradas. Não é lucro líquido contábil, pois pode faltar competência, custos, tributos, contas a pagar etc.
- **A receber:** soma de orçamento(s) aprovados menos receitas vinculadas a eles, limitada a zero por orçamento. Lançamentos gerais sem vínculo não quitam orçamentos automaticamente.
- **Avanço físico:** média simples do percentual de conclusão por etapa; não é avanço financeiro ponderado por custo.

## Testes executados

- `npm run test:logic` → 55/55 passaram (12 testes novos de execução e financeiro).
- Inspeção de sintaxe de 44 arquivos TS/TSX → 0 erros de sintaxe.
- Build Vite/tsc projeto inteiro **não validado aqui** porque o npm não conseguiu acessar registry.npmjs.org (`EAI_AGAIN`). Execute os testes na sua máquina antes de usar em produção.

## Fluxos a validar manualmente no ambiente local

1. Efetue login e aguarde a carga dos dados existentes.
2. Abra **Cronograma** e selecione o cronograma existente com etapas; registre uma quantidade *realmente executada* em uma etapa, confirme percentual e sincronização. Para teste com a obra de exemplo identificada `[TESTE]`, registre somente valores também marcados como teste.
3. Abra **Obras**, veja status do orçamento e avanço correspondente e navegue para a etapa selecionada.
4. Abra **Financeiro**, cadastre um recebimento efetivo e uma despesa paga, vinculando ao orçamento correto, e confira dashboard. **Não insira valores fictícios como se fossem pagamentos reais**.
5. Abra em desktop e em celular para verificar adaptação visual. Gere um PDF e teste importação XLSX SINAPI para regressão.
6. Confirme a sincronização, recarregue página e valide persistência. Exporte backup JSON.

## Etapas futuras (não implementadas nesta versão)

- **v1.9**: dependências entre etapas, múltiplas frentes, feriados e calendário da obra, atrasos reais, medição física-financeira por item e registro de custos com competência.
- **v2.0**: ordens de serviço, diário de obra, responsáveis/equipes com autenticação e perfis, anexos em armazenamento protegido, conciliação/contas a pagar.
- **v2.1**: pesquisa SINAPI com filtros mais amplos, BDI auditável, memória de cálculo e exportação de relatórios.
- **Pré-lançamento**: fluxos completos de ponta a ponta, homologação mobile/PDF, revisão de políticas RLS e funções públicas por token do Supabase, conformidade LGPD e monitoramento.

NÃO são implementados aqui: conexão bancária, lançamento automático de pagamentos, assinatura digital certificada, cronograma com feriados, geração automática de obra ao aprovar proposta, lucro líquido contábil definitivo, push de servidor, sincronização em tempo real via WebSocket.
