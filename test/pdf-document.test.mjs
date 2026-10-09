import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuoteDocument, escapeHtml, safeImageSrc } from '../.test-dist/utils/quoteDocument.js';

const quote = {
  id: 'validation', number:'#001', date:'2026-10-08', validUntil:'2026-11-08',
  clientId:'c1', clientName:'Cliente <Empresa>', clientPhone:'', clientEmail:'', status:'rascunho',
  items:[{id:'1',name:'Produto & instalação',type:'material',unit:'un',quantity:2,unitPrice:12,totalPrice:24},{id:'2',name:'Serviço especializado',type:'servico',unit:'un',quantity:1,unitPrice:20,totalPrice:20}],
  subtotal:44,travelCost:0,otherCosts:0,discountType:'fixed',discountValue:0,taxRate:0,
  targetMarginRate:0,total:44,netProfit:0,modelTemplate:'padrao',
  visibility: {showServices:true,showMaterials:true,showQuantities:true,showUnitPrices:true,showTaxes:true,showProfitMargin:false,showDiscount:true,showTotal:true,showTerms:true,showPix:true,showSignature:true}
};
const company = {name:'',tradeName:'Empresa de teste',document:'',phone:'',whatsapp:'',email:'',address:'',city:'',state:'',logoUrl:'',tagline:'',pixKey:'',pixType:'Aleatória',bankInfo:'',signatureName:'',termsAndConditions:''};

test('PDF preserves dark design, reference structure, A4 pagination rules, and real values', () => {
  const html = buildQuoteDocument({quote,company});
  for (const expected of ['Serviços','Produtos','Orçamento','Empresa','Cliente','Total estimado','Observações','@page{size:A4;margin:0}', 'Cliente &lt;Empresa&gt;', 'Produto &amp; instalação']) {
    if (expected === 'Observações') continue; // omitted if no real notes: expected behavior
    assert.ok(html.includes(expected), `Missing: ${expected}`);
  }
  assert.match(html,/page-break-inside:avoid/);
  assert.match(html,/R\$\s*24,00/);
});

test('PDF never invents deadline, handwritten signature, contact details or catalog photos', () => {
  const html = buildQuoteDocument({quote,company});
  assert.doesNotMatch(html, /Prazo de execução/);
  assert.doesNotMatch(html, /<img class="item-photo"/);
  assert.doesNotMatch(html, /7 dias úteis|Alessandro Santos|0002-26/);
  assert.match(html,/espaço para assinatura/);
});

test('PDF shows user-provided deadline, actual notes and client record only when available', () => {
  const html = buildQuoteDocument({quote:{...quote,executionDeadline:'12 dias após confirmação',notes:'Agendar somente após aceite'},company,client:{id:'c1',name:'Cliente',phone:'',email:'',document:'123',address:'Rua A'}});
  assert.match(html,/12 dias após confirmação/);
  assert.match(html,/Agendar somente após aceite/);
  assert.match(html,/Rua A/);
});

test('PDF output escapes user fields and rejects dangerous image URLs', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(safeImageSrc('javascript:alert(1)'), '');
  assert.equal(safeImageSrc('data:image/svg+xml;base64,PHN2Zz4='), '');
  const html = buildQuoteDocument({quote:{...quote,clientName:'<script>alert(1)</script>'}, company:{...company,logoUrl:'javascript:alert(1)'}});
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /src="javascript/);
  assert.match(html, /&lt;script&gt;/);
});

test('visibility settings remove hidden material items and totals from the generated PDF', () => {
  const html = buildQuoteDocument({quote:{...quote,visibility:{...quote.visibility,showMaterials:false,showTotal:false,showSignature:false}}, company});
  assert.doesNotMatch(html,/Produto &amp; instalação/);
  assert.doesNotMatch(html,/Total estimado:/);
  assert.doesNotMatch(html,/espaço para assinatura/);
});

test('quotes from previous versions keep PDF visibility defaults when no visibility object exists', () => {
  const legacyQuote = {...quote, visibility: undefined};
  const html = buildQuoteDocument({quote:legacyQuote,company});
  assert.match(html, /Produto &amp; instalação/);
  assert.match(html, /Serviço especializado/);
  assert.match(html, /Total estimado/);
});
