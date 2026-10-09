import React from 'react';
import {Activity, BarChart3, Building2, CalendarDays, Clock3, Download, FileCheck2, HardHat, Layers3, ShieldCheck, TrendingUp, TriangleAlert} from 'lucide-react';
import type {WorkSchedule} from '../../types/schedule';
import type {Quote,CompanySettings} from '../../types/index';
import {scheduleOverviewModel,shortDate} from '../../utils/scheduleOverview';
import type {ScheduleOverviewModel,OverviewStage} from '../../utils/scheduleOverview';

type Props={schedule:WorkSchedule;quote?:Quote;company?:CompanySettings;onPreparePDF:()=>void};
const box='min-w-0 overflow-hidden rounded-xl border border-[#234966] bg-[#071626]/95 shadow-[0_2px_14px_rgba(1,7,20,.4)]';
const title='flex items-center gap-2 border-b border-[#24465b] px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-100';
const percent=(v:number|null)=>v===null?'—':v.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const number=(v:number)=>v.toLocaleString('pt-BR',{maximumFractionDigits:2});
const cardTitle='text-[10px] uppercase tracking-wider text-slate-400';
const firstMonth=(m:string)=>Date.parse(m+'-01T12:00:00Z');
const nextMonth=(m:string)=>{const d=new Date(firstMonth(m));d.setUTCMonth(d.getUTCMonth()+1);return d.getTime();};
function rangeOf(stage:OverviewStage, months:ScheduleOverviewModel['months']){
 if(!stage.start||!stage.end||!months.length)return null;
 const from=firstMonth(months[0].key),to=nextMonth(months[months.length-1].key);
 const start=Date.parse(stage.start+'T12:00:00Z'),end=Date.parse(stage.end+'T12:00:00Z')+86400000;
 if(start>=to||end<=from)return null;
 return {left:Math.max(0,(start-from)/(to-from)*100),width:Math.max(.6,(Math.min(to,end)-Math.max(from,start))/(to-from)*100)};
}
function physicalLine(data:ScheduleOverviewModel['months'],field:'planned'|'actual'){
 const coords=data.map((m,i)=>m[field]===null?null:{x:40+(i+.5)*(570/data.length),y:171-(m[field]||0)*1.44});
 return {points:coords.filter((c):c is {x:number;y:number}=>!!c),path:coords.filter((c):c is {x:number;y:number}=>!!c).map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')};
}
export const ScheduleOverview:React.FC<Props>=({schedule,quote,company,onPreparePDF})=>{
 const today=new Date();const date=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
 const model=scheduleOverviewModel(schedule,quote,date);
 const summary=model.stages;
 const labels=model.months;
 const planned=physicalLine(labels,'planned'),actual=physicalLine(labels,'actual');
 const width=Math.max(820,220+labels.length*82);
 return <section aria-label="Painel executivo do cronograma" className="space-y-2 rounded-2xl border border-[#1b465e] bg-[#030e1b] p-2 text-slate-100 shadow-[0_18px_48px_rgba(0,0,0,.28)] sm:p-3">
   <div className="relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-xl border border-orange-600/40 bg-gradient-to-r from-[#06121e] via-[#071d30] to-[#07111b] px-4 py-4 sm:px-5">
     <div className="absolute right-0 top-0 hidden h-full w-32 -skew-x-[25deg] border-l-[9px] border-orange-500/80 bg-gradient-to-bl from-[#214362] via-[#10263e] to-transparent opacity-70 lg:block"/>
     <div className="relative z-10 flex min-w-0 items-center gap-3">
       <div className="rounded-full border-2 border-orange-500/70 bg-orange-500/10 p-3 text-orange-400"><Building2 size={30}/></div>
       <div>
         <p className="text-[11px] font-bold tracking-[.25em] text-orange-400">{company?.tradeName||company?.name||'ORÇAPRO'}</p>
         <h2 className="mt-1 text-xl font-black uppercase tracking-tight text-white sm:text-2xl">Cronograma de obras</h2>
         <p className="text-[10px] font-medium uppercase tracking-[.12em] text-slate-300">Planejamento <span className="px-1 text-orange-500">●</span> Execução <span className="px-1 text-orange-500">●</span> Controle</p>
       </div>
     </div>
     <div className="relative z-10 grid min-w-[230px] gap-x-3 gap-y-1 text-[11px] sm:grid-cols-[105px_auto]">
       <span className="font-semibold text-slate-400">OBRA</span><strong className="truncate" title={schedule.title}>{schedule.title||'Sem identificação'}</strong>
       <span className="font-semibold text-slate-400">LOCAL</span><span className="truncate" title={schedule.siteAddress||''}>{schedule.siteAddress||'Não informado'}</span>
       <span className="font-semibold text-slate-400">INÍCIO PREVISTO</span><span>{shortDate(model.start)}</span>
       <span className="font-semibold text-slate-400">TÉRMINO PREVISTO</span><span>{shortDate(model.end)}</span>
       <span className="font-semibold text-slate-400">DURAÇÃO TOTAL</span><span>{model.duration===null?'A definir':`${model.duration} dias úteis`}</span>
     </div>
     <div className="relative z-10 flex flex-wrap items-center gap-2"><a href="#orcapro-schedule-settings" className="rounded-lg border border-[#42647c] bg-[#122b3e] px-3 py-2.5 text-xs font-semibold text-slate-100 hover:bg-[#1b3a50]">Editar planejamento</a><button type="button" onClick={onPreparePDF} disabled={!summary.length} className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-900/30 hover:bg-orange-500 disabled:opacity-40"><Download size={15}/> Gerar relatório PDF</button></div>
   </div>

   <div className="grid gap-2 xl:grid-cols-12">
     <div className={`${box} xl:col-span-4`}>
       <h3 className={title}><Layers3 size={16} className="text-orange-400"/> Resumo das etapas e percentuais</h3>
       <div className="max-h-[410px] overflow-auto">
       <table className="w-full text-left text-[11px]"><thead className="sticky top-0 z-10 bg-[#122538] text-[10px] uppercase text-slate-300"><tr><th className="p-2">Etapa</th><th className="p-2 text-right">% HH</th><th className="p-2 text-right">Medido</th></tr></thead>
         <tbody>{summary.map((s,i)=><tr key={s.id} className="border-t border-[#1b354c]"><td className="px-2 py-2"><div className="flex items-start gap-2"><span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{background:s.color}}>{i+1}</span><div className="min-w-0"><div className="line-clamp-2 font-medium text-slate-100" title={s.description}>{s.description}</div><div className="mt-0.5 text-[9px] text-slate-500">{s.code} · {number(s.quantity)} {s.unit}</div></div></div></td><td className="p-2 text-right text-slate-200">{percent(s.share)}</td><td className="p-2 text-right text-emerald-300">{percent(s.progress)}</td></tr>)}</tbody>
       </table>
       {summary.length===0&&<p className="p-4 text-xs text-slate-400">Adicione composições e equipes para exibir as etapas.</p>}
       </div>
       <div className="flex justify-between border-t border-orange-500/60 bg-orange-500/5 px-3 py-2 text-[11px] font-bold"><span>TOTAL EM HORAS-HOMEM</span><span className="text-orange-300">{number(model.totalHH)} HH</span></div>
     </div>
     <div className={`${box} xl:col-span-8`}>
       <h3 className={title}><CalendarDays size={16} className="text-orange-400"/> Gráfico de Gantt — cronograma físico</h3>
       {labels.length ? <div className="overflow-x-auto" role="region" aria-label="Gantt mensal do planejamento">
         <div style={{minWidth:width}}>
           <div className="grid border-b border-[#214766] bg-[#10263b]" style={{gridTemplateColumns:`220px repeat(${labels.length},minmax(0,1fr))`}}>
             <div className="p-2 text-[10px] font-bold uppercase">Atividade</div>
             {labels.map(m=><div key={m.key} className="border-l border-[#23506b] px-0.5 py-2 text-center text-[10px] font-bold uppercase">{m.label}</div>)}
           </div>
           {summary.map((s,i)=>{
             const bar=rangeOf(s,labels);
             return <div key={s.id} className="grid min-h-[41px] border-b border-[#1d3647] last:border-0" style={{gridTemplateColumns:'220px 1fr'}}>
               <div className="flex min-w-0 items-center gap-2 border-r border-[#23506b] px-2 py-1.5 text-[10px]"><span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-bold text-white" style={{background:s.color}}>{i+1}</span><span className="truncate" title={s.description}>{s.description}</span></div>
               <div className="relative min-h-[41px]" style={{backgroundImage:'linear-gradient(to right,rgba(40,86,116,.6) 1px,transparent 1px)',backgroundSize:`${100/labels.length}% 100%`}}>
                 {bar?<div className="absolute top-[11px] h-[16px] rounded-[3px] border border-white/10 shadow-[0_0_9px_rgba(0,0,0,.45)]" style={{left:`${bar.left}%`,width:`${bar.width}%`,background:s.color}} title={`${s.description}: ${shortDate(s.start)} a ${shortDate(s.end)} · ${s.duration} dias úteis`}/>:<span className="absolute left-3 top-3 text-[10px] italic text-amber-300">Prazo pendente</span>}
               </div>
             </div>;
           })}
         </div>
       </div>:<div className="grid min-h-[190px] place-items-center p-5 text-center text-xs text-amber-200">Gantt indisponível: complete quantidades, coeficientes e equipes de todas as etapas para calcular as datas.</div>}
       <p className="border-t border-[#1a4058] px-3 py-2 text-[10px] text-slate-400">Barras por datas previstas (meses de calendário). <strong className="text-orange-200">Detalhamento diário com dias úteis permanece disponível abaixo.</strong>{model.chartTruncated?' Exibindo somente os 24 primeiros meses.':''}</p>
     </div>
   </div>

   <div className="grid gap-2 xl:grid-cols-12">
     <div className={`${box} xl:col-span-8`}>
       <h3 className={title}><HardHat size={16} className="text-orange-400"/> Detalhamento dos serviços</h3>
       <div className="max-h-[375px] overflow-auto"><table className="w-full min-w-[700px] text-left text-[10px]">
         <thead className="sticky top-0 z-10 bg-[#122538] text-slate-300"><tr>{['Etapa','Serviço / quantidade','% HH','Início','Término','Dias úteis','Status'].map(h=><th key={h} className="whitespace-nowrap px-2 py-2 uppercase">{h}</th>)}</tr></thead>
         <tbody>{summary.map((s,i)=><tr key={s.id} className="border-t border-[#1b354c]">
           <td className="px-2 py-2"><span className="rounded px-2 py-1 font-bold text-white" style={{background:s.color}}>{i+1}</span></td>
           <td className="max-w-[230px] px-2 py-2"><p className="truncate text-slate-100" title={s.description}>{s.description}</p><small className="text-slate-400">{number(s.quantity)} {s.unit} · {s.code}</small></td>
           <td className="px-2 py-2">{percent(s.share)}</td><td className="whitespace-nowrap px-2 py-2">{shortDate(s.start)}</td><td className="whitespace-nowrap px-2 py-2">{shortDate(s.end)}</td>
           <td className="px-2 py-2">{s.duration===null?'—':s.duration}</td>
           <td className="whitespace-nowrap px-2 py-2"><span className={s.status==='concluido'?'text-emerald-300':s.status==='em_andamento'?'text-amber-300':'text-slate-400'}>● {s.status==='concluido'?'Concluído':s.status==='em_andamento'?'Em andamento':'Pendente'}</span></td>
         </tr>)}</tbody>
       </table></div>
       {!summary.length&&<p className="p-4 text-xs text-slate-400">Nenhum serviço cadastrado.</p>}
     </div>
     <div className="flex min-w-0 flex-col gap-2 xl:col-span-4">
       <div className={box}>
         <h3 className={title}><Activity size={16} className="text-orange-400"/> Avanço físico da obra</h3>
         <div className="flex flex-wrap items-center justify-around gap-3 p-3">
           <div className="grid h-32 w-32 shrink-0 place-items-center rounded-full p-4" style={{background:`conic-gradient(#f97316 0% ${model.physical??0}%,#273b4f ${model.physical??0}% 100%)`}}>
             <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#071626]"><strong className="text-2xl font-black">{percent(model.physical)}</strong><small className="text-[9px] uppercase text-slate-400">HH medidas</small></div>
           </div>
           <div className="space-y-2 text-[11px]">
             <p className="flex justify-between gap-3"><span className="text-emerald-300">● Concluído</span><b>{model.completed} etapa(s)</b></p>
             <p className="flex justify-between gap-3"><span className="text-amber-300">● Em andamento</span><b>{model.inProgress} etapa(s)</b></p>
             <p className="flex justify-between gap-3"><span className="text-slate-400">● Sem medição</span><b>{model.notStarted} etapa(s)</b></p>
           </div>
         </div>
         <div className="mx-3 mb-2 h-2 overflow-hidden rounded-full bg-[#263b4f]"><div className="h-full rounded-full bg-gradient-to-r from-orange-600 to-amber-400" style={{width:`${model.physical??0}%`}}/></div>
         <p className="px-3 pb-3 text-[10px] text-slate-400">Percentual ponderado por HH de cada etapa, apenas com quantidades medidas.</p>
       </div>
       <div className={box}>
         <h3 className={title}><TrendingUp size={16} className="text-orange-400"/> Curva S — evolução física</h3>
         {labels.length?<div className="p-3">
           <div className="mb-1 flex justify-end gap-3 text-[10px]"><span className="text-orange-400">━ Planejado</span><span className="text-amber-200">{model.hasMeasurements?'┄ Realizado':'Realizado: sem medições'}</span></div>
           <svg viewBox="0 0 640 212" role="img" aria-label="Curva S com percentuais acumulados por mês" className="h-auto w-full">
             {[0,25,50,75,100].map(p=><g key={p}><line x1="38" x2="620" y1={171-p*1.44} y2={171-p*1.44} stroke="#214058" strokeWidth="1"/><text x="29" y={175-p*1.44} fontSize="12" fill="#a4bad0" textAnchor="end">{p}%</text></g>)}
             {labels.map((m,i)=><g key={m.key}><line x1={40+(i+.5)*570/labels.length} x2={40+(i+.5)*570/labels.length} y1="27" y2="171" stroke="#1d384d" strokeWidth="1"/><text x={40+(i+.5)*570/labels.length} y="194" fill="#a4bad0" textAnchor="middle" fontSize={labels.length>12?8:11}>{m.key.slice(5)}/{m.key.slice(2,4)}</text></g>)}
             {planned.path&&<path d={planned.path} stroke="#ff8819" strokeWidth="3.5" fill="none" strokeLinejoin="round"/>}
             {model.hasMeasurements&&actual.path&&<path d={actual.path} stroke="#ffd166" strokeWidth="2.5" fill="none" strokeDasharray="8 5" strokeLinejoin="round"/>}
             {planned.points.map((p,i)=><circle key={'p'+i} cx={p.x} cy={p.y} r="3.5" fill="#ff8819"/>)}
             {model.hasMeasurements&&actual.points.map((p,i)=><circle key={'a'+i} cx={p.x} cy={p.y} r="3" fill="#ffd166"/>)}
           </svg>
           <p className="text-[10px] leading-relaxed text-slate-400">Planejado por HH distribuídas nos dias úteis da etapa; realizado por medições datadas. Não equivale à curva de custos.</p>
         </div>:<div className="p-4 text-xs text-slate-400">A curva será exibida quando todas as datas puderem ser calculadas.</div>}
       </div>
     </div>
   </div>

   <div className="grid gap-2 lg:grid-cols-12">
     <div className={`${box} lg:col-span-3`}><h3 className={title}><Clock3 size={15} className="text-orange-400"/> Controle de prazos</h3>
       <div className="space-y-2 p-3 text-[11px]">
         <div className="flex justify-between"><span className="text-emerald-300">● Previstas e não vencidas</span><b>{model.upcoming}</b></div>
         <div className="flex justify-between"><span className="text-amber-300">● Prazo previsto vencido*</span><b>{model.overdue}</b></div>
         <div className="flex justify-between"><span className="text-slate-400">● Sem previsão</span><b>{model.unknownDeadline}</b></div>
         <p className="pt-1 text-[9px] text-slate-500">*Sem medição completa até a data atual. Não atesta atraso contratual.</p>
       </div>
     </div>
     <div className={`${box} lg:col-span-5`}><h3 className={title}><TriangleAlert size={15} className="text-orange-400"/> Atividades com maior duração</h3>
       <div className="p-3"><div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 text-[10px]">
         <span className="text-slate-400">SERVIÇO</span><span className="text-slate-400">TÉRMINO</span><span className="text-slate-400">DIAS</span>
         {model.longest.map(s=><React.Fragment key={s.id}><span className="truncate text-slate-200" title={s.description}>{s.description}</span><span>{shortDate(s.end)}</span><b>{s.duration}</b></React.Fragment>)}
       </div>{!model.longest.length&&<p className="mt-2 text-xs text-slate-400">Sem durações calculadas.</p>}
       <p className="mt-2 text-[9px] text-slate-500">{model.criticalDisclaimer}</p></div>
     </div>
     <div className={`${box} lg:col-span-4`}><h3 className={title}><BarChart3 size={15} className="text-orange-400"/> Indicadores</h3>
       <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
         <div className="rounded-lg border border-[#244259] p-2 text-center"><CalendarDays size={17} className="mx-auto text-slate-400"/><p className={cardTitle}>Físico</p><b className="text-lg text-orange-400">{percent(model.physical)}</b><p className="text-[9px] text-slate-500">Medido em HH</p></div>
         <div className="rounded-lg border border-[#244259] p-2 text-center"><FileCheck2 size={17} className="mx-auto text-slate-400"/><p className={cardTitle}>Financeiro</p><b className="text-lg text-orange-400">{percent(model.financialPercent)}</b><p className="text-[9px] text-slate-500">Valor proporcional medido</p></div>
         <div className="rounded-lg border border-[#244259] p-2 text-center"><ShieldCheck size={17} className="mx-auto text-slate-400"/><p className={cardTitle}>Qualidade</p><b className="text-xs text-amber-200">Não informado</b><p className="text-[9px] text-slate-500">Sem inspeção vinculada</p></div>
         <div className="rounded-lg border border-[#244259] p-2 text-center"><HardHat size={17} className="mx-auto text-slate-400"/><p className={cardTitle}>Segurança</p><b className="text-xs text-amber-200">Não informado</b><p className="text-[9px] text-slate-500">Sem indicador registrado</p></div>
       </div>
     </div>
   </div>
   <p className="px-1 text-[10px] leading-relaxed text-slate-400">Relatório baseado nas atividades, coeficientes, equipes e medições registradas. A previsão não nivela recursos entre frentes paralelas. Indicadores sem fonte não são estimados. {quote?'Indicador financeiro limitado aos itens do orçamento expressamente vinculados.':'Associe um orçamento para indicadores financeiros.'}</p>
 </section>;
};
