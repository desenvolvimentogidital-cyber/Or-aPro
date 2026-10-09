# OrçaPro — Homologação real isolada (2026-10-09)

## Infraestrutura criada
- Organização Supabase: desenvolvimentogidital (Free).
- Banco separado: **OrçaPro-Homologacao** — `obokqubntggrgqqmflhx`, São Paulo (`sa-east-1`).
- Custo de criação do novo projeto confirmado pelo Supabase: **US$ 0/mês**.
- Migração real aplicada: `initial_orcapro_schema_homologacao`, extraída de `supabase/schema.sql`.
- Vercel: **Preview** da branch `homologacao-supabase`; URL `https://or-a-4s2nhkedd-desenvolvimentogidital-cybers-projects.vercel.app`.
- `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` configuradas **apenas para essa branch de Preview**, sem modificar os valores de produção.
- Produção mantém `https://or-a-pro-seven.vercel.app`, vinculada à branch `main` e ao Supabase original.

## Testes executados no Supabase de homologação (banco hospedado real)
1. Tabelas `orcapro_workspaces` e `orcapro_shared_quotes` presentes, ambas com RLS ativo.
2. Workspace e tokens privados invisíveis e não atualizáveis por outro usuário (identidades QA transacionais).
3. Rejeição de token malformado, inexistente e expirado.
4. Leitura de proposta válida e aprovação exatamente uma vez; recusa de segunda decisão.
5. Status de orçamento atualizado, número de revisão incrementado e notificação gerada.
6. Criação, leitura e atualização de cliente e lançamento financeiro com revisão otimista.
7. Proteção contra sobrescrita por revisão obsoleta (CAS não afeta dados).
8. Restauração de dados por revisão nova e verificação de leitura.
9. **Transações revertidas com ROLLBACK**; confirmada a ausência de workspaces, links e usuários QA após os testes.

## GitHub Actions já aprovado antes desta rodada
- 106 testes de lógica, build/TypeScript, testes Playwright e PostgreSQL local.

## Pendências para liberar produção comercial
- Testes no navegador com **conta de homologação real**: cadastro, verificação por e-mail, login, criação de cliente e orçamento, SINAPI, obras, medição, financeiro, compartilhamento/aprovação válida por URL, PDF, backup e recuperação de senha.
- Conferir no painel Supabase **Authentication > URL Configuration** o Site URL e redirect URLs da Preview; a conexão administrativa disponível não oferece ação de alteração dessas configurações.
- Preview da Vercel mantém a proteção de acesso habilitada; não remover globalmente para facilitar testes.
- Avaliar avisos Supabase de duas funções públicas `SECURITY DEFINER`. São executáveis intencionalmente por token; revisar ameaça de abuso antes do lançamento.
- Verificar configuração da proteção contra senhas vazadas no Auth, inclusive na produção.
- Evitar colocar senhas de usuário, `service_role`, tokens privados ou dados financeiros reais no GitHub.

**Veredito atual:** base e segurança SQL validadas; homologação funcional autenticada no navegador permanece **parcial**. A plataforma **não deve ser declarada 100% aprovada para lançamento** antes da validação dos fluxos restantes.
