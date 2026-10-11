import React from 'react';
import {HardHat,UsersRound,AlertTriangle} from 'lucide-react';
import type {EmployeeCost} from '../../types';
import type {ScheduleTask} from '../../types/schedule';
import type {TaskEstimate} from '../../utils/scheduleMath';
import type {TaskCrewCost,WorkCrewCostReport} from '../../utils/scheduleCrewCosts';
import {employeeMatchesLabor,roleKey,setTaskCrewEmployee} from '../../utils/scheduleCrewCosts';
import {formatCurrency} from '../../utils/formatters';

type AssignProps={
  task:ScheduleTask;
  estimate:TaskEstimate;
  employees:readonly EmployeeCost[];
  costs:TaskCrewCost|undefined;
  onChange:(task:ScheduleTask)=>void;
  onError:(text:string)=>void;
};
const fmt=(v:number)=>v.toLocaleString('pt-BR',{maximumFractionDigits:2});
export const ScheduleCrewAssignments:React.FC<AssignProps>=({
  task,estimate,employees,costs,onChange,onError
})=>{
  if(!estimate.labor.length)return null;
  return <section className="space-y-2 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3"
    aria-label={`Funcionários alocados na etapa ${task.composition.code}`}>
    <h4 className="flex items-center gap-2 text-xs font-semibold text-sky-100">
      <UsersRound size={15}/> Funcionários desta etapa
    </h4>
    <p className="text-[11px] text-slate-300">
      Selecione funcionários cadastrados em Formação de Preço → Funcionários.
      Configure o número de pessoas de cada profissão acima antes de alocar.
      O cronograma continua usando as HH oficiais; a seleção não muda a produtividade.
    </p>
    {estimate.labor.map(l=>{
      const key=roleKey(l.code,l.role);
      const list=employees.filter(e=>employeeMatchesLabor(e,l.code,l.role));
      const selected=task.employeeAssignments?.[key]||[];
      const capacity=task.crew?.[key]||0;
      return <div key={key} className="space-y-1.5 rounded-lg border border-white/10 bg-black/20 p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <strong>{l.role}</strong>
          <span className="text-slate-400">{selected.length}/{capacity} vaga(s) identificadas</span>
        </div>
        {list.length===0&&<p className="text-[11px] text-amber-200">Nenhum profissional cadastrado com esta função; a quantidade de pessoas pode ser preenchida acima, mas o custo da equipe ficará incompleto.</p>}
        {list.map(employee=>{
          const checked=selected.includes(employee.id);
          const disabled=!checked&&(capacity<1||selected.length>=capacity);
          return <label key={employee.id} className="flex min-h-10 items-center gap-2 rounded-lg bg-white/5 px-2.5 text-[11px] text-slate-200">
            <input type="checkbox" aria-label={`Alocar ${employee.name} na função ${l.role}`}
              checked={checked} disabled={disabled}
              onChange={e=>{
                try{onChange(setTaskCrewEmployee(task,key,employee.id,e.target.checked,employees));onError('');}
                catch(err){onError(err instanceof Error?err.message:'Não foi possível alocar a equipe.');}
              }}
            />
            <span className="min-w-0 flex-1 break-words">{employee.name}</span>
            <span className="text-slate-400">{employee.paymentBasis==='monthly'?'Mensalista':'Horista'}</span>
          </label>;
        })}
      </div>;
    })}
    {costs&&<div className="grid grid-cols-2 gap-2 text-[11px]">
      <div className="rounded-lg bg-black/25 p-2">
        <span className="block text-slate-400">Horistas · variável</span>
        <strong className="text-sky-100">{formatCurrency(costs.variableHourly)}</strong>
      </div>
      <div className="rounded-lg bg-black/25 p-2">
        <span className="block text-slate-400">Mensalistas · parcela da folha fixa</span>
        <strong className="text-sky-100">{formatCurrency(costs.allocatedMonthly)}</strong>
      </div>
      <p className="col-span-2 text-slate-400">{fmt(costs.assignedHH)} HH alocadas; {fmt(costs.unassignedHH)} HH sem funcionário identificado nesta etapa.</p>
      {costs.warnings.slice(0,5).map((w,i)=><p key={i} className="col-span-2 text-amber-200">{w}</p>)}
    </div>}
  </section>;
};
export const ScheduleCrewCostSummary:React.FC<{report:WorkCrewCostReport;hasEmployees:boolean}>=({report,hasEmployees})=>
  <section className="space-y-3 rounded-2xl border border-sky-500/25 bg-[#141822] p-4"
    aria-label="Custos previstos da equipe na obra">
    <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
      <HardHat size={17} className="text-sky-300"/> Equipe cadastrada e custos previstos da obra
    </h3>
    <p className="text-xs text-slate-300">
      Vincule profissionais em cada etapa abaixo. Os custos reais de pagamento da sua empresa
      são usados apenas como estimativa de planejamento, sem criar despesas ou alterar o orçamento aprovado.
    </p>
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="rounded-lg bg-black/20 p-3">
        <span className="block text-slate-400">Horistas · desembolso variável estimado</span>
        <strong className="text-base text-white">{formatCurrency(report.variableHourly)}</strong>
      </div>
      <div className="rounded-lg bg-black/20 p-3">
        <span className="block text-slate-400">Mensalistas · folha fixa alocada</span>
        <strong className="text-base text-white">{formatCurrency(report.allocatedMonthly)}</strong>
      </div>
    </div>
    <p className="text-xs text-slate-300">
      {fmt(report.assignedHH)} HH atribuídas / {fmt(report.assignedHH+report.unassignedHH)} HH previstas.
    </p>
    {!hasEmployees&&<p className="text-xs text-amber-200">Nenhum funcionário cadastrado. Abra Formação de Preço → Funcionários e equipe antes de atribuir responsáveis à obra.</p>}
    {!!report.unassignedHH&&<p className="text-xs text-amber-200">O custo está parcial: existem HH sem funcionários vinculados. Não use os valores acima como custo integral da equipe.</p>}
    <p className="text-[11px] text-slate-400">
      A alocação mensal é apenas a parcela gerencial de um salário já contabilizado no custo fixo.
      Não some essa parcela novamente ao fluxo de caixa nem à margem sem excluir o rateio fixo.
      Benefícios e outros custos fixos já permanecem no custo da empresa.
    </p>
    {report.issues.slice(0,5).map((w,i)=><p key={i} role="status" className="text-[11px] text-amber-200">{w}</p>)}
  </section>;
