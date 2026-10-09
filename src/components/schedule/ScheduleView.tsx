import React, { useMemo, useRef, useState } from 'react';
import { CalendarDays, Upload, Plus, Trash2, HardHat, Clock3, Info, AlertTriangle, Search, FileSpreadsheet, CheckCircle2, BarChart3, Download, ChevronDown, ExternalLink, ArrowUp, ArrowDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { importSinapiFile } from '../../utils/sinapiFile';
import {sinapiUFs, withSinapiProvenance, validCompetence, sinapiOriginLabel, type SinapiUF, type SinapiRegime} from '../../utils/sinapiRegional';
import { estimateSchedule, validScheduleDate, workingDaysBetween, nextWorkday } from '../../utils/scheduleMath';
import { physicalFinancial } from '../../utils/physicalFinancial';
import { buildScheduleDocument } from '../../utils/scheduleDocument';
import { addMeasurement, measuredQuantity, physicalProgress, progressPercent } from '../../utils/execution';
import { resolveScheduleSelection } from '../../utils/scheduleSelection';
import { decimalFromInput, mergeSinapiReports } from '../../utils/sinapi';
import type { SinapiComposition, WorkSchedule, ScheduleTask } from '../../types/schedule';
import { newId } from '../../utils/quoteMath';

const control='w-full min-w-0 rounded-xl border border-white/10 bg-[#0b0e15] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-orange-500/70';
const tile='rounded-2xl border border-white/10 bg-[#141822]';
const fmt=(value:number, maximumFractionDigits=2)=>value.toLocaleString('pt-BR',{maximumFractionDigits});
const toInput=(value:number)=>Number.isFinite(value)?String(value):'';
const csvSafe=(text:unknown)=>{
  let s=String(text??'');if(/^[\s\x00-\x1f]*[=+\-@\t\r]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
};
function exportModelCSV(){
  const heads=['Código Composição','Descrição Composição','Unidade Composição','Código Insumo','Descrição Insumo','Unidade Insumo','Coeficiente','Tipo'];
  const csv='\uFEFF'+heads.map(csvSafe).join(';')+'\r\n';
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='modelo_colunas_coeficientes_sinapi.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportScheduleCSV(schedule:WorkSchedule){
  const results=estimateSchedule(schedule);
  const data=[['Composição','Descrição','Unidade','Quantidade','HH totais','Dias úteis','Início','Término','Equipe por profissão','Origem SINAPI','Quantidade executada','Avanço (%)'],...results.entries.map(x=>[x.task.composition.code,x.task.composition.description,x.task.composition.unit,String(x.task.quantity),String(x.totalHH),x.days===null?'Pendente':String(x.days),x.start||'',x.end||'',x.labor.map(l=>`${l.role}: ${l.workers} pessoa(s)`).join(' | '),`${x.task.composition.sourceFile} - ${x.task.composition.sourceSheet} - ${sinapiOriginLabel(x.task.composition)}`,String(measuredQuantity(x.task)),String(progressPercent(x.task)??'')])];
  const csv='\uFEFF'+data.map(row=>row.map(csvSafe).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=`orcapro-cronograma-${schedule.id}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export const ScheduleView:React.FC=()=>{
  const {schedules,selectedScheduleId,setSelectedScheduleId,addSchedule,updateSchedule,deleteSchedule,quotes,company,ready,syncStatus}=useApp();
  const {theme}=useTheme();
  const [imported,setImported]=useState<SinapiComposition[]>([]);
  const [importInfo,setImportInfo]=useState('');
  const [reference,setReference]=useState('');
  const [regionalUF,setRegionalUF]=useState<SinapiUF | ''>('');
  const [regionalRegime,setRegionalRegime]=useState<SinapiRegime | ''>('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [search,setSearch]=useState('');
  const [selectedComposition,setSelectedComposition]=useState('');
  const [quantity,setQuantity]=useState('');
  const [selectedQuoteItem,setSelectedQuoteItem]=useState('');
  const [measurementInput,setMeasurementInput]=useState<Record<string,string>>({});
  const [measurementDate,setMeasurementDate]=useState<Record<string,string>>({});
  const [measurementNote,setMeasurementNote]=useState<Record<string,string>>({});
  const [showImport,setShowImport]=useState(true);
  const [holidayInput,setHolidayInput]=useState('');
  const [printHtml,setPrintHtml]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);
  const printableFrameRef=useRef<HTMLIFrameElement>(null);
  const current=resolveScheduleSelection(schedules,selectedScheduleId);
  const report=useMemo(()=>current?estimateSchedule(current):null,[current]);
  const attached=quotes.find(q=>q.id===current?.quoteId);
  const physical=current?physicalProgress(current):null;
  const physicalMoney=current?physicalFinancial(current,attached):null;
  const filtered=useMemo(()=>imported.filter(c=>`${c.code} ${c.description} ${c.unit}`.toLowerCase().includes(search.toLowerCase())).slice(0,80),[imported,search]);
  const selected=imported.find(c=>`${c.code}|${c.unit}`===selectedComposition);
  const change=(patch:Partial<WorkSchedule>)=>{if(current)updateSchedule({...current,...patch,updatedAt:new Date().toISOString()});};
  const addHoliday=()=>{
    if(!current)return;
    if(!validScheduleDate(holidayInput)){setError('Informe uma data não útil válida.');return;}
    const values=[...new Set([...(current.holidays||[]),holidayInput])].sort();
    if(values.length>366){setError('Limite de 366 datas não úteis por cronograma.');return;}
    change({holidays:values});setHolidayInput('');setError('');
  };
  const updateMode=(mode:'sequencial'|'dependencias')=>{
    if(!current)return;
    const initialize=mode==='dependencias' && !current.dependenciesConfigured && current.scheduleMode!=='dependencias';
    const tasks=initialize ? current.tasks.map((t,i)=>({...t,dependencies:i?[current.tasks[i-1].id]:[]})) : current.tasks;
    change({scheduleMode:mode,tasks,dependenciesConfigured: mode==='dependencias'||current.dependenciesConfigured});
  };
  const add=()=>{
    const title='Novo cronograma';
    const now=new Date();const plan:WorkSchedule={id:newId('cron'),title,startDate:[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-'),hoursPerDay:8,efficiency:1,tasks:[],createdAt:now.toISOString(),updatedAt:now.toISOString()};
    // 8h e 100% são parâmetros editáveis de planejamento, não coeficientes SINAPI.
    addSchedule(plan);setSelectedScheduleId(plan.id);setError('');
  };
  const loadFiles=async(files?:FileList|null)=>{
    if(!files?.length)return;
    setBusy(true);setError('');setImportInfo('');setImported([]);setSelectedComposition('');setReference('');setRegionalUF('');setRegionalRegime('');
    try{
      const reports=[];
      for(const file of Array.from(files))reports.push({file:file.name,report:await importSinapiFile(file)});
      const result=mergeSinapiReports(reports.map(f=>f.report));
      setImported(result.compositions);
      setSelectedComposition('');
      setReference(result.reference||'');
      const names=reports.map(r=>`${r.file}: ${r.report.compositions.length} composição(ões) elegíveis`).join(' | ');
      setImportInfo(`${names}. Total: ${result.compositions.length} serviço(s) com HH identificadas. ${result.issues.join(' ')}`);
    }catch(e){setError(e instanceof Error?e.message:'Falha na leitura da planilha.');}
    finally{setBusy(false);if(fileRef.current)fileRef.current.value='';}
  };
  const append=()=>{
    if(!current||!selected)return;
    const q=decimalFromInput(quantity);
    if(!Number.isFinite(q)||q<=0){setError('Informe quantidade válida maior que zero para o serviço.');return;}
    if(current.tasks.length>=180){setError('Limite de 180 serviços por cronograma. Divida a obra por etapa.');return;}
    if(!regionalUF || !regionalRegime || !validCompetence(reference.trim())){setError('Informe competência MM/AAAA, UF e regime de desoneração antes de adicionar a composição.');return;}
    let composition: SinapiComposition;
    try {composition=withSinapiProvenance(selected,{reference:reference.trim(),uf:regionalUF,regime:regionalRegime});}
    catch(err){setError(err instanceof Error?err.message:'Referência regional inválida.');return;}
    const task:ScheduleTask={id:newId('etapa'),composition,quantity:q,crew:{},dependencies:current.scheduleMode==='dependencias' && current.tasks.length?[current.tasks[current.tasks.length-1].id]:[]};
    change({tasks:[...current.tasks,task]});setError('');setQuantity('');setSelectedQuoteItem('');
  };
  const changeTask=(task:ScheduleTask)=>change({tasks:current!.tasks.map(t=>t.id===task.id?task:t)});
  const recordMeasurement=(task:ScheduleTask)=>{
    const amount=decimalFromInput(measurementInput[task.id]||'');
    const now=new Date();const localDate=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
    try {
      const next=addMeasurement(task,{id:newId('med'),date:measurementDate[task.id]||localDate,quantity:amount,note:(measurementNote[task.id]||'').trim(),recordedAt:now.toISOString()});
      changeTask(next);setMeasurementInput(v=>({...v,[task.id]:''}));setMeasurementNote(v=>({...v,[task.id]:''}));setError('');
    }catch(err){setError(err instanceof Error?err.message:'Medição inválida.');}
  };
  const removeTask=(id:string)=>{
    if(!current||!window.confirm('Remover esta etapa e retirar suas referências como predecessora?'))return;
    change({tasks:current.tasks.filter(t=>t.id!==id).map(t=>({...t,dependencies:(t.dependencies||[]).filter(d=>d!==id)}))});
  };
  const shiftTask=(index:number,step:number)=>{if(!current)return;const pos=index+step;if(pos<0||pos>=current.tasks.length)return;const updated=[...current.tasks];[updated[index],updated[pos]]=[updated[pos],updated[index]];change({tasks:updated});};
  const stat=(label:string,value:string,sub:string)=> <div className={`${tile} p-3.5`}><p className="text-[11px] text-slate-400">{label}</p><strong className="mt-1 block text-lg font-bold text-white">{value}</strong><p className="mt-1 text-[10px] text-slate-500">{sub}</p></div>;
  return <div className="space-y-4 pb-24 animate-in fade-in duration-200">
    <header className="flex items-start justify-between gap-3 pt-1"><div><div className="flex items-center gap-2"><CalendarDays size={22} style={{color:theme.primaryColor}}/><h1 className="text-xl font-bold text-white">Cronograma de execução</h1></div><p className="mt-1 text-xs text-slate-400">Composições SINAPI · quantitativos · horas-homem · equipe · prazo previsto</p></div><button onClick={add} className="flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{background:theme.primaryGradient}}><Plus size={16}/> Novo</button></header>
    {syncStatus==='error'&&<p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">Erro ao sincronizar. Não considere as mudanças salvas até resolver o aviso no topo do aplicativo.</p>}
    {!ready&&<div className={`${tile} p-5 text-sm text-slate-400`}>Carregando seus cronogramas...</div>}
    {ready&&<>
    <section className={`${tile} space-y-3 p-4`}><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Obra / cronograma</h2><span className="text-[10px] text-slate-500">{schedules.length} registrado(s)</span></div>
      {schedules.length>0?<select className={control} aria-label="Selecionar cronograma" value={current?.id||''} onChange={e=>setSelectedScheduleId(e.target.value)}>{schedules.map(p=><option key={p.id} value={p.id}>{p.title||'Sem título'} · {p.tasks?.length||0} etapa(s) {quotes.find(q=>q.id===p.quoteId)?.number||''}</option>)}</select>:<div className="rounded-xl border border-dashed border-white/15 p-5 text-center text-sm text-slate-400">Sem cronogramas cadastrados. Clique em <strong className="text-slate-200">Novo</strong> para começar.</div>}
      {current?.tasks.length===0 && schedules.some(p=>p.id!==current.id && p.tasks?.length>0) &&
        <button type="button" className="w-full rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2.5 text-left text-xs text-orange-200" onClick={()=>{const other=schedules.find(p=>p.id!==current.id && p.tasks?.length>0);if(other)setSelectedScheduleId(other.id);}}>
          Este cronograma está vazio. Abrir o cronograma com serviços cadastrados →
        </button>}
      {current&&<><label className="block text-[11px] text-slate-400">Identificação da obra<input className={`${control} mt-1`} value={current.title} maxLength={120} onChange={e=>change({title:e.target.value})} placeholder="Nome real da obra"/></label><label className="block text-[11px] text-slate-400">Vincular a um orçamento existente<select className={`${control} mt-1`} value={current.quoteId||''} onChange={e=>change({quoteId:e.target.value||undefined,tasks:current.tasks.map(t=>({...t,quoteItemId:undefined}))})}><option value="">Sem orçamento vinculado</option>{quotes.map(q=><option value={q.id} key={q.id}>{q.number} · {q.clientName} · {q.status}</option>)}</select></label>{attached&&attached.status!=='aprovado'&&<div className="text-[11px] text-amber-300">O orçamento vinculado ainda está como “{attached.status}”. O cronograma é apenas uma previsão, não uma execução contratada.</div>}
      <div className="grid grid-cols-2 gap-2.5"><label className="text-[11px] text-slate-400">Data de início<input type="date" className={`${control} mt-1`} value={current.startDate} onChange={e=>change({startDate:e.target.value})}/></label><label className="text-[11px] text-slate-400">Jornada (h/dia)<input type="number" min="0.1" max="24" step="0.5" className={`${control} mt-1`} value={toInput(current.hoursPerDay)} onChange={e=>change({hoursPerDay:Number(e.target.value)})}/></label><label className="text-[11px] text-slate-400">Eficiência planejada (%)<input type="number" min="1" max="100" step="1" className={`${control} mt-1`} value={toInput(Math.round(current.efficiency*100))} onChange={e=>change({efficiency:Number(e.target.value)/100})}/></label><div className="flex items-end"><button onClick={()=>{if(window.confirm('Excluir este cronograma e todas as suas etapas?')){deleteSchedule(current.id);setSelectedScheduleId('');}}} className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/20 px-3 py-2.5 text-xs text-rose-300 hover:bg-rose-500/10"><Trash2 size={14}/> Excluir cronograma</button></div></div>
      <div className="space-y-3 rounded-xl border border-orange-500/15 bg-orange-500/5 p-3">
        <label className="block text-[11px] text-slate-300">Modo de planejamento<select className={`${control} mt-1`} value={current.scheduleMode||'sequencial'} onChange={e=>updateMode(e.target.value as 'sequencial'|'dependencias')}><option value="sequencial">Sequencial — compatível com cronogramas antigos</option><option value="dependencias">Dependências — permite execução paralela</option></select></label>
        <p className="text-[10px] text-slate-400">No modo dependências, cada etapa pode começar após suas predecessoras. Ao ativar, a sequência existente é preservada e você pode ajustar as dependências em cada etapa. Equipes compartilhadas em serviços paralelos devem ser planejadas manualmente: não há nivelamento automático de recursos.</p>
        <label className="text-[11px] text-slate-300">Feriados e paralisações conhecidos (inserção manual)</label>
        <div className="flex items-center gap-2"><input className={control} aria-label="Dia não útil" type="date" value={holidayInput} onChange={e=>setHolidayInput(e.target.value)}/><button type="button" onClick={addHoliday} className="shrink-0 rounded-xl border border-orange-500/30 px-3 py-2.5 text-xs text-orange-300">Adicionar</button></div>
        {(current.holidays||[]).length>0&&<div className="flex flex-wrap gap-1.5">{current.holidays!.map(d=><button key={d} type="button" title="Remover dia não útil" onClick={()=>change({holidays:current.holidays!.filter(x=>x!==d)})} className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-slate-200">{d.split('-').reverse().join('/')} ×</button>)}</div>}
      </div>
      <p className="text-[10px] leading-relaxed text-slate-500">Jornada e eficiência são premissas informadas pelo responsável, não produtividades SINAPI. Sábados e domingos são excluídos, além das datas não úteis cadastradas. O sistema não inclui feriados automaticamente.</p></>}
    </section>
    <section className={`${tile} space-y-3 p-4`}><button type="button" onClick={()=>setShowImport(v=>!v)} className="flex w-full items-center justify-between text-left"><span className="flex items-center gap-2 text-sm font-semibold"><FileSpreadsheet size={17} style={{color:theme.primaryColor}}/> Importar composições SINAPI</span><ChevronDown size={17} className={`text-slate-400 transition ${showImport?'rotate-180':''}`}/></button>
      {showImport&&<><p className="text-[11px] leading-relaxed text-slate-400">Importe o arquivo <strong>SINAPI Referência</strong> (aba <strong>Analítico</strong>) em XLSX. Você também pode selecionar as quatro planilhas juntas: o sistema identificará a fonte de horas-homem e avisará quais arquivos são apenas de preços, percentuais, famílias ou manutenções. Planilhas CSV/TSV normalizadas continuam aceitas.</p>
      <input aria-label="Importar planilha SINAPI" ref={fileRef} type="file" accept=".xlsx,.csv,.tsv" className="hidden" multiple onChange={e=>void loadFiles(e.target.files)}/>
      <button onClick={()=>fileRef.current?.click()} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-orange-500/30 bg-orange-500/10 px-3 py-3 text-xs font-semibold text-orange-200 hover:bg-orange-500/15 disabled:opacity-50"><Upload size={17}/>{busy?'Lendo planilha...':'Selecionar planilhas do SINAPI'}</button>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><label className="block text-[11px] text-slate-400">Competência (MM/AAAA)<input className={`${control} mt-1`} value={reference} maxLength={7} onChange={e=>setReference(e.target.value)} placeholder="MM/AAAA"/></label><label className="block text-[11px] text-slate-400">UF da referência<select className={`${control} mt-1`} value={regionalUF} onChange={e=>setRegionalUF(e.target.value as SinapiUF | '')}><option value="">Selecione a UF</option>{sinapiUFs.map(uf=><option key={uf} value={uf}>{uf}</option>)}</select></label><label className="block text-[11px] text-slate-400">Encargos SINAPI<select className={`${control} mt-1`} value={regionalRegime} onChange={e=>setRegionalRegime(e.target.value as SinapiRegime | '')}><option value="">Selecione</option><option value="sem_desoneracao">Sem desoneração</option><option value="com_desoneracao">Com desoneração</option></select></label></div><p className="text-[10px] text-amber-300">A planilha analítica informa HH, não preços. UF e encargos identificam a referência declarada e NÃO modificam os coeficientes nem calculam custo automaticamente. Selecione o regime correspondente ao documento.</p>
      <button type="button" onClick={exportModelCSV} className="mr-3 text-[11px] text-orange-300 hover:underline">Baixar modelo de colunas (CSV vazio)</button>
      <a href="https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-orange-300 hover:underline">Abrir fonte oficial SINAPI (CAIXA) <ExternalLink size={12}/></a>
      <p className="text-[11px] text-amber-300/90">Importante: o percentual de mão de obra não representa horas-homem. Prazo por serviço depende das composições analíticas, quantitativo, equipe e jornada reais.</p>
      {importInfo&&<p className="rounded-xl bg-white/5 p-3 text-[11px] leading-relaxed text-slate-300">{importInfo}</p>}
      {imported.length>0&&<><p className="text-[11px] text-slate-400">As composições importadas ficam disponíveis nesta sessão. Ao adicionar uma etapa, o coeficiente e a fonte ficam salvos no cronograma no seu Supabase. Reimporte a planilha para escolher novos serviços depois de fechar o aplicativo.</p>
      <label className="relative block"><Search size={15} className="absolute left-3 top-3.5 text-slate-500"/><input className={`${control} pl-9`} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por código ou descrição"/></label>
      <div className="max-h-64 space-y-1 overflow-y-auto">{filtered.map(c=><button type="button" key={`${c.code}|${c.unit}`} onClick={()=>setSelectedComposition(`${c.code}|${c.unit}`)} className={`w-full rounded-xl border p-3 text-left ${selectedComposition===`${c.code}|${c.unit}`?'border-orange-500/60 bg-orange-500/10':'border-white/5 bg-[#0d1119]'}`}><div className="flex items-start justify-between gap-2"><strong className="text-xs text-slate-200">{c.code} · {c.unit}</strong><span className="text-[11px] text-orange-300">{fmt(c.labor.reduce((s,l)=>s+l.hoursPerUnit,0),4)} HH/{c.unit}</span></div><p className="mt-1 text-[11px] leading-snug text-slate-400">{c.description}</p></button>)}</div>
      {selected&&<div className="space-y-3 rounded-xl border border-orange-500/20 bg-orange-500/5 p-3"><div><strong className="text-xs">{selected.description}</strong><p className="mt-1 text-[10px] text-slate-400">{selected.labor.map(l=>`${l.role}: ${fmt(l.hoursPerUnit,5)} h/${selected.unit}`).join(' · ')}</p></div>
        {current?.quoteId&&<label className="block text-[11px] text-slate-400">Usar quantitativo de item do orçamento (opcional)<select className={`${control} mt-1`} value={selectedQuoteItem} onChange={e=>{setSelectedQuoteItem(e.target.value);const item=attached?.items.find(i=>i.id===e.target.value);if(item)setQuantity(String(item.quantity));}}><option value="">Inserir quantitativo manualmente</option>{attached?.items.filter(i=>i.unit.toLowerCase()===selected.unit.toLowerCase()).map(i=><option key={i.id} value={i.id}>{i.name} — {i.quantity} {i.unit}</option>)}</select></label>}
        <label className="block text-[11px] text-slate-400">Quantidade de serviço ({selected.unit})<input type="text" inputMode="decimal" value={quantity} onChange={e=>setQuantity(e.target.value)} className={`${control} mt-1`} placeholder={`Quantidade em ${selected.unit}`}/></label>
        <button disabled={!current} onClick={append} className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-40" style={{background:theme.primaryGradient}}><Plus size={16}/> Adicionar serviço ao cronograma</button>
      </div>}</>}
      </>}
    </section>
    {printHtml&&<section className={`${tile} space-y-2 p-3`}><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-xs text-orange-300">Cronograma pronto para impressão</strong><div className="flex items-center gap-3"><button className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white" onClick={()=>printableFrameRef.current?.contentWindow?.print()}>Imprimir / Salvar PDF</button><button className="text-xs text-slate-400" onClick={()=>setPrintHtml('')}>Fechar prévia</button></div></div><p className="text-[11px] text-slate-400">Use o botão de impressão e selecione “Salvar como PDF” no navegador. Dados são os que estão no cronograma atual, sem alterações no orçamento.</p><iframe ref={printableFrameRef} title="Prévia do cronograma para PDF" srcDoc={printHtml} className="h-[580px] w-full rounded-xl border border-white/10 bg-white" sandbox="allow-modals allow-same-origin"/></section>}
    {error&&<div role="alert" className="flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300"><AlertTriangle size={16}/>{error}</div>}
    {current&&report&&<>
      <div className="grid grid-cols-2 gap-2.5">{stat('Serviços',String(report.entries.length),'Etapas cadastradas')}{stat('Horas-homem',fmt(report.totalHH,2)+' HH','Soma por profissão')}{stat('Prazo previsto',report.workingDays===null?'A definir':`${report.workingDays} dias úteis`,current.scheduleMode==='dependencias'?'Com dependências e frentes paralelas':'Execução sequencial')}{stat('Data final',report.finishDate?new Date(report.finishDate+'T12:00:00').toLocaleDateString('pt-BR'):'A definir',`${report.pending} etapa(s) sem cálculo`)}{stat('Execução medida',physical?.percent===null?'Sem etapas':`${fmt(physical?.percent||0,1)}%`,`${physical?.completed||0} etapa(s) completas`)}</div>
      <section className={`${tile} space-y-3 p-4`}><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><HardHat size={17} style={{color:theme.primaryColor}}/> Etapas e equipes</h2><p className="mt-1 text-[11px] text-slate-400">Defina a quantidade real de profissionais por função em cada serviço.</p></div><button type="button" disabled={!report.entries.length} onClick={()=>exportScheduleCSV(current)} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 disabled:opacity-40"><Download size={14}/> Exportar CSV</button><button type="button" disabled={!report.entries.length} onClick={()=>setPrintHtml(buildScheduleDocument(current,attached,company))} className="flex items-center gap-1.5 rounded-lg border border-orange-500/30 px-3 py-2 text-xs text-orange-200 disabled:opacity-40">Preparar PDF</button></div>
      {report.entries.length===0?<div className="py-6 text-center text-xs text-slate-500">Nenhuma etapa adicionada. Importe a composição SINAPI e informe a quantidade para começar.</div>:report.entries.map((item,index)=><article key={item.task.id} className="space-y-3 rounded-xl border border-white/10 bg-[#0b0e15] p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase text-orange-300">Etapa {index+1} · código {item.task.composition.code}</p><h3 className="mt-1 text-xs font-semibold leading-snug text-white">{item.task.composition.description}</h3><p className="mt-1 text-[10px] text-slate-500">Origem: {item.task.composition.sourceFile} · {item.task.composition.sourceSheet} · {sinapiOriginLabel(item.task.composition)}</p></div><div className="flex shrink-0 items-center gap-1"><button disabled={index===0} title="Mover etapa acima" onClick={()=>shiftTask(index,-1)} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 disabled:opacity-20"><ArrowUp size={14}/></button><button disabled={index===report.entries.length-1} title="Mover etapa abaixo" onClick={()=>shiftTask(index,1)} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 disabled:opacity-20"><ArrowDown size={14}/></button><button title="Remover etapa" onClick={()=>removeTask(item.task.id)} className="rounded-lg p-1.5 text-rose-300 hover:bg-rose-500/10"><Trash2 size={15}/></button></div></div>
        <div className="grid grid-cols-2 gap-2"><label className="text-[10px] text-slate-400">Quantidade ({item.task.composition.unit})<input className={`${control} mt-1`} type="text" inputMode="decimal" value={toInput(item.task.quantity)} onChange={e=>{const q=decimalFromInput(e.target.value); if(q<measuredQuantity(item.task)){setError('Não é possível reduzir a quantidade abaixo do avanço físico já medido.');return;}changeTask({...item.task,quantity:q});}}/></label><div className="rounded-xl bg-white/5 p-2.5"><p className="text-[10px] text-slate-400">Horas-homem totais</p><strong className="text-sm">{fmt(item.totalHH,3)} HH</strong></div></div>
        {current.scheduleMode==='dependencias'&&<div className="rounded-xl border border-white/10 p-3"><p className="text-[11px] font-semibold text-slate-200">Atividades predecessoras</p><p className="mt-1 text-[10px] text-slate-500">Sem predecessoras = pode começar no início da obra. O sistema bloqueia ciclos e dependências inválidas.</p><div className="mt-2 max-h-40 space-y-1 overflow-y-auto">{current.tasks.filter(t=>t.id!==item.task.id).length===0?<span className="text-[10px] text-slate-500">Nenhuma outra etapa.</span>:current.tasks.filter(t=>t.id!==item.task.id).map(t=><label key={t.id} className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" checked={(item.task.dependencies||[]).includes(t.id)} onChange={e=>changeTask({...item.task,dependencies:e.target.checked?[...new Set([...(item.task.dependencies||[]),t.id])]:(item.task.dependencies||[]).filter(id=>id!==t.id)})}/>{t.composition.code} · {t.composition.description.slice(0,62)}</label>)}</div></div>}
        {attached&&<label className="block text-[11px] text-slate-400">Item financeiro correspondente no orçamento (opcional)<select className={`${control} mt-1`} value={item.task.quoteItemId||''} onChange={e=>changeTask({...item.task,quoteItemId:e.target.value||undefined})}><option value="">Sem correspondência financeira</option>{attached.items.map(q=><option key={q.id} value={q.id}>{q.name} · {fmt(q.quantity)} {q.unit} · R$ {fmt(q.totalPrice)}</option>)}</select><span className="mt-1 block text-[10px] text-slate-500">Só entra no físico-financeiro se a unidade e a quantidade forem compatíveis, sem associar o mesmo item duas vezes.</span></label>}
        <div className="space-y-2">{item.labor.map((l,i)=><div className="flex items-center gap-2" key={`${l.code}:${l.role}`}><div className="min-w-0 flex-1"><p className="truncate text-[11px] text-slate-300" title={l.role}>{l.role}</p><p className="text-[10px] text-slate-500">{fmt(l.hours,3)} h necessárias</p></div><label className="w-24 text-[10px] text-slate-400">Pessoas<input type="number" min="1" max="500" step="1" className={`${control} mt-1`} value={item.task.crew[`${l.code}:${l.role}`]||''} onChange={e=>changeTask({...item.task,crew:{...item.task.crew,[`${l.code}:${l.role}`]:Number(e.target.value)}})}/></label></div>)}</div>
        <div className="space-y-2 rounded-xl border border-white/10 bg-[#141822] p-3">
          <div className="flex items-center justify-between text-[11px]"><strong>Execução física comprovada por medições</strong><span>{fmt(measuredQuantity(item.task),3)} / {fmt(item.task.quantity,3)} {item.task.composition.unit} ({fmt(progressPercent(item.task)||0,1)}%)</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{width:`${progressPercent(item.task)||0}%`}}/></div>
          <div className="grid grid-cols-2 gap-2"><label className="text-[10px] text-slate-400">Quantidade executada nesta medição<input className={`${control} mt-1`} inputMode="decimal" placeholder="Quantidade real" value={measurementInput[item.task.id]||''} onChange={e=>setMeasurementInput(v=>({...v,[item.task.id]:e.target.value}))}/></label><label className="text-[10px] text-slate-400">Data da execução<input type="date" className={`${control} mt-1`} value={measurementDate[item.task.id]||new Date().toLocaleDateString('en-CA')} onChange={e=>setMeasurementDate(v=>({...v,[item.task.id]:e.target.value}))}/></label></div>
          <input aria-label="Observação da medição" className={control} placeholder="Observação (opcional)" maxLength={160} value={measurementNote[item.task.id]||''} onChange={e=>setMeasurementNote(v=>({...v,[item.task.id]:e.target.value}))}/>
          <button type="button" onClick={()=>recordMeasurement(item.task)} className="w-full rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-2 text-xs font-semibold text-emerald-300">Registrar quantidade realmente executada</button>
          {(item.task.progress?.length||0)>0&&<div className="space-y-1 border-t border-white/10 pt-2">{(item.task.progress||[]).map(m=><div key={m.id} className="flex justify-between gap-2 text-[10px] text-slate-400"><span>{m.date.split('-').reverse().join('/')} · {fmt(m.quantity,3)} {item.task.composition.unit}{m.note?` · ${m.note}`:''}</span><span className="text-emerald-400">Registrado</span></div>)}</div>}
        </div>
        {item.days===null?<div className="rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-200">{item.warnings.join(' ')||'Revise os dados.'}</div>:<div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-2 text-[11px] text-emerald-200"><CheckCircle2 size={14}/>{item.days} dia(s) útil(eis) · {item.start?.split('-').reverse().join('/')} → {item.end?.split('-').reverse().join('/')}</div>}
      </article>)}
      </section>
      <section className={`${tile} space-y-3 p-4`}><h2 className="text-sm font-bold">Cronograma físico-financeiro — itens vinculados</h2><p className="text-[11px] text-slate-400">Valor previsto das etapas expressamente vinculadas aos itens da proposta versus valor proporcional às quantidades efetivamente medidas. Não representa faturamento, emissão de nota, contas a receber ou pagamento.</p>
        <div className="grid grid-cols-2 gap-2"><div className="rounded-xl bg-white/5 p-3"><p className="text-[10px] text-slate-400">Valor de proposta mapeado</p><strong className="text-base">{(physicalMoney?.planned||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></div><div className="rounded-xl bg-white/5 p-3"><p className="text-[10px] text-slate-400">Valor medido proporcional</p><strong className="text-base">{(physicalMoney?.measured||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></div></div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-orange-500" style={{width:`${physicalMoney?.percent||0}%`}}/></div><p className="text-[11px] text-slate-300">{physicalMoney?.percent===null?'Sem cobertura financeira validada':`${fmt(physicalMoney?.percent||0,1)}% de avanço financeiro nos itens mapeados`}</p>
        {physicalMoney?.issues.map((issue,i)=><p key={i} className="text-[10px] text-amber-300">{issue}</p>)}
        {!!physicalMoney?.unlinkedTasks&&<p className="text-[10px] text-slate-400">{physicalMoney.unlinkedTasks} etapa(s) sem vínculo financeiro; não foram incluídas no cálculo.</p>}
        {attached?.status!=='aprovado'&&<p className="text-[10px] text-amber-300">Proposta ainda não aprovada: valores são apenas planejamento, não contratação comprovada.</p>}
      </section>
      <section className={`${tile} space-y-3 p-4`}><h2 className="flex items-center gap-2 text-sm font-bold"><BarChart3 size={17} style={{color:theme.primaryColor}}/> Gantt — planejado e executado</h2><p className="text-[11px] text-slate-400">Barras laranja: prazo previsto em dias úteis. Sobreposição verde: percentual físico medido sobre a barra prevista (não representa datas reais de execução). Em modo dependências, atividades independentes podem ocorrer em paralelo; sem nivelamento automático de equipes.</p>
      {report.workingDays!==null? <div className="space-y-2">{report.entries.map((e,i)=>{const first=nextWorkday(current.startDate,current.holidays||[]);const previous=first&&e.start?Math.max(0,(workingDaysBetween(first,e.start,current.holidays||[])||1)-1):0;const total=Math.max(1,report.workingDays||1);return <div className="grid grid-cols-[74px_minmax(0,1fr)] items-center gap-2" key={e.task.id}><span className="truncate text-[10px] text-slate-400">{e.task.composition.code}</span><div className="relative h-6 rounded-md bg-white/5"><span title={`${e.days} dia(s) · ${e.start} a ${e.end}`} className="absolute top-0 flex h-6 items-center justify-center rounded-md text-[10px] font-semibold text-white" style={{left:`${previous/total*100}%`,width:`${Math.max(1,(e.days||1)/total*100)}%`,background:theme.primaryGradient}}>{(e.days||0)/total>0.08?e.days:''}</span><span className="absolute bottom-0 h-1.5 rounded bg-emerald-400" style={{left:`${previous/total*100}%`,width:`${(e.days||0)/total*(progressPercent(e.task)||0)}%`}}/></div></div>})}<p className="text-[10px] text-slate-500">Início: {current.startDate.split('-').reverse().join('/')} · Término previsto: {report.finishDate?.split('-').reverse().join('/')}. Exclui as datas não úteis informadas e considera dependências configuradas.</p></div> :<div className="rounded-xl border border-dashed border-white/15 p-4 text-xs text-slate-400">Informe quantidade, equipes e parâmetros válidos de todas as etapas para exibir o gráfico.</div>}
      </section>
      <aside className="flex items-start gap-2 rounded-xl border border-white/10 bg-[#141822] p-3 text-[11px] leading-relaxed text-slate-400"><Info size={16} className="mt-0.5 shrink-0"/><span>O SINAPI fornece coeficientes referenciais de consumo de mão de obra por unidade, <strong className="text-slate-200">não um compromisso automático de duração</strong>. O prazo depende da equipe real, jornada, eficiência, condições da obra, feriados, logística, interferências e sequência executiva. Revise as composições e valide o cronograma tecnicamente antes de enviar ao cliente.</span></aside>
    </>}
    </>}
  </div>;
};
