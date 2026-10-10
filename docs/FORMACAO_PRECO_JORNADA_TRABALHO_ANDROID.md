# OrçaPro — Formação de Preço: dias e horas editáveis

## Problema apresentado no Android
A tela **Formação de Preço** exibia a mensagem vermelha "Dias e horas trabalhadas devem ser maiores que zero" e os indicadores mostravam `0 dias` e `0h úteis`. Entretanto, o componente mantinha `workDaysPerMonth = 0` e `workHoursPerMonth = 0` sem renderizar inputs, impossibilitando corrigir a mensagem e calcular custo diário ou horário.

## Correção
- Inserido quadro fixo **Dias e horas de trabalho** acima das abas **Custos Mensais**, **Quanto Preciso Cobrar?** e **BDI Analítico**, visível nos celulares e na web.
- Usuário informa **Dias trabalhados por mês** (inteiros de 1 a 31) e **Horas trabalhadas por dia** (de 0,5 a 24). Cálculo demonstrado: **22 dias × 8h = 176h por mês**.
- Sem valores, não se força jornada de 22 dias/8h nem se mostra alerta vermelho. Informa-se que os campos precisam ser preenchidos; os cartões mostram traço em vez de custo `R$ 0,00` fictício.
- Ao completar, usa os números no `pricingEstimate` já existente, preservando fórmulas e markup: custo por dia = despesas mensais ÷ dias; custo por hora = despesas mensais ÷ horas mensais.
- O formulário armazena os campos opcionais **`company.pricingWorkDaysPerMonth`** e **`company.pricingHoursPerDay`** via `updateCompany` no **workspace JSONB** já protegido por autenticação, persistindo na nuvem e ficando disponível após fechar e abrir o app.
- A interface indica salvando/salvo/erro conforme sincronização real da conta.
- O quadro também é visível na aba "Quanto Preciso Cobrar?" para permitir ajustes sem trocar de tela.
- Não altera jornadas do cronograma SINAPI, coeficientes HH, base de dados, autenticação, RLS, despesas ou orçamentos anteriores. Não demanda migração.

## Testes
- `test/pricing-workload.test.mjs`: sem valores, validação, jornada 22×8 e custo por dia/hora com R$16.200 do print, configurabilidade e integridade.
- `test/e2e/pricing-workload.mjs`: Android 390→320 px com REST em memória, abre Formação de Preço pelo menu Mais, edita jornada, verifica custo diário/horário, salvamento e persistência após recarga. Nenhuma conta/empresa real acessada.
- CI: `npm run lint`, `npm run test:logic`, `npm run build`, Browser Smoke e PostgreSQL Security Contract.

## Publicação
A Vercel apresentou bloqueios prévios de cota de builds. Esta correção fica em PR até os testes passarem e haver janela de publicação única, sem redeploy a cada mudança.
