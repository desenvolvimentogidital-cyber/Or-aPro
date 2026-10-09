# OrçaPro v2.4.1 — publicação de homologação

## GitHub

O repositório solicitado é https://github.com/desenvolvimentogidital-cyber/Or-aPro.git (público).

1. Extraia esta pasta no Windows e abra o PowerShell na pasta onde está `package.json`.
2. Instale o [Git para Windows](https://git-scm.com/download/win), se necessário, e confirme `git --version`.
3. Confira a identidade do commit (`git config user.name`, `git config user.email`). Se não houver identidade, configure a do seu GitHub.
4. Execute `powershell -NoProfile -ExecutionPolicy Bypass -File .\PUBLICAR_GITHUB.ps1`.
5. Quando solicitado, autentique-se no GitHub pelo fluxo oficial do Git Credential Manager. Nunca cole seu token na conversa.
6. O script só faz o primeiro envio se o repositório remoto continuar **sem commits**. Não usa push forçado.

`.env.local` foi removido deste pacote e está ignorado pelo `.gitignore`. As chaves públicas do Supabase devem ser adicionadas nas variáveis de ambiente da Vercel, não no repositório.

## Vercel

1. No painel da Vercel, selecione a conta ou equipe autorizada e **Add New > Project**.
2. Import Git Repository: `desenvolvimentogidital-cyber/Or-aPro`.
3. Framework Vite; root `./`; Build command automático por `vercel.json` (`npm run lint && npm run test:logic && npm run build`); output `dist`.
4. Adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com a URL e a chave **publishable** do projeto Supabase OrçaPro. Marque Preview e Production. **Nunca** use `service_role`, senha do banco ou chave secreta em variáveis `VITE_`.
5. Faça deploy. No Supabase Authentication > URL Configuration, cadastre o endereço correto da Vercel em Site URL / Redirect URLs antes de testar recuperação de senha. Ajuste outras configurações de autenticação somente após revisar a segurança.
6. Teste login, um orçamento de TESTE, PDF, cronograma SINAPI, backup, RLS e link de proposta. Não use dados de clientes reais durante a homologação.

Observação: o projeto Supabase atual é compartilhado com a versão local. Para isolamento pleno dos testes, crie posteriormente um projeto Supabase separado de homologação e aplique o esquema de forma segura.

## Status de segurança

Antes de comercializar, revisar avisos das funções públicas `SECURITY DEFINER` e a proteção de senhas vazadas no Supabase. Aprovação por posse de link não é assinatura de identidade verificada.
