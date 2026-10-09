# OrçaPro — Homologação autenticada real (ambiente seguro)

O novo fluxo manual do GitHub Actions `OrçaPro QA — Autenticado no Supabase Real` inicia o aplicativo localmente, usando **exclusivamente** o Supabase QA `obokqubntggrgqqmflhx`.

## Pré-requisitos antes da primeira execução

1. Abra **Supabase OrçaPro-Homologacao** → **Authentication** → **URL Configuration**:
   - **Site URL**: `https://or-a-pro-git-homo-d458b5-desenvolvimentogidital-cybers-projects.vercel.app`
   - **Redirect URLs**: inclua `https://or-a-pro-git-homo-d458b5-desenvolvimentogidital-cybers-projects.vercel.app/**`.
   - Isso não altera a configuração do Supabase de produção.
2. Crie uma conta **exclusivamente QA** pela tela de cadastro na Preview Vercel, confirme-a pelo e-mail e faça login uma vez para comprovar o fluxo. Se a Vercel exigir login por proteção da Preview, autentique-se primeiro na Vercel.
3. A conta QA deve estar **sem nenhum dado** (sem clientes, orçamentos, cronogramas, itens de catálogo, notificações ou lançamentos). O teste abortará sem alterar nada se existirem registros.
4. No repositório GitHub → **Settings → Secrets and variables → Actions** → **New repository secret**, configure os quatro segredos:
   - `QA_SUPABASE_URL`: `https://obokqubntggrgqqmflhx.supabase.co`
   - `QA_ANON_KEY`: **somente** a chave pública publishable do Supabase QA (aba Settings/API Keys); nunca `service_role`.
   - `QA_EMAIL`: email da conta QA verificada (não usar email pessoal).
   - `QA_PASSWORD`: senha da conta QA verificada.
5. GitHub → **Actions → OrçaPro QA — Autenticado no Supabase Real → Run workflow** (branch `main`). A execução é manual para evitar gravações acidentais durante desenvolvimento.

## Cobertura

- Login real via GoTrue na conta QA;
- Cliente cadastrado, salvo e reaberto após reload;
- Recebimento de R$13,25 registrado e recuperado após reload — é **dado QA** e nunca pagamento real;
- Navegação desktop nos módulos sem erros JavaScript;
- Backup JSON do estado vazio inicial, restauração e conferência de que os dados QA foram removidos.

Proteções: URL do Supabase precisa corresponder exatamente ao projeto QA. A execução aborta em conta não vazia. Em caso de falha após criar dados, tenta restaurar o backup original. Nunca imprime ou armazena segredos nos logs/artefatos.

## O que NÃO fica aprovado automaticamente

- Verificação de e-mail e recuperação de senha via caixa de entrada não são automatizadas; devem ser comprovadas manualmente pela conta QA.
- Aceite de link público válido com Chromium usando token real, importação SINAPI pela UI, medição de obra, criação de orçamento completo e PDFs via sessão QA ainda exigem testes adicionais.
- Este fluxo não deve ser executado contra produção. Não usar usuário, senha ou chave service_role da produção.

## Segurança do projeto

A Preview permanece protegida pela autenticação da Vercel. A função pública de aceite de proposta continua intencionalmente acessível por token UUID e ainda requer revisão de ameaça e rate limiting para lançamento. A proteção contra senhas vazadas no Supabase de produção precisa ser verificada no painel Auth.
