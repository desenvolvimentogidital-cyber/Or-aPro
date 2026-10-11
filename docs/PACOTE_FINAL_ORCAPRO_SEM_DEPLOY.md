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
