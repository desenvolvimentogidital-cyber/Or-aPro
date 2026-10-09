# Homologação de persistência no navegador

O arquivo `test/e2e/persistence-contract.mjs` executa uma jornada de interface em Chromium com um serviço REST **inteiramente em memória**, sem comunicação com o Supabase de produção.

Verifica:
1. Abrir um workspace vazio sem criar gravação desnecessária;
2. Criar cliente e confirmar POST/PATCH com revisão;
3. Registrar recebimento informado e conferir valor;
4. Recarregar a página e recuperar ambos os registros;
5. Exportar backup, restaurar conteúdo adicional e confirmar nova gravação e recarga;
6. Forçar falha de atualização CAS (0 linhas) e confirmar mensagem de conflito e preservação do servidor.

O cliente e os valores utilizados são exclusivamente dados de teste, não cadastros da aplicação publicada. **Não afirma que o Supabase real foi homologado**.

## Para finalizar a homologação autenticada

Será necessário um ambiente Supabase de homologação independente, com conta de teste e configuração de segredos nas variáveis do GitHub Actions. Esse recurso depende da disponibilidade/custo de um segundo projeto ou branch Supabase e deve ser autorizado previamente.

Nenhuma credencial real deve ser adicionada ao repositório ou registrada em logs.
