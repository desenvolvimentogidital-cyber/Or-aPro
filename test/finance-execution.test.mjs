import test from 'node:test';
import assert from 'node:assert/strict';
import { addMeasurement, measuredQuantity, physicalProgress, progressPercent, validISODate } from '../.test-dist/utils/execution.js';
import { financeMetrics, validateEntry } from '../.test-dist/utils/financeMetrics.js';

const labor=[{code:'88309',role:'pedreiro',hoursPerUnit:.6}];
const task=(q=20)=>({id:'e1',composition:{code:'X',description:'Serviço real importado',unit:'M2',labor,sourceFile:'arquivo.xlsx',sourceSheet:'Analítico'},quantity:q,crew:{}});
const med=(quantity,date='2026-10-08')=>({id:'m'+quantity,date,quantity,recordedAt:'2026-10-08T12:00:00Z'});
const schedule=(tasks)=>({id:'cr1',title:'obra',startDate:'2026-10-08',hoursPerDay:8,efficiency:1,tasks,createdAt:'x',updatedAt:'x'});
const entry=(id,type,amount,quoteId)=>({id,type,amount,date:'2026-10-08',description:'Registro efetivo',category:'Teste unitário',createdAt:'2026-10-08T12:00:00Z',quoteId});
const quote=(id,total,status='aprovado')=>({id,total,status,number:'#001'});

test('sem medições: progresso físico é zero e sem simulação',()=>{assert.equal(measuredQuantity(task()),0);assert.equal(progressPercent(task()),0);assert.equal(physicalProgress(schedule([task()])).percent,0);});
test('incremento de medição com origem data e quantidade',()=>{const t=addMeasurement(task(),med(5));assert.equal(measuredQuantity(t),5);assert.equal(progressPercent(t),25);assert.equal(t.progress.length,1);});
test('medições não podem ultrapassar quantidade prevista',()=>{assert.throws(()=>addMeasurement(addMeasurement(task(),med(15)),med(6)),/exceder/);});
test('datas e quantidades inválidas bloqueiam medição',()=>{assert.equal(validISODate('2026-02-29'),false);assert.throws(()=>addMeasurement(task(),med(-1)),/maior que zero/);assert.throws(()=>addMeasurement(task(),med(5,'2026-13-12')),/data válida/);});
test('progresso usa média por etapa e nunca mistura m², m³ e unidades',()=>{const s=schedule([addMeasurement(task(20),med(20)),addMeasurement(task(10),med(5))]);const p=physicalProgress(s);assert.equal(p.percent,75);assert.equal(p.completed,1);});
test('caixa sem lançamentos é zero mesmo com orçamentos aprovados',()=>{const m=financeMetrics([],[quote('q1',3000)]);assert.equal(m.received,0);assert.equal(m.spent,0);assert.equal(m.receivable,3000);});
test('recebido menos despesa produz saldo de caixa, não lucro líquido fictício',()=>{const m=financeMetrics([entry('r','recebimento',800,'q1'),entry('d','despesa',200,'q1')],[quote('q1',3000)]);assert.equal(m.cashBalance,600);assert.equal(m.receivable,2200);});
test('recebimento sem vínculo não liquida orçamento aprovado',()=>{const m=financeMetrics([entry('r','recebimento',800)],[quote('q1',3000)]);assert.equal(m.received,800);assert.equal(m.receivable,3000);});
test('recusado e rascunho não entram em contas a receber',()=>{const m=financeMetrics([],[quote('a',300,'rascunho'),quote('b',900,'recusado')]);assert.equal(m.receivable,0);});
test('recebimento em excesso aparece como alerta sem saldo negativo a receber',()=>{const m=financeMetrics([entry('r','recebimento',3100,'q1')],[quote('q1',3000)]);assert.equal(m.overpaidQuotes,1);assert.equal(m.receivable,0);});
test('valor inválido não contamina totais financeiros',()=>{const m=financeMetrics([entry('bad','recebimento',NaN),entry('ok','despesa',100)],[]);assert.equal(m.received,0);assert.equal(m.spent,100);assert.equal(m.invalidEntries,1);});
test('despesa inválida bloqueada na inclusão',()=>{assert.throws(()=>validateEntry(entry('x','despesa',0)),/maior que zero/);});
