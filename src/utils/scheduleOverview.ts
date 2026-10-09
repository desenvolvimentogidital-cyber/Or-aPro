import type {WorkSchedule} from '../types/schedule';
import type {Quote} from '../types/index';
import {estimateSchedule, workingDaysBetween, validScheduleDate} from './scheduleMath.js';
import {progressPercent} from './execution.js';
import {physicalFinancial} from './physicalFinancial.js';

export const stageColors = ['#1686ff','#24bc69','#ff9a18','#f3483e','#995aff','#15b7d2','#ffc027','#f3389c','#3e84ff'] as const;
export const shortDate=(v:string|null|undefined)=>v&&validScheduleDate(v)?v.slice(8)+'/'+v.slice(5,7)+'/'+v.slice(0,4):'A definir';
const monthLabel=(v:string)=>new Date(v+'-15T12:00:00Z').toLocaleDateString('pt-BR',{month:'short',year:'numeric',timeZone:'UTC'}).replace('.','').toUpperCase();
const ym=(date:string)=>date.slice(0,7);
const monthEnd=(month:string)=>new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0,12)).toISOString().slice(0,10);
const round=(n:number)=>Math.round(n*10)/10;

export type OverviewStage={
  id:string;code:string;description:string;unit:string;quantity:number;
  share:number|null;duration:number|null;start:string|null;end:string|null;
  hh:number;progress:number|null;status:'concluido'|'em_andamento'|'pendente';
  color:string;roles:string;warning:string[];
};
export type OverviewMonth={key:string;label:string;planned:number|null;actual:number|null};
export interface ScheduleOverviewModel {
 stages:OverviewStage[];months:OverviewMonth[];
 totalHH:number;duration:number|null;start:string|null;end:string|null;pending:number;
 physical:number|null;completed:number;inProgress:number;notStarted:number;
 overdue:number;upcoming:number;unknownDeadline:number;
 criticalDisclaimer:string;longest:OverviewStage[]; financialPercent:number|null;
 financialPlanned:number;financialMeasured:number;financialIssues:string[];
 chartTruncated:boolean; hasMeasurements:boolean;
}

/** Modelo único para dashboard e PDF. Pesos em HH (nunca soma m² com m³).
 * A curva realizada utiliza SOMENTE datas e quantidades de medições registradas.
 * Não há custo realizado, qualidade, acidentes, conclusão automática nem caminho crítico presumidos.
 */
export function scheduleOverviewModel(schedule:WorkSchedule,quote?:Quote,asOf=new Date().toISOString().slice(0,10)):ScheduleOverviewModel {
 const report=estimateSchedule(schedule);
 const entries=report.entries;
 const valid=entries.map(e=>Number.isFinite(e.totalHH)&&e.totalHH>0&&e.task.quantity>0?e.totalHH:0);
 const totalWeight=valid.reduce((n,v)=>n+v,0);
 const stages:OverviewStage[]=entries.map((e,i)=>{
   const progress=progressPercent(e.task);
   const status=progress!==null&&progress>=100-1e-7?'concluido':progress!==null&&progress>0?'em_andamento':'pendente';
   return {
     id:e.task.id,code:e.task.composition.code,description:e.task.composition.description,
     unit:e.task.composition.unit,quantity:e.task.quantity,
     share:totalWeight>0&&valid[i]>0?100*valid[i]/totalWeight:null,
     duration:e.days,start:e.start,end:e.end,hh:e.totalHH,
     progress,status,color:stageColors[i%stageColors.length],
     roles:e.labor.map(l=>l.workers>0?`${l.workers} × ${l.role}`:`${l.role}: equipe pendente`).join(' · '),
     warning:e.warnings
   };
 });
 const sumProgress=stages.reduce((n,s,i)=>n+valid[i]*(s.progress??0)/100,0);
 const physical=totalWeight>0?100*sumProgress/totalWeight:null;
 const completed=stages.filter(s=>s.status==='concluido').length;
 const inProgress=stages.filter(s=>s.status==='em_andamento').length;
 const notStarted=stages.length-completed-inProgress;
 const today=validScheduleDate(asOf)?asOf:new Date().toISOString().slice(0,10);
 const overdue=stages.filter(s=>s.end&&s.end<today&&s.status!=='concluido').length;
 const upcoming=stages.filter(s=>s.end&&s.end>=today&&s.status!=='concluido').length;
 const unknownDeadline=stages.filter(s=>!s.end).length;
 const longest=stages.filter(s=>s.duration!==null).sort((a,b)=>(b.duration??0)-(a.duration??0)).slice(0,3);
 const physicalMoney=physicalFinancial(schedule,quote);
 const months:OverviewMonth[]=[];
 let chartTruncated=false;
 if(report.finishDate && validScheduleDate(schedule.startDate) && totalWeight>0) {
   const begin=ym(schedule.startDate),last=ym(report.finishDate);
   const d=new Date(begin+'-01T12:00:00Z');
   while(d.toISOString().slice(0,7)<=last && months.length<24){
     const key=d.toISOString().slice(0,7),end=monthEnd(key);
     let plannedHH=0,actualHH=0;
     for(let i=0;i<entries.length;i++){
       const entry=entries[i],weight=valid[i],task=entry.task;
       if(!weight)continue;
       if(entry.start&&entry.end&&entry.days){
         if(end>=entry.end)plannedHH+=weight;
         else if(end>=entry.start){
           const duration=workingDaysBetween(entry.start,end,schedule.holidays||[])||0;
           plannedHH+=weight*Math.min(1,Math.max(0,duration/entry.days));
         }
       }
       let measuredByDate=0;
       for(const m of task.progress||[]){
         if(validScheduleDate(m.date)&&m.date<=end&&Number.isFinite(m.quantity)&&m.quantity>0)measuredByDate+=m.quantity;
       }
       if(task.quantity>0)actualHH+=weight*Math.min(1,measuredByDate/task.quantity);
     }
     months.push({key,label:monthLabel(key),planned:round(100*plannedHH/totalWeight),actual:round(100*actualHH/totalWeight)});
     d.setUTCMonth(d.getUTCMonth()+1);
   }
   chartTruncated=d.toISOString().slice(0,7)<=last;
 }
 const hasMeasurements=schedule.tasks.some(t=>(t.progress||[]).some(m=>m.quantity>0));
 return {
 stages,months,totalHH:report.totalHH,duration:report.workingDays,
 start:validScheduleDate(schedule.startDate)?schedule.startDate:null,
 end:report.finishDate,pending:report.pending,physical,completed,inProgress,notStarted,
 overdue,upcoming,unknownDeadline,
 criticalDisclaimer:'Maiores durações previstas — não representam caminho crítico calculado.',
 longest,financialPercent:physicalMoney.percent,
 financialPlanned:physicalMoney.planned,financialMeasured:physicalMoney.measured,
 financialIssues:physicalMoney.issues,chartTruncated,hasMeasurements
 };
}
