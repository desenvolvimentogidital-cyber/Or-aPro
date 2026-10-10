# OrçaPro — refinamento mobile, web e relatórios (09/10/2026)

## Escopo implementado
- **Autenticação:** visual mobile e desktop renovado; benefícios reais da plataforma na tela larga; formulários legíveis em 320–430 px; controle acessível de mostrar/ocultar senha; feedback de erro e sucesso; login, cadastro, recuperação e sessão preservados. Nenhum provedor social fictício foi adicionado.
- **Navegação mobile:** seis atalhos continuam disponíveis (Início, Clientes, Novo, Orçamentos, Cronograma, Mais), agora ajustados a celulares estreitos e à área de gestos do sistema. A seleção de texto em relatórios e valores volta a funcionar; seleção automática mobile/web continua em 768 px.
- **Cronograma:** painel executivo preservado com Gantt mensal de rolagem horizontal interna e coluna de atividade fixa; dica de gesto no celular; tabela de serviços navegável por toque e teclado; Curva S em tamanho mínimo legível com rolagem interna. Nenhuma mudança em coeficientes SINAPI, fórmulas, medições, cálculo de datas ou formatos salvos.
- **Relatório para PDF:** ao preparar, a prévia passa a entrar em foco na área de rolagem. Permanece a impressão do iframe; há também o link **Abrir relatório em nova aba** (documento HTML temporário gerado localmente), alternativa para navegador Android que não imprime iframes. Na nova aba, imprimir/salvar como PDF é uma ação do navegador. Não são enviados dados a um serviço de PDFs e não há falsa promessa de download binário direto.

## Testes automáticos
- A suíte Chromium `test/e2e/auto-layout.mjs` cobre o formulário de login/cadastro/recuperação em 375 px, visibilidade da senha, passagem do cronograma pelo celular, largura de 320 a 767 px, acessibilidade dos quadros de rolagem, criação da prévia de PDF, link local para nova aba, web 1440 px e troca entre modos.
- `test/e2e/smoke.mjs` foi alinhado com os títulos da nova tela de autenticação.
- Continuam necessários `npm run lint`, `npm run test:logic`, `npm run build` e as ações CI, Browser Smoke e contrato PostgreSQL.

## Validação manual antes de publicar
1. Login, cadastro, redefinição de senha e logout com contas de **homologação** no Supabase real.
2. Abrir em Android Chrome (320/360/390/430 px), confirmar barra inferior e navegação sem rolagem horizontal da **página**. Usar Gantt/Curva S/tabela com rolagem somente interna.
3. Criar um orçamento de teste → vincular ao cronograma → importar SINAPI → registrar equipe, dependências e medição → atualizar e conferir dados persistidos. Sem dados reais de clientes nos testes.
4. Preparar PDF, usar impressão dentro do app no desktop e a opção de abrir em outra aba no Android; conferir capa, dados, páginas técnicas e que a opção do navegador salve PDF.
5. Validar permissões de contas distintas e sincronização/backup. Não alterar o banco sem plano de migração.

## Limitações que permanecem
- O envio do PDF é feito pelo usuário após salvar pelo navegador; não há envio automático de arquivo nem servidor de renderização de PDF.
- O sistema **não** faz nivelamento automático de equipes entre frentes paralelas nem calcula caminho crítico CPM; os prazos continuam estimativas.
- O comportamento de confirmação de e-mail depende da configuração do projeto Supabase, não pode ser desativado pela tela de login.
- Não foi alterado o Supabase (schema, RLS ou dados), nem rotas/endpoints, nem a autenticação.
