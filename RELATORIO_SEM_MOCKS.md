# Auditoria e remoção de mocks — 08/10/2026

## Removido / corrigido

- Eliminado `src/data/initialData.ts`, que continha empresa, clientes, orçamentos, catálogo, despesas e notificações inventadas. Substituído por `src/data/defaults.ts` com **dados comerciais vazios** e uma identidade visual neutra do produto.
- Removido modo de demonstração, inclusive no desenvolvimento. Sem URL e chave pública do Supabase, há somente uma tela de configuração necessária, sem acesso ao workspace.
- O usuário só acessa os registros após autenticação; contas novas partem vazias. Nenhum dado comercial é populado automaticamente.
- Painel de **Super Admin**, contadores de empresas/planos e status fictícios substituídos por um painel honesto de personalização de aparência local.
- Calculadora de preços começa com entradas zero, sem custos fictícios; ela realiza cálculo efetivo após configuração.
- Seleção de modelo exige escolher um orçamento existente, sem usar o primeiro automaticamente.
- Indicadores de gráfico sem histórico informam ausência de histórico em vez de gerar série inventada.
- Removida barra artificial de hora fixa, Wi-Fi e bateria da moldura mobile.
- Corrigidas descrições falsas de Excel e push remoto; fluxos WhatsApp e PDF passam a ser comunicados conforme sua operação real.
- SQL de decisão pública registra resposta real e histórico, gera notificação persistida, impede segunda decisão da mesma proposta e usa controle de revisão.
- Migração automática de registros locais bloqueia IDs conhecidos de registros demonstrativos antigos.

## O que depende de serviço externo

- Banco real e autenticação: deve ser configurado no Supabase do proprietário e testado.
- Link público/aceite: função SQL incluída, mas **não executada externamente**; sem instância real não pode ser afirmada operacional.
- Sem provider configurado, email de recuperação também não foi testado.
- Nenhuma implantação ou banco externo foi modificado.

## Escopo

Não há promessas de entrega automática de mensagens WhatsApp, faturamento pago, cobrança de plano, controle de outras empresas, confirmação de identidade do cliente, assinatura digital ou push em segundo plano. Esses recursos não existem e não são substituídos por mocks.

## Verificações executadas

- 16 testes automatizados aprovados (`npm run test:logic`), incluindo seis verificações anti-exemplos.
- Análise sintática de 30 arquivos TypeScript/TSX: zero erros sintáticos.
- Build e checagem completa de tipos **não concluídos**: npm registry inacessível (EAI_AGAIN) para instalar React/Vite e seus tipos.
- Supabase, SQL real, políticas RLS, aceites via link e fluxos ponta a ponta **não testados externamente**.
- Nenhum deploy ou configuração externa foram realizados.
