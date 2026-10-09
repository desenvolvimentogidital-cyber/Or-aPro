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
