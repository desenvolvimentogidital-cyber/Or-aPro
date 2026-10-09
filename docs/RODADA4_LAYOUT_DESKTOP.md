# Rodada 4 — Workspace responsivo

- Em telas grandes, a area de trabalho tem barra lateral escura para Clientes, Orcamentos, SINAPI, Cronograma, Obras, Financeiro, Formação de preço e Relatorios.
- Em celular, a barra inferior original foi preservada e nenhum formulario foi reestruturado.
- Em tablets a partir de 768px o modo inicial passa a ser fluido; o usuário ainda pode selecionar a visualização de celular.
- Versão de frontend atualizada para 2.5.0.

## Validacao
Workflow `OrçaPro Browser Smoke` testa UI com um usuário fictício **somente no navegador CI**, intercepta exclusivamente a leitura remota (retorna lista vazia), valida que não aparecem erros e percorre menu desktop e mobile. Capturas ficam como artefatos da execução.

**Limitacao**: Este teste é visual/estrutural. Não é teste de operações com Supabase real. Os testes de criação, sincronização, login e restauração com credenciais reais ainda exigem ambiente isolado de homologação.
