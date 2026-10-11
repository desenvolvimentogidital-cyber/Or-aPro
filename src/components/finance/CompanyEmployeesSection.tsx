import React,{useEffect,useMemo,useState} from 'react';
import {BriefcaseBusiness,Plus,Trash2,Pencil,UsersRound,Search} from 'lucide-react';
import {useApp} from '../../context/AppContext';
import {useAuth} from '../../context/AuthContext';
import type {EmployeeCost} from '../../types';
import {employeeMonthlyCosts,sinapiMonthlyReference,validateEmployeeCost} from '../../utils/employeeCosts';
import {pricingWorkload} from '../../utils/pricingWorkload';
import {lookupSinapiWorkerHourly,listSinapiWorkers,type SinapiWorkerRole,type WorkerRate} from '../../services/sinapiWorkerRates';
import {sinapiUFs,type SinapiUF,type SinapiRegime} from '../../utils/sinapiRegional';
import {newId} from '../../utils/quoteMath';
import {formatCurrency} from '../../utils/formatters';

const field='mt-1 block min-h-11 w-full rounded-xl border border-white/15 bg-[#0b101a] px-3 py-2 text-sm text-white outline-none focus:border-orange-400';
function number(text:string,empty=NaN):number{
  const v=text.trim().replace(/\s/g,'');
  if(!v)return empty;
  let clean=v;
  if(/^\d{1,3}(\.\d{3})+,(\d{1,2})?$/.test(v))clean=v.replace(/\./g,'').replace(',','.');
  else if(/^\d+,[0-9]{0,2}$/.test(v))clean=v.replace(',','.');
  if(!/^\d+(\.\d{0,2})?$/.test(clean))return NaN;
  return Number(clean);
}
function value(n:number):string{return Number.isFinite(n)?String(n):'';}
export const CompanyEmployeesSection:React.FC=()=>{
  const {company,updateCompany,ready,syncStatus,setActiveView}=useApp();
  const {session}=useAuth();
  const employees=company.employees||[];
  const metrics=useMemo(()=>employeeMonthlyCosts(employees),[employees]);
  const schedule=pricingWorkload(company.pricingWorkDaysPerMonth,company.pricingHoursPerDay);
  const [roles,setRoles]=useState<SinapiWorkerRole[]>([]);
  const [roleStatus,setRoleStatus]=useState<'loading'|'ready'|'error'>('loading');
  const [editId,setEditId]=useState('');
  const [name,setName]=useState('');
  const [code,setCode]=useState('');
  const [customRole,setCustomRole]=useState('');
  const [basis,setBasis]=useState<'monthly'|'hourly'>('monthly');
  const [payment,setPayment]=useState('');
  const [extras,setExtras]=useState('');
  const [planned,setPlanned]=useState('');
  const [uf,setUF]=useState<SinapiUF|''>(sinapiUFs.includes(company.state as SinapiUF)?company.state as SinapiUF:'');
  const [regime,setRegime]=useState<SinapiRegime|' '>(' ');
  const [competence,setCompetence]=useState('09/2026');
  const [reference,setReference]=useState<WorkerRate|null>(null);
  const [lookupStatus,setLookupStatus]=useState<'idle'|'loading'|'ready'|'missing'|'error'>('idle');
  const [error,setError]=useState('');
  useEffect(()=>{
    if(!session){setRoles([]);setRoleStatus('error');return;}
    const ac=new AbortController();setRoleStatus('loading');
    void listSinapiWorkers(session,ac.signal).then(rows=>{
      if(!ac.signal.aborted){setRoles(rows);setRoleStatus('ready');}
    }).catch(()=>{if(!ac.signal.aborted)setRoleStatus('error');});
    return()=>ac.abort();
  },[session?.user.id,session?.access_token]);
  useEffect(()=>{
    setReference(null);setError('');
    if(!session||!code||!uf||regime===' '||!/^(0[1-9]|1[0-2])\/20\d{2}$/.test(competence)){
      setLookupStatus('idle');return;
    }
    const ac=new AbortController();setLookupStatus('loading');
    void lookupSinapiWorkerHourly(session,code,{uf,regime,reference:competence},ac.signal)
      .then(result=>{if(!ac.signal.aborted){setReference(result);setLookupStatus(result?'ready':'missing');}})
      .catch(e=>{if(!ac.signal.aborted){setError(e instanceof Error?e.message:'Erro ao consultar SINAPI.');setLookupStatus('error');}});
    return()=>ac.abort();
  },[session?.user.id,session?.access_token,code,uf,regime,competence]);
  const selectedRole=roles.find(r=>r.code===code)?.role||'';
  const activeRate=reference?.code===code && reference.source.uf===uf && reference.source.regime===regime && reference.source.reference===competence?reference:null;
  const monthlyReference=activeRate?sinapiMonthlyReference(activeRate.hourlyCost,schedule):null;
  function clear(){
    setEditId('');setName('');setCode('');setCustomRole('');
    setBasis('monthly');setPayment('');setExtras('');setPlanned('');setError('');
  }
  function edit(e:EmployeeCost){
    setEditId(e.id);setName(e.name);setCode(e.sinapiCode||'');
    setCustomRole(e.sinapiCode?'':e.role);setBasis(e.paymentBasis);
    setPayment(value(e.paymentAmount));
    setExtras(e.monthlyExtras?value(e.monthlyExtras):'');
    setPlanned(e.plannedHoursPerMonth?value(e.plannedHoursPerMonth):'');
    if(e.reference){
      if(sinapiUFs.includes(e.reference.uf as SinapiUF))setUF(e.reference.uf as SinapiUF);
      setRegime(e.reference.regime);setCompetence(e.reference.competence);
    }
    setError('');
  }
  function save(event:React.FormEvent){
    event.preventDefault();setError('');
    const role=code?selectedRole:customRole.trim();
    const row:EmployeeCost={
      id:editId||newId('emp'),name:name.trim(),role,
      sinapiCode:code||undefined,paymentBasis:basis,
      paymentAmount:number(payment),monthlyExtras:number(extras,0),
      plannedHoursPerMonth:basis==='hourly'?number(planned,0):0,
      reference:code&&activeRate?.source.uf===uf&&activeRate.source.regime===regime&&
        activeRate.source.reference===competence?
        {code,uf:activeRate.source.uf,regime:activeRate.source.regime,
         competence:activeRate.source.reference,hourlyCost:activeRate.hourlyCost,
         sourceFile:activeRate.sourceFile}:undefined
    };
    try{
      if(!ready)throw Error('Aguarde os dados da conta carregarem.');
      if(!role)throw Error('Selecione uma profissão SINAPI ou informe outra função.');
      validateEmployeeCost(row);
      const next=editId?employees.map(e=>e.id===editId?row:e):[...employees,row];
      if(next.length>200)throw Error('Limite de 200 funcionários por empresa.');
      updateCompany({employees:next});
      clear();
    }catch(e){setError(e instanceof Error?e.message:'Confira os valores do funcionário.');}
  }
  function remove(e:EmployeeCost){
    if(window.confirm(`Excluir ${e.name} dos custos previstos? Isso não apaga pagamentos financeiros já registrados.`))
      updateCompany({employees:employees.filter(v=>v.id!==e.id)});
  }
  function useReference(){
    if(!activeRate){return;}
    const suggested=basis==='hourly'?activeRate.hourlyCost:monthlyReference;
    if(suggested===null){setError('Configure a jornada mensal antes de calcular uma equivalência de mês.');return;}
    setPayment(String(suggested));setError('');
  }
  return <section aria-label="Funcionários e equipe" className="space-y-3 rounded-2xl border border-orange-500/25 bg-[#141822] p-4">
    <div className="flex gap-2"><UsersRound className="h-5 w-5 shrink-0 text-orange-400"/>
      <div><h2 className="text-sm font-bold text-white">Funcionários e equipe</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-300">Cadastre a função e como o profissional é pago. Mensalistas entram nos custos fixos; horistas são uma previsão variável separada.</p></div>
    </div>
    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
      <div className="rounded-xl bg-black/20 p-3"><span className="block text-slate-400">Folha mensal fixa</span><strong className="text-base text-white">{formatCurrency(metrics.fixed)}</strong></div>
      <div className="rounded-xl bg-black/20 p-3"><span className="block text-slate-400">Horistas previstos</span><strong className="text-base text-white">{formatCurrency(metrics.variableEstimate)}</strong></div>
      <div className="col-span-2 rounded-xl bg-black/20 p-3 sm:col-span-1"><span className="block text-slate-400">Total equipe estimado</span><strong className="text-base text-white">{formatCurrency(metrics.forecast)}</strong></div>
    </div>
    {metrics.unplannedHourly>0&&<p className="text-xs text-amber-200">{metrics.unplannedHourly} horista(s) sem horas previstas. Eles não entram na previsão mensal até você informar as horas.</p>}
    <form onSubmit={save} className="space-y-3 rounded-xl border border-white/10 bg-[#0b101a]/40 p-3">
      <h3 className="flex items-center gap-2 text-xs font-bold"><BriefcaseBusiness size={16}/> {editId?'Editar funcionário':'Adicionar funcionário'}</h3>
      <label className="block text-xs text-slate-300">Nome ou identificação interna
        <input className={field} maxLength={150} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Eletricista João ou Funcionário 01" required/>
      </label>
      <label className="block text-xs text-slate-300">Profissão SINAPI
        <select className={field} aria-label="Profissão SINAPI do funcionário" value={code} onChange={e=>{setCode(e.target.value);setError('');}}>
          <option value="">Outra função (informar manualmente)</option>
          {roles.map(r=><option key={r.code} value={r.code}>{r.role} · {r.code}</option>)}
        </select>
      </label>
      {roleStatus==='loading'&&<p className="text-[11px] text-sky-200">Buscando profissões oficiais SINAPI…</p>}
      {roleStatus==='error'&&<p role="status" className="text-[11px] text-amber-300">Não foi possível carregar profissões SINAPI. Você pode cadastrar uma função manualmente.</p>}
      {!code&&<label className="block text-xs text-slate-300">Função
        <input className={field} value={customRole} maxLength={150} onChange={e=>setCustomRole(e.target.value)} placeholder="Ex.: Mestre de obras" required/>
      </label>}
      {code&&<div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-slate-300">UF da referência
          <select className={field} value={uf} onChange={e=>setUF(e.target.value as SinapiUF|'')} aria-label="UF do profissional">
            <option value="">Selecione</option>{sinapiUFs.map(v=><option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="block text-xs text-slate-300">Regime
          <select className={field} value={regime} onChange={e=>setRegime(e.target.value as SinapiRegime|' ')} aria-label="Encargos SINAPI do funcionário">
            <option value=" ">Selecione</option>
            <option value="sem_desoneracao">Sem desoneração</option><option value="com_desoneracao">Com desoneração</option>
          </select>
        </label>
        <label className="col-span-2 block text-xs text-slate-300">Competência SINAPI
          <input className={field} value={competence} onChange={e=>setCompetence(e.target.value)}
            placeholder="MM/AAAA" maxLength={7} aria-label="Mês e ano da referência SINAPI"/>
        </label>
      </div>}
      {code&&lookupStatus==='loading'&&<p role="status" className="text-xs text-sky-200">Consultando custo/h oficial da função…</p>}
      {code&&lookupStatus==='missing'&&<p className="text-xs text-amber-200">Sem custo/h desta função para UF, mês e regime. Você pode informar o valor pago ou importar CSD/CCD em Serviços → Custos SINAPI.</p>}
      {activeRate&&<div className="space-y-1 rounded-xl border border-sky-500/25 bg-sky-500/5 p-3 text-xs">
        <strong className="block text-sky-200">Referência SINAPI (custo com encargos): {formatCurrency(activeRate.hourlyCost)}/h</strong>
        <span className="block text-slate-300">{reference.source.uf} · {reference.source.reference} · {reference.source.regime==='com_desoneracao'?'Com desoneração':'Sem desoneração'}</span>
        <span className="block text-slate-300">Equivalência mensal por jornada informada: {monthlyReference===null?'Informe dias e horas acima':formatCurrency(monthlyReference)}</span>
        <p className="text-[11px] text-amber-200">Referência de CUSTO da composição com encargos, não salário-base oficial nem obrigação trabalhista.</p>
      </div>}
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-slate-300">Forma de pagamento
          <select className={field} value={basis} onChange={e=>setBasis(e.target.value as 'monthly'|'hourly')}>
            <option value="monthly">Mensal</option><option value="hourly">Por hora</option>
          </select>
        </label>
        <label className="block text-xs text-slate-300">{basis==='monthly'?'Pagamento mensal (R$)':'Pagamento por hora (R$)'}
          <input className={field} inputMode="decimal" aria-label={basis==='monthly'?'Pagamento mensal do funcionário':'Pagamento por hora do funcionário'}
            value={payment} onChange={e=>setPayment(e.target.value)} placeholder="0,00" required/>
        </label>
      </div>
      {activeRate&&<button type="button" onClick={useReference}
        className="min-h-10 w-full rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 text-[11px] font-semibold text-sky-200">
        Usar referência {basis==='monthly'?'mensal estimada':'por hora'} (editável)
      </button>}
      <div className="grid grid-cols-2 gap-2">
        {basis==='hourly'&&<label className="block text-xs text-slate-300">Horas previstas no mês
          <input className={field} inputMode="decimal" aria-label="Horas previstas do funcionário no mês"
            value={planned} onChange={e=>setPlanned(e.target.value)} placeholder="Ainda não definidas"/>
        </label>}
        <label className="block text-xs text-slate-300">Outros custos mensais (R$)
          <input className={field} inputMode="decimal" aria-label="Benefícios e encargos adicionais mensais"
            value={extras} onChange={e=>setExtras(e.target.value)} placeholder="Opcional"/>
        </label>
      </div>
      <p className="text-[11px] text-slate-400">O pagamento real e os benefícios são definidos por você; encargos adicionais não são presumidos. Não lance esta mesma folha também como despesa mensal fixa, para evitar duplicidade no cálculo.</p>
      {error&&<p role="alert" className="text-xs text-rose-300">{error}</p>}
      <div className="flex gap-2">
        <button disabled={!ready} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-orange-600 px-3 text-xs font-bold text-white disabled:opacity-50" type="submit">
          <Plus size={15}/> {editId?'Atualizar funcionário':'Salvar funcionário'}
        </button>
        {editId&&<button type="button" onClick={clear} className="rounded-xl border border-white/15 px-4 text-xs">Cancelar</button>}
      </div>
    </form>
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-slate-200">Equipe cadastrada ({employees.length})</h3>
      {!employees.length&&<p className="rounded-lg bg-black/20 p-3 text-xs text-slate-400">Nenhum funcionário cadastrado ainda.</p>}
      {employees.map(e=><div key={e.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 p-3">
        <div className="min-w-0 flex-1"><strong className="block truncate text-xs">{e.name}</strong>
          <p className="text-[11px] text-slate-400">{e.role} · {e.paymentBasis==='monthly'?'Mensal':'Por hora'}{e.sinapiCode?' · SINAPI '+e.sinapiCode:''}</p>
          <p className="text-[11px] text-slate-200">{formatCurrency(e.paymentAmount)}{e.paymentBasis==='hourly'?'/h':'/mês'}{e.paymentBasis==='hourly'?' · '+(e.plannedHoursPerMonth?e.plannedHoursPerMonth+' h/mês previstas':'sem horas previstas'):''}</p>
        </div>
        <button type="button" aria-label={`Editar funcionário ${e.name}`} onClick={()=>edit(e)} className="min-h-10 min-w-10 rounded-lg text-sky-300"><Pencil size={16} className="mx-auto"/></button>
        <button type="button" aria-label={`Excluir funcionário ${e.name}`} onClick={()=>remove(e)} className="min-h-10 min-w-10 rounded-lg text-rose-300"><Trash2 size={16} className="mx-auto"/></button>
      </div>)}
    </div>
    {syncStatus!=='saved'&&<p role="status" className="text-[11px] text-amber-200">{syncStatus==='saving'?'Salvando equipe na nuvem…':'Falha na sincronização; não feche sem confirmar o salvamento.'}</p>}
    <p className="text-[11px] text-slate-400">Cadastro e previsão não registram pagamento no caixa automaticamente. Quando pagar salário ou diária, lance em Financeiro → Despesa paga para refletir o movimento real.</p>
  </section>;
};
