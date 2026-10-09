# OrçaPro v1.6 — Importação validada com SINAPI 08/2026

## Arquivos enviados pelo usuário, analisados sem alteração

| Nome | Reconhecimento | Destinação no cronograma |
|---|---|---|
| SINAPI_Referência_2026_08.xlsx | Aba `Analítico`, 66.837 linhas físicas, cabeçalho A:H | **Usado** para extrair composições e coeficientes unitários de mão de obra |
| SINAPI_mao_de_obra_2026_08.xlsx | Abas com percentuais de custo da mão de obra por UF, sem/com desoneração | Não converter percentual monetário em HH |
| SINAPI_familias_e_coeficientes_2026_08.xlsx | Coeficientes de representatividade dos insumos em famílias | Não interpretar como produtividade do serviço |
| SINAPI_Manutenções_2026_08.xlsx | Histórico das alterações de insumos e composições | Não interpretar como coeficiente de execução |

## Resultado da validação no navegador (Chromium, usando os XLSX originais)

- 9.092 composições de serviços **com mão de obra H identificável** foram extraídas de `Analítico` de agosto de 2026.
- 364 composições **sem mão de obra H identificável** não recebem prazo fictício.
- A leitura do arquivo de Referência durou cerca de 4,12 segundos nesta máquina de teste; o tempo pode variar entre dispositivos.
- O código 104658 (piso podotátil, m²) trouxe 1,279 h de servente e 0,639 h de pedreiro por m², diretamente da planilha fornecida.
- O código 96113 (forro de placas de gesso comercial, m²) trouxe 0,4522 h de servente e 0,7867 h de gesseiro por m².
- Composições intermediárias são expandidas recursivamente (ex.: 105002 contém 104658 e outras composições), evitando perda de mão de obra indireta.
- As outras três planilhas são reconhecidas e exibem explicação clara de por que não fornecem HH.

## Modificações de código

- `src/utils/sinapi.ts`: parser do analítico da CAIXA, expansão de composições auxiliares, detecção de mês/ano, agregação por função, prevenção de meses misturados.
- `src/utils/sinapiFile.ts`: leitor XLSX ZIP seletivo; só descompacta `Analítico` quando recebe workbook oficial da CAIXA, não todas as planilhas de preços.
- `src/components/schedule/ScheduleView.tsx`: seleção de múltiplas planilhas, feedback por arquivo, referência mês/ano identificada e alertas para as planilhas não apropriadas ao cronograma.
- `test/sinapi-schedule.test.mjs`: novos testes de relatório original, composição auxiliar ausente e mistura de meses.

## Segurança, persistência e limitações

- O arquivo XLSX é processado localmente no navegador; não é enviado ao banco.
- Só as etapas explicitamente adicionadas pelo usuário, suas fontes e coeficientes são salvas no Supabase.
- Nenhuma tabela SQL foi criada/alterada; não há necessidade de executar nova migração do banco.
- Os coeficientes SINAPI são **consumos referenciais de HH**, não durações garantidas: prazo depende de quantitativos, equipes, jornada, eficiência, feriados e condições de campo.
- Os itens de cronogramas antigos permanecem como estavam; para aproveitar as correções, importe a referência novamente e cadastre as novas etapas. Não houve migração automática de dados de usuário.
- Testes completos de React/Vite (`npm run build`) não foram possíveis neste ambiente, onde não há `vite` instalado no diretório; o comando retornou `vite: not found`.
- O uso comercial deve passar por validação técnica dos coeficientes/composições e por testes de ponta a ponta no aplicativo instalado.

## Testes

`npm run test:logic`: 40 testes aprovados; verificação isolada de tipos do importador XLSX aprovada; sintaxe de TS/TSX dos arquivos alterados aprovada. Importação dos quatro XLSX foi executada e validada no navegador Chromium, inclusive o arquivo de 13,6 MB de referência.

## Como usar

1. Extraia o ZIP e execute `npm install` e `npm run dev`.
2. Abra **Cronograma de execução** e crie/selecione uma obra.
3. Clique **Selecionar planilhas do SINAPI** e escolha **SINAPI_Referência_2026_08.xlsx** (ou os quatro arquivos juntos).
4. Pesquise o código ou descrição da composição, informe quantidade e clique **Adicionar serviço**.
5. Defina os profissionais reais por função e confira o prazo e a fonte exibidos.
