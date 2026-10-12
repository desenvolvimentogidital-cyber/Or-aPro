import type { WorkspaceData } from '../types/workspace';

/**
 * Assinatura determinística dos campos persistidos. Listas opcionais ausentes
 * em workspaces antigos equivalem a listas vazias. Com isso a hidratação do
 * estado não provoca uma escrita sem alterações.
 */
export function workspaceSignature(data: WorkspaceData): string {
  return JSON.stringify({
    quotes: data.quotes,
    clients: data.clients,
    catalog: data.catalog,
    expenses: data.expenses,
    company: data.company,
    notifications: data.notifications,
    schedules: data.schedules ?? [],
    financeEntries: data.financeEntries ?? [],
    lastQuoteNumber: data.lastQuoteNumber ?? 0
  });
}

export function needsWorkspaceSave(data: WorkspaceData, savedSignature: string | null): boolean {
  return workspaceSignature(data) !== savedSignature;
}

/**
 * Conciliação de três versões (base editada, alterações locais e nuvem).
 * Registros são independentes por ID. Se o MESMO registro mudou em ambas as
 * sessões, bloqueamos a mesclagem, inclusive exclusão versus edição.
 * Nunca resolvemos o conflito sobrescrevendo dados de outra sessão.
 */
export function reconcileWorkspaces(base: WorkspaceData, local: WorkspaceData, remote: WorkspaceData):
  { merged: WorkspaceData | null; conflicts: string[] } {
  const conflicts: string[] = [];
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const choose = <T>(baseValue:T|undefined, localValue:T|undefined, remoteValue:T|undefined, field:string):T|undefined => {
    if (same(localValue, remoteValue) || same(remoteValue, baseValue)) return localValue;
    if (same(localValue, baseValue)) return remoteValue;
    conflicts.push(field);
    return remoteValue;
  };
  const collection = <T extends {id:string}>(name:string, previous:readonly T[]|undefined,
    ours:readonly T[]|undefined, theirs:readonly T[]|undefined):T[] => {
    const values=[previous??[],ours??[],theirs??[]];
    const maps=values.map(rows=>new Map(rows.map(item=>[item.id,item])));
    for (let i=0;i<3;i++) if(maps[i].size!==values[i].length)
      conflicts.push(name+' (identificadores repetidos)');
    // Preserva a ordem da nuvem e depois adiciona somente os registros locais novos.
    const ids=[...new Set([...(theirs??[]).map(x=>x.id),
      ...(ours??[]).map(x=>x.id),...(previous??[]).map(x=>x.id)])];
    const merged:T[]=[];
    for(const id of ids){
      const item=choose(maps[0].get(id),maps[1].get(id),maps[2].get(id),name+' ('+id+')');
      if(item!==undefined)merged.push(item);
    }
    return merged;
  };
  const company=Object.fromEntries(
    [...new Set([...Object.keys(base.company??{}),...Object.keys(local.company??{}),...Object.keys(remote.company??{})])]
      .map(k=>[k,choose(
        (base.company as unknown as Record<string,unknown>)[k],
        (local.company as unknown as Record<string,unknown>)[k],
        (remote.company as unknown as Record<string,unknown>)[k],
        'Dados da empresa ('+k+')'
      )])
  ) as unknown as WorkspaceData['company'];
  const merged:WorkspaceData = {
    quotes:collection('Orçamentos',base.quotes,local.quotes,remote.quotes),
    clients:collection('Clientes',base.clients,local.clients,remote.clients),
    catalog:collection('Catálogo',base.catalog,local.catalog,remote.catalog),
    expenses:collection('Despesas mensais',base.expenses,local.expenses,remote.expenses),
    company,
    notifications:collection('Notificações',base.notifications,local.notifications,remote.notifications),
    schedules:collection('Obras e cronogramas',base.schedules,local.schedules,remote.schedules),
    financeEntries:collection('Financeiro',base.financeEntries,local.financeEntries,remote.financeEntries),
    lastQuoteNumber:Math.max(base.lastQuoteNumber??0,local.lastQuoteNumber??0,remote.lastQuoteNumber??0)
  };
  // Duas sessões criando orçamentos distintos com o mesmo número não podem ser
  // mescladas automaticamente; a numeração comercial ficaria ambígua.
  const numbers=new Map<string,string>();
  for(const q of merged.quotes){
    if(!q.number)continue;
    const id=numbers.get(q.number);
    if(id&&id!==q.id)conflicts.push('Numeração dos orçamentos ('+q.number+')');
    numbers.set(q.number,q.id);
  }
  return conflicts.length?{merged:null,conflicts:[...new Set(conflicts)]}:{merged,conflicts:[]};
}
