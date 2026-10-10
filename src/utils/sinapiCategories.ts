import type { SinapiComposition } from '../types/schedule';

/** Categorias de execução são deduzidas das profissões do Analítico,
 * não do nome comercial do orçamento. Nunca separam HH de uma composição
 * mista nem removem uma categoria profissional de uma composição oficial.
 */
export type SinapiCategory = 'eletrica' | 'hidraulica' | 'mista' | 'pintura' |
  'revestimento' | 'alvenaria' | 'civil' | 'outras';
export type SinapiCategoryFilter = 'todas' | SinapiCategory;

export const sinapiCategoryOptions: readonly {value:SinapiCategoryFilter;label:string}[] = [
  {value:'todas',label:'Todas as especialidades'},
  {value:'eletrica',label:'Elétrica (sem encanador)'},
  {value:'hidraulica',label:'Hidráulica (sem eletricista)'},
  {value:'mista',label:'Mista: elétrica e hidráulica'},
  {value:'pintura',label:'Pintura'},
  {value:'revestimento',label:'Revestimentos e pisos'},
  {value:'alvenaria',label:'Alvenaria'},
  {value:'civil',label:'Outros serviços civis'},
  {value:'outras',label:'Outras especialidades'}
];

const norm=(s:string)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const electrical=(r:string)=>/ELETRICISTA|ELETROTECNICO|INSTALADOR ELETRICO|CABISTA/.test(r);
const hydraulic=(r:string)=>/ENCANADOR|BOMBEIRO HIDRAULICO|INSTALADOR HIDRAULICO/.test(r);
const general=(r:string)=>/SERVENTE|MOTORISTA|OPERADOR|AJUDANTE GERAL/.test(r);

export function categoryOfSinapi(c:Pick<SinapiComposition,'labor'|'description'>):SinapiCategory {
  const roles=(c.labor||[]).map(l=>norm(l.role));
  const electric=roles.some(electrical),water=roles.some(hydraulic);
  if(electric&&water)return 'mista';
  if(electric)return 'eletrica';
  if(water)return 'hidraulica';
  if(roles.some(r=>/PINTOR/.test(r)))return 'pintura';
  if(roles.some(r=>/AZULEJISTA|LADRILHISTA|REVESTIDOR|ASSENTADOR/.test(r)))return 'revestimento';
  const d=norm(c.description);
  if(roles.some(r=>/PEDREIRO/.test(r)) && /ALVENARIA|TIJOLO|BLOCO/.test(d))return 'alvenaria';
  if(roles.some(r=>/PEDREIRO|CARPINTEIRO|ARMADOR|MESTRE DE OBRAS/.test(r)))return 'civil';
  // Não deduzir especialidade a partir de palavras em serviços com
  // mão de obra desconhecida. O filtro elétrico requer ELETRICISTA real.
  return 'outras';
}

export const matchesSinapiCategory=(c:Pick<SinapiComposition,'labor'|'description'>,
  filter:SinapiCategoryFilter)=>filter==='todas'||categoryOfSinapi(c)===filter;

export const categoryLabel=(c:Pick<SinapiComposition,'labor'|'description'>)=>
  sinapiCategoryOptions.find(x=>x.value===categoryOfSinapi(c))?.label||'Outras especialidades';

export const categorySearchHint=(filter:SinapiCategoryFilter):string=>({
  todas:'',eletrica:'eletrica',hidraulica:'hidraulica',mista:'instalacao',
  pintura:'pintura',revestimento:'revestimento',alvenaria:'alvenaria',
  civil:'alvenaria',outras:'servico'
})[filter];
