import type { SinapiComposition } from '../types/schedule';

export interface SinapiOnlineResult {
  code:string;
  description:string;
  unit:string;
}
export interface SinapiOnlineSearch {
  data:SinapiOnlineResult[];
  source:'SINPRES';
  note?:string;
}
const valid=(value:unknown):value is SinapiOnlineResult=>{
  if(!value||typeof value!=='object')return false;
  const row=value as Partial<SinapiOnlineResult>;
  return typeof row.code==='string'&&/^\d{4,8}$/.test(row.code)
    && typeof row.description==='string'&&row.description.trim().length>2
    && typeof row.unit==='string'&&row.unit.trim().length>0;
};

/** Retorna apenas catálogo textual. Não fornece HH, preços ou equipe. */
export async function searchSinapiOnline(query:string,signal?:AbortSignal):Promise<SinapiOnlineResult[]>{
  const value=query.trim();
  if(value.length<2||value.length>100)return [];
  const response=await fetch('/api/sinapi-search?q='+encodeURIComponent(value),{signal});
  if(!response.ok){
    const text:unknown=await response.json().catch(()=>null);
    const error=text&&typeof text==='object'&&'error' in text?String(text.error):'Serviço SINAPI online indisponível.';
    throw new Error(error);
  }
  const data:unknown=await response.json();
  if(!data||typeof data!=='object'||!('data' in data)||!Array.isArray(data.data)){
    throw new Error('Resposta inesperada da consulta online SINAPI.');
  }
  return data.data.slice(0,30).filter(valid);
}

/**
 * Catálogo online não equivale ao relatório analítico SINAPI.
 * A etapa pode ser registrada como pendente, mas não ter prazo/HH inventados.
 */
export function onlineSinapiPendingComposition(item:SinapiOnlineResult):SinapiComposition{
  if(!valid(item))throw Error('Composição online inválida.');
  return {
    code:item.code,description:item.description,unit:item.unit,labor:[],
    sourceFile:'SINPRES — catálogo público derivado da CAIXA (fonte não oficial)',
    sourceSheet:'Consulta textual, sem coeficientes analíticos de mão de obra'
  };
}
