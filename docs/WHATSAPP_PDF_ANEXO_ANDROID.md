# OrçaPro — compartilhamento de orçamento PDF no WhatsApp (Android)

## Problema reproduzido no código anterior
O botão de envio da prévia abria `https://wa.me/<numero>?text=<resumo>`. O protocolo `wa.me` suporta preparar uma mensagem de texto, **não anexar bytes PDF**. Por isso o cliente recebia somente a descrição da proposta.

## Nova implementação
- Em **Orçamentos → Visualizar → Enviar → Enviar PDF pelo WhatsApp**, o OrçaPro gera **um arquivo PDF A4 verdadeiro** no próprio navegador, com texto selecionável, paginação, identificação da empresa/cliente, quantitativos, itens, totais, observações/pagamentos e assinaturas conforme os controles de exibição do orçamento.
- `src/utils/quotePdfFile.ts`: gerador leve de PDF vetorial (Helvetica WinAnsi), sem CDN, terceiros, cookies ou envio de dados a servidor. O PDF otimizado para anexo tem layout próprio compacto; a prévia e impressão premium anterior continuam disponíveis em **Salvar como PDF / Imprimir**, sem modificação.
- `navigator.share({files:[file]})` abre a folha nativa do **Android**. O usuário deve escolher WhatsApp, selecionar a conversa do destinatário e confirmar o envio; o navegador **não** pode predefinir o contato nem concluir o envio por conta própria.
- Se o navegador não permitir compartilhar arquivos (por exemplo, webview, desktop ou permissão recusada), é disponibilizado o comando **Baixar PDF para anexar manualmente**; ao acioná-lo, o usuário abre a conversa do cliente e usa **Anexar → Documento**.
- Não há mudança automática para status **enviado**, porque abrir o menu de compartilhamento não confirma entrega.
- O link público de aprovação de 30 dias e as opções de impressão/edição continuam separados.
- Não depende de telefone pré-cadastrado para abrir o seletor Android, pois o destinatário é escolhido manualmente no WhatsApp.
- Os valores da proposta não são recalculados, e visibilidade de itens, unidades, preços, total, termos, Pix e assinatura é respeitada.

## Testes
- `test/quote-pdf-share.test.mjs`: assinatura `%PDF`, metadados A4, offsets da tabela xref, páginas múltiplas, texto acentuado WinAnsi, controle de confidencialidade de dados ocultados, nome seguro e tipo `application/pdf`.
- `test/e2e/whatsapp-pdf.mjs`: Chromium em 390 px e REST simulado; `navigator.share` interceptado confirma que o navegador entrega **File PDF real**, não URL de texto, e o fallback permite download com nome correto. Nenhuma mensagem é enviada ao WhatsApp nos testes.
- CI: lint, testes lógicos, build, Browser Smoke e contrato PostgreSQL.

## Limites de experiência
- Não é possível abrir a conversa específica do cliente **e** anexar o arquivo automaticamente apenas com Web Share API: o usuário escolhe a conversa na tela nativa.
- O modelo de PDF enviado como anexo é **compacto e vetorial**; a impressão existente conserva seu layout avançado preto/laranja com imagens. A versão de anexo não inclui imagens dos itens ou logotipo, mas mantém o texto e os valores visíveis do orçamento.
- Se o usuário quiser envio completamente automático para um número específico, seria necessária uma integração autorizada com a **WhatsApp Business Platform** e hospedagem segura de mídia, com permissões e obrigações legais próprias. Não foi habilitada nenhuma API de WhatsApp.
- A Vercel apresentou bloqueio por limite de builds em versões anteriores; fazer merge/deploy uma única vez, após CI verde e com liberação da cota.
