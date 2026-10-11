/** Desmembramento SINAPI somente com dados oficiais de INSUMOS e Analítico.
 * Respeita todas as composições auxiliares e distingue ENCARGOS de MATERIAL.
 * A ausência de qualquer custo ou a falta de conciliação bloqueia o selo "completo".
 */
export type SinapiCostKind='labor'|'material'|'equipment'|'other';
export interface SinapiAnalyticalItem {
  type:'composition'|'input';
  code:string;
  unit:string;
  coefficient:string|number;
  status:string;
}
export interface SinapiPublishedAnalytical {
  code:string;
  unit:string;
  items:SinapiAnalyticalItem[];
}
export interface SinapiPublishedInputCost {
  code:string;unit:string;classification:string;
  costs_in_cents:Record<string,Record<string,number>>;
}
export interface SinapiPublishedCompositionCost {
  code:string;unit:string;
  costs_in_cents:Record<string,Record<string,number>>;
}
export interface SinapiCostBreakdown {
  status:'reconciled'|'partial'|'discrepant';
  unit:string;
  uf:string;
  regime:string;
  labor:number;
  material:number;
  equipment:number;
  other:number;
  knownTotal:number;
  officialTotal:number|null;
  difference:number|null;
  missingCount:number;
  issues:string[];
}
const key=(code:string,unit:string)=>code+'|'+unit.trim().toUpperCase();
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
const normalize=(s:string)=>s.normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
/** MAO DE OBRA, MATERIAL, EQUIPAMENTO (AQUISICAO/LOCACAO);
 * serviços, encargos e especiais ficam em "outros" explicitamente.
 */
export function sinapiInputCategory(classification:string):SinapiCostKind {
  const c=normalize(classification);
  if(c==='MAO DE OBRA')return 'labor';
  if(c==='MATERIAL')return 'material';
  if(c.startsWith('EQUIPAMENTO'))return 'equipment';
  return 'other';
}
export function calculateSinapiCostBreakdown(
 root:{code:string;unit:string},uf:string,regime:string,
 analytical:readonly SinapiPublishedAnalytical[],
 inputs:readonly SinapiPublishedInputCost[],
 official:SinapiPublishedCompositionCost|null
):SinapiCostBreakdown{
  if(!/^[A-Z]{2}$/.test(uf)||!['sem_desoneracao','com_desoneracao'].includes(regime))
    throw Error('UF ou regime SINAPI inválido.');
  const graph=new Map(analytical.map(r=>[key(r.code,r.unit),r.items]));
  const indexed=new Map(inputs.map(r=>[key(r.code,r.unit),r]));
  const subtotals:Record<SinapiCostKind,number>={labor:0,material:0,equipment:0,other:0};
  const issues:string[]=[];
  const detailSet=new Set<string>();
  let missingCount=0,visitedCount=0;
  function unknown(message:string){
    missingCount++;
    if(!detailSet.has(message)&&issues.length<25){detailSet.add(message);issues.push(message);}
  }
  function walk(code:string,unit:string,coefficient:number,depth:number,ancestors:Set<string>){
    const identity=key(code,unit);
    if(depth>24){unknown('Limite de 24 níveis de composições auxiliares alcançado.');return;}
    if(ancestors.has(identity)){unknown('Ciclo de composição auxiliar: '+identity);return;}
    if(++visitedCount>50000){unknown('Limite de 50 mil insumos alcançado.');return;}
    const items=graph.get(identity);
    if(!Array.isArray(items)||items.length===0){
      unknown('Analítico indisponível: '+identity);return;
    }
    const next=new Set(ancestors);next.add(identity);
    for(const item of items){
      const factor=Number(item.coefficient);
      if(!Number.isFinite(factor)||factor<=0||factor>1e8||
        !/^\d{1,8}$/.test(item.code)||!item.unit){
        unknown('Coeficiente ou item SINAPI inválido em '+identity);continue;
      }
      const multiplier=coefficient*factor;
      if(!Number.isFinite(multiplier)||multiplier<=0||multiplier>1e12){
        unknown('Quantidade de insumo fora do limite em '+identity);continue;
      }
      if(item.type==='composition'){
        walk(item.code,item.unit,multiplier,depth+1,next);
      }else if(item.type==='input'){
        const price=indexed.get(key(item.code,item.unit));
        const cents=price?.costs_in_cents?.[regime]?.[uf];
        if(!Number.isSafeInteger(cents)||!cents||cents<=0){
          unknown('Preço do insumo ausente: '+key(item.code,item.unit));continue;
        }
        subtotals[sinapiInputCategory(price.classification)]+=multiplier*cents/100;
      }else{
        unknown('Tipo de componente desconhecido em '+identity);
      }
    }
  }
  walk(root.code,root.unit,1,0,new Set());
  const officialCents=official?.code===root.code&&
    key(official.code,official.unit)===key(root.code,root.unit)?
    official.costs_in_cents?.[regime]?.[uf]:undefined;
  const officialTotal=Number.isSafeInteger(officialCents)&&
    typeof officialCents==='number'&&officialCents>0?officialCents/100:null;
  for(const kind of Object.keys(subtotals) as SinapiCostKind[]){
    subtotals[kind]=round(subtotals[kind]);
  }
  const knownTotal=round(Object.values(subtotals).reduce((sum,v)=>sum+v,0));
  const difference=officialTotal===null?null:round(knownTotal-officialTotal);
  const status=missingCount>0||officialTotal===null?'partial':
    Math.abs(difference!)<=0.02?'reconciled':'discrepant';
  if(officialTotal===null)issues.push('Custo integral da composição não publicado para esta UF/regime.');
  if(status==='discrepant')issues.push('Subtotais não conciliam com o custo integral: confira fontes e regras de arredondamento.');
  return {status,unit:root.unit,uf,regime,
    ...subtotals,knownTotal,officialTotal,difference,missingCount,issues};
}
