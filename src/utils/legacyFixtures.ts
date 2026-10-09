/** Blocks accidental migration of known pre-release example records.
 * This checks identifiers from the old demo bundle; real user-created identifiers
 * use UUID suffixes instead. It does not automatically delete any user data. */
export function containsOldExampleRecords(data: {
  quotes?: { id: string }[]; clients?: { id: string }[];
  catalog?: { id: string }[]; expenses?: { id: string }[];
  company?: { name?: string; tradeName?: string };
}): boolean {
  const anyMatch = (entries: { id: string }[] | undefined, pattern: RegExp) =>
    Array.isArray(entries) && entries.some(item => pattern.test(item.id));
  return anyMatch(data.quotes, /^orc-(?:15|16|17|18)$/)
    || anyMatch(data.clients, /^cli-[1-5]$/)
    || anyMatch(data.catalog, /^(?:mat-[1-6]|srv-[1-5]|mdo-[1-3])$/)
    || anyMatch(data.expenses, /^exp-[1-8]$/)
    || data.company?.name === 'Elétrica Plus Soluções em Energia Ltda'
    || data.company?.tradeName === 'Elétrica Plus';
}
