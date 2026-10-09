# OrçaPro 1.3 — implementação do modelo de PDF da referência

## Escopo implementado

- Documento de impressão próprio `src/utils/quoteDocument.ts` (não reaproveita a tela do aplicativo para impressão).
- A4 com fundo azul-marinho/preto, acentos e raios laranja, logotipo, bloco de orçamento, dois blocos Empresa/Cliente, separação de Serviços e Produtos, detalhes monetários, observações, área de assinatura e rodapé.
- Cores secundárias para os dois modelos já existentes no projeto. O modelo Padrão é o preto/laranja da imagem.
- Renderização real com informações gravadas no aplicativo; nenhum nome, imagem, valor financeiro, foto de produto, prazo ou assinatura do exemplo foi embutido no projeto.
- Upload opcional de logotipo em Dados da Empresa e de fotografias em Catálogo. Imagens JPG/PNG/WebP são comprimidas no navegador antes de integrar o JSON autenticado.
- Campo opcional `Quote.executionDeadline`, prazo válido editável, condição de pagamento e observações editáveis.
- Itens de orçamento preservam `imageUrl` como instantâneo do catálogo. O formato anterior de orçamentos permanece compatível por campos opcionais.
- O documento é exibido em iframe independente, com a mesma marcação HTML/CSS que é enviada à impressora/salvador de PDF.
- Regras `@page size:A4`, `break-inside:avoid-page` em cartões e linhas de tabelas; cabeçalhos das tabelas se repetem quando permitido pelo renderizador.
- Textos escapados para HTML e fontes de imagens validadas (PNG/JPEG/WebP base64 ou HTTPS).
- Ações não inventadas: assinatura é linha em branco, não aceite digital; botão de PDF usa o comando nativo de impressão do navegador.

## Verificações efetuadas

- `npm run test:logic`: **21 de 21 testes passando**, incluindo 5 novos testes de estrutura e segurança do documento.
- Parser TypeScript/TSX (sem bibliotecas externas): **32 arquivos, nenhum erro sintático**.
- Renderização de QA em WeasyPrint a partir do gerador HTML: caso com 3 itens em **1 página A4**; caso com 72 itens em **5 páginas A4**, com todos os 72 nomes extraíveis do PDF e observações/assinaturas no final.
- As informações comerciais usadas apenas na verificação de layout são dados de teste externos, fora do pacote distribuído.

## Restrições de validação

- `npm run lint` (TypeScript completo) e `npm run build` dependem de `npm install` e **não foram concluídos** neste ambiente sem dependências.
- A opção **Salvar como PDF** é do próprio navegador; não existe API de PDF no servidor nem arquivo gerado automaticamente por back-end.
- Renderizações automatizadas foram verificadas com WeasyPrint (equivalente de QA). A impressão nativa deve ser conferida no Chrome/Edge e em aparelhos Android antes do lançamento.
- A sincronização/auth não foi executada contra um Supabase real, pois não foram fornecidas credenciais.

## Arquivos modificados

- `src/utils/quoteDocument.ts` (novo), `src/utils/imageUpload.ts` (novo)
- `src/components/quotes/QuotePreviewModal.tsx`, `src/components/quotes/QuoteBuilderView.tsx`
- `src/components/company/CompanySettingsView.tsx`, `src/components/catalog/CatalogView.tsx`
- `src/components/models/QuoteModelsView.tsx`, `src/types/index.ts`, `src/index.css`
- `test/pdf-document.test.mjs` (novo), `package.json`, `README.md`

Nenhum deploy feito. Arquivo original anterior mantido intacto.
