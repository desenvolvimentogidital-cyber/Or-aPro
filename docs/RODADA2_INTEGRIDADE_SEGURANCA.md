# Rodada 2 — integridade e seguranca
Corrigido: restauracao JSON e migracao do navegador devem preservar a assinatura do ultimo documento efetivamente salvo no Supabase. Os dados importados passam a ser uma edicao pendente e provocam salvamento, e a operacao so e permitida se o estado anterior estiver com sincronizacao concluida.

Adicionados cinco testes de regressao e cabeçalhos X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy e Permissions-Policy na Vercel.

**Limites conhecidos**: testes automáticos de conflito simultaneo multiaba e de recuperacao de backup em Supabase isolado ainda nao foram executados. Funcoes SECURITY DEFINER de proposta publica seguem em revisao; os avisos do Security Advisor sao observados como pendentes, sem revogar intencionalmente os links publicos. A protecao contra senhas vazadas requer acao no Auth do projeto, fora deste PR.
