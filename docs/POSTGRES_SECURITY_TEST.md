# Contrato SQL executado no GitHub Actions (ambiente isolado)

A etapa `OrçaPro PostgreSQL Security Contract` levanta um **PostgreSQL efemero** dentro do runner, cria apenas roles e usuarios QA locais e aplica o arquivo oficial `supabase/schema.sql`.

Com isso testa diretamente:
- a politica RLS que impede leitura e alteração de workspace de outra conta;
- que a role `anon` nao tem SELECT sobre tabelas privadas;
- que tokens públicos malformados, inexistentes e expirados nao vazam dados;
- que a aprovação válida atualiza orçamento, revisão e notificação;
- que uma segunda decisão com o mesmo token não é aceita.

## Escopo e limites
Não usa nenhum segredo nem faz chamadas ao Supabase hospedado. A função `auth.uid()` e a tabela `auth.users` são criadas localmente com semântica compatível apenas para testar o contrato SQL. Não substitui testes reais do Supabase Auth/Gotrue, CORS ou fluxos de navegador autenticado.

Sem cobrança de novo projeto Supabase. Pode consumir minutos gratuitos do GitHub Actions. O PostgreSQL é apagado ao terminar a execução.
