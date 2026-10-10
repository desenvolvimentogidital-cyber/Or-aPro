import type {Session} from './cloud';
import type {SinapiComposition} from '../types/schedule';
import {validCompetence} from '../utils/sinapiRegional';

const origin=(import.meta.env.VITE_SUPABASE_URL||'').replace(/\/$/,'');
const apiKey=import.meta.env.VITE_SUPABASE_ANON_KEY||'';

function headers(session:Session,json=false):Record<string,string> {
  return {apikey:apiKey,Authorization:'Bearer '+session.access_token,
    ...(json?{'Content-Type':'application/json'}:{})};
}
async function request(session:Session,path:string,options:RequestInit={}):Promise<Response>{
  if(!origin||!apiKey)throw Error('Conexão com a base Supabase não configurada.');
  const response=await fetch(origin+path,{...options,headers:{...headers(session,!!options.body),...options.headers}});
  if(!response.ok){
    let message='Erro ao consultar a biblioteca SINAPI.';
    try{const body=await response.json();message=body.message||body.error||message;}catch{/* Resposta sem JSON */}
    if(response.status===404)message='Biblioteca SINAPI ainda não instalada neste servidor.';
    throw Error(message+' (HTTP '+response.status+').');
  }
  return response;
}

export function isAnalyticalSinapi(c:SinapiComposition):boolean {
  return !!c&&/^\d{3,8}$/.test(c.code)&&typeof c.description==='string'
    &&c.description.length>=3&&typeof c.unit==='string'&&!!c.unit.trim()
    &&Array.isArray(c.labor)&&c.labor.length>0&&c.labor.length<=50
    &&c.labor.every(l=>!!l&&typeof l.code==='string'&&typeof l.role==='string'
      &&Number.isFinite(l.hoursPerUnit)&&l.hoursPerUnit>0);
}

/** Indexa uma referência analítica completa na própria conta; não salva no workspace JSONB. */
export async function saveSinapiLibrary(
  session:Session,compositions:SinapiComposition[],
  fallbackReference:string,onProgress?:(saved:number,total:number)=>void,
):Promise<number>{
  if(!validCompetence(fallbackReference))throw Error('Informe a competência SINAPI MM/AAAA do arquivo.');
  if(compositions.length<1||compositions.length>120000)throw Error('Quantidade de composições fora do limite.');
  const unique=new Map<string,SinapiComposition>();
  for(const item of compositions){
    if(!isAnalyticalSinapi(item))continue;
    const month=item.reference||fallbackReference;
    if(!validCompetence(month)||month!==fallbackReference)
      throw Error('A competência da planilha é diferente da escolhida. Não será alterada.');
    unique.set(month+'|'+item.code,item);
  }
  if(!unique.size)throw Error('O arquivo não possui composição com coeficientes HH completos.');
  const entries=[...unique.values()];
  let saved=0;
  // 120 linhas por requisição: seguro para planilhas grandes e limites do PostgREST.
  for(let i=0;i<entries.length;i+=120){
    const subset=entries.slice(i,i+120);
    const payload=subset.map(c=>({
      user_id:session.user.id,reference:c.reference||fallbackReference,
      code:c.code,description:c.description,unit:c.unit,labor:c.labor,
      source_file:c.sourceFile.slice(0,200),source_sheet:c.sourceSheet.slice(0,100)
    }));
    await request(session,
      '/rest/v1/orcapro_sinapi_compositions?on_conflict=user_id,reference,code',
      {method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify(payload)});
    saved+=subset.length;
    onProgress?.(saved,entries.length);
  }
  return saved;
}

export async function countSavedSinapi(session:Session):Promise<number>{
  const response=await request(session,
    '/rest/v1/rpc/orcapro_sinapi_library_count',
    {method:'POST',body:'{}'});
  const count=await response.json() as number;
  return Number.isSafeInteger(count)&&count>=0?count:0;
}

export async function searchSavedSinapi(session:Session,term:string,signal?:AbortSignal):
  Promise<SinapiComposition[]>{
  if(term.trim().length<2)return [];
  const response=await request(session,'/rest/v1/rpc/orcapro_find_sinapi',
    {method:'POST',signal,body:JSON.stringify({p_query:term.trim().slice(0,100),p_limit:60})});
  const rows=await response.json() as SinapiComposition[];
  return Array.isArray(rows)?rows.filter(isAnalyticalSinapi).slice(0,60):[];
}
