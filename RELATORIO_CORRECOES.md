# OrçaPro — Relatório de correções
Data: 08/10/2026

## Aplicado neste pacote

1. **Orçamentos:** construtor inicia vazio para evitar salvar exemplos como dados reais; edição reutiliza os dados de proposta existente e salva com o mesmo ID/número; duplicação cria IDs novos; numeração sequencial considera maior número e último número emitido, inclusive após exclusões; histórico local em criação, edição e troca manual de status.
2. **Cálculos:** lógica isolada em `src/utils/quoteMath.ts`, validando valores negativos, não finitos, porcentagens e limites de desconto; custo de viagem incluído no cálculo de lucro; prejuízo é mostrado como valor negativo; ausência de custo de item gera alerta, nunca custo arbitrário baseado no preço de venda. Calculadora de markup deixa de usar fator fictício quando os parâmetros são impossíveis.
3. **Indicadores:** cartões calculam valores reais de propostas aprovadas, por período, a partir das datas armazenadas. Gráfico de tendência usa valores calculados. Os valores aprovados não são tratados como recebimentos efetivos.
4. **Exportação:** CSV centralizado com escape de aspas, separadores e fórmulas de planilha, inclusive texto potencialmente malicioso vindo de clientes; BOM UTF-8 para acentos.
5. **Persistência:** backup/importação de JSON com confirmação; modo local identificado expressamente como demonstração; erros de armazenamento avisados, em vez de ignorados; opção de tentar novamente e aviso antes de sair sem salvar.
6. **Nuvem opcional:** Auth Supabase com cadastro, login, logout e recuperação de senha; banco SQL configurável com RLS e isolamento por usuário (um ambiente de trabalho por conta), revisão otimista para detectar conflitos; importação de dados locais para conta autenticada opcional e confirmada. Sem credenciais, produção bloqueia modo inseguro por padrão.
7. **Compartilhamento:** link público aleatório com validade limitada, leitura por função SQL que não expõe tabela, resumo sem custos internos ou margem, aceites/recusas persistidos em banco e transmitidos ao status; não representa assinatura digital verificada.
8. **UX:** etiquetas de aprovação manual são explícitas; abrir WhatsApp não marca automaticamente proposta como enviada; exclusões pedem confirmação; impressão usa folha A4 com CSS de impressão; personalização não se anuncia como administrador global.
9. **Código:** dependências não utilizadas removidas, páginas de login e visualização pública adicionadas, testes de lógica e pipeline de CI incluídos.

## Validações feitas no ambiente de edição

- `npm run test:logic`: **9/9 passaram** (preços, markup, prejuízo, desconto, numeração, receita mensal, CSV e UUID).
- Análise de sintaxe TypeScript: **29 arquivos analisados, 0 erros de sintaxe**.
- `npm run lint` e `npm run build`: **não concluídos**. O ambiente não conseguiu instalar dependências React/Vite; portanto o comportamento da interface e os comandos de build ainda precisam de validação no projeto com `npm install`.
- Banco Supabase e funções SQL: **não implantados**. É indispensável executar `supabase/schema.sql` em um projeto de testes antes de validar os fluxos de autenticação e compartilhamento.
- Nenhum deploy foi feito nem dados externos foram modificados.

## Ainda necessário antes de receber clientes reais

- Rodar os comandos de instalação, lint, testes e build em ambiente com rede e dependências; executar CI.
- Configurar projeto gratuito Supabase, URLs de callback/recuperação e domínios; verificar RLS de duas contas diferentes, sincronização e aprovação remota de ponta a ponta.
- Revisar LGPD, termos, retenção, restauração periódica dos backups e limites da infraestrutura gratuita.
- Implementar gestão de múltiplos usuários por empresa / controle de papéis se o produto exigir colaboração; atualmente o isolamento é por conta.
- Implementar conciliação de pagamentos para *faturamento recebido*, alertas remotos em segundo plano e assinatura digital certificada se forem requisitos comerciais.
- Executar testes em navegadores e dispositivos de uso real (cadastro, login, recuperar senha, sair, clientes, catálogo, despesas, orçamentos, edição, PDF, CSV, backup, importação, link, aceite, recusa e conflitos entre abas).

**Importante:** Alterações de código e scripts não significam que o serviço Supabase tenha sido criado, autenticado ou publicado. Leia também `README.md`.
