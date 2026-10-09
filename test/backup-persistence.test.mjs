import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { workspaceSignature, needsWorkspaceSave } from '../.test-dist/utils/workspaceSync.js';

const workspace = () => ({
  quotes: [], clients: [], catalog: [], expenses: [], company: { name: 'Empresa' },
  notifications: [], schedules: [], financeEntries: [], lastQuoteNumber: 0
});

test('backup diferente do estado salvo exige nova gravação', () => {
  const original = workspace();
  const restored = { ...original, company: { name: 'Empresa Restaurada' } };
  assert.equal(needsWorkspaceSave(restored, workspaceSignature(original)), true);
});

test('backup igual não gera alteração fictícia', () => {
  const original = workspace();
  assert.equal(needsWorkspaceSave({ ...original }, workspaceSignature(original)), false);
});

test('importacao JSON e migracao legada utilizam tratamento de estado restaurado', () => {
  const source = readFileSync('src/context/AppContext.tsx', 'utf8');
  assert.match(source, /const applyRestoredSnapshot = \(data: WorkspaceData\)/);
  assert.match(source, /const previousServerSignature = lastSavedSignatureRef\.current/);
  assert.match(source, /lastSavedSignatureRef\.current = previousServerSignature/);
  assert.match(source, /applyRestoredSnapshot\(validated\)/);
  assert.match(source, /applyRestoredSnapshot\(\{\s*quotes: legacyQuotes/);
});

test('restauracao so permite importacao com sincronizacao concluida', () => {
  const source = readFileSync('src/context/AppContext.tsx', 'utf8');
  assert.match(source, /const importBackup = \(value: unknown\) => \{\s*if \(!ready \|\| !session \|\| syncStatus !== 'saved'\)/);
  assert.match(source, /const importLegacyData = \(\) => \{\s*if \(!ready \|\| !session \|\| syncStatus !== 'saved'\)/);
});

test('respostas HTTP recebem headers de seguranca sem CSP que quebraria pdf', () => {
  const v = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const headers = Object.fromEntries(v.headers[0].headers.map(x => [x.key, x.value]));
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.match(headers['Permissions-Policy'], /camera=\(\)/);
});
