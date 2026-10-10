# OrçaPro — seleção livre de bases referenciais e índices de reajuste

## Funcionalidade
A solicitação foi permitir que cada usuário escolha a referência adequada para o orçamento ou para o cronograma, em vez de restringir o programa a SINAPI.

São **duas seleções independentes**, pois cumprem funções diferentes:

- **Base de composições e custos:** SINAPI, SICRO, ORSE, SEINFRA-CE, EMOP-RJ, SCO-RJ, CDHU/CPOS-SP, SUDECAP-BH, SEDOP-PA, SETOP/SEINFRA-MG, DER-SP/MG/PR, TCPO (privada), própria ou OUTRA personalizada.
- **Índice de reajuste monetário:** nenhum, INCC, IPCA, INPC, IGP-M, IGP-DI, CUB, índice SINAPI ou OUTRO personalizado.
- Campos informativos opcionais: competência (MM/AAAA) e UF. **Não** inferem valores, vigência contratual, série histórica nem custo local.
- Novos orçamentos começam com SINAPI / sem índice; documentos antigos permanecem compatíveis sem migração.
- As seleções ficam no próprio JSONB do orçamento (`Quote.referenceSettings`) e do cronograma (`WorkSchedule.referenceSettings`). Ao vincular uma proposta, o cronograma que ainda não tiver preferência pode adotar a da proposta.
- A interface é responsiva, com agrupamento de bases, nomes personalizados e feedback de validação; o PDF indica as escolhas quando elas tiverem sido registradas.

## Limites técnicos e jurídicos explícitos
- **Não** executar reajuste automático apenas porque foi selecionado INCC, IPCA ou outro índice. Para isso são necessárias cláusula contratual, data-base, série mensal, periodicidade e metodologia de cálculo auditável.
- **Não** fabricar preços, coeficientes HH, equipes ou prazos de SICRO/ORSE/etc. As composições do cronograma e o importador existentes são SINAPI; a escolha de outra referência **ainda não ativa conexão automática** nem converte composições de bases incompatíveis.
- Algumas tabelas são privadas ou licenciadas (ex.: TCPO). A presença no menu não concede licença, não garante API nem reprodução de dados.
- CUB é indicador de custo/m² por padrão e UF; não equivale automaticamente a uma composição de serviço nem a coeficientes HH.
- Orçamentos e equipes já salvos não são recalculados ao trocar a preferência. Cada etapa conserva origem, competência e referência próprias.

## Validação
- `test/construction-references.test.mjs` cobre fontes nacionais/regionais/privadas, índices separados, campo personalizado, validação e integridade de HH/prazo e PDF.
- `test/e2e/auto-layout.mjs` exercita no celular as opções SICRO/INCC, OUTRA, customização e retorno a SINAPI.
- CI: `npm run lint`, `npm run test:logic`, `npm run build`, navegador Chromium e contrato PostgreSQL.

## Fontes de referência
- SINAPI oficial: https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx
- SICRO oficial: https://www.gov.br/dnit/pt-br/assuntos/planejamento-e-pesquisa/custos-referenciais/sistemas-de-custos/sicro

## Implantação
Nesta etapa nenhuma mudança de schema, autenticação ou RLS. Publicar apenas depois dos testes, da revisão e da liberação do bloqueio da Vercel; evitar deploys repetidos enquanto o limite estiver ativo.
