import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Integração em Chromium Android SIMULADO: REST, sessão e share sheet inteiramente mockados.
// Nenhuma informação de cliente é enviada a servidores reais ou ao WhatsApp real.
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:3000/';
const quote={
 id:'quote-whatsapp',number:'#0255',clientId:'client-qa',clientName:'Cliente QA',
 clientPhone:'11999999999',clientEmail:'qa@example.invalid',date:'2026-10-09',validUntil:'2026-12-09',
 status:'rascunho',items:[{id:'item-1',name:'Instalação de chuveiro elétrico',unit:'un',type:'servico',
 quantity:22,unitPrice:180,totalPrice:3960}],
 subtotal:3960,total:3960,netProfit:0,travelCost:0,otherCosts:0,discountType:'fixed',
 discountValue:0,taxRate:0,targetMarginRate:0,modelTemplate:'padrao',
 visibility:{showServices:true,showMaterials:true,showQuantities:true,showUnitPrices:true,
  showTaxes:false,showProfitMargin:false,showDiscount:true,showTotal:true,showTerms:true,
  showPix:false,showSignature:false}
};
const payload={quotes:[quote],clients:[],catalog:[],expenses:[],notifications:[],
 company:{name:'Empresa QA',tradeName:'OrçaPro QA',phone:'',email:'',whatsapp:'',
  document:'',address:'',city:'',state:'',logoUrl:'',tagline:'',pixKey:'',
  pixType:'CPF',bankInfo:'',signatureName:'',termsAndConditions:''},
 schedules:[],financeEntries:[],lastQuoteNumber:255};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
const errors=[];
page.on('pageerror',err=>errors.push(err.message));
await page.addInitScript(()=>{
 sessionStorage.setItem('orcapro_cloud_session',JSON.stringify({
  access_token:'fake-qa',refresh_token:'fake-qa',expires_at:Date.now()+3600000,
  user:{id:'00000000-0000-4000-8000-000000000001',email:'qa@example.invalid'}
 }));
 window.__shareMeta=null;
 window.__forceNoShare=false;
 Object.defineProperty(navigator,'canShare',{value:arg=>!window.__forceNoShare&&Array.isArray(arg.files)&&arg.files.length===1,configurable:true});
 Object.defineProperty(navigator,'share',{value:async arg=>{
  const f=arg.files[0];const buf=new Uint8Array(await f.arrayBuffer());
  window.__shareMeta={fileName:f.name,type:f.type,size:f.size,
    signature:new TextDecoder().decode(buf.slice(0,8)),title:arg.title,fileCount:arg.files.length,
    text:arg.text??null};
 },configurable:true});
});
const headers={'content-type':'application/json','access-control-allow-origin':'*',
 'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
await page.route('**/rest/v1/orcapro_workspaces**',route=>{
 if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
 if(route.request().method()==='GET')return route.fulfill({status:200,headers,
  body:JSON.stringify([{payload,revision:1}])});
 return route.fulfill({status:200,headers,body:'[]'});
});
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.getByRole('navigation',{name:'Navegação Principal'})
  .getByRole('button',{name:'Orçamentos'}).click();
 await page.getByRole('button',{name:'Visualizar'}).first().click();
 await page.getByRole('button',{name:'Enviar',exact:true}).click();
 const pdfButton=page.getByRole('button',{name:'Enviar PDF pelo WhatsApp'});
 await pdfButton.waitFor();
 await pdfButton.click();
 await page.getByRole('status').getByText(/Compartilhamento aberto\/concluído/).waitFor();
 const meta=await page.evaluate(()=>window.__shareMeta);
 assert.equal(meta.fileName,'OrcaPro_Orcamento_-0255.pdf');
 assert.equal(meta.type,'application/pdf');
 assert.ok(meta.size>1300);
 assert.equal(meta.signature,'%PDF-1.4');
 assert.equal(meta.fileCount,1);
 assert.equal(meta.text,null,'O orçamento deve ser arquivo, não mensagem');
 console.log('PASS Android: Web Share API recebe arquivo PDF real, não wa.me com texto');

 await page.evaluate(()=>{window.__forceNoShare=true;});
 const download=page.waitForEvent('download',{timeout:8000});
 await pdfButton.click();
 const result=await download;
 assert.equal(result.suggestedFilename(),'OrcaPro_Orcamento_-0255.pdf');
 await page.getByRole('status').getByText(/anexe o PDF como Documento/).waitFor();
 console.log('PASS fallback Android: baixa PDF quando não pode anexar pela Web Share API');
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
