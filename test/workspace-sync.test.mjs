import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceSignature, needsWorkspaceSave } from '../.test-dist/utils/workspaceSync.js';

const emptyWorkspace = () => ({
  quotes: [], clients: [], catalog: [], expenses: [],
  company: { name: '' }, notifications: [],
  schedules: [], financeEntries: [], lastQuoteNumber: 0
});

test('abrir o mesmo workspace não dispara gravação sem alterações', () => {
  const loaded = emptyWorkspace();
  const saved = workspaceSignature(loaded);
  assert.equal(needsWorkspaceSave({ ...loaded }, saved), false);
  assert.equal(needsWorkspaceSave({ company: { name: '' }, ...loaded }, saved), false);
});

test('listas opcionais ausentes no legado são equivalentes a listas vazias', () => {
  const loaded = emptyWorkspace();
  const old = { ...loaded, schedules: undefined, financeEntries: undefined };
  assert.equal(workspaceSignature(old), workspaceSignature(loaded));
});

test('mudanças reais nos registros disparam persistência, incluindo lançamentos', () => {
  const loaded = emptyWorkspace();
  const saved = workspaceSignature(loaded);
  assert.equal(needsWorkspaceSave({ ...loaded, clients: [{ id: 'cli-1', name: 'Cliente real' }] }, saved), true);
  assert.equal(needsWorkspaceSave({ ...loaded, financeEntries: [{ id: 'pag-1', amount: 250 }] }, saved), true);
  assert.equal(needsWorkspaceSave({ ...loaded, lastQuoteNumber: 1 }, saved), true);
});

test('recarregar snapshot remoto preserva assinatura, edição posterior é nova', () => {
  const remote = { ...emptyWorkspace(), company: { name: 'Empresa nova' } };
  const signature = workspaceSignature(remote);
  assert.equal(needsWorkspaceSave(remote, signature), false);
  assert.equal(needsWorkspaceSave({ ...remote, company: { name: 'Empresa corrigida' } }, signature), true);
});
