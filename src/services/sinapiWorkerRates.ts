import type {Session} from './cloud';
import type {SinapiProvenance} from '../utils/sinapiRegional';
import {validateProvenance} from '../utils/sinapiRegional';

const url=(import.meta.env.VITE_SUPABASE_URL||'').replace(/\/$/,'');
const key=import.meta.env.VITE_SUPABASE_ANON_KEY||'';
export interface SinapiWorkerRole{code:string;role:string;compositions_count:number;}
export interface WorkerRate {hourlyCost:number;sourceFile:string;origin:'private'|'official';source:SinapiProvenance;}
async function get(session:Session,path:string,signal?:AbortSignal):Promise<any>{
  if(!url||!key||!session.access_token||!session.user.id)
    throw Error('Faça login para consultar os profissionais SINAPI.');
  const r=await fetch(url+path,{headers:{apikey:key,Authorization:'Bearer '+session.access_token},signal});
  if(!r.ok)throw Error(`Não foi possível consultar a referência de mão de obra (HTTP ${r.status}).`);
  return r.json();
}
export async function listSinapiWorkers(session:Session,signal?:AbortSignal):Promise<SinapiWorkerRole[]>{
  const rows=await get(session,'/rest/v1/rpc/orcapro_sinapi_worker_roles',signal);
  if(!Array.isArray(rows))throw Error('Lista de profissionais inválida.');
  return rows.filter(v=>/^\d{3,8}$/.test(v.code)&&typeof v.role==='string'&&v.role.length>=3)
    .map(v=>({code:v.code,role:v.role,compositions_count:Number(v.compositions_count)||0}));
}
export async function lookupSinapiWorkerHourly(
  session:Session,code:string,source:SinapiProvenance,signal?:AbortSignal
):Promise<WorkerRate|null>{
  validateProvenance(source);
  if(!/^\d{3,8}$/.test(code))throw Error('Código SINAPI de profissional inválido.');
  const personal=new URLSearchParams({select:'unit,unit_cost,source_file',
    user_id:'eq.'+session.user.id,reference:'eq.'+source.reference,
    uf:'eq.'+source.uf,regime:'eq.'+source.regime,code:'eq.'+code,limit:'10'});
  const rows=await get(session,'/rest/v1/orcapro_sinapi_unit_costs?'+personal,signal);
  if(!Array.isArray(rows))throw Error('Resposta de custos pessoais inválida.');
  const own=rows.find(v=>String(v.unit).toUpperCase()==='H'&&
    Number.isFinite(Number(v.unit_cost))&&Number(v.unit_cost)>0);
  if(own)return {hourlyCost:Number(own.unit_cost),sourceFile:own.source_file,
    origin:'private',source:{...source}};
  const params=new URLSearchParams({select:'unit,costs_in_cents,source_file',
    reference:'eq.'+source.reference,code:'eq.'+code,limit:'10'});
  const refs=await get(session,'/rest/v1/orcapro_sinapi_published_unit_costs?'+params,signal);
  if(!Array.isArray(refs))throw Error('Referência regional de custos inválida.');
  const published=refs.find(v=>String(v.unit).toUpperCase()==='H' &&
    Number.isSafeInteger(v.costs_in_cents?.[source.regime]?.[source.uf]) &&
    v.costs_in_cents[source.regime][source.uf]>0);
  if(!published)return null;
  return {hourlyCost:published.costs_in_cents[source.regime][source.uf]/100,
    sourceFile:published.source_file,origin:'official',source:{...source}};
}
