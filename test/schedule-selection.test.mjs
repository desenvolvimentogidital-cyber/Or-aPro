import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveScheduleSelection } from '../.test-dist/utils/scheduleSelection.js';
const make = (id, tasks = []) => ({ id, title: id, tasks });
test('cronograma com etapas aparece primeiro quando seleção não foi feita', () => {
  const empty = make('vazio'); const populated = make('teste', [{ id:'a' }, { id:'b' }]);
  assert.equal(resolveScheduleSelection([empty, populated], '')?.id, 'teste');
});
test('seleção manual de cronograma vazio é respeitada', () => {
  const empty = make('vazio'); const populated = make('teste', [{ id:'a' }]);
  assert.equal(resolveScheduleSelection([empty, populated], 'vazio')?.id, 'vazio');
});
test('lista vazia e apenas cronogramas vazios são tratados corretamente', () => {
  assert.equal(resolveScheduleSelection([], ''), null);
  assert.equal(resolveScheduleSelection([make('primeiro'), make('segundo')], '')?.id, 'primeiro');
});
