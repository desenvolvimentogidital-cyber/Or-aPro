import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

/**
 * Contrato de persistencia de interface. API REST em memoria com revision CAS.
 * Nenhuma requisicao e enviada ao Supabase real e nenhum dado e publicado.
 * Nao substitui teste end-to-end em projeto Supabase de homologacao.
 */
const origin = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000/';
const account = {
  access_token: 'contract-test-not-an-auth-token',
  refresh_token: 'contract-test-not-an-auth-token',
  expires_at: Date.now() + 60 * 60 * 1000,
  user: { id: '00000000-0000-4000-8000-000000000001', email: 'qa@example.invalid' }
};
const server = { payload: null, revision: 0, writes: 0, rejectWrites: false };
const headers = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
  'content-type': 'application/json'
};
async function waitUntil(check, message) {
  const deadline = Date.now() + 12_000;
  while (!check()) {
    if (Date.now() > deadline) throw Error(message);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
function reply(route, payload, status = 200) {
  return route.fulfill({ status, headers, body: JSON.stringify(payload) });
}
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.addInitScript(value => {
    sessionStorage.setItem('orcapro_cloud_session', JSON.stringify(value));
  }, account);
  await page.route('**/rest/v1/orcapro_workspaces**', async route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return reply(route, {}, 200);
    if (req.method() === 'GET') {
      return reply(route, server.payload ? [{ payload: server.payload, revision: server.revision }] : []);
    }
    const body = JSON.parse(req.postData() || '{}');
    if (server.rejectWrites) return reply(route, []);
    if (req.method() === 'POST' && server.revision === 0) {
      server.payload = structuredClone(body.payload);
      server.revision = 1;
      server.writes++;
      return reply(route, [{ revision: server.revision }]);
    }
    if (req.method() === 'PATCH') {
      const requested = new URL(req.url()).searchParams.get('revision');
      if (requested !== 'eq.' + server.revision) return reply(route, []);
      if (body.revision !== server.revision + 1) return reply(route, []);
      server.payload = structuredClone(body.payload);
      server.revision = body.revision;
      server.writes++;
      return reply(route, [{ revision: server.revision }]);
    }
    throw Error('Metodo inesperado no contrato REST: ' + req.method());
  });
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.getByRole('navigation', { name: 'Navegação desktop' }).waitFor({ timeout: 15_000 });
  await page.getByText('Dados na nuvem').first().waitFor();
  await page.waitForTimeout(900);
  assert.equal(server.writes, 0, 'abrir um workspace vazio nao pode gerar escrita');

  const nav = page.getByRole('navigation', { name: 'Navegação desktop' });
  await nav.getByRole('button', { name: 'Clientes' }).click();
  await page.getByTitle('Adicionar Cliente').click();
  await page.getByPlaceholder('Ex: Maria Silva').fill('Cliente QA - persistencia');
  await page.getByPlaceholder('(11) 98765-4321').fill('(11) 99999-1111');
  await page.getByRole('button', { name: 'Salvar Cliente' }).click();
  await waitUntil(() => server.payload?.clients?.length === 1, 'cliente nao foi persistido pelo POST/PATCH');
  assert.equal(server.payload.clients[0].name, 'Cliente QA - persistencia');
  console.log('PASS cliente salvo em API REST simulada');

  await nav.getByRole('button', { name: 'Financeiro' }).click();
  await page.getByLabel('Valor (R$)').fill('130,25');
  await page.getByLabel('Categoria').fill('Teste QA');
  await page.getByLabel('Descrição').fill('Movimentacao QA');
  await page.getByRole('button', { name: 'Salvar movimentação real' }).click();
  await waitUntil(() => server.payload?.financeEntries?.length === 1, 'movimentacao nao foi persistida');
  assert.equal(server.payload.financeEntries[0].amount, 130.25);
  assert.equal(server.payload.financeEntries[0].type, 'recebimento');
  console.log('PASS movimentacao salva em API REST simulada');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('navigation', { name: 'Navegação desktop' }).waitFor();
  await page.getByRole('navigation', { name: 'Navegação desktop' }).getByRole('button', { name: 'Clientes' }).click();
  await page.getByText('Cliente QA - persistencia').waitFor();
  await page.getByRole('navigation', { name: 'Navegação desktop' }).getByRole('button', { name: 'Financeiro' }).click();
  await page.getByText('Movimentacao QA').waitFor();
  console.log('PASS dados restaurados apos reload de pagina');

  await page.getByRole('button', { name: 'Backup', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar dados em JSON' }).click();
  const file = await downloadPromise;
  assert.ok(file.suggestedFilename().endsWith('.json'));
  const backup = JSON.parse(await readFile(await file.path(), 'utf8'));
  assert.equal(backup.format, 'orcapro-backup-v1');
  assert.equal(backup.data.clients.length, 1);
  assert.equal(backup.data.financeEntries.length, 1);
  backup.data.clients.push({
    ...backup.data.clients[0], id: 'cli-test-restore-2', name: 'Cliente QA Restaurado'
  });
  page.once('dialog', dialog => dialog.accept());
  await page.locator('input[type=file]').setInputFiles({
    name: 'orcapro-qa.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))
  });
  await waitUntil(() => server.payload?.clients?.length === 2, 'restauracao nao foi persistida no REST');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('navigation', { name: 'Navegação desktop' }).getByRole('button', { name: 'Clientes' }).click();
  await page.getByText('Cliente QA Restaurado').waitFor();
  console.log('PASS exportacao e restauracao persistidas apos reload');

  // Simula conflito CAS que o Supabase retornaria como PATCH com zero linhas.
  // O aplicativo deve exibir erro em vez de confirmar escrita inexistente.
  server.rejectWrites = true;
  await page.getByTitle('Adicionar Cliente').click();
  await page.getByPlaceholder('Ex: Maria Silva').fill('Cliente conflitante QA');
  await page.getByPlaceholder('(11) 98765-4321').fill('(11) 99999-2222');
  await page.getByRole('button', { name: 'Salvar Cliente' }).click();
  await page.getByText('Erro de sincronização').first().waitFor({ timeout: 12_000 });
  assert.equal(server.payload.clients.length, 2, 'falha CAS nao pode sobrescrever servidor');
  assert.deepEqual(pageErrors, [], 'nao pode ocorrer excecao JavaScript silenciosa');
  console.log('PASS conflito reportado ao usuario; registros do servidor preservados');
} finally {
  await browser.close();
}
