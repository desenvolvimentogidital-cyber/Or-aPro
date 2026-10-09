import type {WorkSchedule} from '../types/schedule';
import type {Quote,CompanySettings} from '../types/index';
import {scheduleOverviewModel,shortDate} from './scheduleOverview.js';
import type {ScheduleOverviewModel,OverviewStage} from './scheduleOverview.js';

const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch));
const pct=(v:number|null)=>v===null?'—':v.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const n=(v:number)=>Number.isFinite(v)?v.toLocaleString('pt-BR',{maximumFractionDigits:1}):'—';
const ms=(v:string)=>Date.parse(v+'T12:00:00Z');
const range=(s:OverviewStage,months:ScheduleOverviewModel['months'])=>{
 if(!s.start||!s.end||!months.length)return null;
 const first=ms(months[0].key+'-01');const last=new Date(ms(months[months.length-1].key+'-01'));last.setUTCMonth(last.getUTCMonth()+1);
 const end=last.getTime(),start=ms(s.start),finish=ms(s.end)+86400000;
 if(finish<=first||start>=end)return null;
 return {left:Math.max(0,100*(start-first)/(end-first)),width:Math.max(.5,100*(Math.min(finish,end)-Math.max(start,first))/(end-first))};
};
const curve=(months:ScheduleOverviewModel['months'],key:'planned'|'actual')=>months.map((m,i)=>{
 const v=m[key];return v===null?null:{x:28+(i+.5)*390/months.length,y:106-v*.84};
}).filter((p):p is {x:number;y:number}=>p!==null);
const coords=(p:{x:number;y:number}[])=>p.map(x=>[x.x.toFixed(1),x.y.toFixed(1)].join(',')).join(' ');

/** Capa A4 paisagem com identidade do painel de obras. Gráficos reais; nunca inventa KPls. */
export function buildScheduleDashboardCover(schedule:WorkSchedule,quote?:Quote,company?:CompanySettings){
 const today=new Date(),local=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
 const data=scheduleOverviewModel(schedule,quote,local);
 const stages=data.stages.slice(0,9),months=data.months.slice(0,12);
 const omitted=data.stages.length-stages.length;
 const monthheads=months.map(m=>'<span>'+esc(m.label)+'</span>').join('');
 const gantt=stages.map((s,i)=>{
    const bar=range(s,months);
    return '<div class="oc-gantt-row"><div class="oc-gantt-name"><b style="background:'+s.color+'">'+(i+1)+'</b><span>'+esc(s.description)+'</span></div><div class="oc-gantt-track" style="background-size:'+(months.length?100/months.length:100)+'% 100%">'+(bar?'<i style="left:'+bar.left+'%;width:'+bar.width+'%;background:'+s.color+'"></i>':'<small>Sem prazo</small>')+'</div></div>';
 }).join('');
 const shareRows=stages.map((s,i)=>'<tr><td><span class="oc-number" style="background:'+s.color+'">'+(i+1)+'</span> '+esc(s.description)+'</td><td>'+pct(s.share)+'</td></tr>').join('');
 const detailRows=stages.map((s,i)=>'<tr><td><span class="oc-number" style="background:'+s.color+'">'+(i+1)+'</span></td><td>'+esc(s.description)+'</td><td>'+n(s.quantity)+' '+esc(s.unit)+'</td><td>'+shortDate(s.start)+'</td><td>'+shortDate(s.end)+'</td><td>'+ (s.duration===null?'—':s.duration) +'</td><td>'+pct(s.progress)+'</td></tr>').join('');
 const planned=coords(curve(months,'planned')),actual=data.hasMeasurements?coords(curve(months,'actual')):'';
 const ticks=[0,25,50,75,100].map(v=>'<line x1="28" y1="'+(106-v*.84)+'" x2="425" y2="'+(106-v*.84)+'" stroke="#244055"/><text x="24" y="'+(109-v*.84)+'" fill="#adbbce" font-size="8" text-anchor="end">'+v+'%</text>').join('');
 const ticklabels=months.map((m,i)=>'<text x="'+(28+(i+.5)*390/months.length)+'" y="123" fill="#b1c4d7" font-size="7" text-anchor="middle">'+esc(m.key.slice(5))+'/'+esc(m.key.slice(2,4))+'</text>').join('');
 const curveSvg=months.length?'<svg viewBox="0 0 450 135" aria-label="Curva S de progresso" role="img">'+ticks+ticklabels+(planned?'<polyline fill="none" stroke="#ff901b" stroke-width="2.5" points="'+planned+'"/>':'')+(actual?'<polyline fill="none" stroke="#ffe09e" stroke-width="2" stroke-dasharray="5 3" points="'+actual+'"/>':'')+'</svg>':'<p class="oc-muted">Aguardando cálculo das datas das etapas.</p>';
 const longest=data.longest.map(s=>'<tr><td>'+esc(s.description)+'</td><td>'+shortDate(s.end)+'</td><td>'+s.duration+'</td></tr>').join('')||'<tr><td colspan="3">Sem durações calculadas.</td></tr>';
 const branding=esc(company?.tradeName||company?.name||'ORÇAPRO');
 const html='<div id="oc-report-cover">'+
 '<div class="oc-hero"><div class="oc-brand"><div class="oc-mark">▥</div><div><b>'+branding+'</b><small>PLANEJAMENTO DE OBRAS</small></div></div>'+
 '<div class="oc-hero-title"><h1>CRONOGRAMA DE OBRAS</h1><p>PLANEJAMENTO <em>●</em> EXECUÇÃO <em>●</em> CONTROLE</p><small>Dados do cronograma e medições registradas no OrçaPro</small></div>'+
 '<div class="oc-hero-info"><div><b>OBRA:</b><span>'+esc(schedule.title)+'</span></div><div><b>LOCAL:</b><span>'+esc(schedule.siteAddress||'Não informado')+'</span></div><div><b>INÍCIO PREVISTO:</b><span>'+shortDate(data.start)+'</span></div><div><b>TÉRMINO:</b><span>'+shortDate(data.end)+'</span></div><div><b>DURAÇÃO:</b><span>'+(data.duration===null?'A definir':data.duration+' dias úteis')+'</span></div></div></div>'+
 '<div class="oc-layout-top"><section class="oc-panel"><h2>◉ RESUMO DAS ETAPAS E PERCENTUAIS</h2><table><thead><tr><th>ETAPA REAL DA OBRA</th><th>% HH</th></tr></thead><tbody>'+shareRows+'</tbody></table><div class="oc-panel-total">TOTAL <b>'+n(data.totalHH)+' HH</b></div></section>'+
 '<section class="oc-panel"><h2>◷ GRÁFICO DE GANTT — CRONOGRAMA FÍSICO</h2>'+(months.length?'<div class="oc-gantt-header"><span>ATIVIDADE</span><div style="grid-template-columns:repeat('+months.length+',1fr)">'+monthheads+'</div></div>'+gantt:'<p class="oc-muted">Não é possível apresentar barras de Gantt sem prazo calculado.</p>')+'</section></div>'+
 '<div class="oc-layout-mid"><section class="oc-panel"><h2>▤ DETALHAMENTO DOS SERVIÇOS</h2><table><thead><tr><th>#</th><th>SERVIÇO</th><th>QTD.</th><th>INÍCIO</th><th>FIM</th><th>DIAS</th><th>MEDIDO</th></tr></thead><tbody>'+detailRows+'</tbody></table>'+(omitted>0?'<p class="oc-muted">'+omitted+' etapa(s) adicionais detalhadas nas páginas seguintes.</p>':'')+'</section>'+
 '<div class="oc-right"><section class="oc-panel"><h2>◴ AVANÇO FÍSICO DA OBRA</h2><div class="oc-progress"><div class="oc-ring" style="background:conic-gradient(#f97316 0% '+(data.physical??0)+'%,#273b4f '+(data.physical??0)+'% 100%)"><div><b>'+pct(data.physical)+'</b><small>HH MEDIDAS</small></div></div><div class="oc-progress-legend"><div>● Concluído <b>'+data.completed+' etapa(s)</b></div><div>● Em andamento <b>'+data.inProgress+' etapa(s)</b></div><div>● Sem medição <b>'+data.notStarted+' etapa(s)</b></div></div></div></section>'+
 '<section class="oc-panel"><h2>↗ CURVA S — EVOLUÇÃO FÍSICA</h2><div class="oc-chart-legend"><span>━ Planejado</span> <span>'+(data.hasMeasurements?'┄ Realizado':'Realizado: sem medições')+'</span></div>'+curveSvg+'</section></div></div>'+
 '<div class="oc-layout-bottom"><section class="oc-panel"><h2>▦ CONTROLE DE PRAZOS</h2><div class="oc-statline">Não vencidas <b>'+data.upcoming+'</b></div><div class="oc-statline">Previsão vencida* <b>'+data.overdue+'</b></div><div class="oc-statline">Sem prazo calculado <b>'+data.unknownDeadline+'</b></div></section>'+
 '<section class="oc-panel"><h2>△ MAIORES DURAÇÕES PREVISTAS</h2><table><tbody>'+longest+'</tbody></table></section>'+
 '<section class="oc-panel"><h2>▥ INDICADORES</h2><div class="oc-kpis"><div>FÍSICO<b>'+pct(data.physical)+'</b><small>HH medidas</small></div><div>FINANCEIRO<b>'+pct(data.financialPercent)+'</b><small>Valor proporcional</small></div><div>QUALIDADE<b>—</b><small>Sem registro</small></div><div>SEGURANÇA<b>—</b><small>Sem registro</small></div></div></section></div>'+
 '<p class="oc-foot">OrçaPro · '+esc(quote?.number||'Sem orçamento vinculado')+' · Referências conforme composições cadastradas. *Prazo previsto vencido sem medição completa não prova atraso contratual. Percentuais ponderados por horas-homem; valor medido não é faturamento. Equipes e datas exigem validação técnica.</p>'+
 '</div>';
 const css='#oc-report-cover{--oc-b:#205275;color:#f8fbff;background:#030e1b;font:8px/1.23 Arial,Helvetica,sans-serif;padding:7px;border:1px solid #173b56;break-after:page;page-break-after:always;min-height:165mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
 '#oc-report-cover *{box-sizing:border-box}#oc-report-cover section{margin:0}#oc-report-cover h1,#oc-report-cover h2,#oc-report-cover p{margin:0}'+
 '#oc-report-cover .oc-hero{display:grid;grid-template-columns:24% 40% 36%;background:linear-gradient(110deg,#061524,#091b31,#061420);min-height:35px;gap:5px;border-bottom:2px solid #ea700e;margin-bottom:5px;padding:6px 8px;align-items:center}'+
 '#oc-report-cover .oc-brand{display:flex;align-items:center;gap:7px;border-right:1px solid #2d5169}#oc-report-cover .oc-mark{font-size:28px;color:#ff9a1b}#oc-report-cover .oc-brand b{display:block;font-size:15px;color:#fff;overflow-wrap:anywhere}#oc-report-cover .oc-brand small{display:block;color:#c1cddd;font-size:6px}'+
 '#oc-report-cover .oc-hero-title h1{font-size:19px;color:#fff;line-height:1.15}#oc-report-cover .oc-hero-title p{color:#c7daf1;font-size:9px;margin:3px 0}#oc-report-cover .oc-hero-title em{color:#ff8714;font-style:normal}#oc-report-cover .oc-hero-title small{color:#a9b8ca;font-style:italic}'+
 '#oc-report-cover .oc-hero-info{display:grid;gap:1px;border-left:2px solid #ef780f;padding-left:7px}#oc-report-cover .oc-hero-info div{display:grid;grid-template-columns:36% 64%;gap:3px}#oc-report-cover .oc-hero-info b{font-size:6.7px}#oc-report-cover .oc-hero-info span{color:#d5e3ed;font-size:7px;overflow-wrap:anywhere}'+
 '#oc-report-cover .oc-layout-top,#oc-report-cover .oc-layout-mid,#oc-report-cover .oc-layout-bottom{display:grid;gap:5px;margin-bottom:5px}#oc-report-cover .oc-layout-top{grid-template-columns:37% 1fr}#oc-report-cover .oc-layout-mid{grid-template-columns:61% 1fr}#oc-report-cover .oc-layout-bottom{grid-template-columns:28% 37% 1fr}'+
 '#oc-report-cover .oc-panel{border:1px solid #22618a;border-radius:5px;background:#091726;overflow:hidden;padding:3px 4px}#oc-report-cover .oc-panel h2{color:#f6f8ff;font-size:9px;padding:3px 1px 5px;border-bottom:1px solid #255070;margin-bottom:3px}'+
 '#oc-report-cover table{width:100%;border-collapse:collapse;table-layout:fixed}#oc-report-cover th{background:#132c42;color:#c9daec;font-size:6.5px;padding:3px 2px;text-align:left}#oc-report-cover td{color:#d8e8fa;border-top:1px solid #233e56;padding:3px 2px;font-size:7px;vertical-align:top;overflow-wrap:anywhere}#oc-report-cover tr{break-inside:avoid}#oc-report-cover .oc-number{display:inline-grid;place-items:center;border-radius:8px;min-width:14px;height:13px;padding:1px;color:white;font-weight:bold}'+
 '#oc-report-cover .oc-panel-total{display:flex;justify-content:space-between;color:#ffb15c;border-top:1px solid #df6b1c;margin-top:3px;padding-top:3px;font-weight:bold}'+
 '#oc-report-cover .oc-gantt-header{display:grid;grid-template-columns:33% 1fr;background:#142f46;color:#d7e8f5;font-size:6.4px;font-weight:bold}#oc-report-cover .oc-gantt-header>span{padding:5px}#oc-report-cover .oc-gantt-header>div{display:grid}#oc-report-cover .oc-gantt-header>div>span{text-align:center;border-left:1px solid #264861;padding:5px 0}'+
 '#oc-report-cover .oc-gantt-row{display:grid;grid-template-columns:33% 1fr;min-height:17px;border-top:1px solid #243e52}#oc-report-cover .oc-gantt-name{display:flex;min-width:0;align-items:center;gap:4px;padding:2px 3px}#oc-report-cover .oc-gantt-name b{color:white;border-radius:50%;min-width:13px;height:13px;display:grid;place-items:center}#oc-report-cover .oc-gantt-name span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}#oc-report-cover .oc-gantt-track{position:relative;background-image:linear-gradient(to right,#27455e 1px,transparent 1px)}#oc-report-cover .oc-gantt-track i{position:absolute;top:5px;height:7px;border-radius:3px}#oc-report-cover .oc-gantt-track small{font-size:6px;color:#fbbf24;padding-left:4px}'+
 '#oc-report-cover .oc-right{display:grid;gap:5px}#oc-report-cover .oc-progress{display:flex;gap:10px;justify-content:space-around;align-items:center;padding:4px}#oc-report-cover .oc-ring{border-radius:50%;width:80px;height:80px;padding:12px;display:grid;place-items:center}#oc-report-cover .oc-ring>div{background:#071727;width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-direction:column}#oc-report-cover .oc-ring b{font-size:16px;color:white}#oc-report-cover .oc-ring small{color:#c4d6e6;font-size:6px}#oc-report-cover .oc-progress-legend{flex:1}#oc-report-cover .oc-progress-legend div{display:flex;justify-content:space-between;gap:8px;margin:5px 0;color:#c4d4e5;font-size:7px}'+
 '#oc-report-cover .oc-chart-legend{text-align:right;color:#ffbc65;font-size:7px}#oc-report-cover svg{display:block;width:100%;height:auto;max-height:85px}#oc-report-cover .oc-statline{display:flex;justify-content:space-between;padding:3px;border-top:1px solid #1f3e54}#oc-report-cover .oc-statline b{color:#ffb15c}'+
 '#oc-report-cover .oc-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:3px}#oc-report-cover .oc-kpis div{border:1px solid #254766;border-radius:4px;padding:5px 2px;text-align:center;font-size:6.2px;color:#b0c9dd}#oc-report-cover .oc-kpis b{display:block;color:#f59a26;font-size:13px;margin:4px 0}#oc-report-cover .oc-kpis small{color:#9fb5c7;font-size:5.8px}'+
 '#oc-report-cover .oc-foot{color:#a8bfd2;font-size:6.8px;padding:4px 2px;border-top:1px solid #e78016}#oc-report-cover .oc-muted{padding:6px;color:#f5cb9a;font-size:7px}'+
 '@media print{#oc-report-cover{page-break-after:always;break-after:page;min-height:0;margin:0;box-shadow:none}#oc-report-cover .oc-panel{break-inside:avoid}}';
 return {css,html};
}
