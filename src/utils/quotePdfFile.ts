import type {Client,CompanySettings,Quote,QuoteVisibilitySettings} from '../types/index';

/**
 * PDF A4 vetorial, paginado e selecionável, criado no próprio navegador.
 * A versão de impressão continua usando buildQuoteDocument; esta versão
 * compacta de compartilhamento não exige servidor, upload ou biblioteca remota.
 * Helvetica usa WinAnsi, daí a codificação dos caracteres em octal PDF.
 */
const W=595.28,H=841.89,M=38;
const WHITE=[1,1,1],INK=[.09,.16,.24],MUTED=[.35,.42,.5],ORANGE=[.94,.37,.05],PALE=[.97,.98,.99],LINE=[.84,.88,.92],NAVY=[.035,.075,.13];
type RGB=number[];
interface Page{lines:string[];y:number;}
const cp1252:Record<string,number>={
  '€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,
  'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,
  '–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159
};
function pdfText(raw:unknown):string {
  const input=String(raw??'').normalize('NFC').slice(0,100000);
  let result='';
  for(const original of input){
    const c=original==='\t'?' ':original;
    const code=cp1252[c]??c.codePointAt(0)??63;
    if(c==='('||c===')'||c==='\\'){result+='\\'+c;continue;}
    if(code>=32&&code<=126){result+=c;continue;}
    if(code>=128&&code<=255){result+='\\'+code.toString(8).padStart(3,'0');continue;}
    if(c==='\n'||c==='\r'){result+=' ';continue;}
    const fallback=c.normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
    result+=fallback.length===1&&/^[ -~]$/.test(fallback)?fallback:'?';
  }
  return result;
}
const dec=(n:number)=>Number(n.toFixed(3)).toString();
const col=(c:RGB)=>c.map(dec).join(' ');
const fmt=(n:number)=>Number.isFinite(n)?n.toLocaleString('pt-BR',{maximumFractionDigits:2}):'—';
const money=(n:number)=>Number.isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—';
function width(str:string,size:number,bold=false){
  // Estimativa conservadora para Helvetica, deixando margem nos limites.
  return [...str].reduce((n,c)=>n+(c===' '?0.28:'iIl1.,:;!|'.includes(c)?0.28:'MW@'.includes(c)?0.86:bold?.58:.55)*size,0);
}
function cut(text:string,max:number,size:number,bold=false):string{
  const parts=[...text];while(parts.length&&width(parts.join(''),size,bold)>max)parts.pop();
  return parts.join('');
}
function wrap(input:unknown,maxWidth:number,size:number,maxLines=300):string[]{
  const text=String(input??'').replace(/\r/g,'').trim();
  const result:string[]=[];
  for(const paragraph of (text.split('\n').length?text.split('\n'):[''])){
    if(!paragraph.trim()){result.push('');continue;}
    let line='';
    for(const token of paragraph.split(/\s+/)){
      if(!token)continue;
      const flush=()=>{if(line){result.push(line);line='';}};
      if(width(token,size)>maxWidth){
        flush();
        let remaining=token;
        while(remaining && result.length<maxLines){
          const chunk=cut(remaining,maxWidth,size);
          if(!chunk)break;
          remaining=remaining.slice(chunk.length);
          if(remaining)result.push(chunk);
          else line=chunk;
        }
      }else if(!line||width(line+' '+token,size)<=maxWidth)line=line?line+' '+token:token;
      else{flush();line=token;}
      if(result.length>=maxLines)break;
    }
    if(line)result.push(line);
    if(result.length>=maxLines)break;
  }
  return result.length?result.slice(0,maxLines):[''];
}
function rect(p:Page,x:number,top:number,w:number,h:number,fill:RGB,stroke?:RGB){
  const outline=stroke?`${col(stroke)} RG `:'';
  p.lines.push(`${col(fill)} rg ${outline}${dec(x)} ${dec(H-top-h)} ${dec(w)} ${dec(h)} re ${stroke?'B':'f'}`);
}
function line(p:Page,x1:number,top1:number,x2:number,top2:number,color:RGB=LINE,thickness=.6){
  p.lines.push(`${col(color)} RG ${dec(thickness)} w ${dec(x1)} ${dec(H-top1)} m ${dec(x2)} ${dec(H-top2)} l S`);
}
function text(p:Page,value:unknown,x:number,top:number,size=10,bold=false,color:RGB=INK){
  p.lines.push(`BT ${col(color)} rg /${bold?'F2':'F1'} ${dec(size)} Tf 1 0 0 1 ${dec(x)} ${dec(H-top-size)} Tm (${pdfText(value)}) Tj ET`);
}
function right(p:Page,value:string,rightEdge:number,top:number,size=10,bold=false,color:RGB=INK){
  text(p,value,rightEdge-width(value,size,bold),top,size,bold,color);
}
function title(p:Page,value:string){
  text(p,value,M,p.y,13,true,NAVY);p.y+=24;
  line(p,M,p.y-4,W-M,p.y-4,ORANGE,1.2);p.y+=9;
}
function footer(p:Page,index:number,total:number){
  line(p,M,H-42,W-M,H-42,LINE);
  text(p,'OrçaPro · Proposta comercial gerada com dados cadastrados pelo responsável',M,H-33,8,false,MUTED);
  right(p,`${index} / ${total}`,W-M,H-33,8,false,MUTED);
}
function newPage(pages:Page[],number:string,companyName:string):Page{
  const p:Page={lines:[],y:92};
  pages.push(p);
  rect(p,0,0,W,71,NAVY);
  rect(p,0,69,W,3,ORANGE);
  text(p,companyName,M,16,17,true,WHITE);
  text(p,'ORÇAMENTO '+number,M,44,11,true,[1,.68,.43]);
  if(pages.length>1)right(p,'CONTINUAÇÃO',W-M,44,9,false,WHITE);
  return p;
}
function ensure(pages:Page[],p:Page,need:number,number:string,companyName:string):Page {
  return p.y+need>H-58?newPage(pages,number,companyName):p;
}
export function quotePdfFilename(quoteNumber:string):string {
  const safe=quoteNumber.replace(/[^A-Za-z0-9_-]/g,'-').replace(/-+/g,'-').slice(0,45)||'sem-numero';
  return `OrcaPro_Orcamento_${safe}.pdf`;
}
export function buildQuotePdf({quote,company,client}:{quote:Quote;company:CompanySettings;client?:Client|null}):Uint8Array{
  const companyName=company.tradeName?.trim()||company.name?.trim();
  if(!companyName)throw Error('Cadastre o nome da sua empresa antes de compartilhar o PDF.');
  const vis:QuoteVisibilitySettings=Object.assign({
    showServices:true,showMaterials:true,showQuantities:true,showUnitPrices:true,
    showTaxes:false,showProfitMargin:false,showDiscount:true,showTotal:true,
    showTerms:true,showPix:true,showSignature:true
  },quote.visibility??{});
  const pages:Page[]=[];
  let p=newPage(pages,quote.number,companyName);
  title(p,'PROPOSTA COMERCIAL');
  const fields=[
    ['Cliente',quote.clientName],
    ['Orçamento',quote.number],
    ['Data',quote.date],
    ['Validade',quote.validUntil],
    ...(quote.executionDeadline?[['Prazo de execução',quote.executionDeadline]]:[])
  ];
  for(const [label,value] of fields){
    p=ensure(pages,p,24,quote.number,companyName);
    text(p,label+':',M,p.y,9,true,MUTED);
    const x=M+100;
    const strs=wrap(value,W-M-x,10,4);
    for(const entry of strs){text(p,entry,x,p.y,10,true,INK);p.y+=14;}
    p.y+=7;
  }
  const customerDetails=[client?.document&&`Documento: ${client.document}`,client?.address,client?.city||undefined,
    quote.clientPhone&&`Telefone: ${quote.clientPhone}`,quote.clientEmail&&`E-mail: ${quote.clientEmail}`].filter(Boolean);
  for(const detail of customerDetails){for(const chunk of wrap(detail, W-2*M,9,6)){
    p=ensure(pages,p,13,quote.number,companyName);text(p,chunk,M,p.y,9,false,MUTED);p.y+=13;
  }}
  p.y+=13;
  title(p,'ITENS DA PROPOSTA');
  const shown=quote.items.filter(i=>i.type==='material'?vis.showMaterials:vis.showServices);
  const header=()=>{
    p=ensure(pages,p,26,quote.number,companyName);
    rect(p,M,p.y,W-2*M,27,[.09,.18,.27]);
    text(p,'SERVIÇO / PRODUTO',M+8,p.y+7,9,true,WHITE);
    if(vis.showQuantities){right(p,'QTD',379,p.y+7,9,true,WHITE);right(p,'UN',421,p.y+7,9,true,WHITE);}
    if(vis.showUnitPrices){right(p,'UNIT.',491,p.y+7,9,true,WHITE);right(p,'TOTAL',W-M-7,p.y+7,9,true,WHITE);}
    p.y+=27;
  };
  header();
  if(!shown.length){text(p,'Nenhum item visível segundo as opções do orçamento.',M+8,p.y+15,9,false,MUTED);p.y+=40;}
  for(const item of shown){
    const description=wrap(item.name,vis.showQuantities?270:vis.showUnitPrices?345:480,9.4,100);
    const rowHeight=Math.max(34,description.length*13+12);
    if(p.y+rowHeight>H-66){p=newPage(pages,quote.number,companyName);title(p,'ITENS DA PROPOSTA (continuação)');header();}
    if((shown.indexOf(item)%2)===0)rect(p,M,p.y,W-2*M,rowHeight,PALE);
    for(let j=0;j<description.length;j++)text(p,description[j],M+8,p.y+9+j*13,9.4,j===0,INK);
    if(vis.showQuantities){
      right(p,fmt(item.quantity),379,p.y+9,9,false,INK);
      right(p,item.unit,421,p.y+9,9,false,MUTED);
    }
    if(vis.showUnitPrices){
      right(p,money(item.unitPrice),491,p.y+9,8.5,false,INK);
      right(p,money(item.totalPrice),W-M-7,p.y+9,8.5,true,INK);
    }
    p.y+=rowHeight;line(p,M,p.y,W-M,p.y,LINE,.3);
  }
  p.y+=14;
  const totals=[
    ...(vis.showDiscount&&quote.discountValue>0?[['Desconto',money(quote.discountValue)]]:[]),
    ...(vis.showTaxes&&quote.taxRate>0?[['Tributos declarados',fmt(quote.taxRate)+'%']]:[]),
    ...(vis.showTotal?[['TOTAL DO ORÇAMENTO',money(quote.total)]]:[])
  ];
  for(const [label,value] of totals){
    p=ensure(pages,p,31,quote.number,companyName);
    const isTotal=label==='TOTAL DO ORÇAMENTO';
    if(isTotal)rect(p,M,p.y,W-2*M,37,NAVY);
    text(p,label,M+10,p.y+9,isTotal?11:9,isTotal,isTotal?WHITE:MUTED);
    right(p,value,W-M-10,p.y+9,isTotal?14:10,isTotal,isTotal?WHITE:INK);
    p.y+=isTotal?47:28;
  }
  const notes=vis.showTerms?[
    quote.paymentTerms&&['Condições de pagamento',quote.paymentTerms],
    quote.notes&&['Observações',quote.notes],
    company.termsAndConditions&&['Termos da empresa',company.termsAndConditions]
  ].filter(Boolean) as string[][]:[];
  if(vis.showPix&&company.pixKey)notes.push(['Pix',`${company.pixType||'Chave'}: ${company.pixKey}`]);
  for(const [label,value] of notes){
    p=ensure(pages,p,43,quote.number,companyName);
    p.y+=10;text(p,label,M,p.y,10,true,NAVY);p.y+=17;
    const wrapped=wrap(value,W-2*M,9,800);
    for(const chunk of wrapped){p=ensure(pages,p,14,quote.number,companyName);text(p,chunk,M,p.y,9,false,INK);p.y+=13.5;}
    p.y+=6;
  }
  if(vis.showSignature){
    p=ensure(pages,p,95,quote.number,companyName);p.y+=49;
    line(p,M,p.y,M+218,p.y,MUTED,.7);line(p,W-M-218,p.y,W-M,p.y,MUTED,.7);
    text(p,cut(quote.clientName,218,9),M,p.y+8,9,false,MUTED);
    right(p,cut(company.signatureName||companyName,218,9),W-M,p.y+8,9,false,MUTED);
    p.y+=42;
  }
  if(pages.length>300)throw Error('O orçamento excede o limite de páginas para compartilhamento.');
  pages.forEach((page,i)=>footer(page,i+1,pages.length));
  const objects:string[]=[''];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>5+i*2+' 0 R').join(' ')}] >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  for(const page of pages){
    const content=page.lines.join('\n')+'\n';
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${dec(W)} ${dec(H)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${objects.length+1} 0 R >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
  }
  const chunks:string[]=['%PDF-1.4\n%OrcaPro\n'];
  const offsets=[0];let position=chunks[0].length;
  for(let i=1;i<objects.length;i++){
    offsets.push(position);
    const raw=`${i} 0 obj\n${objects[i]}\nendobj\n`;
    chunks.push(raw);position+=raw.length;
  }
  const xrefAt=position;
  chunks.push(`xref\n0 ${objects.length}\n0000000000 65535 f \n`);
  for(let i=1;i<objects.length;i++)chunks.push(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
  chunks.push(`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);
  return new TextEncoder().encode(chunks.join(''));
}

export function makeQuotePdfFile(args:{quote:Quote;company:CompanySettings;client?:Client|null}):File {
  const bytes=buildQuotePdf(args);
  // TS 7 tipa Uint8Array como ArrayBufferLike; File exige BlobPart<ArrayBuffer>.
  const buffer=new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new File([buffer],quotePdfFilename(args.quote.number),{type:'application/pdf'});
}

/** Acionar dentro de um clique; o navegador pede ao usuário app e destinatário. */
export async function shareQuotePdf(file:File,quoteNumber:string):Promise<'shared'|'cancelled'|'unsupported'>{
  if(typeof navigator.share!=='function'||!navigator.canShare?.({files:[file]}))return 'unsupported';
  try{
    await navigator.share({files:[file],title:`Orçamento ${quoteNumber} - OrçaPro`});
    return 'shared';
  }catch(e){
    if(e instanceof Error&&e.name==='AbortError')return 'cancelled';
    throw e;
  }
}

export function downloadQuotePdf(file:File):void {
  const url=URL.createObjectURL(file);
  const a=document.createElement('a');a.href=url;a.download=file.name;
  document.body.appendChild(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),60000);
}
