import type {Session} from './cloud';
import type {SinapiComposition} from '../types/schedule';
import type {SinapiUnitCost} from '../utils/sinapiCosts';
import {sameServiceUnit} from '../utils/quoteSchedule';
import {validateProvenance,type SinapiProvenance} from '../utils/sinapiRegional';

const origin=(import.meta.env.VITE_SUPABASE_URL||'').replace(/\/$/,'');
const apiKey=import.meta.env.VITE_SUPABASE_ANON_KEY||'';
export interface SavedSinapiUnitCost {
  code:string;
  unit:string;
  unitCost:number;
  source:SinapiProvenance;
  sourceFile:string;
}
async function call(session:Session,path:string,options:RequestInit={}):Promise<Response>{
  if(!origin||!apiKey||!session.access_token)throw Error('Faça login para acessar os preços SINAPI.');
  const r=await fetch(origin+path,{
    ...options,
    headers:{apikey:apiKey,Authorization:'Bearer '+session.access_token,
      ...(options.body?{'Content-Type':'application/json'}:{}),
      ...options.headers}
  });
  if(!r.ok){
    let reason='Consulta de custos SINAPI indisponível.';
    try{const data=await r.json();reason=String(data.message||data.error||reason);}catch{}
    throw Error(reason+' (HTTP '+r.status+')');
  }
  return r;
}
/** Salva somente custos numéricos válidos, com sua origem explícita.
 * Não grava preços de venda e não modifica propostas já criadas.
 */
export async function saveOfficialSinapiCosts(
  session:Session,entries:SinapiUnitCost[],sourceFile:string,
  onProgress?:(saved:number,total:number)=>void
):Promise<number>{
  if(!session.user.id)throw Error('Conta não autenticada.');
  if(!sourceFile.trim()||sourceFile.length>200)throw Error('Origem do arquivo SINAPI inválida.');
  if(!entries.length||entries.length>100000)throw Error('Arquivo sem custos oficiais válidos.');
  const keyed=new Map<string,SinapiUnitCost>();
  for(const entry of entries){
    validateProvenance(entry.source);
    if(!/^\d{3,8}$/.test(entry.code)||!entry.unit.trim()||
      !Number.isFinite(entry.unitCost)||entry.unitCost<=0||entry.unitCost>1e9)
      throw Error('Custo SINAPI inválido no arquivo.');
    const key=[entry.source.reference,entry.source.uf,entry.source.regime,
      entry.code,entry.unit.trim().toUpperCase()].join('|');
    const old=keyed.get(key);
    if(old&&Math.abs(old.unitCost-entry.unitCost)>0.0001)
      throw Error('Custos divergentes na mesma referência e unidade SINAPI.');
    keyed.set(key,entry);
  }
  const rows=[...keyed.values()];
  let stored=0;
  for(let i=0;i<rows.length;i+=120){
    const batch=rows.slice(i,i+120).map(v=>({
      user_id:session.user.id,reference:v.source.reference,uf:v.source.uf,
      regime:v.source.regime,code:v.code,unit:v.unit.trim().toUpperCase(),
      unit_cost:v.unitCost,source_file:sourceFile
    }));
    await call(session,
      '/rest/v1/orcapro_sinapi_unit_costs?on_conflict=user_id,reference,uf,regime,code,unit',
      {method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify(batch)});
    stored+=batch.length;
    onProgress?.(stored,rows.length);
  }
  return stored;
}
/** Retorna nulo quando o preço regional oficial ainda não foi importado.
 * Não busca outra UF, competência ou regime silenciosamente.
 */
export async function findOfficialSinapiCost(
  session:Session,composition:SinapiComposition,source:SinapiProvenance,
  signal?:AbortSignal
):Promise<SavedSinapiUnitCost|null>{
  validateProvenance(source);
  if(composition.reference&&composition.reference!==source.reference)
    throw Error('A competência da composição não corresponde à dos custos.');
  if(!/^\d{3,8}$/.test(composition.code))return null;
  const q=new URLSearchParams({
    select:'unit,unit_cost,source_file',
    user_id:'eq.'+session.user.id,
    reference:'eq.'+source.reference,
    uf:'eq.'+source.uf,
    regime:'eq.'+source.regime,
    code:'eq.'+composition.code,
    limit:'30'
  });
  const response=await call(session,'/rest/v1/orcapro_sinapi_unit_costs?'+q.toString(),
    {signal});
  const rows=await response.json() as Array<{unit:string;unit_cost:string|number;source_file:string}>;
  const found=Array.isArray(rows)?rows.find(row=>sameServiceUnit(row.unit,composition.unit)
    &&Number.isFinite(Number(row.unit_cost))&&Number(row.unit_cost)>0):undefined;
  if(!found)return null;
  return {code:composition.code,unit:found.unit,unitCost:Number(found.unit_cost),source:{...source},sourceFile:found.source_file};
}
