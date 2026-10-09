# Auditoria e melhoria do cronograma OrçaPro — 09/10/2026

## Alterações técnicas
- `src/utils/scheduleMath.ts`: `scheduleWorkdayDates()` gera eixo com **datas exatas** de dias úteis e exclui fins de semana e datas não úteis cadastradas. Não inventa feriados nacionais/estaduais.
- `src/components/schedule/ScheduleView.tsx`: Gantt com colunas `D1`, `D2`, etc. **sempre acompanhadas da data DD/MM e dia da semana**; navegação em blocos de 15 dias úteis, serviços identificados por nome, código, duração, início e fim.
- `src/utils/scheduleDocument.ts`: PDF A4 paisagem, cores de alto contraste, colunas de duração/início/fim separadas e quadro visual paginado em blocos de 15 dias úteis para envio.
- Os modelos de dados, salvamento, medidas, módulos de financeiro e autenticação não foram modificados.
- `test/schedule-clarity.test.mjs`: testes de dias, feriados, datas, gargalo de profissão, simultaneidade e PDF.

## Cálculo auditado
- `HH_por_função = quantidade × coeficiente_SINAPI_da_função`.
- `Dias_da_função = ceil(HH_por_função / (profissionais × horas_por_dia × eficiência))`.
- `Duração_da_etapa = maior(Dias_da_função)`, assumindo que cada profissão pode trabalhar simultaneamente, sem disputa pelos mesmos profissionais com outras frentes.
- Etapas sequenciais iniciam no dia útil após a anterior; no modo dependências, cada etapa aguarda suas predecessoras.
- Com quantidade, coeficiente, equipe ou calendário inválidos, **o sistema não inventa um prazo**.
- Medições físicas e valores de recebimentos não são deduzidos automaticamente do planejamento.

## Conferência com a planilha SINAPI Referência enviada (08/2026)
- Arquivo analisado: `SINAPI_Referência_2026_08.xlsx`, contendo as abas Menu, Busca, ISD, ICD, ISE, CSD, CCD, CSE, Analítico e Analítico com Custo.
- O parser do aplicativo reconheceu **9.092 composições com HH identificável** na aba Analítico (66.837 linhas lidas; 66.828 linhas inspecionadas, 55 ignoradas).
- **364 composições sem mão de obra HH reconhecível** foram excluídas, evitando produtividade fictícia.
- Amostra confirmada, composição 104658 (piso podotátil): servente código 88316 = **1,279 HH/m²**; pedreiro código 88309 = **0,639 HH/m²**.
- A competência reconhecida pela planilha foi **08/2026**, não devendo ser confundida com referência atualizada automaticamente.
- A leitura de HH **não equivale a uma lista completa de materiais/equipamentos** nem faz dimensionamento de estoque, logística, máquina ou insumos; valores de venda/custos financeiros são tratados em módulos específicos, mediante importação/associação adequada.
- A UF e regime registrados identificam proveniência da referência, não alteram coeficientes de produtividade.

## Exemplo matemático validado
Início 09/10/2026 (sexta-feira), feriado informado 12/10/2026 (segunda-feira), jornada de 8h/dia e eficiência 100%.
Para 25 m² da composição 104658, com 2 serventes e 1 pedreiro:
- HH servente 25 × 1,279 = 31,975 HH; duração ceil(31,975/(2×8)) = **2 dias úteis**.
- HH pedreiro 25 × 0,639 = 15,975 HH; duração ceil(15,975/(1×8)) = **2 dias úteis**.
- Serviço: 09/10 e 13/10; término 13/10. A etapa seguinte em sequência começa 14/10.

## Restrições de lançamento/uso
- A estimativa deve ser revisada por profissional responsável, que verifica produtividade em campo, feriados municipais, clima, logística, interferências e disponibilidade simultânea de equipe.
- O programa não faz nivelamento automático da mesma equipe em frentes paralelas e não promete recursos materiais suficientes só porque há coeficientes HH.
- Datas geradas são **previsões**, não prazos contratuais nem datas de execução real.
- PDF contém resultados a partir dos dados do usuário; exemplo gerado pela auditoria tem rótulo de demonstração e não corresponde a registro comercial.
