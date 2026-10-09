# OrçaPro v1.5 — Cronograma de execução com SINAPI

## Implementado

- Nova tela **Cronograma de execução**, acessível pelo botão no dashboard e por **Mais > Planejamento de obras > Cronograma SINAPI**.
- Importação local de arquivos `.xlsx`, `.csv` e `.tsv` via navegador. XLSX usa descompressão ZIP nativa e XML, sem enviar planilhas a terceiros nem depender de bibliotecas externas. Requer navegador atualizado. `.xls`, `.zip` e PDFs **não** são reconhecidos pelo importador.
- Reconhecimento de composições analíticas com código, descrição, unidade, coeficiente de mão de obra H/unidade e ocupação profissional. Não confunde custo em reais, horas de equipamentos ou consumo de materiais com horas-homem.
- Se a planilha oficial for apenas de preços/composições resumidas **sem coeficientes analíticos de mão de obra**, avisa que não é possível calcular prazo — **não inventa HH**. Existe um botão para baixar CSV vazio com estrutura de colunas compatível, para que o usuário prepare/normalize os dados da fonte oficial.
- Escolha da composição e quantidade real por serviço (m², m³, m, un etc.). Possibilidade de copiar a quantidade de um item do orçamento quando a unidade coincidir. Inclusão de etapas e reordenação.
- Equipe definida por função profissional; cálculo de duração pelo maior gargalo da equipe (horas de cada ocupação / profissionais disponíveis por função / jornada diária / eficiência definida). Prazos sequenciais em dias úteis; sábados e domingos são pulados, **feriados não são avaliados**.
- Gantt simplificado, previsão de início/término, horas-homem, aviso de parâmetros/equipe ausentes, exportação CSV com neutralização de fórmulas.
- Cronogramas de cada usuário persistidos na propriedade opcional `schedules` do `payload` JSONB da tabela `orcapro_workspaces`, mantendo as políticas RLS atuais. **Não requer migração SQL**. Backup novo inclui os cronogramas e backups antigos sem essa propriedade continuam importáveis.
- Cada etapa salva apenas o serviço selecionado e seu coeficiente/fonte importados; não armazena toda a planilha importada no Supabase.

## Origem e limitações

Fonte oficial: https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx

A CAIXA/IBGE publica planilhas mensais de custos e composições e relatórios analíticos em PDF; os coeficientes técnicos de mão de obra devem ser obtidos nas composições/relatórios analíticos adequados. Nem todas as planilhas mensais XLSX fornecem essa relação por serviço. O aplicativo **não baixa automaticamente** o SINAPI, não possui API oficial de preços e não apresenta taxas fictícias.

**Não é um cronograma executivo completo:** não calcula calendário de feriados, dependências técnicas ou atividades paralelas, não emite ART/RRT e não substitui análise de engenheiro/técnico responsável. Os parâmetros iniciais de 8 horas/dia e eficiência 100% são editáveis e NÃO são produtividade da base SINAPI. HH só aparece com coeficiente importado válido.

## Validação

- Testes unitários para importação tabular e hierárquica, rejeição de planilha de preço sem coeficiente, cálculo por função, fins de semana, entradas faltantes e deduplicação.
- Verificação de leitura de arquivo XLSX ZIP/XML no Chromium com arquivo **sintético de teste**. Não foi utilizado como valor de produção.
- Testes lógicos existentes da versão v1.4 também executados.
- Não foi executado build Vite completo neste ambiente porque o registro npm estava inacessível; verificar `npm install`, `npm run lint`, `npm run build` localmente.
- Nenhum dado do Supabase foi modificado e nenhum deploy foi realizado.
