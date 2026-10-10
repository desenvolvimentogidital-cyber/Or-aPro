import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Consulta somente leitura ao catálogo SINPRES (terceiros). Não é API oficial CAIXA.
 * Não envia dados da obra/cliente, não usa segredos do Supabase, não grava resultados.
 * Limitar a URL a um host fixo evita proxy aberto/SSRF.
 */
const UPSTREAM='https://api.sinpres.com.br/api/v1/sectors/civil-construction/compositions';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, s-maxage=300, stale-while-revalidate=600'};
type Row={code:string;description:string;unit:string};
type Raw=Record<string,unknown>;
const record=(x:unknown):x is Raw=>typeof x==='object'&&x!==null&&!Array.isArray(x);

function sanitize(row:unknown):Row|null{
  if(!record(row))return null;
  const code=String(row.code??'').trim();
  const description=typeof row.description==='string'?row.description.trim():'';
  const unit=typeof row.unit==='string'?row.unit.trim():'';
  if(!/^\d{4,8}$/.test(code)||description.length<3||description.length>600||!unit||unit.length>24)return null;
  return {code,description,unit};
}
const reply=(res:ServerResponse,status:number,body:unknown)=>{
  res.writeHead(status,headers);
  res.end(JSON.stringify(body));
};

/** GET /api/sinapi-search?q=chuveiro ; códigos completos consultam detalhe. */
export default async function handler(req:IncomingMessage,res:ServerResponse){
  if(req.method!=='GET'){res.setHeader('Allow','GET');return reply(res,405,{error:'Use GET.'});}
  let params:URLSearchParams;
  try{params=new URL(req.url||'','http://localhost').searchParams;}catch{return reply(res,400,{error:'Consulta inválida.'});}
  const q=(params.get('q')||'').trim();
  if(q.length<2||q.length>100||/[<>\r\n]/.test(q))return reply(res,400,{error:'Informe um nome ou código SINAPI de 2 a 100 caracteres.'});
  const isFullCode=/^\d{5,8}$/.test(q);
  const target=isFullCode?`${UPSTREAM}/${q}`:`${UPSTREAM}?search=${encodeURIComponent(q)}&limit=30&include_total=false&compact=true`;
  try{
    const response=await fetch(target,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(7000)});
    if(response.status===404)return reply(res,200,{data:[],source:'SINPRES',message:'Nenhuma composição encontrada.'});
    if(response.status===429)return reply(res,503,{error:'O catálogo online atingiu o limite de consultas. Tente novamente em instantes.'});
    if(!response.ok)return reply(res,502,{error:'O catálogo externo não respondeu corretamente. Tente novamente ou importe sua referência.'});
    if(Number(response.headers.get('content-length')||0)>1_000_000)return reply(res,502,{error:'A resposta do catálogo excedeu o limite.'});
    const text=await response.text();
    if(text.length>1_000_000)return reply(res,502,{error:'A resposta do catálogo excedeu o limite.'});
    const data:unknown=JSON.parse(text);
    if(!record(data))return reply(res,502,{error:'Formato inesperado do catálogo externo.'});
    const rows=isFullCode?[data.data]:data.data;
    if(!Array.isArray(rows))return reply(res,502,{error:'O catálogo externo retornou dados incompatíveis.'});
    const results=rows.slice(0,30).map(sanitize).filter((v):v is Row=>!!v);
    return reply(res,200,{data:results,source:'SINPRES',note:'Consulta de terceiros baseada em publicações CAIXA/IBGE. Não contém HH verificadas neste retorno.'});
  }catch{
    return reply(res,503,{error:'Não foi possível consultar o catálogo online agora. Confira sua conexão ou use a importação.'});
  }
}
