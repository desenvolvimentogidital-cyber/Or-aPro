# OrçaPro — layout automático mobile e web

## Comportamento ao entrar

A mesma URL de produção serve dois layouts, selecionados pela largura real da janela:

- **Celular / viewport com menos de 768 px:** aplicativo mobile em tela cheia, sem moldura artificial, com rolagem do conteúdo e menu inferior. O item **Cronograma** agora abre diretamente o painel executivo de obras, mesmo no celular.
- **Tablet amplo e computador / viewport de 768 px ou mais:** layout web fluido. A partir de 1024 px aparece o menu lateral e o conteúdo ocupa o espaço restante. O cronograma utiliza largura ampliada para Gantt, tabelas e gráficos.
- **Rotação do telefone ou redimensionamento do navegador:** o modo se ajusta automaticamente ao cruzar 768 px. Não exige limpar cache, alterar configurações, fazer logout ou criar contas diferentes.
- **Pré-visualização pelo computador:** os botões Celular e Fluido permanecem disponíveis para conferir voluntariamente o layout mobile/web. Essa seleção manual não é interrompida por pequenas alterações da largura, mas ao cruzar o breakpoint o modo automático volta a refletir o tamanho atual.

## Dados e módulos preservados

O login, Supabase, sessões, clientes, orçamentos, cronograma, composições SINAPI, equipes, medições, físico-financeiro, PDF e backup são **os mesmos**, independentemente do tamanho da tela. A troca de visualização não modifica dados, tabelas, endpoints nem chama API especial. O início do aplicativo após login continua sendo a tela inicial; para abrir o painel de obras toque em **Cronograma** no rodapé mobile ou **Cronograma SINAPI** no menu lateral web.

## Validação automática

O Chromium inicia na largura de telefone, verifica que a área mobile ocupa toda a largura e que o rodapé abre o cronograma; repete em 375, 390, 430 e 767 px. Em seguida testa 768 px (tablet), 1440 px (web), alternância manual Celular/Fluido e redimensionamento de volta ao telefone sem perda do cronograma. Os testes executam com API REST interceptada em memória; não acessam o banco de produção.

O botão para gerar PDF usa o mesmo relatório A4 paisagem em ambas as visualizações; não há duas versões divergentes dos cálculos.
