import React, {useId} from 'react';
import {adjustmentIndices,costReferences,defaultConstructionReferences,type ConstructionReferenceSettings,type CostReferenceCode,type AdjustmentIndexCode} from '../../utils/constructionReferences';
import {sinapiUFs} from '../../utils/sinapiRegional';

interface Props {
  value?: ConstructionReferenceSettings;
  onChange: (value: ConstructionReferenceSettings)=>void;
}

/**
 * A escolha é metadado da proposta/obra. Não promete carregar tabelas de preço,
 * obter licença TCPO ou aplicar automaticamente índices em dinheiro.
 */
export const ReferencePreferences:React.FC<Props>=({value,onChange})=>{
  const id=useId();
  const setting=value||defaultConstructionReferences();
  const control='mt-1.5 w-full min-h-11 rounded-xl border border-white/10 bg-[#0b0e15] px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500/70';
  const change=(patch:Partial<ConstructionReferenceSettings>)=>onChange({...setting,...patch});
  return <section aria-label="Referências de custos e reajuste" className="space-y-3 rounded-xl border border-white/10 bg-[#0b0e15]/60 p-3">
    <div>
      <h3 className="text-sm font-semibold text-white">Referências e índices escolhidos pelo usuário</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">A base de serviços serve para identificar composições e custos. O índice de reajuste é outra escolha, usada somente se prevista no contrato. Nenhum deles altera preços ou prazos automaticamente.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label htmlFor={id+'-basis'} className="text-xs font-medium text-slate-200">Base referencial de serviços
        <select id={id+'-basis'} aria-label="Base referencial de serviços" className={control} value={setting.costReference}
          onChange={e=>change({costReference:e.target.value as CostReferenceCode})}>
          {['Nacionais','Estaduais / municipais','Privadas / internas'].map(group=>
            <optgroup key={group} label={group}>
              {costReferences.filter(x=>x.group===group).map(x=><option value={x.id} key={x.id}>{x.name}</option>)}
            </optgroup>
          )}
        </select>
      </label>
      <label htmlFor={id+'-index'} className="text-xs font-medium text-slate-200">Índice de reajuste (opcional)
        <select id={id+'-index'} aria-label="Índice de reajuste" className={control} value={setting.adjustmentIndex}
          onChange={e=>change({adjustmentIndex:e.target.value as AdjustmentIndexCode})}>
          {adjustmentIndices.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}
        </select>
      </label>
      {setting.costReference==='OUTRA'&&<label htmlFor={id+'-basis-custom'} className="text-xs font-medium text-slate-200">Nome da outra base
        <input id={id+'-basis-custom'} className={control} aria-label="Nome da base personalizada" maxLength={90} value={setting.customCostReference||''}
          onChange={e=>change({customCostReference:e.target.value})} placeholder="Ex.: tabela municipal da sua região"/>
      </label>}
      {setting.adjustmentIndex==='OUTRO'&&<label htmlFor={id+'-index-custom'} className="text-xs font-medium text-slate-200">Nome do outro índice
        <input id={id+'-index-custom'} className={control} aria-label="Nome do índice personalizado" maxLength={90} value={setting.customAdjustmentIndex||''}
          onChange={e=>change({customAdjustmentIndex:e.target.value})} placeholder="Ex.: índice previsto no contrato"/>
      </label>}
      <label htmlFor={id+'-month'} className="text-xs font-medium text-slate-200">Competência da referência (opcional)
        <input id={id+'-month'} className={control} aria-label="Competência da base de referência" value={setting.baseMonth||''} maxLength={7}
          onChange={e=>change({baseMonth:e.target.value})} inputMode="numeric" placeholder="Ex.: 09/2026"/>
      </label>
      <label htmlFor={id+'-uf'} className="text-xs font-medium text-slate-200">UF de referência (opcional)
        <select id={id+'-uf'} aria-label="UF da base referencial" className={control} value={setting.uf||''} onChange={e=>change({uf:e.target.value})}>
          <option value="">Não informada</option>
          {sinapiUFs.map(uf=><option key={uf} value={uf}>{uf}</option>)}
        </select>
      </label>
    </div>
    {setting.costReference!=='SINAPI'&&
      <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-200">
        Você selecionou outra base. O cadastro da preferência já é salvo, mas este módulo ainda não consulta ou importa automaticamente as composições dessa fonte. Os cálculos atuais com coeficientes SINAPI existentes continuam identificados como SINAPI. Para usar dados de outra base será necessária integração ou importação específica, sem tratar produtividade entre tabelas como equivalente.
      </p>}
    {setting.adjustmentIndex!=='NENHUM'&&
      <p className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-2.5 text-[11px] leading-relaxed text-sky-200">
        Índice registrado apenas como preferência contratual. Não há consulta de série histórica, taxa automática ou correção monetária aplicada ao valor da proposta. A fórmula, competência e periodicidade dependerão do contrato.
      </p>}
    <p className="text-[10px] leading-relaxed text-slate-500">Seleção não significa disponibilidade de tabela, licença, dados regionais ou autorização de uso. Os registros anteriores permanecem compatíveis com SINAPI.</p>
  </section>;
};
