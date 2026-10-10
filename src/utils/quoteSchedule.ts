import type { QuoteItem } from '../types/index';
import type { SinapiComposition } from '../types/schedule';

/** Equivalências tipográficas, sem transformar unidades fisicamente diferentes. */
export function sameServiceUnit(a: string, b: string): boolean {
  const canonical = (v: string) => String(v || '').normalize('NFKC').toUpperCase()
    .replace(/²/g, '2').replace(/³/g, '3').replace(/\s+/g, '');
  return canonical(a) !== '' && canonical(a) === canonical(b);
}

const text = (v: string) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const stop = new Set(['PARA','COM','SEM','DE','DA','DO','DOS','DAS','EM','NA','NO','NOS',
  'E','OU','SERVICO','EXECUCAO','FORNECIMENTO','INSTALACAO','APLICACAO','UNIDADE',
  'INCLUSO','INCLUSA','TIPO','AREA','METRO','CONFORME','MATERIAL']);
const words = (value: string) => new Set(text(value).split(/\s+/)
  .filter(x => x.length >= 4 && !stop.has(x)));
const codeIn = (value: string, code: string) => new RegExp('(?:^|\\D)'+code+'(?:\\D|$)').test(value);

/** Sugestões APENAS para seleção humana; nomes parecidos não autorizam associação automática. */
export function findQuoteSinapiCandidates(
  item: Pick<QuoteItem,'name'|'unit'>,
  compositions: SinapiComposition[],
  query = '',
  limit = 12
): SinapiComposition[] {
  const needle = text(query);
  const tokens = words(item.name);
  if (compositions.length > 120000 || limit < 1) return [];
  const ranked: Array<{entry: SinapiComposition; score: number}> = [];
  for (const entry of compositions) {
    if (!sameServiceUnit(item.unit, entry.unit) || !entry.labor.length) continue;
    const description = text(entry.description);
    const exactCode = codeIn(text(item.name), entry.code);
    if (needle && !text(entry.code+' '+entry.description).includes(needle)) continue;
    const entryTokens = words(entry.description);
    const shared = [...tokens].filter(w=>entryTokens.has(w)).length;
    // Pesquisa manual mostra opções mesmo sem palavra coincidente com o orçamento.
    if (!needle && !exactCode && !shared) continue;
    const score = (exactCode?10000:0) + shared*100 +
      (tokens.size ? Math.round(shared / tokens.size * 25) : 0);
    ranked.push({entry,score});
  }
  ranked.sort((a,b)=>b.score-a.score || a.entry.code.localeCompare(b.entry.code));
  return ranked.slice(0,Math.min(60,limit)).map(x=>x.entry);
}

/** Uma profissão deve aparecer uma única vez na equipe, mesmo quando o Analítico
 * traz a mesma composição auxiliar em várias linhas. Coeficientes são horas
 * por unidade; nunca porcentagens de custo. */
export interface LaborDemand {
  role: string;
  code: string;
  coefficient: number;
  hours: number;
}
export function laborDemandForQuantity(composition: SinapiComposition, quantity: number): LaborDemand[] {
  if (!Number.isFinite(quantity) || quantity <= 0 ||
      !Array.isArray(composition.labor) || !composition.labor.length || composition.labor.length > 50)
    throw new Error('Quantidade ou composição analítica inválida.');
  const grouped = new Map<string, LaborDemand>();
  for (const line of composition.labor) {
    if (!line || !line.code?.trim() || !line.role?.trim() ||
        !Number.isFinite(line.hoursPerUnit) || line.hoursPerUnit <= 0)
      throw new Error('Esta composição não possui coeficientes de mão de obra válidos.');
    const key = `${line.code}:${line.role}`;
    const old = grouped.get(key);
    const coefficient = (old?.coefficient || 0) + line.hoursPerUnit;
    const hours = coefficient * quantity;
    if (!Number.isFinite(coefficient) || !Number.isFinite(hours) || hours <= 0)
      throw new Error('HH calculadas fora do limite.');
    grouped.set(key, {code: line.code, role: line.role, coefficient, hours});
  }
  return [...grouped.values()];
}

export interface SuggestedCrew {
  crew: Record<string,number>;
  labor: {role: string; code: string; coefficient: number; hours: number; workers: number}[];
  totalHH: number;
  projectedDays: number;
  targetDays: number | null;
}

/** Estima profissionais por profissão a partir das HH CONSOLIDADAS.
 * A duração é o maior gargalo profissional, e nunca soma dias de profissões paralelas.
 * Uma pessoa por função é somente um cenário inicial quando não há prazo-alvo.
 */
export function simulateCrewForQuote(
  composition: SinapiComposition, quantity: number,
  hoursPerDay: number, efficiency: number, targetDays?: number
): SuggestedCrew {
  if (!Number.isFinite(hoursPerDay) || hoursPerDay <= 0 || hoursPerDay > 24 ||
    !Number.isFinite(efficiency) || efficiency <= 0 || efficiency > 1 ||
    (targetDays !== undefined && (!Number.isSafeInteger(targetDays) || targetDays < 1 || targetDays > 10000))) {
    throw new Error('Jornada, eficiência ou prazo inválidos.');
  }
  const demand = laborDemandForQuantity(composition, quantity);
  const crew: Record<string,number> = {};
  const labor = demand.map(l=>{
    const workers = targetDays === undefined ? 1 :
      Math.max(1,Math.ceil(l.hours / (targetDays * hoursPerDay * efficiency)));
    if (workers > 500) throw new Error('O prazo exige mais de 500 profissionais por função. Revise a equipe ou o prazo.');
    crew[`${l.code}:${l.role}`] = workers;
    return {...l, workers};
  });
  const projectedDays = Math.max(1,...labor.map(l=>Math.ceil(l.hours / (l.workers * hoursPerDay * efficiency))));
  if(projectedDays > 10000)throw new Error('Duração fora do limite de 10.000 dias úteis.');
  return {crew,labor,totalHH:labor.reduce((sum,l)=>sum+l.hours,0),projectedDays,targetDays:targetDays??null};
}
