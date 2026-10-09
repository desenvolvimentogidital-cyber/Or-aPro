import React, {useState} from 'react';
import {HardHat, CalendarDays, Wallet, AlertTriangle, ArrowRight, BookOpen, Plus, Download, Trash2} from 'lucide-react';
import {useApp} from '../../context/AppContext';
import {estimateSchedule} from '../../utils/scheduleMath';
import {physicalProgress} from '../../utils/execution';
import {addDiaryRecord,validStatus} from '../../utils/workDiary';
import {newId} from '../../utils/quoteMath';
import type {WorkDiaryEntry,OperationalStatus} from '../../types/schedule';

const money=(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const ctrl='w-full rounded-xl border border-white/10 bg-[#0b0e15] px-3 py-2.5 text-xs text-white focus:border-orange-500/50 focus:outline-none';
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const labels:Record<OperationalStatus,string>={planejamento:'Planejamento',em_execucao:'Em execução',paralisada:'Paralisada',concluida:'Concluída'};
const types:Record<WorkDiaryEntry['kind'],string>={diario:'Diário de obra',ocorrencia:'Ocorrência',inspecao:'Inspeção'};
const csvCell=(v:unknown)=>{let value=String(v??'');if(/^[\s\x00-\x1f]*[=+\-@\t\r]/.test(value)) value="'"+value;return '"'+value.replace(/"/g,'""')+'"';};
const exportDiary=(title:string,diary:WorkDiaryEntry[])=>{
  const rows=[['Data','Tipo','Responsável','Pessoas no local','Descrição','Registrado em'],...diary.map(x=>[x.date,types[x.kind],x.responsible,x.workerCount===undefined?'':String(x.workerCount),x.description,x.createdAt])];
  const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`orcapro-diario-${title.replace(/[^a-z0-9-]/gi,'_').slice(0,45)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};

export const WorksView:React.FC=()=>{
 const {schedules,quotes,financeEntries,setActiveView,setSelectedScheduleId,updateSchedule,syncStatus}=useApp();
 const [expandedId,setExpandedId]=useState('');
 const [date,setDate]=useState(today);
 const [kind,setKind]=useState<WorkDiaryEntry['kind']>('diario');
 const [description,setDescription]=useState('');
 const [responsible,setResponsible]=useState('');
 const [workers,setWorkers]=useState('');
 const [error,setError]=useState('');
 const onSave=(planId:string)=>{
  const plan=schedules.find(s=>s.id===planId);if(!plan)return;
  const count=workers.trim()?Number(workers):undefined;
  const record:WorkDiaryEntry={id:newId('diario'),date,kind,description:description.trim(),responsible:responsible.trim(),workerCount:count,createdAt:new Date().toISOString()};
  try {updateSchedule(addDiaryRecord(plan,record));setDescription('');setWorkers('');setError('');}
  catch(e){setError(e instanceof Error?e.message:'Registro inválido.');}
 };
 return <div className="space-y-5 py-5 pb-24">
  <div className="flex items-center gap-3"><HardHat className="text-orange-400" size={26}/><div><h1 className="text-xl font-bold">Obras e execução</h1><p className="text-xs text-slate-400">Cronogramas, medições reais, responsáveis, ocorrências e diário de obra. O status da obra é definido manualmente.</p></div></div>
  {syncStatus==='error'&&<p role="alert" className="rounded-xl border border-rose-500/30 p-3 text-xs text-rose-300">Falha de sincronização: aguarde a correção antes de considerar os registros salvos.</p>}
  {schedules.length===0?<div className="rounded-2xl border border-white/10 bg-[#141822] p-6 text-center"><p className="text-sm text-slate-300">Nenhuma obra com cronograma cadastrada.</p><button onClick={()=>{setSelectedScheduleId('');setActiveView('cronograma');}} className="mt-4 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold">Abrir cronograma</button></div>:schedules.map(plan=>{
   const quote=quotes.find(q=>q.id===plan.quoteId);
   const report=estimateSchedule(plan);const executed=physicalProgress(plan);
   const movements=financeEntries.filter(e=>e.quoteId&&e.quoteId===plan.quoteId);
   const received=movements.filter(e=>e.type==='recebimento').reduce((sum,e)=>sum+e.amount,0);
   const spent=movements.filter(e=>e.type==='despesa').reduce((sum,e)=>sum+e.amount,0);
   const expanded=expandedId===plan.id;
   const diary=[...(plan.diary||[])].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
   return <section key={plan.id} className="space-y-3 rounded-2xl border border-white/10 bg-[#141822] p-4">
    <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-white">{plan.title}</h2><p className="mt-1 text-[11px] text-slate-400">{quote?`${quote.number} · ${quote.clientName} · ${quote.status}`:'Sem orçamento vinculado'}</p></div><HardHat size={20} className="shrink-0 text-orange-400"/></div>
    {quote?.status!=='aprovado'&&<p className="text-[11px] text-amber-300">{quote?`Orçamento ${quote.status}: o cronograma não comprova contratação.`:'Sem proposta aprovada vinculada.'}</p>}
    <div className="grid gap-2 sm:grid-cols-2"><label className="text-[11px] text-slate-400">Estado operacional informado<select className={`${ctrl} mt-1`} value={plan.operationalStatus||'planejamento'} onChange={e=>{if(validStatus(e.target.value))updateSchedule({...plan,operationalStatus:e.target.value,updatedAt:new Date().toISOString()});}}>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="text-[11px] text-slate-400">Responsável pela obra<input className={`${ctrl} mt-1`} maxLength={120} placeholder="Informar nome real" value={plan.responsible||''} onChange={e=>updateSchedule({...plan,responsible:e.target.value,updatedAt:new Date().toISOString()})}/></label></div>
    {plan.operationalStatus==='concluida'&&executed.percent!==null&&executed.percent<100&&<p className="text-[11px] text-amber-300">Obra marcada como concluída, mas medições físicas totalizam apenas {executed.percent.toFixed(1)}%. Confira as medições.</p>}
    <div className="flex justify-between text-xs"><span className="text-slate-400">Avanço físico médio por etapa</span><strong>{executed.percent===null?'Sem etapas':`${executed.percent.toFixed(1)}%`}</strong></div>
    <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-orange-500" style={{width:`${executed.percent||0}%`}}/></div>
    <div className="grid grid-cols-2 gap-2 text-[11px]"><div className="rounded-xl bg-white/5 p-2.5"><p className="text-slate-400">Medições</p><strong>{executed.completed} de {plan.tasks.length} etapas concluídas</strong></div><div className="rounded-xl bg-white/5 p-2.5"><p className="text-slate-400">Término previsto</p><strong>{report.finishDate?report.finishDate.split('-').reverse().join('/'): 'A calcular'}</strong></div><div className="rounded-xl bg-white/5 p-2.5"><p className="text-slate-400">Recebimentos vinculados</p><strong>{money(received)}</strong></div><div className="rounded-xl bg-white/5 p-2.5"><p className="text-slate-400">Despesas vinculadas</p><strong>{money(spent)}</strong></div></div>
    <div className="flex flex-wrap gap-2"><button onClick={()=>{setSelectedScheduleId(plan.id);setActiveView('cronograma');}} className="inline-flex items-center gap-1 rounded-lg border border-orange-500/30 px-3 py-2 text-xs text-orange-300"><CalendarDays size={14}/> Cronograma <ArrowRight size={13}/></button><button onClick={()=>setActiveView('financeiro')} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200"><Wallet size={14}/> Financeiro</button><button onClick={()=>{setExpandedId(expanded?'':plan.id);setError('');setResponsible(plan.responsible||'');}} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200"><BookOpen size={14}/> Diário · {diary.length} registro(s)</button></div>
    {expanded&&<div className="space-y-3 border-t border-white/10 pt-3"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Diário e ocorrências reais</h3><button type="button" className="flex items-center gap-1 text-xs text-orange-300 disabled:opacity-40" disabled={!diary.length} onClick={()=>exportDiary(plan.title,diary)}><Download size={14}/> Exportar CSV</button></div><p className="text-[11px] text-slate-400">Registre somente acontecimentos observados na obra. O diário não cria medições nem despesas automaticamente. Sem fotos ou assinaturas simuladas.</p>
      <div className="grid gap-2 sm:grid-cols-2"><label className="text-[11px] text-slate-400">Data da atividade<input type="date" className={`${ctrl} mt-1`} value={date} onChange={e=>setDate(e.target.value)}/></label><label className="text-[11px] text-slate-400">Tipo de registro<select className={`${ctrl} mt-1`} value={kind} onChange={e=>setKind(e.target.value as WorkDiaryEntry['kind'])}>{Object.entries(types).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="text-[11px] text-slate-400">Responsável pelo registro<input className={`${ctrl} mt-1`} value={responsible} onChange={e=>setResponsible(e.target.value)} placeholder="Nome de quem registrou"/></label><label className="text-[11px] text-slate-400">Trabalhadores no local (opcional)<input type="number" min="0" step="1" className={`${ctrl} mt-1`} value={workers} onChange={e=>setWorkers(e.target.value)} placeholder="Deixar vazio se desconhecido"/></label></div>
      <label className="block text-[11px] text-slate-400">Descrição do ocorrido<textarea className={`${ctrl} mt-1`} rows={3} maxLength={3000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Descreva o que realmente ocorreu na obra."/></label>
      {error&&<p role="alert" className="text-xs text-rose-300">{error}</p>}
      <button type="button" onClick={()=>onSave(plan.id)} className="flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-semibold text-white"><Plus size={15}/> Registrar no diário</button>
      {!diary.length?<p className="text-[11px] text-slate-500">Nenhuma atividade registrada nesta obra.</p>:<div className="max-h-96 space-y-2 overflow-auto">{diary.map(e=><article key={e.id} className="rounded-xl border border-white/10 bg-[#0b0e15] p-3"><div className="flex flex-wrap justify-between gap-2 text-[10px] text-slate-400"><strong className="text-orange-300">{e.date.split('-').reverse().join('/')} · {types[e.kind]||e.kind}</strong><span>{e.responsible}{e.workerCount!==undefined?` · ${e.workerCount} pessoas`:''}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-200">{e.description}</p><button type="button" className="mt-2 flex items-center gap-1 text-[10px] text-rose-300" onClick={()=>{if(window.confirm('Excluir este registro operacional? Esta ação remove o registro do espaço de trabalho.'))updateSchedule({...plan,diary:(plan.diary||[]).filter(x=>x.id!==e.id),updatedAt:new Date().toISOString()});}}><Trash2 size={12}/> Excluir registro</button></article>)}</div>}
     </div>}
   </section>;
  })}
  <p className="flex items-start gap-2 text-[11px] text-slate-400"><AlertTriangle size={15} className="shrink-0"/> Medições físicas, status da obra e diário são registros informados pelo usuário. Recebimentos e despesas são lançamentos distintos e exigem comprovantes e conferência externa para efeitos contábeis.</p>
 </div>;
};
