import type {WorkspaceData} from '../types/workspace';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function ensureRecords(value: unknown,name:string,max=30000): asserts value is Record<string,unknown>[] {
  if(!Array.isArray(value)||value.length>max||!value.every(object))throw Error(`Backup incompatível: lista ${name} inválida ou excessiva.`);
  const ids=new Set<string>();
  for(const row of value){
    if(typeof row.id!=='string'||row.id.length<1||row.id.length>200||ids.has(row.id)) throw Error(`Backup incompatível: identificadores de ${name} ausentes ou duplicados.`);
    ids.add(row.id);
  }
}
function monetary(v:unknown){return typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e12;}
/** Valida integralmente ANTES de substituir o estado em memória; nunca completa registros com dados fictícios. */
export function validateWorkspaceBackup(input:unknown): WorkspaceData {
  if(!object(input))throw Error('Backup não contém dados estruturados.');
  for(const key of ['quotes','clients','catalog','expenses','notifications'] as const)ensureRecords(input[key],key);
  if(input.schedules!==undefined)ensureRecords(input.schedules,'schedules',2000);
  if(input.financeEntries!==undefined)ensureRecords(input.financeEntries,'financeEntries',50000);
  if(!object(input.company)||typeof input.company.name!=='string')throw Error('Empresa inválida no backup.');
  if(input.lastQuoteNumber!==undefined&&(!Number.isSafeInteger(input.lastQuoteNumber)||Number(input.lastQuoteNumber)<0))throw Error('Numeração de orçamentos inválida.');
  for(const q of input.quotes as Record<string,unknown>[]){
    if(typeof q.number!=='string'||typeof q.clientId!=='string'||!monetary(q.total)||!Array.isArray(q.items)||q.items.length>5000)throw Error('Orçamento inválido no backup.');
    if(!q.items.every(object))throw Error('Itens de orçamento inválidos.');
    for(const item of q.items as Record<string,unknown>[])if(typeof item.name!=='string'||!monetary(item.quantity)||!monetary(item.unitPrice)||!monetary(item.totalPrice))throw Error('Valores inválidos em itens do orçamento.');
  }
  for(const item of input.catalog as Record<string,unknown>[])if(typeof item.name!=='string'||!monetary(item.price)||(item.cost!==undefined&&!monetary(item.cost)))throw Error('Itens de catálogo inválidos.');
  for(const s of (input.schedules||[]) as Record<string,unknown>[]) {
    if(typeof s.title!=='string'||!Array.isArray(s.tasks)||s.tasks.length>500)throw Error('Cronograma inválido no backup.');
    for(const t of s.tasks){if(!object(t)||!object(t.composition)||!Array.isArray(t.composition.labor)||!monetary(t.quantity)||!object(t.crew))throw Error('Etapas do cronograma inválidas.');}
  }
  for(const e of (input.financeEntries||[]) as Record<string,unknown>[]){if(!monetary(e.amount)||Number(e.amount)<=0||!['recebimento','despesa'].includes(String(e.type)))throw Error('Lançamentos financeiros inválidos.');}
  return input as unknown as WorkspaceData;
}
