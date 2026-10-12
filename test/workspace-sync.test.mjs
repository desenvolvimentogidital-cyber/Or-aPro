import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceSignature, needsWorkspaceSave, reconcileWorkspaces } from '../.test-dist/utils/workspaceSync.js';

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

test('duas abas adicionando clientes diferentes são conciliadas sem sobrescrever dados',()=>{
 const base=emptyWorkspace();
 const a={...base,clients:[{id:'local',name:'Cliente A'}]};
 const b={...base,clients:[{id:'remote',name:'Cliente B'}]};
 const result=reconcileWorkspaces(base,a,b);
 assert.deepEqual(result.conflicts,[]);
 assert.deepEqual(result.merged.clients.map(c=>c.id),['remote','local']);
});

test('dois lançamentos independentes são conciliados por ID da movimentação',()=>{
 const base=emptyWorkspace();
 const item=id=>({id,type:'despesa',date:'2026-10-11',description:'Material',category:'Obra',amount:10,createdAt:'2026-10-11T12:00:00Z'});
 const result=reconcileWorkspaces(base,{...base,financeEntries:[item('a')]},
   {...base,financeEntries:[item('b')]});
 assert.deepEqual(result.merged?.financeEntries.map(x=>x.id),['b','a']);
});

test('mesma entidade alterada em dois dispositivos bloqueia a conciliação',()=>{
 const base={...emptyWorkspace(),clients:[{id:'same',name:'Anterior'}]};
 const result=reconcileWorkspaces(base,{...base,clients:[{id:'same',name:'Celular'}]},
   {...base,clients:[{id:'same',name:'Computador'}]});
 assert.equal(result.merged,null);
 assert.match(result.conflicts.join(' '),/Clientes \(same\)/);
});

test('exclusão contra edição não reaparece nem apaga registros sem consentimento',()=>{
 const base={...emptyWorkspace(),schedules:[{id:'s1',title:'Obra original'}]};
 const result=reconcileWorkspaces(base,{...base,schedules:[]},
   {...base,schedules:[{id:'s1',title:'Obra atualizada'}]});
 assert.equal(result.merged,null);
 assert.match(result.conflicts.join(' '),/Obras e cronogramas/);
});

test('mantém atualizações em campos distintos dos dados da empresa',()=>{
 const base={...emptyWorkspace(),company:{name:'Original',city:'SP',phone:'123'}};
 const local={...base,company:{...base.company,phone:'999'}};
 const remote={...base,company:{...base.company,city:'RJ'}};
 const merged=reconcileWorkspaces(base,local,remote).merged;
 assert.equal(merged?.company.phone,'999');
 assert.equal(merged?.company.city,'RJ');
});

test('números de orçamento duplicados entre duas sessões exigem revisão humana',()=>{
 const base=emptyWorkspace();
 const local={...base,quotes:[{id:'l',number:'#001'}],lastQuoteNumber:1};
 const remote={...base,quotes:[{id:'r',number:'#001'}],lastQuoteNumber:1};
 const result=reconcileWorkspaces(base,local,remote);
 assert.equal(result.merged,null);
 assert.match(result.conflicts.join(' '),/Numeração dos orçamentos/);
});
