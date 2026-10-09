# OrçaPro v2.4 — Validação final e critérios de liberação

Este projeto contém a implementação consolidada das etapas v1.8–v2.3. **Não é uma homologação de produção**: os testes e configurações abaixo ainda exigem execução em ambiente real.

## Etapas implementadas no código

- **v1.8** — medições físicas, obras, financeiro de pagamentos/despesas declarados e painel sem confundir aprovado com recebido.
- **v1.9** — atividades paralelas e dependências, feriados manuais, Gantt e físico-financeiro vinculado a itens explícitos do orçamento.
- **v2.0** — responsável, estado operacional declarado, diário de obra e ocorrências.
- **v2.1** — BDI analítico, importação de composições SINAPI em XLSX e de custos monetários **em CSV com colunas explicitadas**. UF, MM/AAAA e regime selecionados antes de usar a referência. Não igualar custo SINAPI ao preço de venda.
- **v2.2** — impressão do cronograma e apresentação desktop fluida; PDF do orçamento anterior mantido.
- **v2.3** — validação estrutural de backups antes da substituição, separação explícita entre custos e HH, melhorias de teclado e contraste de foco e testes de regressão.

## Limites técnicos conhecidos

1. O leitor de **HH** recebe o XLSX SINAPI Referência aba Analítico. O leitor de **custos** agora aceita diretamente SINAPI Referência XLSX, abas CSD/CCD por UF e regime, ou CSV tabular exportado da fonte legítima com cabeçalhos `Código composição;Descrição;Unidade;Custo unitário`. Outros layouts XLSX não homologados, tabelas de famílias e percentuais de mão de obra não são inferidos como custos nem HH.
2. Os campos UF e regime são **declarados pelo operador**; o software ainda não verifica geograficamente o conteúdo das colunas de preço. Cabe conferir correspondência com o relatório CAIXA original.
3. OrçaPro usa espaço de trabalho isolado por **usuário autenticado**. Não suporta ainda gestão de equipes multiusuário por empresa com permissões compartilhadas. Não alegar este recurso.
4. O aceite por link público é **confirmação por posse do token**, não assinatura eletrônica qualificada com validação de identidade. O risco de uso indevido do link permanece e requer limitação de abuso e validação jurídica antes de uso como assinatura.
5. Financeiro mostra recebimentos e despesas declaradas; não é escrituração contábil completa nem substitui notas fiscais. Não calcular imposto/folha/lucro líquido contábil sem entradas e integrações reais.

## Verificações nesta entrega

- Executado `npm run test:logic`: **95/95 testes passaram** (compila utilitários com TypeScript global e roda Node.js test runner).
- Parsing TypeScript/TSX: **52 fontes analisadas, zero erros de sintaxe**.
- `npm install`: conexão com npm Registry indisponível/travou neste ambiente; `npm run lint` e `npm run build` **não verificados**.
- Impressão A4 com Playwright/Chromium executada: cronograma com **2 etapas = 1 página; 90 etapas = 12 páginas**, todos os 90 registros presentes; PDF de orçamento com **2 itens = 1 página; 72 itens = 5 páginas**, todos os 72 registros presentes. Primeira e última páginas inspecionadas visualmente. **Android e navegador de usuário ainda precisam de teste.**
- RLS previamente verificada nas duas tabelas Supabase. O alerta do Supabase para funções públicas `SECURITY DEFINER` ainda exige avaliação/mitigação, assim como proteção contra senhas vazadas.
- Não houve deploy e não foram alterados registros Supabase nesta rodada.

## Verificações obrigatórias antes de produção

1. Na pasta do projeto, executar `npm install`, `npm run lint`, `npm run test:logic`, `npm run build` e corrigir quaisquer falhas. Node 22+.
2. Subir `npm run dev` e testar login, cadastro, recuperação, logout, atualização de token e sincronização após reconexão de rede.
3. Testar com **duas contas legítimas de teste em ambiente de homologação separado**, confirmando que uma não lê os registros da outra (RLS).
4. Fluxo completo: orçamento real de homologação → PDF curto/longo → link público → aprovação/recusa → atualização do status → cronograma → medição → diário → recebimento e despesa → exportar/restaurar backup. Não usar dados de clientes reais nos testes públicos.
5. Importar planilha SINAPI Referência real, conferir amostras de HH e validar UF, competência e regime; testar CSV de custos extraído da fonte selecionada.
6. Revisar comportamento visual em 375, 430, 768, 1024, 1280, 1440 e 1920 px; impressão A4 em Chrome, Edge e Android.
7. Revisar links de acesso, TTL do token, abuso/limites de requisição, `SECURITY DEFINER`, políticas RLS e autorização com auditoria do Supabase. **Não conceder SELECT público nas tabelas**.
8. Em Supabase Auth, verificar opções disponíveis para proteção contra senhas comprometidas. Se não disponível no plano, exigir senhas fortes e compensações apropriadas.
9. Criar backup e testar recuperação antes de qualquer alteração de esquema/implantação. Só efetuar **um deploy final** após aprovação.

## Segurança e configuração

O arquivo `.env.local` contém somente URL e chave **publishable** do projeto Supabase anteriormente conectado. Não insira service_role, senha de banco, JWT secret nem chave privada em `VITE_*`. A publicação deve ser bloqueada até todos os itens críticos acima estarem validados.
