import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the shipped app has no seeded fictitious business dataset', () => {
  assert.equal(existsSync(new URL('../src/data/initialData.ts', import.meta.url)), false);
  const ctx = source('src/context/AppContext.tsx');
  for (const name of ['quotes','clients','catalog','expenses','notifications']) {
    assert.match(ctx, new RegExp(`const \\[${name}, set`, 'i'));
    assert.match(ctx, new RegExp(`set[A-Za-z]*\\] = useState<[^>]*>\\(\\[\\]\\)`));
  }
  const d = source('src/data/defaults.ts');
  assert.match(d, /name: '', tradeName: ''/);
  assert.doesNotMatch(d, /@(gmail|hotmail|outlook)\.com|Elétrica Plus|Maria Silva|Pedro Lima/);
});

test('missing Supabase configuration must fail closed on every environment', () => {
  const app = source('src/App.tsx');
  assert.match(app, /if \(!cloudEnabled\) return/);
  assert.doesNotMatch(app, /VITE_ALLOW_DEMO_IN_PRODUCTION/);
  assert.match(app, /if \(!session\) return <AuthScreen/);
});

test('app does not show fake SaaS subscriptions or fabricated admins', () => {
  const admin = source('src/components/admin/AdminPanelView.tsx');
  assert.doesNotMatch(admin, /Plano Pro Ativo|empresas registradas|Super Admin|Notificações Push no Navegador/);
  assert.match(admin, /As alterações visuais são salvas somente neste navegador/);
  const menu = source('src/components/menu/MoreMenuDrawer.tsx');
  assert.doesNotMatch(menu, /Acessar Painel Admin|Plano Pro Ativo/);
});

test('quote models apply to explicitly chosen real quote, not first dataset row', () => {
  const view = source('src/components/models/QuoteModelsView.tsx');
  assert.match(view, /selectedQuoteId/);
  assert.match(view, /updateQuote\(modified\)/);
  assert.doesNotMatch(view, /quotes\[0\]/);
});

test('real customer proposal decisions update quote and create persisted event on server', () => {
  const sql = source('supabase/schema.sql');
  assert.match(sql, /row level security/i);
  assert.match(sql, /orcapro_decide_quote/);
  assert.match(sql, /orcapro_workspaces where user_id = share\.user_id for update/);
  assert.match(sql, /'\{notifications\}'/);
  assert.match(sql, /'\{history\}'/);
  assert.match(sql, /identidade não verificada/);
});

test('financial chart has no invented flat series and calculator has no sample amounts', () => {
  const charts = source('src/components/common/Charts.tsx');
  assert.doesNotMatch(charts, /Array\(8\)\.fill\(0\)/);
  assert.match(charts, /Sem histórico/);
  const form = source('src/components/finance/PricingFormationView.tsx');
  assert.doesNotMatch(form, /useState<number>\((250|50|176|22|25)\)/);
});

test('legacy example detector rejects all old fixture classes but allows real UUID identifiers', async () => {
  const { containsOldExampleRecords } = await import('../.test-dist/utils/legacyFixtures.js');
  assert.equal(containsOldExampleRecords({ quotes: [{ id: 'orc-18' }] }), true);
  assert.equal(containsOldExampleRecords({ clients: [{ id: 'cli-2' }] }), true);
  assert.equal(containsOldExampleRecords({ catalog: [{ id: 'mat-3' }] }), true);
  assert.equal(containsOldExampleRecords({ expenses: [{ id: 'exp-6' }] }), true);
  assert.equal(containsOldExampleRecords({ company: { tradeName: 'Elétrica Plus' } }), true);
  assert.equal(containsOldExampleRecords({ clients: [{ id: 'cli-1d458e5b-49ed-425a-bb5e-2a2c3c446446' }] }), false);
});
