import type {Session} from './cloud';
import type {SinapiComposition} from '../types/schedule';
import {sameServiceUnit} from '../utils/quoteSchedule';
import {validateProvenance,type SinapiProvenance} from '../utils/sinapiRegional';

const origin=(import.meta.env.VITE_SUPABASE_URL||'').replace(/\/$/,'');
const anonKey=import.meta.env.VITE_SUPABASE_ANON_KEY||'';
export interface SinapiWorkerCost {
  code:string; role:string; hoursPerUnit:number;
  hourlyCost:number|null; subtotal:number|null;
}
export interface SinapiLaborEstimate {
  unitCost:number|null;
  workers:SinapiWorkerCost[];
  missingRoles:string[];
  source:SinapiProvenance;
}
/** Mão de obra sem insumos materiais do serviço:
 * somatório de H (coeficiente profissional) x custo oficial H com encargos.
 * Trata composições auxiliares não-profissionais como incompletas em vez de
 * assumir que o custo restante do serviço corresponde só a materiais.
 */
export function calculateSinapiLaborOnly(
  composition:SinapiComposition,source:SinapiProvenance,
  hourlyRates:Record<string,number>
):SinapiLaborEstimate{
  validateProvenance(source);
  if(!Array.isArray(composition.labor)||!composition.labor.length||composition.labor.length>50)
    throw Error('Composição sem coeficientes de profissionais conferidos.');
  const grouped=new Map<string,SinapiWorkerCost>();
  for(const l of composition.labor){
    if(!/^\d{3,8}$/.test(l.code)||!Number.isFinite(l.hoursPerUnit)||l.hoursPerUnit<=0)
      throw Error('Coeficiente de mão de obra inválido.');
    const id=l.code+':'+l.role;
    const existing=grouped.get(id);
    const hours=(existing?.hoursPerUnit||0)+l.hoursPerUnit;
    const hourly=hourlyRates[l.code];
    const valid=Number.isFinite(hourly)&&hourly>0&&hourly<1e7;
    grouped.set(id,{code:l.code,role:l.role,hoursPerUnit:hours,
      hourlyCost:valid?hourly:null,subtotal:valid?hours*hourly:null});
  }
  const workers=[...grouped.values()];
  const missingRoles=workers.filter(w=>w.hourlyCost===null).map(w=>w.role);
  const amount=workers.reduce((sum,w)=>sum+(w.subtotal||0),0);
  return {workers,missingRoles,unitCost:missingRoles.length?null:
    Math.round((amount+Number.EPSILON)*100)/100,source};
}
function authHeaders(session:Session){
  if(!origin||!anonKey||!session.access_token||!session.user.id)
    throw Error('Faça login para consultar os custos de profissionais.');
  return {apikey:anonKey,Authorization:'Bearer '+session.access_token};
}
async function query(session:Session,path:string,signal?:AbortSignal){
  const response=await fetch(origin+path,{headers:authHeaders(session),signal});
  if(!response.ok)throw Error('Não foi possível consultar os custos horários SINAPI (HTTP '+response.status+').');
  return response.json();
}
export async function findSinapiLaborOnlyCost(
  session:Session,composition:SinapiComposition,source:SinapiProvenance,
  signal?:AbortSignal
):Promise<SinapiLaborEstimate>{
  validateProvenance(source);
  if(composition.reference&&composition.reference!==source.reference)
    throw Error('Competência SINAPI diferente da composição escolhida.');
  const codes=[...new Set(composition.labor.map(l=>l.code))];
  if(!codes.length||codes.length>50||codes.some(c=>!/^\d{3,8}$/.test(c)))
    throw Error('Composição sem profissionais válidos para estimar mão de obra.');
  const inCodes='in.('+codes.join(',')+')';
  const personal=new URLSearchParams({select:'code,unit,unit_cost',
    user_id:'eq.'+session.user.id,reference:'eq.'+source.reference,
    uf:'eq.'+source.uf,regime:'eq.'+source.regime,
    code:inCodes,limit:'100'});
  const publicCosts=new URLSearchParams({select:'code,unit,costs_in_cents',
    reference:'eq.'+source.reference,code:inCodes,limit:'100'});
  const [userRows,publicRows]=await Promise.all([
    query(session,'/rest/v1/orcapro_sinapi_unit_costs?'+personal,signal),
    query(session,'/rest/v1/orcapro_sinapi_published_unit_costs?'+publicCosts,signal)
  ]) as [
    Array<{code:string;unit:string;unit_cost:number|string}>,
    Array<{code:string;unit:string;costs_in_cents:Record<string,Record<string,number>>}>
  ];
  if(!Array.isArray(userRows)||!Array.isArray(publicRows))
    throw Error('Dados regionais de custos inválidos.');
  const rates:Record<string,number>={};
  for(const r of publicRows){
    const cents=r.costs_in_cents?.[source.regime]?.[source.uf];
    if(codes.includes(r.code)&&sameServiceUnit(r.unit,'H')&&Number.isSafeInteger(cents)&&cents>0)
      rates[r.code]=cents/100;
  }
  // Preço horário importado na conta prevalece sobre a referência pública.
  for(const r of userRows){
    const cost=Number(r.unit_cost);
    if(codes.includes(r.code)&&sameServiceUnit(r.unit,'H')&&Number.isFinite(cost)&&cost>0)
      rates[r.code]=cost;
  }
  return calculateSinapiLaborOnly(composition,source,rates);
}
