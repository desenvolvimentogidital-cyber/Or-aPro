import test from 'node:test';
import assert from 'node:assert/strict';
import {buildQuotePdf,quotePdfFilename,makeQuotePdfFile} from '../.test-dist/utils/quotePdfFile.js';

const company={name:'Empresa Elétrica QA',tradeName:'OrçaPro QA',signatureName:'Engenheiro QA',
  phone:'',whatsapp:'',email:'qa@example.invalid',document:'',address:'',city:'',state:'',
  logoUrl:'',tagline:'',pixKey:'CHAVE-QA',pixType:'CNPJ',bankInfo:'',termsAndConditions:'Garantia válida por 12 meses'};
const item=(n,name,type='servico')=>({
  id:String(n),name,type,unit:'un',quantity:2,unitPrice:250,totalPrice:500
});
const quote={id:'orc-test',number:'#0123',clientId:'client1',clientName:'Cliente Maria',
  clientPhone:'11999999999',clientEmail:'maria@example.invalid',date:'2026-10-10',
  validUntil:'2026-11-10',status:'rascunho',
  items:[item(1,'Instalação de tomada e chuveiro elétrico')],
  subtotal:500,travelCost:0,otherCosts:0,discountType:'fixed',discountValue:0,
  taxRate:0,targetMarginRate:0,total:500,netProfit:0,
  visibility:{showServices:true,showMaterials:true,showQuantities:true,showUnitPrices:true,
    showTaxes:false,showProfitMargin:false,showDiscount:true,showTotal:true,showTerms:true,showPix:true,showSignature:true},
  notes:'Prazo sujeito a disponibilidade técnica',paymentTerms:'50% de entrada',modelTemplate:'padrao'
};
const pdf=(q=quote)=>Buffer.from(buildQuotePdf({quote:q,company}));
const source=b=>b.toString('latin1');
const offsets=(b)=>{
  const str=source(b),off=Number(str.match(/startxref\n(\d+)\n/)?.[1]);
  assert.ok(off>0 && off<b.length);
  assert.equal(str.slice(off,off+5),'xref\n');
  const declared=Number(str.match(/\/Count (\d+)/)?.[1]);
  assert.ok(Number.isInteger(declared)&&declared>0);
  assert.equal((str.match(/\/Type \/Page \/Parent/g)||[]).length,declared);
  return declared;
};

test('gera PDF real A4 com texto editável/selecionável e nome de arquivo seguro',()=>{
  const bytes=pdf(),s=source(bytes);
  assert.equal(s.slice(0,8),'%PDF-1.4');
  assert.ok(s.endsWith('%%EOF\n'));
  assert.equal(offsets(bytes),1);
  assert.match(s,/\/MediaBox \[0 0 595.28 841.89\]/);
  assert.ok(s.includes(String.raw`OR\307AMENTO`)); // ÊN/Ç cedilha codificadas em PDF WinAnsi
  assert.match(s,/Cliente Maria/);
  assert.ok(s.includes(String.raw`Instala\347\343o de tomada`));
  assert.match(s,/500,00/);
  assert.ok(quotePdfFilename('#0123').endsWith('.pdf'));
  assert.doesNotMatch(quotePdfFilename('../../dangerous#42'),/\.\./);
});
test('não imprime itens escondidos, preço ocultado, Pix ou termos se configuração desabilitar',()=>{
  const hidden={...quote,items:[...quote.items,item(2,'Cabo especial CONFIDENCIAL','material')],
    visibility:{...quote.visibility,showMaterials:false,showUnitPrices:false,showTotal:false,
      showTerms:false,showPix:false,showSignature:false}};
  const s=source(pdf(hidden));
  assert.doesNotMatch(s,/Cabo especial CONFIDENCIAL/);
  assert.doesNotMatch(s,/CHAVE-QA/);
  assert.doesNotMatch(s,/50% de entrada/);
  assert.ok(!s.includes(String.raw`TOTAL DO OR\307AMENTO`));
  assert.ok(s.includes(String.raw`Instala\347\343o`));
});
test('relatório grande é paginado com referências, textos e páginas válidas',()=>{
  const long={...quote,items:Array.from({length:90},(_,i)=>item(i,'Instalação de quadro elétrico '+i+' com acessórios e identificação completa'))};
  const bytes=pdf(long);
  assert.ok(bytes.length>20000);
  assert.ok(offsets(bytes)>=3);
  assert.ok(source(bytes).includes(String.raw`Instala\347\343o de quadro el\351trico 89`));
});
test('arquivo gerado para Android usa MIME application/pdf, não mensagem de texto',()=>{
  const file=makeQuotePdfFile({quote,company});
  assert.equal(file.type,'application/pdf');
  assert.equal(file.name,'OrcaPro_Orcamento_-0123.pdf');
  assert.ok(file.size>1000);
});
