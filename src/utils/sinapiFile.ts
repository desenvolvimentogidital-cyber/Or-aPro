import { mergeSinapiReports, parseSinapiRows, type SheetCells, type SinapiImportReport } from './sinapi';
import {parseSinapiOfficialCosts,sinapiCodeFromFormula} from './sinapiCosts';
import type {SinapiProvenance} from './sinapiRegional';
/** Importador XLSX/CSV, nativo do navegador, sem upload para servidores e sem dependências de leitura de Excel. */
function readU16(d:DataView,o:number){return d.getUint16(o,true);}
function readU32(d:DataView,o:number){return d.getUint32(o,true);}
const decoder=new TextDecoder('utf-8');
function decodeXML(bytes:Uint8Array){return decoder.decode(bytes);}
function xml(source:string): Document {
  const doc=new DOMParser().parseFromString(source,'application/xml');
  if(doc.getElementsByTagName('parsererror').length) throw Error('XML inválido na planilha.');
  return doc;
}
const tags=(element:Element|Document,local:string):Element[] => [...element.getElementsByTagName('*')].filter(el=>el.localName===local);
function textOf(el:Element):string{return tags(el,'t').map(t=>t.textContent||'').join('');}
function excelIndex(column:string):number{let n=0;for(const c of column.toUpperCase())n=n*26+(c.charCodeAt(0)-64);return n-1;}
type ZipEntry={compression:number;compressedSize:number;uncompressedSize:number;local:number};
/** Índice central ZIP: descompacta apenas workbook, sharedStrings e a aba necessária.
 * A referência oficial possui várias abas de ~22 MB não pertinentes a produtividade.
 */
async function openXlsx(file:File):Promise<{read:(name:string)=>Promise<Uint8Array|undefined>}> {
  if(file.size>35*1024*1024)throw Error('Arquivo XLSX excede 35 MB.');
  const a=new Uint8Array(await file.arrayBuffer()),view=new DataView(a.buffer,a.byteOffset,a.byteLength);
  let eocd=-1;
  for(let i=a.length-22;i>=Math.max(0,a.length-65557);i--)if(readU32(view,i)===0x06054b50){eocd=i;break;}
  if(eocd<0)throw Error('Arquivo XLSX inválido: diretório ZIP não encontrado.');
  const count=readU16(view,eocd+10),offset=readU32(view,eocd+16);
  if(count>300||offset>=a.length)throw Error('Planilha XLSX complexa ou ZIP64 não suportado.');
  const entries=new Map<string,ZipEntry>();
  let pos=offset;
  for(let i=0;i<count;i++){
    if(pos+46>a.length||readU32(view,pos)!==0x02014b50)throw Error('Diretório XLSX ZIP corrompido.');
    const compression=readU16(view,pos+10),compressedSize=readU32(view,pos+20),uncompressedSize=readU32(view,pos+24);
    const nameSize=readU16(view,pos+28),extra=readU16(view,pos+30),comment=readU16(view,pos+32),local=readU32(view,pos+42);
    if(pos+46+nameSize+extra+comment>a.length)throw Error('Nome de entrada ZIP incompleto.');
    const name=decoder.decode(a.subarray(pos+46,pos+46+nameSize)).replace(/^\/+/, '');
    pos+=46+nameSize+extra+comment;
    if(/^xl\/(sharedStrings\.xml|workbook\.xml|_rels\/workbook\.xml\.rels|worksheets\/[^/]+\.xml)$/.test(name))entries.set(name,{compression,compressedSize,uncompressedSize,local});
  }
  let expanded=0;
  return {read:async(name:string)=>{
    const entry=entries.get(name);if(!entry)return undefined;
    if(entry.uncompressedSize>35*1024*1024||(expanded+=entry.uncompressedSize)>42*1024*1024)throw Error('Conteúdo XLSX expandido excede o limite permitido.');
    const {local,compressedSize,compression}=entry;
    if(local+30>a.length||readU32(view,local)!==0x04034b50)throw Error('Arquivo XLSX danificado.');
    const start=local+30+readU16(view,local+26)+readU16(view,local+28),end=start+compressedSize;
    if(end>a.length)throw Error('Conteúdo ZIP incompleto.');
    const compressed=a.slice(start,end);
    if(compression===0)return compressed;
    if(compression!==8)throw Error(`Tipo de compressão XLSX não suportado (${compression}).`);
    if(typeof DecompressionStream==='undefined')throw Error('Seu navegador não suporta XLSX compactado. Exporte a aba como CSV.');
    const buffer=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
    if(buffer.byteLength>35*1024*1024 || buffer.byteLength!==entry.uncompressedSize)throw Error('Tamanho descompactado XLSX inválido.');
    return new Uint8Array(buffer);
  }};
}
function readSheet(doc:Document,strings:string[],resolveOfficialCodes=false):SheetCells{
  const rows:SheetCells=[];
  const r=tags(doc,'sheetData')[0];
  if(!r)return rows;
  for(const line of [...r.children].filter(el=>el.localName==='row')){
    const cells:SheetCells[number]=[];
    for(const c of [...line.children].filter(el=>el.localName==='c')){
      const ref=c.getAttribute('r')||'';
      const col=/^[A-Z]+/i.exec(ref)?.[0];
      const ix=col?excelIndex(col):cells.length;
      if(ix<0||ix>150)continue;
      const val=tags(c,'v')[0]?.textContent ?? '';
      if(resolveOfficialCodes&&ix===1&&val==='0'){
        // SINAPI CSD/CCD: as fórmulas HYPERLINK guardam o código real no argumento final.
        // Somente extraímos esse literal; nunca avaliamos fórmula de planilha.
        const formula=tags(c,'f')[0]?.textContent||'';
        cells[ix]=sinapiCodeFromFormula(formula)||0;
      }
      else if(c.getAttribute('t')==='s')cells[ix]=strings[Number(val)]??'';
      else if(c.getAttribute('t')==='inlineStr')cells[ix]=textOf(c);
      else if(c.getAttribute('t')==='b')cells[ix]=val==='1';
      else cells[ix]=val===''?'': Number.isFinite(Number(val))?Number(val):val;
    }
    rows.push(cells);
    if(rows.length>130000)throw Error('Número máximo de linhas excedido (130 mil). Filtre a planilha antes de importar.');
  }
  return rows;
}
function parseSeparated(text:string,delimiter:string):SheetCells{
  const result:SheetCells=[],row:string[]=[];let current='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){
      if(quoted&&text[i+1]==='"'){current+='"';i++;}else quoted=!quoted;
    }else if(c===delimiter&&!quoted){row.push(current);current='';}
    else if((c==='\n'||c==='\r')&&!quoted){
      if(c==='\r'&&text[i+1]==='\n')i++;
      row.push(current);result.push(row.slice());row.length=0;current='';
      if(result.length>130000)throw Error('CSV excede 130 mil linhas.');
    }else current+=c;
  }
  if(quoted)throw Error('CSV com aspas não fechadas.');
  if(current||row.length){row.push(current);result.push(row);}
  return result;
}
export async function importSinapiFile(file:File):Promise<SinapiImportReport>{
  if(!/\.(xlsx|csv|tsv)$/i.test(file.name))throw Error('Formato não suportado. Use XLSX, CSV ou TSV (não PDF, XLS antigo ou ZIP).');
  let sources:Array<{sheet:string;rows:SheetCells}>=[];
  if(/\.xlsx$/i.test(file.name)){
    const archive=await openXlsx(file);
    const book=await archive.read('xl/workbook.xml');if(!book)throw Error('Estrutura XLSX inválida: workbook não encontrado.');
    const rel=await archive.read('xl/_rels/workbook.xml.rels');if(!rel)throw Error('Planilha XLSX sem relações entre abas.');
    const workbook=xml(decodeXML(book)),relationships=xml(decodeXML(rel));
    const relMap=new Map(tags(relationships,'Relationship').map(el=>[el.getAttribute('Id'),el.getAttribute('Target')||'']));
    const sheetNames=tags(workbook,'sheet').map(el=>({name:el.getAttribute('name')||'Planilha',id:[...el.attributes].find(a=>a.localName==='id')?.value||''}));
    const norm=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const official=sheetNames.some(s=>['isd','icd','ise','csd','ccd','cse','analitico com custo','busca','menu','sem desoneracao','com desoneracao','coeficientes','manutencoes'].includes(norm(s.name)));
    let chosen=sheetNames;
    if(official){
      chosen=sheetNames.filter(s=>norm(s.name)==='analitico');
      if(!chosen.length){
        const labels=sheetNames.map(s=>s.name).join(', ');
        return {compositions:[],inspected:0,ignored:0,issues:[`O arquivo contém as abas ${labels}. Para calcular horas-homem, importe o arquivo SINAPI Referência, aba “Analítico”. Percentuais de mão de obra, fatores de famílias, custos e manutenções não são horas de serviço.`]};
      }
    }
    const shared=await archive.read('xl/sharedStrings.xml');
    const strings=shared?tags(xml(decodeXML(shared)),'si').map(el=>textOf(el)):[];
    for(const sheet of chosen){
      const target=relMap.get(sheet.id)||'';
      const path=target.startsWith('/')?target.slice(1):target.startsWith('xl/')?target:`xl/${target.replace(/^\.\//,'')}`;
      const payload=await archive.read(path);
      if(payload)sources.push({sheet:sheet.name,rows:readSheet(xml(decodeXML(payload)),strings)});
    }
  }else{
    if(file.size>35*1024*1024)throw Error('CSV excede limite de 35 MB.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    let text=new TextDecoder('utf-8').decode(bytes);
    if(text.includes('\uFFFD'))text=new TextDecoder('windows-1252').decode(bytes);
    const sample=text.split(/\r?\n/).slice(0,12).join('\n');
    const delimiter=/\.tsv$/i.test(file.name)?'\t': [';','\t',','].sort((a,b)=>(sample.split(b).length-sample.split(a).length))[0];
    sources=[{sheet:'CSV',rows:parseSeparated(text.replace(/^\uFEFF/,''),delimiter)}];
  }
  if(!sources.length)throw Error('Nenhuma aba de dados foi encontrada.');
  const parts=sources.map(s=>parseSinapiRows(s.rows,file.name,s.sheet));
  const outcome=mergeSinapiReports(parts);
  if(outcome.compositions.length===0)outcome.issues.unshift('Nenhuma composição com coeficiente H de profissão foi importada.');
  return outcome;
}

/** Abre SOMENTE a aba oficial de custos correspondente à UF/regime informado.
 * Os relatórios de percentuais, manutenção e famílias são rejeitados.
 */
export async function importSinapiOfficialCosts(file:File,source:SinapiProvenance){
  if(!/\.xlsx$/i.test(file.name))throw Error('Para ler a aba CSD/CCD, selecione o arquivo SINAPI Referência em XLSX.');
  const archive=await openXlsx(file);
  const book=await archive.read('xl/workbook.xml'),rels=await archive.read('xl/_rels/workbook.xml.rels');
  if(!book||!rels)throw Error('Estrutura de planilha inválida.');
  const doc=xml(decodeXML(book)),rel=xml(decodeXML(rels));
  const requiredSheet=source.regime==='sem_desoneracao'?'CSD':'CCD';
  const sheet=tags(doc,'sheet').find(s=>s.getAttribute('name')?.toUpperCase()===requiredSheet);
  if(!sheet)throw Error(`O arquivo não contém a aba ${requiredSheet} esperada para os encargos.`);
  const id=[...sheet.attributes].find(a=>a.localName==='id')?.value;
  const target=tags(rel,'Relationship').find(r=>r.getAttribute('Id')===id)?.getAttribute('Target')||'';
  if(!target)throw Error('Referência da aba de custos não encontrada no XLSX.');
  const path=target.startsWith('/')?target.slice(1):target.startsWith('xl/')?target:`xl/${target.replace(/^\.\//,'')}`;
  const payload=await archive.read(path);
  if(!payload)throw Error('Aba de custos ausente ou não suportada no arquivo.');
  const shared=await archive.read('xl/sharedStrings.xml');
  const strings=shared?tags(xml(decodeXML(shared)),'si').map(el=>textOf(el)):[];
  return parseSinapiOfficialCosts(readSheet(xml(decodeXML(payload)),strings,true),requiredSheet,source);
}
