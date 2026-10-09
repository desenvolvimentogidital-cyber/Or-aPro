import type {SinapiProvenance} from './sinapiRegional.js';
import {validateProvenance} from './sinapiRegional.js';
import type {SheetCells} from './sinapi.js';
export interface SinapiUnitCost {code:string;description:string;unit:string;unitCost:number;source:SinapiProvenance;}
const clean=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const find=(h:string[],expressions:RegExp[])=>h.findIndex(x=>expressions.some(r=>r.test(x)));
function decimal(input:string):number {
  let s=input.trim().replace(/\s/g,'').replace(/^R\$/i,'');
  if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
  if(!/^\d+(?:\.\d+)?$/.test(s))return NaN;
  return Number(s);
}
function readCSV(input:string):string[][] {
  const result:string[][]=[],row:string[]=[];let cell='',inside=false;
  const delimiters=[';',',','\t'];
  const line=input.split(/\r?\n/,1)[0]||'';
  const sep=delimiters.reduce((best,s)=>line.split(s).length>line.split(best).length?s:best,delimiters[0]);
  for(let i=0;i<input.length;i++){
    const ch=input[i];
    if(ch==='"'){if(inside&&input[i+1]==='"'){cell+='"';i++;}else inside=!inside;}
    else if(ch===sep&&!inside){row.push(cell);cell='';}
    else if((ch==='\n'||ch==='\r')&&!inside){if(ch==='\r'&&input[i+1]==='\n')i++;row.push(cell);result.push([...row]);cell='';row.length=0;if(result.length>80000)throw Error('CSV excede 80 mil linhas.');}
    else cell+=ch;
  }
  if(inside)throw Error('CSV possui aspas não fechadas.');
  if(cell||row.length){row.push(cell);result.push(row);}
  return result;
}
/** Preços em CSV estruturado. NÃO interpreta HH como preço e NÃO define preço de venda. */
export function parseSinapiUnitCosts(csv:string,source:SinapiProvenance):{rows:SinapiUnitCost[];ignored:number} {
  validateProvenance(source);
  const lines=readCSV(csv.replace(/^\uFEFF/,''));
  const header=lines.findIndex(row=>{const h=row.map(clean);return find(h,[/^codigo( da)? composicao$/, /^codigo( do)? servico$/])>=0&&find(h,[/^custo unitario$/, /^preco unitario$/, /^custo total por unidade$/])>=0;});
  if(header<0)throw Error('CSV de custos requer colunas: Código composição, Descrição, Unidade, Custo unitário. Não importe arquivo de percentuais ou HH.');
  const h=lines[header].map(clean),ixCode=find(h,[/^codigo( da)? composicao$/, /^codigo( do)? servico$/]),ixDesc=find(h,[/^descricao/,/^servico$/]),ixUnit=find(h,[/^unidade/,/^unid$/]),ixCost=find(h,[/^custo unitario$/, /^preco unitario$/, /^custo total por unidade$/]);
  if([ixCode,ixDesc,ixUnit,ixCost].some(ix=>ix<0))throw Error('Colunas de custos insuficientes.');
  const byCode=new Map<string,SinapiUnitCost>();let ignored=0;
  for(const line of lines.slice(header+1)) {
    if(!line.some(s=>String(s).trim()))continue;
    const code=String(line[ixCode]||'').trim(),description=String(line[ixDesc]||'').trim(),unit=String(line[ixUnit]||'').trim(),cost=decimal(String(line[ixCost]||''));
    if(!/^\d{3,8}$/.test(code)||!description||!unit||!Number.isFinite(cost)||cost<=0||cost>1e9){ignored++;continue;}
    const key=code+'|'+clean(unit),previous=byCode.get(key);
    if(previous&&Math.abs(previous.unitCost-cost)>0.001)throw Error(`Valores conflitantes para composição ${code}/${unit}. Confira a UF, desoneração e competência.`);
    byCode.set(key,{code,description,unit,unitCost:cost,source:{...source}});
  }
  if(!byCode.size)throw Error('Não há custos unitários válidos neste CSV.');
  return {rows:[...byCode.values()],ignored};
}

/** Extrai apenas o código literal de HYPERLINK SINAPI; NÃO executa fórmulas. */
export function sinapiCodeFromFormula(formula:string):string|null{
  return /^HYPERLINK\([\s\S]*,\s*(\d{3,8})\s*\)$/i.exec(formula.trim())?.[1]??null;
}

/** Lê custos por UF do relatório mensal oficial SINAPI Referência (abas CSD/CCD).
 * A célula do código é uma fórmula HYPERLINK cujo valor em cache pode ser zero:
 * sinapiFile.ts recupera SOMENTE o código literal presente nessa fórmula, sem executá-la.
 * Preços não são HH e jamais se tornam preço de venda automaticamente.
 */
export function parseSinapiOfficialCosts(rows:SheetCells, sheetName:string, source:SinapiProvenance):{rows:SinapiUnitCost[];ignored:number}{
  validateProvenance(source);
  const expected=source.regime==='sem_desoneracao'?'CSD':'CCD';
  if(sheetName.toUpperCase()!==expected)throw Error(`Regime selecionado exige a aba ${expected}.`);
  const get=(r:number,c:number)=>String(rows[r]?.[c]??'').trim();
  const identity=clean(get(0,0)),title=clean(get(1,0));
  if(!identity.includes('sinapi sistema nacional') || !title.includes('relatorio de custos de composicoes'))throw Error('Planilha não corresponde ao relatório de custos SINAPI.');
  if((expected==='CSD'&&!title.includes('sem desoneracao'))||(expected==='CCD'&&(!title.includes('com desoneracao')||title.includes('sem desoneracao'))))throw Error('Encargos da planilha incompatíveis com a seleção.');
  const ref=get(2,1);
  if(ref!==source.reference)throw Error(`Referência da planilha (${ref||'desconhecida'}) diferente da selecionada (${source.reference}).`);
  // A linha 9 contém as UFs e a 10 os cabeçalhos. E,G,I,... são custos; F,H,J... são %AS.
  const ufColumn=(rows[8]||[]).findIndex((v,i)=>i>=4&&i%2===0&&String(v??'').trim().toUpperCase()===source.uf);
  if(ufColumn<0)throw Error(`A UF ${source.uf} não está na linha de UFs da aba ${sheetName}.`);
  if(!/^custo/i.test(get(9,ufColumn)))throw Error('Coluna da UF não corresponde a custo monetário.');
  const result=new Map<string,SinapiUnitCost>();let ignored=0;
  for(const line of rows.slice(10)){
    if(!line?.some(v=>String(v??'').trim()))continue;
    const code=String(line[1]??'').trim(),description=String(line[2]??'').trim(),unit=String(line[3]??'').trim();
    // Custo zero no arquivo da CAIXA sinaliza preço indisponível, não serviço gratuito.
    const cost=Number(line[ufColumn]);
    if(!/^\d{3,8}$/.test(code)||!description||!unit||!Number.isFinite(cost)||cost<=0||cost>1e9){ignored++;continue;}
    const key=code+'|'+clean(unit),old=result.get(key);
    if(old&&Math.abs(old.unitCost-cost)>0.001)throw Error(`Custo conflitante na composição ${code}/${unit}.`);
    result.set(key,{code,description,unit,unitCost:cost,source:{...source}});
  }
  if(!result.size)throw Error('Nenhum custo válido encontrado: verifique o relatório original e a seleção de UF.');
  return {rows:[...result.values()],ignored};
}
