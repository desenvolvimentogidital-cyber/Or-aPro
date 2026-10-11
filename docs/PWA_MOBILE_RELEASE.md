# OrçaPro — instalação pelo celular (PWA) e checklist de finalização

## Instalação
- Android Chrome: abrir `https://or-a-pro-seven.vercel.app`, tocar em **Instalar app**, e confirmar a instalação do navegador. Se a instalação direta não for oferecida, usar menu **⋮ > Instalar app / Adicionar à tela inicial**.
- Samsung Internet: usar o menu para adicionar ou instalar.
- iPhone Safari / navegadores compatíveis: **Compartilhar > Adicionar à Tela de Início**.
- A instalação cria um atalho/app com janela própria, não um APK baixado e não depende da Play Store. Recursos locais dependem do navegador/dispositivo.

## Escopo e segurança
- Manifesto HTTPS, ícones PNG 192/512 e maskable 512, tela inicial standalone, cores de marca.
- Botão de instalação usa o evento real `beforeinstallprompt`; quando indisponível, fornece instruções, sem simular a instalação.
- Service worker recebe somente navegações, faz **network-first** e guarda apenas a tela pública `offline.html`.
- Orçamentos, sessão, dados de clientes, PDF compartilhados, API Supabase e arquivos pessoais nunca são cacheados pelo worker.
- Com a internet indisponível, a tela informa que é necessária conexão para acessar/alterar dados; o OrçaPro **não é um editor offline**.
- Atualizações de versão: `sw.js` servido sem cache e nunca faz cache de `index.html`/arquivos JS; próxima abertura online usa o build novo.

## Critérios de aceite de pré-lançamento
- [x] Instalação PWA implementada no código, com fluxo Android e alternativa iOS.
- [x] Manifesto, favicon, ícones 192/512 e maskable; gerador determinístico sem dependência.
- [x] Proteção de dados contra cache do service worker; página offline explicita limite.
- [x] Testes automatizados do fluxo de instalação e dos requisitos PWA (ver CI).
- [ ] Publicação de produção do commit que inclui PWA e os 9.136 serviços SINAPI (conferir SHA pelo Vercel antes de marcar).
- [ ] Teste manual com instalação real em Chrome Android e Samsung Internet, com logout/login, refresh, PDF, câmera/arquivo e atualização do app instalado.
- [ ] Teste manual iOS: Adicionar à Tela de Início, splash, teclado e safe area, caso iPhone seja alvo.
- [ ] Teste ponta a ponta autenticado no domínio de produção com dados de QA, verificando Supabase, orçamento, SINAPI, cronograma, persistência e erro de sincronização, sem misturar contas pessoais.
- [ ] Revisão operacional de cotas/deploy Vercel, configuração do repositório e alertas; garantir que o deploy de `main` não fique retido em prévias.
- [ ] Auditoria final de segurança e performance da produção com o fluxo real, incluindo políticas RLS, autenticação e links de propostas públicas.

## Observações
Sem instalar via Play Store. A instalação depende de HTTPS, navegador compatível, heurísticas de engajamento e decisões do próprio usuário. Serviços SINAPI listados na base são composições **analíticas** (9.136 válidas em 09/2026), não necessariamente todas as linhas/insumos da planilha. A precificação comercial não decorre automaticamente das horas-homem.
