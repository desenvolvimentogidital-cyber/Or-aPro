/**
 * Bases de composições de serviços não são índices monetários de reajuste.
 * A escolha aqui é um REGISTRO da referência preferida pelo usuário, não um
 * conector nem uma autorização para atribuir preços ou coeficientes inexistentes.
 */
export const costReferences=[
  {id:'SINAPI',name:'SINAPI — CAIXA / IBGE',group:'Nacionais'},
  {id:'SICRO',name:'SICRO — DNIT (transportes)',group:'Nacionais'},
  {id:'ORSE',name:'ORSE — Sergipe',group:'Estaduais / municipais'},
  {id:'SEINFRA_CE',name:'SEINFRA — Ceará',group:'Estaduais / municipais'},
  {id:'EMOP_RJ',name:'EMOP — Rio de Janeiro',group:'Estaduais / municipais'},
  {id:'SCO_RJ',name:'SCO — Município do Rio de Janeiro',group:'Estaduais / municipais'},
  {id:'CDHU_SP',name:'CDHU / CPOS — São Paulo',group:'Estaduais / municipais'},
  {id:'SUDECAP_BH',name:'SUDECAP — Belo Horizonte',group:'Estaduais / municipais'},
  {id:'SEDOP_PA',name:'SEDOP — Pará',group:'Estaduais / municipais'},
  {id:'SETOP_MG',name:'SETOP / SEINFRA — Minas Gerais',group:'Estaduais / municipais'},
  {id:'DER_SP',name:'DER — São Paulo',group:'Estaduais / municipais'},
  {id:'DER_MG',name:'DER — Minas Gerais',group:'Estaduais / municipais'},
  {id:'DER_PR',name:'DER — Paraná',group:'Estaduais / municipais'},
  {id:'TCPO',name:'TCPO — tabela privada / licenciada',group:'Privadas / internas'},
  {id:'PROPRIA',name:'Composição própria da empresa',group:'Privadas / internas'},
  {id:'OUTRA',name:'Outra base — informar o nome',group:'Privadas / internas'}
] as const;

export const adjustmentIndices=[
  {id:'NENHUM',name:'Sem índice de reajuste'},
  {id:'INCC',name:'INCC — custo da construção (FGV)'},
  {id:'IPCA',name:'IPCA — inflação (IBGE)'},
  {id:'INPC',name:'INPC — preços ao consumidor (IBGE)'},
  {id:'IGPM',name:'IGP-M — preços gerais (FGV)'},
  {id:'IGPDI',name:'IGP-DI — preços gerais (FGV)'},
  {id:'CUB',name:'CUB/m² — construção, por estado / padrão'},
  {id:'SINAPI_INDICE',name:'Índice / custo SINAPI (IBGE / CAIXA)'},
  {id:'OUTRO',name:'Outro índice — informar o nome'}
] as const;

export type CostReferenceCode=typeof costReferences[number]['id'];
export type AdjustmentIndexCode=typeof adjustmentIndices[number]['id'];
export interface ConstructionReferenceSettings {
  costReference: CostReferenceCode;
  customCostReference?: string;
  adjustmentIndex: AdjustmentIndexCode;
  customAdjustmentIndex?: string;
  baseMonth?: string; // MM/AAAA, informada pelo usuário, não calculada
  uf?: string; // UF informada pelo usuário; não vincula automaticamente tabelas
}

export function defaultConstructionReferences(): ConstructionReferenceSettings {
  return {costReference:'SINAPI',adjustmentIndex:'NENHUM'};
}

export function costReferenceName(setting?: Partial<ConstructionReferenceSettings>): string {
  const id=setting?.costReference||'SINAPI';
  if(id==='OUTRA')return setting?.customCostReference?.trim()||'Outra base (não informada)';
  return costReferences.find(s=>s.id===id)?.name||'Base não reconhecida';
}

export function adjustmentIndexName(setting?: Partial<ConstructionReferenceSettings>): string {
  const id=setting?.adjustmentIndex||'NENHUM';
  if(id==='OUTRO')return setting?.customAdjustmentIndex?.trim()||'Outro índice (não informado)';
  return adjustmentIndices.find(s=>s.id===id)?.name||'Índice não reconhecido';
}

export function validReferenceSettings(settings:ConstructionReferenceSettings): boolean {
  if(!costReferences.some(v=>v.id===settings.costReference))return false;
  if(!adjustmentIndices.some(v=>v.id===settings.adjustmentIndex))return false;
  if(settings.costReference==='OUTRA' && !settings.customCostReference?.trim())return false;
  if(settings.adjustmentIndex==='OUTRO' && !settings.customAdjustmentIndex?.trim())return false;
  if((settings.customCostReference||'').length>90||(settings.customAdjustmentIndex||'').length>90)return false;
  if(settings.baseMonth && !/^(0[1-9]|1[0-2])\/\d{4}$/.test(settings.baseMonth))return false;
  if(settings.uf && !/^[A-Z]{2}$/.test(settings.uf))return false;
  return true;
}
