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
    assert.equal(await page.getByLabel('Senha',{exact:true}).getAttribute('minlength'), null,
      'Login existente não deve impedir senhas antigas de comprimento menor');
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await page.getByRole('heading', { name: 'Crie sua conta' }).waitFor();
    assert.equal(await page.getByLabel('Senha',{exact:true}).getAttribute('minlength'), '8',
      'Novos cadastros precisam de pelo menos oito caracteres');
    let signupCalls = 0;
    await page.route('**/auth/v1/signup**', async route => {
      signupCalls++;
      const address = new URL(route.request().url());
      assert.equal(address.searchParams.get('redirect_to'),
        new URL(base).origin + new URL(base).pathname, 'Link de confirmação deve apontar ao OrçaPro atual');
      assert.equal(JSON.parse(route.request().postData() ?? '{}').email, 'teste.cadastro@example.test');
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({user:{id:'test-only',email:'teste.cadastro@example.test'},session:null})
      });
    });
    await page.getByLabel('E-mail').fill('teste.cadastro@example.test');
    await page.getByLabel('Senha',{exact:true}).fill('TestPassword2026!');
    await page.getByRole('button', { name: 'Criar conta', exact:true }).click();
    await page.getByRole('status').getByText('Confira o e-mail informado', {exact:false}).waitFor();
    assert.equal(signupCalls, 1, 'Solicitação de cadastro deve ser enviada uma única vez');
    await page.getByRole('button', { name: 'Voltar ao login' }).click();
    await page.getByRole('heading', { name: 'Bem-vindo de volta' }).waitFor();
    await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
    await page.getByRole('heading', { name: 'Recupere o acesso' }).waitFor();
    assert.deepEqual(errors, [], 'Sem excecoes JS no fluxo de navegacao de autenticacao');
    console.log(`PASS browser smoke ${viewport.width}x${viewport.height}`);
    await page.close();
  }
  // Direct registration link opens a blank new-account form, without touching old workspaces.
  const signupPage = await browser.newPage();
  await signupPage.goto(base+'?cadastro=1', { waitUntil:'domcontentloaded' });
  await signupPage.getByRole('heading', { name: 'Crie sua conta' }).waitFor();
  await signupPage.close();
  const page = await browser.newPage();
  await page.goto(base+'?proposta=token-invalido', { waitUntil:'domcontentloaded' });
  await page.getByRole('alert').waitFor({ timeout: 10000 });
  console.log('PASS resposta clara a proposta invalida');
  await page.close();
} finally {
  await browser.close();
}
