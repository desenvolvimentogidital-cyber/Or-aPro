import type {Session} from './cloud';
import type {SinapiComposition} from '../types/schedule';
import {validateProvenance,type SinapiProvenance} from '../utils/sinapiRegional';
import {calculateSinapiCostBreakdown,type SinapiPublishedAnalytical,
  type SinapiPublishedInputCost,type SinapiPublishedCompositionCost,
  type SinapiCostBreakdown} from '../utils/sinapiCostBreakdown';

const base=(import.meta.env.VITE_SUPABASE_URL||'').replace(/\/$/,'');
const apiKey=import.meta.env.VITE_SUPABASE_ANON_KEY||'';
const validCode=(c:string)=>/^\d{1,8}$/.test(c);
async function read(session:Session,table:string,params:URLSearchParams,signal:AbortSignal){
  if(!base||!apiKey||!session.access_token||!session.user.id)
    throw Error('Entre na sua conta para consultar o detalhamento SINAPI.');
  const response=await fetch(base+'/rest/v1/'+table+'?'+params.toString(),{
    headers:{apikey:apiKey,Authorization:'Bearer '+session.access_token},
    signal
  });
  if(response.status===404||response.status===406)
    throw Error('O detalhamento nacional ainda não foi publicado no banco. Aguarde a importação oficial.');
  if(!response.ok)throw Error('Não foi possível consultar o detalhamento regional (HTTP '+response.status+').');
  const rows=await response.json();
  if(!Array.isArray(rows))throw Error('Dados analíticos SINAPI inesperados.');
  return rows;
}
const chunks=<T>(items:readonly T[],size:number)=>{
  const all:T[][]=[];for(let i=0;i<items.length;i+=size)all.push(items.slice(i,i+size));
  return all;
};
/** Busca SOMENTE a composição escolhida e suas auxiliares, depois os INSUMOS.
 * Preços e coeficientes têm a mesma referência. Não busca preço de outro estado.
 * Não mistura código de insumo com código de composição.
 */
export async function loadSinapiCostBreakdown(
  session:Session,composition:SinapiComposition,source:SinapiProvenance,
  signal:AbortSignal
):Promise<SinapiCostBreakdown>{
  validateProvenance(source);
  if(composition.reference&&composition.reference!==source.reference)
    throw Error('A competência da composição e dos preços é diferente.');
  if(!/^\d{3,8}$/.test(composition.code))
    throw Error('Código de composição inválido.');
  const registry=new Map<string,SinapiPublishedAnalytical>();
  const scanned=new Set<string>();
  let queue=[composition.code];
  let depth=0;
  while(queue.length){
    if(signal.aborted)throw Error('Consulta cancelada.');
    if(++depth>25||scanned.size>3000)
      throw Error('Composição muito complexa: consulte o relatório oficial diretamente.');
    const batchCodes=[...new Set(queue)].filter(code=>validCode(code)&&!scanned.has(code));
    queue=[];
    for(const code of batchCodes)scanned.add(code);
    for(const group of chunks(batchCodes,75)){
      const q=new URLSearchParams({select:'code,unit,items',
        reference:'eq.'+source.reference,code:'in.('+group.join(',')+')',
        limit:'500'});
      const rows=await read(session,'orcapro_sinapi_published_analytical',q,signal);
      for(const row of rows){
        if(!validCode(row.code)||!Array.isArray(row.items))continue;
        const identity=row.code+'|'+String(row.unit).toUpperCase();
        registry.set(identity,{code:row.code,unit:row.unit,items:row.items});
        for(const child of row.items)if(child.type==='composition'&&validCode(child.code)&&!scanned.has(child.code))
          queue.push(child.code);
      }
    }
  }
  if(!registry.has(composition.code+'|'+composition.unit.toUpperCase()))
    throw Error('A composição ainda não tem itens analíticos publicados para esta competência.');
  const inputCodes=new Set<string>();
  for(const row of registry.values())for(const child of row.items){
    if(child.type==='input'&&validCode(child.code))inputCodes.add(child.code);
  }
  if(inputCodes.size>7500)throw Error('O serviço possui insumos demais para consultar de uma vez.');
  const inputs:SinapiPublishedInputCost[]=[];
  for(const codes of chunks([...inputCodes],75)){
    const params=new URLSearchParams({select:'code,unit,classification,costs_in_cents',
      reference:'eq.'+source.reference,code:'in.('+codes.join(',')+')',limit:'500'});
    inputs.push(...await read(session,'orcapro_sinapi_published_inputs',params,signal));
  }
  const officialQuery=new URLSearchParams({select:'code,unit,costs_in_cents',
    reference:'eq.'+source.reference,code:'eq.'+composition.code,limit:'10'});
  const official=await read(session,'orcapro_sinapi_published_unit_costs',
    officialQuery,signal) as SinapiPublishedCompositionCost[];
  const reference=official.find(r=>r.unit.toUpperCase()===composition.unit.toUpperCase())||null;
  return calculateSinapiCostBreakdown(
    {code:composition.code,unit:composition.unit},source.uf,source.regime,
    [...registry.values()],inputs,reference);
}
