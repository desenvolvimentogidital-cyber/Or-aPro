import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const base = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000/';
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    const res = await page.goto(base, { waitUntil: 'domcontentloaded' });
    assert.equal(res?.status(), 200, 'A interface precisa responder HTTP 200');
    await page.getByRole('heading', { name: 'Bem-vindo de volta' }).waitFor();
    await page.getByLabel('E-mail').waitFor();
    await page.getByLabel('Senha',{exact:true}).waitFor();
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await page.getByRole('heading', { name: 'Crie sua conta' }).waitFor();
    await page.getByRole('button', { name: 'Voltar ao login' }).click();
    await page.getByRole('heading', { name: 'Bem-vindo de volta' }).waitFor();
    await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
    await page.getByRole('heading', { name: 'Recupere o acesso' }).waitFor();
    assert.deepEqual(errors, [], 'Sem excecoes JS no fluxo de navegacao de autenticacao');
    console.log(`PASS browser smoke ${viewport.width}x${viewport.height}`);
    await page.close();
  }
  const page = await browser.newPage();
  await page.goto(base+'?proposta=token-invalido', { waitUntil:'domcontentloaded' });
  await page.getByRole('alert').waitFor({ timeout: 10000 });
  console.log('PASS resposta clara a proposta invalida');
  await page.close();
} finally {
  await browser.close();
}
