/** Cronogramas estimados a partir de coeficientes de mão de obra informados pelo usuário. */
export interface SinapiLabor {
  code: string;
  role: string;
  hoursPerUnit: number; // h da categoria profissional por unidade de composição (coeficiente SINAPI)
}
export interface SinapiComposition {
  code: string;
  description: string;
  unit: string;
  labor: SinapiLabor[];
  sourceFile: string;
  sourceSheet: string;
  reference?: string; // Competência MM/AAAA identificada no conteúdo da planilha
  uf?: import('../utils/sinapiRegional').SinapiUF; // Localidade declarada pelo usuário
  regime?: import('../utils/sinapiRegional').SinapiRegime; // Encargos declarados pelo usuário
}
export interface TaskProgressEntry {
  id: string;
  date: string; // Date work was measured, yyyy-mm-dd
  quantity: number; // Incremental quantity effectively performed, never estimated
  note?: string;
  recordedAt: string;
}
export interface ScheduleTask {
  id: string;
  composition: SinapiComposition;
  quantity: number;
  crew: Record<string, number>; // Pessoas POR profissão. Ausência => previsão pendente, não inventar efetivo.
  notes?: string;
  progress?: TaskProgressEntry[]; // Real measurements; absence means none recorded.
  dependencies?: string[]; // IDs das etapas predecessoras; apenas no modo dependencias
  quoteItemId?: string; // associação explícita ao item financeiro da proposta
}
export interface WorkDiaryEntry {
  id: string;
  date: string; // date reported by responsible person, not inferred
  kind: 'diario' | 'ocorrencia' | 'inspecao';
  description: string;
  responsible: string;
  workerCount?: number; // number present on site; optional, not assumed
  createdAt: string;
}
export type OperationalStatus = 'planejamento' | 'em_execucao' | 'paralisada' | 'concluida';
export interface WorkSchedule {
  id: string;
  title: string;
  siteAddress?: string; // Local da obra informado pelo responsável; não usar endereço da empresa como obra.
  quoteId?: string;
  referenceSettings?: import('../utils/constructionReferences').ConstructionReferenceSettings; // Preferência da obra, sem alterar composições existentes
  startDate: string;
  hoursPerDay: number;
  efficiency: number; // 0 < eficiência <= 1; ajustada manualmente pelo responsável
  tasks: ScheduleTask[];
  createdAt: string;
  updatedAt: string;
  scheduleMode?: 'sequencial' | 'dependencias'; // ausência preserva cronogramas antigos
  dependenciesConfigured?: boolean; // evita sobrescrever vínculos ao alternar modos
  holidays?: string[]; // Datas não úteis informadas pelo responsável, yyyy-mm-dd
  operationalStatus?: OperationalStatus; // manual status, not inferred from quote approval
  responsible?: string; // responsible person declared by user
  diary?: WorkDiaryEntry[]; // operational activity log, user-entered, never generated automatically
}
