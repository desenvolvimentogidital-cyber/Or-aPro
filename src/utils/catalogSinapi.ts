import type { CatalogItem, QuoteItem } from '../types/index';
import type { SinapiComposition } from '../types/schedule';
import { sameServiceUnit } from './quoteSchedule.js';
import { sinapiUFs, validCompetence } from './sinapiRegional.js';

/** Associações persistentes contêm a composição analítica real, NUNCA custos resumidos ou HH inferidas do nome. */
export function usableSinapiComposition(value: unknown): value is SinapiComposition {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<SinapiComposition>;
  return typeof entry.code === 'string' && /^\d{4,8}$/.test(entry.code)
    && typeof entry.description === 'string' && entry.description.trim().length > 0
    && typeof entry.unit === 'string' && entry.unit.trim().length > 0
    && typeof entry.sourceFile === 'string' && entry.sourceFile.trim().length > 0
    && typeof entry.sourceSheet === 'string' && entry.sourceSheet.trim().length > 0
    && typeof entry.reference === 'string' && validCompetence(entry.reference)
    && !!entry.uf && sinapiUFs.includes(entry.uf)
    && (entry.regime === 'com_desoneracao' || entry.regime === 'sem_desoneracao')
    && Array.isArray(entry.labor) && entry.labor.length > 0 && entry.labor.length <= 50
    && entry.labor.every(row=>!!row && typeof row.code === 'string'
      && typeof row.role === 'string' && row.role.trim().length > 0
      && typeof row.hoursPerUnit === 'number' && Number.isFinite(row.hoursPerUnit)
      && row.hoursPerUnit > 0);
}

const normalized=(s:string)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const stop=new Set(['A','O','E','DA','DE','DO','DAS','DOS','EM','COM','PARA','UMA','UM',
  'SERVICO','SERVICOS','EXECUCAO','INSTALACAO','INSTALACOES','INSTALAR','INSTALANDO',
  'COLOCACAO','COLOCAR','APLICACAO','APLICAR','FORNECIMENTO','FORNECER','TROCA',
  'SUBSTITUICAO','UNIDADE','TIPO','INCLUSO','INCLUSA','GERAL','OBRA','POR']);
const stems=(s:string)=>new Set(normalized(s).split(/\s+/).filter(x=>x.length>2&&!stop.has(x))
  .map(x=>x.length>4 && x.endsWith('S') ? x.slice(0,-1):x));
const containsCode=(s:string,code:string)=>/^\d{4,8}$/.test(code)
  && new RegExp('(?:^|\\D)'+code+'(?:\\D|$)').test(s);

/** Busca por termos significativos, acentos e plural; exige escolha humana da composição. */
export function findCatalogSinapiCandidates(
  item: Pick<CatalogItem,'name'|'unit'>,
  compositions: SinapiComposition[],
  query = '',
  limit = 20
): SinapiComposition[] {
  if(compositions.length>120000 || !Number.isSafeInteger(limit) || limit<1) return [];
  const wanted=stems(item.name),searched=stems(query);
  const rawQuery=normalized(query),rawName=normalized(item.name);
  // Aceita código SINAPI inteiro, prefixo (ex.: 919) e "SINAPI 91996".
  const codePart=rawQuery.match(/(?:^| )(\d{3,8})(?: |$)/)?.[1]||'';
  const found:Array<{entry:SinapiComposition;score:number}>=[];
  for(const entry of compositions) {
    if(!entry || !Array.isArray(entry.labor) || !entry.labor.length) continue;
    const tokens=stems(entry.description);
    const codeName=containsCode(rawName,entry.code);
    const codeQuery=!!codePart && entry.code.startsWith(codePart);
    const same=[...wanted].filter(token=>tokens.has(token)).length;
    const queryMatch=[...searched].filter(token=>tokens.has(token)).length;
    if(rawQuery && !codeQuery && (searched.size===0 || queryMatch===0) &&
      !normalized(entry.description).includes(rawQuery))continue;
    if(!rawQuery && !codeName && same===0)continue;
    const exactUnit=sameServiceUnit(item.unit,entry.unit);
    const score=(codeQuery?(codePart===entry.code?12000:10000):0)+(codeName?5000:0)
      +(queryMatch*300)+(same*120)+(exactUnit?250:0)
      +((wanted.size && same===wanted.size)?80:0)
      +((searched.size && queryMatch===searched.size)?150:0);
    found.push({entry,score});
  }
  found.sort((a,b)=>b.score-a.score || a.entry.code.localeCompare(b.entry.code));
  return found.slice(0,Math.min(limit,60)).map(x=>x.entry);
}

/** A identidade da associação preserva competência, UF e fonte ao lado do código. */
export function compositionIdentity(entry:SinapiComposition):string {
  return [entry.code,entry.unit,entry.reference||'',entry.uf||'',entry.regime||'',entry.sourceFile,entry.sourceSheet].join('|');
}

/** Uma composição vinculada pelo próprio usuário pode ser usada depois de reiniciar o navegador. */
export function savedSinapiForQuote(item:QuoteItem,catalog:CatalogItem[]):SinapiComposition|undefined {
  if(usableSinapiComposition(item.sinapiComposition))return item.sinapiComposition;
  const byId=item.catalogItemId?catalog.find(c=>c.id===item.catalogItemId):undefined;
  if(byId && usableSinapiComposition(byId.sinapiComposition))return byId.sinapiComposition;
  // Orçamentos antigos não carregavam catalogItemId: somente correspondência não ambígua.
  const matches=catalog.filter(c=>c.type==='servico' && normalized(c.name)===normalized(item.name)
    && sameServiceUnit(c.unit,item.unit));
  return matches.length===1 && usableSinapiComposition(matches[0].sinapiComposition)
    ? matches[0].sinapiComposition : undefined;
}
