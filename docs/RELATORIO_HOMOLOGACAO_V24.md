# OrçaPro v2.4 — Relatório de homologação técnica (09/10/2026)

## Alterações implementadas

- `src/utils/sinapiFile.ts`: seleciona exclusivamente CSD/CCD do SINAPI Referência e recupera o código de composição da fórmula `HYPERLINK(...)` quando seu valor de cache no XLSX é zero; o conteúdo da fórmula não é executado.
- `src/utils/sinapiCosts.ts`: analisa a competência do arquivo, a modalidade de encargos, a linha com nomes das UFs e o custo monetário da coluna selecionada. Ignora custos indisponíveis/zero e não trata `%AS` como moeda.
- `src/components/catalog/CatalogView.tsx`: o Catálogo passa a receber `.xlsx` oficial e CSV estruturado, preservando a exigência de preço de venda informado pelo operador.
- Testes automatizados contra divergência de competência, regime, coluna incorreta, custo zero, arquivo incompatível e fórmulas não suportadas.

## Evidências de verificação

- **95 testes de lógica aprovados**, inclusive os 6 específicos da v2.4.
- **Planilha real `SINAPI_Referência_2026_08.xlsx`**, planilhas CSD e CCD, colunas SP, todas as 10.557 linhas inspecionadas em cada uma por leitura independente de valores e fórmulas do XLSX:
  - CSD SP: 8.403 custos utilizáveis; 2.144 ignorados; serviço 104658: **R$ 208,00/m²**.
  - CCD SP: 8.403 custos utilizáveis; 2.144 ignorados; serviço 104658: **R$ 204,51/m²**.
  - **Limitação da evidência:** a extração dos valores XLSX do teste usou leitor XML auxiliar para formar as linhas e executou o mesmo analisador TypeScript do aplicativo. A operação integral do botão de importação no navegador não foi homologada.
- `npm run lint`: não concluído — `vite/client` indisponível sem dependências.
- `npm run build`: não concluído — comando `vite` indisponível sem dependências.
- Instalação npm: ambiente sem acesso ao registro (erro DNS `EAI_AGAIN`).
- Navegação Chromium/Playwright: bloqueio administrativo para páginas locais e loopback. **Não afirmar que houve teste E2E nessa rodada.**

## Segurança do Supabase — pendências

O banco real permanece intacto e RLS está ativada nas tabelas de trabalho e links. A revisão do Supabase retornou:

1. Funções `orcapro_public_quote` e `orcapro_decide_quote` são `SECURITY DEFINER` acessíveis por tokens a visitantes. Isso é proposital para o fluxo sem conta, mas exige auditoria específica, limitação contra abuso e testes com dois usuários. **Não habilitar SELECT público nas tabelas.**
2. Supabase Auth sinalizou proteção contra senhas vazadas desabilitada; é necessária configuração administrativa ou uma medida compensatória efetiva.
3. O aceite por link não confirma identidade e não constitui assinatura eletrônica qualificada.

Referências oficiais da auditoria: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable e https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Próximos testes indispensáveis antes de produção

No Windows, entre na pasta OrcaPro e execute `VALIDAR_WINDOWS.bat`. Verifique:

1. `npm install` + `npm run lint` + `npm run test:logic` + `npm run build` com resultado zero.
2. Importar XLSX Referência 08/2026 pelo **Catálogo**, selecionar SP e ambos regimes separadamente, conferir composição 104658 e preços; testar rejeição de competência errada.
3. Cadastro/login/logout/recuperação; isolamento de dados de duas contas; rede desconectada e concorrência de gravações.
4. Criar proposta, enviar por link, responder com cliente de teste, refletir no dashboard/cronograma, registrar recebimentos e despesas reais de teste, verificar PDFs e backup/restauração.
5. Revisar Chrome/Edge/Android e larguras 375, 430, 768, 1024, 1280, 1440, 1920.
6. Repassar avisos de segurança do Supabase após qualquer endurecimento de permissões, sem quebrar fluxo público.

**Estado final:** candidata a homologação. Não pronta para declarar lançamento comercial até os testes e riscos críticos acima serem resolvidos. Nenhum deploy e nenhuma alteração de banco executados nesta rodada.
