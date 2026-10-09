# Rodada 1 — Testes de navegador
O workflow `OrçaPro Browser Smoke` instala Chromium apenas no runner gratuito do GitHub Actions.
Os smoke tests exercitam a **interface real compilada pelo Vite**, mas usam uma URL fictícia de backend e não acessam o Supabase de produção.
Verificam o login renderizado, alternancia entre cadastro/login/recuperacao e erro em link de proposta inválido em mobile e desktop.

## Testes autenticados ainda necessários
Para cobrir cadastro real, clientes, orcamentos, importacao SINAPI, medicoes, financeiro e restauracao, criar um **Supabase exclusivo de homologação** e configurar conta de teste sem acesso a dados comerciais.
Nao colocar senha em arquivo versionado nem usar o projeto Supabase produtivo como alvo de operacoes destrutivas.
A execucao de smoke tests NAO deve ser descrita como homologacao funcional completa.
