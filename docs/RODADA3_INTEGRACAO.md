# Rodada 3 — integracao entre modulos e PDF multipagina
## Novos testes
- Fluxo logico integrado: custo SINAPI SP 08/2026 -> precificacao declarada -> documento de proposta -> recebimento e despesa lançados. Nao preenche automaticamente valores financeiros.
- Geracao efetiva de PDF pelo Chromium, usando um orçamento de 72 itens e um cronograma de 90 etapas, incluindo verificacao de existencia do PDF e multiplas paginas.

**Importante**: os dados QA sao gerados somente em memoria durante a execucao do CI. Eles NAO fazem parte do banco ou dos cadastros de producao.

## Nao homologado
- Autenticacao com conta de teste isolada, persistencia de clientes/obras/financeiro, aprovacao publica com token valido, restauracao de backup em banco de homologacao.
- O browser smoke CI usa apenas interface local e nao executa essas operações produtivas.
