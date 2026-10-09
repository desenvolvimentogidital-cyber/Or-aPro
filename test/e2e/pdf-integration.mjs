import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { buildQuoteDocument } from '../../.test-dist/utils/quoteDocument.js';
import { buildScheduleDocument } from '../../.test-dist/utils/scheduleDocument.js';

const browser = await chromium.launch({headless:true});
async function verifyPrinted(name, html, minimumPages) {
  const page = await browser.newPage();
  try {
    await page.setContent(html, {waitUntil:'load'});
    const pdf = await page.pdf({printBackground:true,preferCSSPageSize:true});
    const text=pdf.toString('latin1');
    const count=(text.match(/\/Type\s*\/Page\b/g)||[]).length;
    assert.ok(pdf.byteLength>5000, name+' deve produzir PDF real');
    assert.ok(count>=minimumPages, name+' deve paginar conteudo longo (pagina(s): '+count+')');
    assert.equal(await page.locator('script').count(),0, name+' não pode injetar scripts');
    console.log('PASS '+name+' PDF '+count+' pagina(s), '+pdf.byteLength+' bytes');
  } finally {await page.close();}
}
try {
  const company = {name:'Empresa QA',tradeName:'Empresa QA',phone:'',email:'',document:'',address:'',pixKey:'',state:'',city:''};
  const quote={
    id:'qa-1',number:'#QA-001',date:'2026-10-09',validUntil:'2026-11-09',
    clientId:'qa-c1',clientName:'Cliente QA',clientPhone:'',clientEmail:'',
    status:'rascunho',subtotal:5760,total:5760,travelCost:0,otherCosts:0,
    discountType:'fixed',discountValue:0,taxRate:0,targetMarginRate:0,netProfit:0,
    items:Array.from({length:72},(_,i)=>({
      id:'qa-item-'+i,name:'Servico de integracao '+String(i+1).padStart(2,'0'),
      type:'servico',unit:'m²',quantity:1,unitPrice:80,totalPrice:80
    }))
  };
  const quoteHtml=buildQuoteDocument({quote,company});
  assert.ok(quoteHtml.includes('Servico de integracao 72'));
  await verifyPrinted('Orcamento 72 itens',quoteHtml,2);

  const composition={code:'96113',description:'Forro de gesso QA',unit:'m²',
    labor:[{code:'1',role:'Gesseiro',hoursPerUnit:0.5}],
    sourceFile:'SINAPI_QA',sourceSheet:'Analitico',reference:'08/2026',uf:'SP',regime:'sem_desoneracao'};
  const schedule={
    id:'qa-schedule',title:'Cronograma de integracao',startDate:'2026-10-09',
    hoursPerDay:8,efficiency:1,
    createdAt:'2026-10-09T00:00:00Z',updatedAt:'2026-10-09T00:00:00Z',
    tasks:Array.from({length:90},(_,i)=>({
      id:'qa-t'+i,composition:{...composition,code:String(96113+i)},
      quantity:10,crew:{'1:Gesseiro':1},progress:[]
    }))
  };
  const scheduleHtml=buildScheduleDocument(schedule);
  assert.ok(scheduleHtml.includes('96202'));
  await verifyPrinted('Cronograma 90 etapas',scheduleHtml,2);
} finally {await browser.close();}
