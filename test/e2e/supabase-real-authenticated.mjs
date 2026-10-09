import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Executa SOMENTE contra o projeto Supabase isolado criado para homologacao.
// Nunca apontar este teste autenticado para a producao.
const qaOrigin = 'https://obokqubntggrgqqmflhx.supabase.co';
const actual = (process.env.QA_SUPABASE_URL ?? '').replace(/\/$/, '');
assert.equal(actual, qaOrigin, 'BLOQUEADO: Supabase diferente do ambiente exclusivo de homologacao');
assert.ok(process.env.QA_EMAIL && process.env.QA_PASSWORD, 'Configure QA_EMAIL e QA_PASSWORD nos segredos do GitHub Actions');
assert.ok(process.env.QA_ANON_KEY?.startsWith('sb_publishable_') || process.env.QA_ANON_KEY?.startsWith('eyJ'), 'Configure somente a chave publicavel QA, nunca service_role');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const testSuffix = String(Date.now());
const qaClient = 'QA-E2E-Cliente-'+testSuffix;
const qaFinance = 'QA-E2E-Recebimento-'+testSuffix;
let original = null;
let changed = false;
let restored = false;
let loggedIn = false;
let cleanupError = null;
const base = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000/';
const nav = page.getByRole('navigation', {name:'Navegação desktop'});
const saved = page.getByText('Dados na nuvem').first();

async function waitSaved() {
  // Garante que o debounce e uma eventual atualizacao REST ja tiveram tempo de iniciar.
  await page.waitForTimeout(900);
  await saved.waitFor({timeout:15_000});
}

async function restoreOriginal() {
  if (!original) return;
  const backupButton=page.getByRole('button',{name:'Backup',exact:true});
  if (!(await page.getByRole('dialog',{name:'Backup de dados'}).isVisible().catch(()=>false))) await backupButton.click();
  page.once('dialog', d=>d.accept());
  await page.locator('input[type=file]').setInputFiles({
    name:'orcapro-qa-baseline.json', mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(original))
  });
  await waitSaved();
  await page.getByRole('button',{name:'Fechar'}).click();
}
try {
  const response = await page.goto(base,{waitUntil:'domcontentloaded'});
  assert.equal(response?.status(),200);
  await page.getByLabel('E-mail').fill(process.env.QA_EMAIL);
  await page.getByLabel('Senha').fill(process.env.QA_PASSWORD);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await nav.waitFor({timeout:20_000});
  await saved.waitFor({timeout:20_000});
  loggedIn = true;

  await page.getByRole('button',{name:'Backup',exact:true}).click();
  const d=page.waitForEvent('download');
  await page.getByRole('button',{name:'Exportar dados em JSON'}).click();
  const download=await d;
  original=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.equal(original.format,'orcapro-backup-v1');
  // Nunca sobrescrever a conta de alguem: somente uma conta QA VAZIA.
  for (const prop of ['quotes','clients','catalog','expenses','notifications','schedules','financeEntries']) {
    assert.equal(original.data[prop]?.length ?? 0,0,'A conta QA deve estar vazia antes da jornada: '+prop);
  }
  await page.getByRole('button',{name:'Fechar'}).click();

  await nav.getByRole('button',{name:'Clientes'}).click();
  await page.getByTitle('Adicionar Cliente').click();
  await page.getByPlaceholder('Ex: Maria Silva').fill(qaClient);
  await page.getByPlaceholder('(11) 98765-4321').fill('(11) 99999-0000');
  await page.getByRole('button',{name:'Salvar Cliente'}).click();
  changed=true;
  await waitSaved();
  await page.reload({waitUntil:'domcontentloaded'});
  await saved.waitFor({timeout:20_000});
  await nav.getByRole('button',{name:'Clientes'}).click();
  await page.getByText(qaClient).waitFor({timeout:10_000});
  console.log('PASS real Supabase: cliente criado, salvo e recuperado apos reload');

  await nav.getByRole('button',{name:'Financeiro'}).click();
  await page.getByLabel('Valor (R$)').fill('13,25');
  await page.getByLabel('Categoria').fill('Homologacao automatizada');
  await page.getByLabel('Descrição').fill(qaFinance);
  await page.getByRole('button',{name:'Salvar movimentação real'}).click();
  await waitSaved();
  await page.reload({waitUntil:'domcontentloaded'});
  await saved.waitFor({timeout:20_000});
  await nav.getByRole('button',{name:'Financeiro'}).click();
  await page.getByText(qaFinance).waitFor({timeout:10_000});
  console.log('PASS real Supabase: lançamento criado, salvo e recuperado apos reload');

  // Navegacao de modulos sem alteracao de dados.
  for(const name of ['Orçamentos','Novo orçamento','Cronograma SINAPI','Obras','Relatórios','Financeiro']){
    await nav.getByRole('button',{name,exact:true}).click();
    await page.waitForTimeout(100);
  }
  assert.deepEqual(errors, [], 'Nao deve haver erros JS na jornada autenticada');
  console.log('PASS navegacao autenticada de modulos');

  await restoreOriginal();
  restored=true;
  await page.reload({waitUntil:'domcontentloaded'});
  await saved.waitFor({timeout:20_000});
  await nav.getByRole('button',{name:'Clientes'}).click();
  assert.equal(await page.getByText(qaClient).count(),0,'Cliente QA ficou apos restauracao');
  await nav.getByRole('button',{name:'Financeiro'}).click();
  assert.equal(await page.getByText(qaFinance).count(),0,'Financeiro QA ficou apos restauracao');
  console.log('PASS restore do baseline: nenhum registro de teste persistiu');
} finally {
  if (changed && !restored && loggedIn && original) {
    try {
      await restoreOriginal();
      console.log('CLEANUP: baseline restaurado apos erro de teste');
    } catch(err) {
      cleanupError=err;
      console.error('ATENCAO: falha ao restaurar baseline; revise a conta exclusiva de QA');
    }
  }
  await browser.close();
  if(cleanupError)throw new Error('Falha na limpeza da conta QA; verifique antes de reutilizar a conta');
}
