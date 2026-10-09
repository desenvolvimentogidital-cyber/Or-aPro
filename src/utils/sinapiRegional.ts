import type {SinapiComposition} from '../types/schedule';

// A origem regional dos preços SINAPI não se confunde com os coeficientes HH.
export const sinapiUFs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'] as const;
export type SinapiUF = typeof sinapiUFs[number];
export type SinapiRegime = 'sem_desoneracao' | 'com_desoneracao';
export interface SinapiProvenance { uf: SinapiUF; reference: string; regime: SinapiRegime; }
export const validCompetence = (input: string) => /^(0[1-9]|1[0-2])\/20\d{2}$/.test(input);
export function validateProvenance(value: SinapiProvenance) {
  if (!sinapiUFs.includes(value.uf)) throw new Error('Selecione uma UF brasileira válida.');
  if (!validCompetence(value.reference)) throw new Error('A competência deve usar MM/AAAA.');
  if (!['sem_desoneracao','com_desoneracao'].includes(value.regime)) throw new Error('Selecione o regime de encargos.');
}
export function withSinapiProvenance(comp: SinapiComposition, value: SinapiProvenance): SinapiComposition {
  validateProvenance(value);
  if (comp.reference && comp.reference !== value.reference) {
    throw new Error(`A planilha é da competência ${comp.reference}; não é permitido gravar como ${value.reference}.`);
  }
  return {...comp, reference:value.reference, uf:value.uf, regime:value.regime, labor:comp.labor.map(l=>({...l}))};
}
export function sinapiOriginLabel(c:SinapiComposition):string {
  const parts=[c.reference||'competência não informada',c.uf||'UF não informada',c.regime==='com_desoneracao'?'com desoneração':c.regime==='sem_desoneracao'?'sem desoneração':'regime não informado'];
  return parts.join(' · ');
}
