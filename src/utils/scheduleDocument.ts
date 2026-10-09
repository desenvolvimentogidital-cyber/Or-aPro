import type {WorkSchedule} from '../types/schedule';
import type {Quote,CompanySettings} from '../types/index';
import {estimateSchedule,scheduleWorkdayDates} from './scheduleMath.js';
import {physicalFinancial} from './physicalFinancial.js';
import {measuredQuantity,progressPercent} from './execution.js';
import {sinapiOriginLabel} from './sinapiRegional.js';
import {buildScheduleDashboardCover} from './scheduleDashboardDocument.js';
const esc=(v: unknown)=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch));
const fmt=(v:number)=>Number.isFinite(v)?v.toLocaleString('pt-BR',{maximumFractionDigits:3}):'—';
const money=(v:number)=>Number.isFinite(v)?v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—';
const date=(v:string|null|undefined)=>v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v.split('-').reverse().join('/'): 'A definir';
const short=(v:string)=>v.slice(8,10)+'/'+v.slice(5,7);
const weekdays=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const weekday=(v:string)=>weekdays[new Date(v+'T12:00:00Z').getUTCDay()];
export function buildScheduleDocument(schedule:WorkSchedule,quote?:Quote,company?:CompanySettings):string {
  const report=estimateSchedule(schedule);
  const cover=buildScheduleDashboardCover(schedule,quote,company);
  const physical=physicalFinancial(schedule,quote);
  const labels = new Map(schedule.tasks.map((t,i)=>[t.id,`${i+1} · ${t.composition.code}`]));
  // Datas reais: 15 dias úteis por página, com data e dia da semana em cada coluna.
  const allDays=report.finishDate?scheduleWorkdayDates(schedule.startDate,report.finishDate,schedule.holidays||[]):[];
  const axisDays=allDays.slice(0,260);
  const windows:string[]=[];
  for(let offset=0;offset<axisDays.length;offset+=15) {
    const days=axisDays.slice(offset,offset+15);
    const first=days[0],last=days[days.length-1];
    const axis=`<div class="time-row time-axis" style="grid-template-columns:240px repeat(${days.length},minmax(0,1fr))"><div class="time-label">Serviço · prazo calculado</div>${days.map((d,i)=>`<div class="time-cell head" title="Dia útil ${offset+i+1} · ${date(d)}"><b>D${offset+i+1}</b><span>${short(d)}</span><small>${weekday(d)}</small></div>`).join('')}</div>`;
    const activities=report.entries.map((e,i)=>({e,i})).filter(({e})=>e.start&&e.end&&e.start<=last&&e.end>=first);
    const bars=activities.map(({e,i})=>{
      const progress=progressPercent(e.task);
      return `<div class="time-row" style="grid-template-columns:240px repeat(${days.length},minmax(0,1fr))"><div class="time-label"><b>${i+1}. ${esc(e.task.composition.code)}</b> ${esc(e.task.composition.description)}<small>${e.days} dia(s) úteis · ${date(e.start)} a ${date(e.end)}${progress===null?'':` · medido ${fmt(progress)}%`}</small></div>${days.map(d=>`<div class="time-cell ${d>=e.start!&&d<=e.end!?'active':''}"></div>`).join('')}</div>`;
    }).join('');
    windows.push(`<section class="timeline-page"><h2>Planejamento visual · dias úteis ${offset+1} a ${offset+days.length}</h2><p class="sub">${date(first)} a ${date(last)} · Barras em laranja = execução prevista; fins de semana e datas não úteis informadas excluídos.</p><div class="timeline">${axis}${bars||'<p class="sub pad">Nenhuma etapa prevista neste intervalo.</p>'}</div></section>`);
  }
  const moreDays=allDays.length>260?'<p class="hint">O quadro visual inclui os primeiros 260 dias úteis. Confira as datas das demais etapas na tabela de atividades.</p>':'';

  const rows=report.entries.map((e,i)=>{
    const deps=(schedule.scheduleMode==='dependencias'?(e.task.dependencies||[]):i?[schedule.tasks[i-1].id]:[]).map(id=>labels.get(id)||'Referência inválida').join(', ');
    const roles=e.labor.map(l=>`${l.role}: ${fmt(l.hours)} HH / ${l.workers||'equipes não informadas'}`).join(' | ');
    return `<tbody class="activity"><tr><td>${i+1}</td><td><b>${esc(e.task.composition.code)}</b> — ${esc(e.task.composition.description)}<small>Composição: ${esc(e.task.composition.sourceFile)} · ${esc(sinapiOriginLabel(e.task.composition))}</small></td><td>${fmt(e.task.quantity)} ${esc(e.task.composition.unit)}</td><td>${fmt(e.totalHH)} HH</td><td>${e.days===null?'Pendente':`${e.days} dias úteis`}</td><td>${date(e.start)}</td><td>${date(e.end)}</td><td>${fmt(measuredQuantity(e.task))} ${esc(e.task.composition.unit)}</td></tr><tr class="note"><td></td><td colspan="7"><span>Equipe: ${esc(roles||'Não informada')}</span>${deps?`<span>Predecessoras: ${esc(deps)}</span>`:''}${e.warnings.length?`<span class="warn">Pendências: ${esc(e.warnings.join(' '))}</span>`:''}</td></tr></tbody>`;
  }).join('');
  const reference = [...new Set(schedule.tasks.map(t=>t.composition.reference).filter(Boolean))].join(', ')||'Não informada';
  const warns=physical.issues.map(w=>`<li>${esc(w)}</li>`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cronograma — ${esc(schedule.title)}</title><style>
@page{size:A4 landscape;margin:12mm 12mm 13mm}*{box-sizing:border-box}html,body{margin:0;background:#07111c;color:#f3f7fc;font-family:Arial,'DejaVu Sans',sans-serif;font-size:11px;line-height:1.45}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:22px}header{border-bottom:2px solid #f97316;padding-bottom:15px;margin-bottom:18px}h1{font-size:22px;margin:0 0 5px}h2{font-size:15px;margin:0 0 10px;color:#fdba74}.sub{color:#a5b4c6}.pill{display:inline-block;padding:4px 9px;background:#372013;color:#fdba74;border-radius:7px;margin-top:8px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:18px}.card{padding:10px;border:1px solid #384858;border-radius:10px;background:#101e2d;overflow-wrap:anywhere}.card b{display:block;margin:4px 0;font-size:13px}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}th{text-align:left;background:#173048;color:#fed7aa;font-size:10px;padding:7px}td{padding:7px 5px;border-bottom:1px solid #35485b;vertical-align:top;overflow-wrap:anywhere}tr,tbody.activity{break-inside:avoid-page;page-break-inside:avoid}td small{display:block;color:#94a3b8;margin-top:4px}tr.note td{font-size:10px;color:#9cabbc;background:#0e1d2b;padding:5px 8px 10px}.note span{display:block;margin-bottom:3px}.warn{color:#fbbf24}.totals{display:flex;gap:10px;margin:16px 0}.totals .card{flex:1}section{break-inside:auto;margin:14px 0}footer{color:#93a6b9;border-top:1px solid #41516a;padding-top:8px;font-size:10px}.hint{padding:10px 12px;border:1px solid #6a4932;border-radius:9px;color:#fed7aa;margin:10px 0}li{margin-bottom:4px}@media print{html,body{background:#07111c}body{padding:0}.meta{grid-template-columns:repeat(3,1fr)}.card,.hint{break-inside:avoid-page}}
 
/* Apresentação clara para impressão, em A4 paisagem: fundo claro e baixo consumo de tinta. */
html,body{background:#fff;color:#1b3048;font-family:Arial,'DejaVu Sans',sans-serif;font-size:10px}
body{padding:16px} header{border-color:#ea580c} h1{color:#142d49;font-size:23px} h2{color:#183855}
.sub{color:#53677e}.pill{background:#fff3e8;color:#9a3412}
.meta{grid-template-columns:repeat(4,1fr);gap:8px}.card{background:#f3f6f9;border:1px solid #dce4ec;color:#253e58}
.card b{color:#142d49}th{background:#213c56;color:white}td{border-color:#dce4ec}
td small{color:#60758b}tr.note td{background:#f5f8fa;color:#53677e}.warn{color:#9a3412}
.hint{background:#fff7ed;color:#7c401a;border-color:#fdba74}
footer{color:#53677e;border-color:#d1dbe5}
.timeline-page{break-before:page;page-break-before:always;margin:8px 0}
.timeline{border:1px solid #d6e0e9;border-radius:5px;overflow:hidden}
.time-row{display:grid;border-bottom:1px solid #dbe4ed;min-height:37px;break-inside:avoid-page}
.time-row:last-child{border:0}.time-label{padding:6px 7px;border-right:1px solid #c7d5e2;font-size:8px;min-width:0;overflow-wrap:anywhere}
.time-label b{color:#183855}.time-label small{display:block;color:#53677e;font-size:7.5px;margin-top:4px}
.time-cell{border-right:1px solid #e0e8ef;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:7.5px}
.time-cell.head{background:#e9eff5;min-height:45px;color:#334e66}
.time-cell.head b{color:#1e3a55}.time-cell.head span{font-weight:bold}
.time-cell.head small{color:#677e94}.time-cell.active{background:#f97316;border-right-color:#fff2e3}
.pad{padding:10px}
@media print{html,body{background:#fff;color:#1b3048}body{padding:0}.meta{grid-template-columns:repeat(4,1fr)}.timeline-page{break-before:page;page-break-before:always}.time-row{break-inside:avoid-page}}
${cover.css}</style></head><body>${cover.html}<header><h1>Cronograma de execução</h1><div class="sub">${esc(company?.tradeName||company?.name||'Empresa não identificada')} · ${esc(schedule.title)}</div><div class="pill">${esc((schedule.operationalStatus||'planejamento').replace('_',' '))} · planejamento técnico, não promessa contratual</div></header>
<div class="meta"><div class="card">Orçamento vinculado<b>${esc(quote?.number||'Não informado')}</b>${esc(quote?.clientName||'')}</div><div class="card">Início previsto<b>${date(schedule.startDate)}</b>Término: ${date(report.finishDate)}</div><div class="card">Prazo estimado<b>${report.workingDays===null?'Pendente':`${report.workingDays} dias úteis`}</b>${report.pending} etapa(s) sem cálculo</div><div class="card">Horas-homem<b>${fmt(report.totalHH)} HH</b>SINAPI: ${esc(reference)}</div><div class="card">Jornada e eficiência<b>${fmt(schedule.hoursPerDay)} h/dia · ${fmt(schedule.efficiency*100)}%</b>Valores definidos para a obra</div><div class="card">Calendário<b>${schedule.scheduleMode==='dependencias'?'Com dependências':'Sequencial'}</b>${(schedule.holidays||[]).length} dia(s) não úteis informados</div></div>
<section><h2>Etapas, equipes e datas previstas</h2>${report.entries.length?`<table><thead><tr><th style="width:5%">#</th><th>Composição / serviço</th><th style="width:12%">Quantidade</th><th style="width:10%">HH</th><th style="width:11%">Prazo</th><th style="width:11%">Início</th><th style="width:11%">Término</th><th style="width:12%">Medido</th></tr></thead>${rows}</table>`:'<p>Nenhuma etapa cadastrada.</p>'}</section>
<section><h2>Físico-financeiro dos itens vinculados</h2><div class="totals"><div class="card">Valor vinculado<b>${money(physical.planned)}</b></div><div class="card">Valor proporcional medido<b>${money(physical.measured)}</b></div><div class="card">Avanço dos itens cobertos<b>${physical.percent===null?'Não calculado':`${fmt(physical.percent)}%`}</b></div></div>${warns?`<ul class="sub">${warns}</ul>`:''}</section>
<div class="hint">Este documento apresenta estimativa baseada em coeficientes SINAPI de mão de obra, quantidades, equipes e jornada declaradas. Sem rateio automático de recursos compartilhados entre etapas paralelas. As datas devem ser conferidas com feriados locais, logística e condições reais da obra. Valor proporcional medido não é faturamento, nota fiscal ou recebimento.</div>
${windows.join('')}${moreDays}
<footer>OrçaPro · Documento gerado sob demanda com registros disponíveis no sistema. Não contém assinaturas, medições ou equipes inventadas.</footer></body></html>`;
}
