# OrçaPro — pacote de melhorias para uma única publicação

**Regra desta etapa:** desenvolver em branch/PR de rascunho, executar CI e preservar os dados. **Não realizar merge nem deploy de produção** até o usuário autorizar a liberação conjunta. A Vercel já retornou erro 402 de cota de API, confirmado antes desta etapa.

## Concluído nesta branch (PR #33, ainda sem merge)
- Atribuir funcionários cadastrados a cada profissão SINAPI de cada etapa do cronograma; associação privada e opcional, por ID e código da função.
- Previsão específica da obra: horistas = custo variável estimado por HH; mensalistas = parcela **já inclusa no fixo** da empresa alocada gerencialmente por HH.
- Alertar quando há vagas da equipe sem cadastro, empregado excluído/incompatível, atribuição repetida ou etapa paralela com o mesmo profissional no mesmo período.
- Não modificar o número de pessoas, a produtividade, o prazo, valores de orçamento, PDF público nem lançamentos financeiros automaticamente.
- Validar alocações em backups e manter cronogramas antigos funcionando.
- Testes unitários das regras e teste de navegador com persistência e mobile (ver status CI da PR antes de afirmar aprovação).
- Painel financeiro por obra com receita recebida, despesa paga, saldo não equivalente a lucro, cobertura parcial dos custos de orçamento e tratamento de registros sem obra.

## Melhorias implementadas e próximas melhorias ANTES do merge conjunto
1. **Importação nacional de custos SINAPI** — elaborar processo em lotes com checkpoint/resume, código/unidade/referência/UF/regime, contagem de cobertura real e rejeição de conflitos. Conferir direitos de uso, planilha fonte e limites do Supabase antes de gravar. Nunca completar valores ausentes com médias ou preços de outra UF.
2. **Decomposição correta de cada serviço** — extrair e classificar insumos e composições auxiliares do arquivo Analítico com Custo. Demonstrar subtotal de profissionais, materiais e equipamentos apenas quando o desdobramento e preços estiverem completos e reconciliados com CSD/CCD. Se não estiverem, manter "demais custos" sem rotulá-los exclusivamente como materiais.
3. **Previsto x realizado — implementado nesta branch:** lançar recebimentos/despesas reais associados explicitamente à obra, comparar com a proposta e com custos diretos conhecidos; itens sem custo informado e valores sem obra ficam identificados. Não é lucro líquido. **Próximo:** aprofundar custos indiretos, consumo e medições de fornecedores sem criar movimentação fictícia.
4. **Atualização mensal da referência** — ferramenta de importação/validação da nova competência, histórico com origem e data, sem reprecificar cotações e orçamentos já gravados.
5. **Homologação mobile e PDF** — testar Android Chrome/Samsung, seleção de execução apenas, funcionário mensal ou por hora, HH, custo, cronograma Gantt, PDF e dados persistidos com conta de testes no domínio de produção depois da publicação.
6. **Operação Vercel** — desbloquear quota 402, verificar CI final e liberar `main` UMA vez, validar commit/aliases e fazer smoke no domínio oficial.

## Critérios de segurança
- A planilha SINAPI de custos fornece valores referenciais, não salário contratual ou piso obrigatório.
- Dados privados de funcionários não devem constar de PDFs de proposta pública ou respostas anônimas.
- Nenhum registro financeiro é criado por registrar um trabalhador ou atribuí-lo a uma etapa.
- Se cliente fornecer material: modo "somente mão de obra" exclui custo de material, sem ocultar equipamentos ou outras composições auxiliares indevidamente.
- A ausência de preço oficial deve ser exibida como ausência e não como R$ 0 com certeza de custo.
- Não fazer deploys intermediários para reduzir risco de regressão e evitar nova cota.


## Preparação da referência SINAPI nacional 09/2026 (NOVO, ainda NÃO aplicado)

Arquivo original: SINAPI_Referência_2026_09.xlsx, fornecido pelo proprietário da plataforma.
Inspeção da planilha: CSD/CCD com 10.599 composições por regime;
ISD/ICD com 4.878 insumos por regime; 27 UFs. O banco público tem
somente 63 registros de preços pontuais antes da nova carga.
Células vazias são AUSÊNCIA de preço, nunca custo zero.

### Procedimento para a futura liberação conjunta
1. Executar backup do Postgres e avaliar capacidade/limites antes de importar.
2. Aplicar em QA as migrações:
   - supabase/migrations/20261011_sinapi_national_inputs_price_reference.sql
   - supabase/migrations/20261011_sinapi_national_analytical_items.sql
3. Validar SEM gravar dados:
   python scripts/sinapi_national_prices.py "SINAPI_Referência_2026_09.xlsx" --check-only
4. Preparar os CSVs, mapa de cobertura e arquivos SQL:
   python scripts/sinapi_national_prices.py "SINAPI_Referência_2026_09.xlsx" --out-dir dados-sinapi
   python scripts/sinapi_analytical_items.py "SINAPI_Referência_2026_09.xlsx" --out-dir dados-sinapi
5. Inspecionar dados-sinapi/summary.json e analytical_summary.json.
   Somente conta autenticada pode ler o catálogo nacional; importação exige
   acesso administrativo ao Postgres, NUNCA segredo de serviço no frontend.
6. Usando uma conexão DATABASE_URL segura para o ambiente QA, executar:
   psql -v ON_ERROR_STOP=1 -f dados-sinapi/import.sql
   psql -v ON_ERROR_STOP=1 -f dados-sinapi/import_analytical.sql
   Verificar contagens, competências e preços já conhecidos, especialmente
   104596 PR CCD = 14829 centavos e 88316 PR CCD = 3112 centavos.
7. Executar na produção somente após revisão, backup e autorização de release.
   A carga é transacional e bloqueia preços publicados divergentes;
   não mistura estados, competências ou regimes.

### Detalhamento SINAPI (preparado, depende dos dados nacionais)
- Consulta sob demanda no Catálogo e no Orçamento, sem lentidão no cadastro.
- Recursão em composições auxiliares com coeficientes originais da planilha.
- Classificação de mão de obra, material, equipamento e outros/encargos.
- Só marca como CONCILIADO se todos os insumos tiverem preço e o desvio
  para o total SINAPI for de no máximo R$ 0,02 por unidade.
- Ausência de preço -> PARCIAL. Diferença -> NÃO CONCILIADO.
  Nesses casos não apresentar custo integral ou margem como confirmados.
- Não altera automaticamente preço de venda, proposta ou caixa da empresa.
- CI testa parsers sintéticos XLSX e RLS via Postgres efêmero.

