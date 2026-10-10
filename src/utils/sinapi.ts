import type { SinapiComposition, SinapiLabor } from '../types/schedule';

export type SheetCells = Array<Array<string | number | boolean | null | undefined>>;
export interface SinapiImportReport { compositions: SinapiComposition[]; inspected: number; ignored: number; issues: string[]; reference?: string; }
const normalized = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const str = (s: unknown) => String(s ?? '').trim();
const units = new Set(['H','HH','HORA','HORAS']);
const laborKeywords = /\b(PEDREIRO|SERVENTE|CARPINTEIRO|ARMADOR|PINTOR|ELETRICISTA|ENCANADOR|GESSEIRO|MONTADOR|AZULEJISTA|ASSENTADOR|SOLDADOR|MARCENEIRO|AJUDANTE|OPERADOR|INSTALADOR|APLICADOR|IMPERMEABILIZADOR|CALCETEIRO|TELHADISTA|REVESTIDOR|LADRILHISTA|OFICIAL|MEIO OFICIAL|MOTORISTA|TOPOGRAFO|MESTRE DE OBRAS|TECNICO|TECNICA|SERRALHEIRO|VIDRACEIRO|JARDINEIRO|VIGIA|LABORATORISTA|APONTADOR|AUXILIAR|BOMBEIRO HIDRAULICO|RASPADOR|MARMORISTA|CALAFETADOR)\b/;
function safeNum(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const s = str(value).replace(/\s/g, '');
  if (!s) return NaN;
  const decimal = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(decimal) ? Number(decimal) : NaN;
}
const numberCode = (s: unknown) => /^\d{3,8}$/.test(str(s).replace(/\.0$/, ''));
const makeRoleKey = (labor: SinapiLabor) => `${labor.code}:${normalized(labor.role)}`;
const find = (cols: string[], ...terms: RegExp[]) => cols.findIndex(c => terms.some(t=>t.test(c)));
const findHeader = (rows: SheetCells): {offset:number;headers:string[]}|null => {
  for (let i=0;i<Math.min(rows.length,50);i++) {
    const h = (rows[i]||[]).map(normalized);
    if (find(h,/^DESCRICAO/,/^SERVICO$/, /^DESCRICAO SERVICO/,/^ITEM$/)>=0 && find(h,/^CODIGO/,/^COMPOSICAO/,/^COD COMP/)>=0) return {offset:i,headers:h};
  }
  return null;
};
function isLabor(description:string, type:string, unit:string):boolean {
  // Coeficiente H não é automaticamente HH: equipamentos e mão de obra indireta também usam horas.
  if (!units.has(normalized(unit))) return false;
  const t = normalized(type), d = normalized(description);
  // A planilha oficial inclui EPI, ferramentas e encargos complementares em H;
  // eles NÃO são profissionais, mesmo quando a descrição contém "OPERADOR".
  // "OPERADOR DE BETONEIRA" e "OPERADOR DE MÁQUINA" são profissões reais:
  // rejeitar estas palavras só no TIPO equipamento, não na descrição do trabalhador.
  if (/\b(EQUIPAMENTO|MAQUINA|CAMINHAO|BETONEIRA|CHP|CHI|MATERIAL)\b/.test(t)) return false;
  if (/\b(EPI|FERRAMENTAS|EXAMES|SEGURO|TRANSPORTE|ALIMENTACAO|ENCARGOS COMPLEMENTARES COLETADO)\b/.test(d)) return false;
  return /\b(MAO DE OBRA|MAO DE OBRA COM ENCARGOS|MO|LABOR)\b/.test(t) || laborKeywords.test(d);
}

/** Formato original da CAIXA: aba "Analítico" do arquivo SINAPI_Referência.
 * As linhas de composições auxiliares precisam ser expandidas recursivamente:
 * o coeficiente de um serviço intermediário não equivale a HH.
 */
export function parseOfficialAnalytical(rows:SheetCells,sourceFile:string,sourceSheet:string,headerOffset=9):SinapiImportReport {
  type Child = {code:string; description:string; unit:string; coefficient:number; type:string};
  type Node = {code:string;description:string;unit:string;status:string;children:Child[]};
  const nodes=new Map<string,Node>();
  let inspected=0, ignored=0;
  const reference=str(rows[2]?.[1]);
  let current:Node|null=null;
  for(let i=headerOffset+1;i<rows.length;i++) {
    const row=rows[i]||[];
    const code=str(row[1]).replace(/\.0$/,'');
    if(!numberCode(code)) {ignored++;continue;}
    inspected++;
    const type=normalized(row[2]), itemCode=str(row[3]).replace(/\.0$/,'');
    const desc=str(row[4]),unit=str(row[5]),coefficient=safeNum(row[6]);
    if(!type && !itemCode && desc && unit) {
      current={code,description:desc,unit,status:normalized(row[7]),children:[]};
      nodes.set(code,current);
    } else if(current && current.code===code && itemCode && desc && unit && coefficient>0 && Number.isFinite(coefficient)) {
      current.children.push({code:itemCode,description:desc,unit,coefficient,type});
    } else ignored++;
  }
  const memo=new Map<string,{labor:SinapiLabor[];complete:boolean}>();
  const resolving=new Set<string>();
  const sumLabor=(items:SinapiLabor[]):SinapiLabor[]=>{
    const byRole=new Map<string,SinapiLabor>();
    for(const entry of items) {
      const key=makeRoleKey(entry),saved=byRole.get(key);
      if(saved)saved.hoursPerUnit+=entry.hoursPerUnit;
      else byRole.set(key,{...entry});
    }
    return [...byRole.values()].filter(l=>Number.isFinite(l.hoursPerUnit)&&l.hoursPerUnit>0);
  };
  function expand(code:string,depth=0):{labor:SinapiLabor[];complete:boolean} {
    if(memo.has(code))return memo.get(code)!;
    const node=nodes.get(code);
    if(!node || depth>35 || resolving.has(code))return {labor:[],complete:false};
    resolving.add(code);
    let complete=true;
    const labor:SinapiLabor[]=[];
    if(node.status==='EM ESTUDO')complete=false;
    for(const ch of node.children) {
      if(ch.type!=='COMPOSICAO' && ch.type!=='INSUMO')continue;
      if(isLabor(ch.description,ch.type,ch.unit)) {
        labor.push({code:ch.code,role:ch.description,hoursPerUnit:ch.coefficient});
      } else if(ch.type==='COMPOSICAO') {
        const inner=expand(ch.code,depth+1);
        if(!inner.complete)complete=false;
        inner.labor.forEach(l=>labor.push({...l,hoursPerUnit:l.hoursPerUnit*ch.coefficient}));
      }
    }
    resolving.delete(code);
    const result={labor:sumLabor(labor),complete};
    memo.set(code,result);
    return result;
  }
  const compositions:SinapiComposition[]=[];
  let incomplete=0,withoutLabor=0;
  for(const n of nodes.values()) {
    if(units.has(normalized(n.unit)))continue; // serviços por H não são atividades de produção por área/volume
    const result=expand(n.code);
    if(!result.complete) {incomplete++;continue;}
    if(!result.labor.length) {withoutLabor++;continue;}
    compositions.push({code:n.code,description:n.description,unit:n.unit,labor:result.labor,sourceFile,sourceSheet,reference: /^\d{2}\/\d{4}$/.test(reference)?reference:undefined});
  }
  const issues:string[]=[];
  if(incomplete)issues.push(`${incomplete} composição(ões) não foram importadas porque há auxiliares ausentes, cíclicas ou em estudo; não foi estimado HH parcial.`);
  if(withoutLabor)issues.push(`${withoutLabor} composição(ões) não possuem mão de obra H identificável; não foi atribuído HH fictício.`);
  if(!compositions.length)issues.push('A aba Analítico não contém composições com horas-homem completas reconhecíveis.');
  return {compositions,inspected,ignored,issues,reference:/^\d{2}\/\d{4}$/.test(reference)?reference:undefined};
}

/** Lê quadros analíticos / normalizados. Ignora relatórios apenas de preço, sem HH verificável. */
export function parseSinapiRows(rows:SheetCells, sourceFile:string, sourceSheet:string):SinapiImportReport {
  const issues:string[]=[];
  const parsed=new Map<string,SinapiComposition>();
  let inspected=0,ignored=0;
  // Layout original SINAPI da CAIXA (não confundir com % mão de obra ou coeficientes de famílias).
  const officialHeader=rows.findIndex((r,i)=>{const h=(r||[]).map(normalized);return i<25 && h[1]?.startsWith('CODIGO DA COMPOSICAO') && h[2]==='TIPO ITEM' && h[3]?.startsWith('CODIGO DO ITEM') && h[6]==='COEFICIENTE';});
  if(officialHeader>=0){
    return parseOfficialAnalytical(rows,sourceFile,sourceSheet,officialHeader);
  }
  const header=findHeader(rows);
  if (!header) return {compositions:[],inspected:0,ignored:rows.length,issues:['Não foi localizado cabeçalho reconhecível. Use relatório analítico contendo composição, profissão, unidade H e coeficiente (não apenas preço).']};
  const h=header.headers;
  const codeIdx=find(h,/^CODIGO COMPOSICAO/,/^COD COMPOSICAO/,/^COD COMP/,/^COMPOSICAO CODIGO/,/^CODIGO DO SERVICO/);
  const descriptionIdx=find(h,/^DESCRICAO COMPOSICAO/,/^DESCRICAO DO SERVICO/,/^DESCRICAO SERVICO/);
  const unitIdx=find(h,/^UNIDADE COMPOSICAO/,/^UNIDADE DO SERVICO/,/^UNID COMPOSICAO/,/^UNIDADE SERVICO/);
  const childCodeIdx=find(h,/^CODIGO (INSUMO|AUXILIAR|COMPONENTE)/,/^COD (INSUMO|AUXILIAR|COMPONENTE)/);
  const childDescIdx=find(h,/^DESCRICAO (INSUMO|AUXILIAR|COMPONENTE|MAO DE OBRA)/);
  const childUnitIdx=find(h,/^UNIDADE (INSUMO|AUXILIAR|COMPONENTE)/,/^UNID (INSUMO|AUXILIAR|COMPONENTE)/);
  const coefIdx=find(h,/^COEFICIENTE/,/^COEF$/, /^CONSUMO UNITARIO/);
  const hhIdx=find(h,/^HH( POR UNIDADE)?$/, /^H H( POR UNIDADE)?$/, /^HORAS HOMEM/,/^HOMEM HORA/,/^HH UNIDADE/);
  const laborRoleIdx=find(h,/^PROFISSAO$/, /^CATEGORIA PROFISSIONAL$/, /^FUNCAO$/, /^OCUPACAO$/);
  const typIdx=find(h,/^TIPO$/, /^NATUREZA$/, /^CLASSE$/);
  const onlyCode=find(h,/^CODIGO$/),onlyDesc=find(h,/^DESCRICAO$/),onlyUnit=find(h,/^UNIDADE$/, /^UNID$/);
  const ixCode=codeIdx>=0?codeIdx:onlyCode;
  const ixDesc=descriptionIdx>=0?descriptionIdx:onlyDesc;
  const ixUnit=unitIdx>=0?unitIdx:onlyUnit;
  if(ixCode<0||ixDesc<0||ixUnit<0) return {compositions:[],inspected:0,ignored:rows.length,issues:['Faltam código, descrição ou unidade da composição.']};
  const get=(r:SheetCells[number],ix:number) => ix>=0?r[ix]:undefined;
  const add=(code:string,desc:string,unit:string,labor:SinapiLabor)=>{
    const key=code+'|'+normalized(unit);
    let comp=parsed.get(key);
    if(!comp) { comp={code,description:desc,unit,labor:[],sourceFile,sourceSheet};parsed.set(key,comp); }
    // Mesma profissão em linhas diferentes: coeficientes somam, sem duplicar por idêntico papel.
    const match=comp.labor.find(l=>makeRoleKey(l)===makeRoleKey(labor));
    if(match) match.hoursPerUnit+=labor.hoursPerUnit; else comp.labor.push(labor);
  };
  let parent: {code:string;description:string;unit:string}|null=null;
  let kind:'analytical'|'tabular'='tabular';
  for(let i=header.offset+1;i<rows.length;i++) {
    const r=rows[i]||[];if(!r.some(v=>str(v))) continue;
    inspected++;
    // Relação tabular explícita composição + insumo + coeficiente
    if(childDescIdx>=0 && coefIdx>=0) {
      const code=str(get(r,ixCode)),desc=str(get(r,ixDesc)),unit=str(get(r,ixUnit));
      const childDesc=str(get(r,childDescIdx)),childUnit=str(get(r,childUnitIdx)),coefficient=safeNum(get(r,coefIdx));
      const childCode=str(get(r,childCodeIdx));
      if(numberCode(code)&&desc&&unit&&childDesc&&isLabor(childDesc,str(get(r,typIdx)),childUnit)&&coefficient>0) {
        add(code,desc,unit,{code:childCode,role:childDesc,hoursPerUnit:coefficient});
      }else ignored++;
      continue;
    }
    // Relatório por linha: COMPOSICAO | CODIGO | DESCRICAO | UNIDADE | COEFICIENTE
    // Cabeçalho genérico com TIPO em coluna distinta e código/descrição/unidade.
    const code=str(get(r,ixCode)),desc=str(get(r,ixDesc)),unit=str(get(r,ixUnit)),type=normalized(get(r,typIdx));
    const hh=safeNum(get(r,hhIdx));
    if(hhIdx>=0 && numberCode(code) && desc && unit && hh>0) {
      add(code,desc,unit,{code:'',role:str(get(r,laborRoleIdx))||'Mão de obra (profissão não detalhada)',hoursPerUnit:hh});
      continue;
    }
    if(typIdx>=0 && coefIdx>=0){
      kind='analytical';
      if((/^COMPOSICAO$|^SERVICO$/.test(type)) && numberCode(code)&&desc&&unit && !units.has(normalized(unit))) {
        parent={code,description:desc,unit};continue;
      }
      if(parent && isLabor(desc,type,unit) && safeNum(get(r,coefIdx))>0) {
        add(parent.code,parent.description,parent.unit,{code,role:desc,hoursPerUnit:safeNum(get(r,coefIdx))});continue;
      }
    }
    ignored++;
  }
  const compositions=[...parsed.values()].filter(c=>c.labor.length>0 && c.labor.every(l=>Number.isFinite(l.hoursPerUnit)&&l.hoursPerUnit>0));
  if(compositions.length===0) issues.push('Nenhum coeficiente de mão de obra em H/unidade foi encontrado. As planilhas de preços/custos SINAPI não permitem calcular prazo sem composição analítica.');
  if(compositions.length && kind==='analytical') issues.push('Composições auxiliares aninhadas não são expandidas automaticamente: confira o quantitativo H e as categorias antes de usar o prazo.');
  return {compositions,inspected,ignored,issues};
}

export function mergeSinapiReports(parts:SinapiImportReport[]):SinapiImportReport {
  const months=[...new Set(parts.map(x=>x.reference).filter(Boolean))];
  if(months.length>1)throw Error(`Foram selecionadas planilhas de competências diferentes (${months.join(', ')}). Importe um mês por vez para evitar coeficientes misturados.`);
  const map=new Map<string,SinapiComposition>();
  for(const p of parts)for(const c of p.compositions){
    // Somente a última versão de cada serviço/unidade é apresentada no lote importado.
    map.set(`${c.code}|${normalized(c.unit)}`,c);
  }
  return {compositions:[...map.values()],inspected:parts.reduce((n,p)=>n+p.inspected,0),ignored:parts.reduce((n,p)=>n+p.ignored,0),issues:parts.flatMap(p=>p.issues),reference:parts.find(p=>p.reference)?.reference};
}

export const decimalFromInput=(value:string)=>safeNum(value);
