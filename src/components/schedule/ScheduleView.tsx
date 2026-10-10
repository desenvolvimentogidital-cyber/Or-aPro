import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Upload, Plus, Trash2, HardHat, Clock3, Info, AlertTriangle, Search, FileSpreadsheet, CheckCircle2, BarChart3, Download, ChevronDown, ExternalLink, ArrowUp, ArrowDown, Wrench } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { importSinapiFile } from '../../utils/sinapiFile';
import {sinapiUFs, withSinapiProvenance, validCompetence, sinapiOriginLabel, type SinapiUF, type SinapiRegime} from '../../utils/sinapiRegional';
import { estimateSchedule, validScheduleDate, scheduleWorkdayDates } from '../../utils/scheduleMath';
import { physicalFinancial } from '../../utils/physicalFinancial';
import { buildScheduleDocument } from '../../utils/scheduleDocument';
import { ScheduleOverview } from './ScheduleOverview';
import { addMeasurement, measuredQuantity, physicalProgress, progressPercent } from '../../utils/execution';
import { resolveScheduleSelection } from '../../utils/scheduleSelection';
import { decimalFromInput, mergeSinapiReports } from '../../utils/sinapi';
import type { SinapiComposition, WorkSchedule, ScheduleTask } from '../../types/schedule';
import { newId } from '../../utils/quoteMath';
import { sameServiceUnit, simulateCrewForQuote } from '../../utils/quoteSchedule';
import { compositionIdentity, findCatalogSinapiCandidates, savedSinapiForQuote, usableSinapiComposition } from '../../utils/catalogSinapi';
import {searchSinapiOnline,onlineSinapiPendingComposition,type SinapiOnlineResult} from '../../services/sinapiOnline';

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
  const {schedules,selectedScheduleId,setSelectedScheduleId,addSchedule,updateSchedule,deleteSchedule,quotes,catalog,updateCatalogItem,sinapiSession,setSinapiSession,company,ready,syncStatus}=useApp();
  const {theme}=useTheme();
  const imported=sinapiSession.compositions;
  const [importInfo,setImportInfo]=useState(sinapiSession.info);
  const reference=sinapiSession.reference;
  const regionalUF=sinapiSession.uf;
  const regionalRegime=sinapiSession.regime;
  const setReference=(value:string)=>setSinapiSession(v=>({...v,reference:value}));
  const setRegionalUF=(value:SinapiUF|'')=>setSinapiSession(v=>({...v,uf:value}));
  const setRegionalRegime=(value:SinapiRegime|'')=>setSinapiSession(v=>({...v,regime:value}));
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [search,setSearch]=useState('');
  const [selectedComposition,setSelectedComposition]=useState('');
  const [quantity,setQuantity]=useState('');
  const [selectedQuoteItem,setSelectedQuoteItem]=useState('');
  const [activeQuoteItem,setActiveQuoteItem]=useState('');
  const [quoteSearch,setQuoteSearch]=useState<Record<string,string>>({});
  const [quoteComposition,setQuoteComposition]=useState<Record<string,string>>({});
  const [quoteTargetDays,setQuoteTargetDays]=useState<Record<string,string>>({});
  const [measurementInput,setMeasurementInput]=useState<Record<string,string>>({});
  const [measurementDate,setMeasurementDate]=useState<Record<string,string>>({});
  const [measurementNote,setMeasurementNote]=useState<Record<string,string>>({});
  const [catalogServiceQuery,setCatalogServiceQuery]=useState('');
  const [catalogSelectedId,setCatalogSelectedId]=useState('');
  const [catalogSinapiQuery,setCatalogSinapiQuery]=useState('');
  const [catalogChoice,setCatalogChoice]=useState('');
  const [catalogQuantity,setCatalogQuantity]=useState('');
  const [catalogTargetDays,setCatalogTargetDays]=useState('');
  const [catalogNotice,setCatalogNotice]=useState('');
  const [onlineResults,setOnlineResults]=useState<SinapiOnlineResult[]>([]);
  const [onlineStatus,setOnlineStatus]=useState<'idle'|'loading'|'ready'|'error'>('idle');
  const [onlineError,setOnlineError]=useState('');
  const [selectedOnline,setSelectedOnline]=useState<SinapiOnlineResult|null>(null);
  const [catalogQuoteItemId,setCatalogQuoteItemId]=useState('');
  const [showImport,setShowImport]=useState(true);
  const [holidayInput,setHolidayInput]=useState('');
  const [printHtml,setPrintHtml]=useState('');
  const [printUrl,setPrintUrl]=useState('');
  const [ganttPage,setGanttPage]=useState(0);
  const fileRef=useRef<HTMLInputElement>(null);
  const printableFrameRef=useRef<HTMLIFrameElement>(null);
  const pdfPreviewRef=useRef<HTMLElement>(null);
  // O relatório é gerado localmente; a aba independente permite usar
  // "Imprimir / Salvar PDF" inclusive quando o navegador móvel não imprime iframes.
  useEffect(()=>{
    if(!printHtml){setPrintUrl('');return;}
    const url=URL.createObjectURL(new Blob([printHtml],{type:'text/html;charset=utf-8'}));
    setPrintUrl(url);
    window.requestAnimationFrame(()=>pdfPreviewRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',
      block:'start'
    }));
    return ()=>URL.revokeObjectURL(url);
  },[printHtml]);
  const current=resolveScheduleSelection(schedules,selectedScheduleId);
  const report=useMemo(()=>current?estimateSchedule(current):null,[current]);
  // Um grupo de 15 dias úteis por vez: datas REAIS legíveis, mesmo em obras longas.
  const timeline=useMemo(()=>current&&report?.finishDate?scheduleWorkdayDates(current.startDate,report.finishDate,current.holidays||[]):[],[current,report]);
  const pageCount=Math.ceil(timeline.length/15);
  const safeGanttPage=Math.min(ganttPage,Math.max(0,pageCount-1));
  const ganttDates=timeline.slice(safeGanttPage*15,(safeGanttPage+1)*15);
  const attached=quotes.find(q=>q.id===current?.quoteId);
  const physical=current?physicalProgress(current):null;
  const physicalMoney=current?physicalFinancial(current,attached):null;
  const filtered=useMemo(()=>imported.filter(c=>`${c.code} ${c.description} ${c.unit}`.toLowerCase().includes(search.toLowerCase())).slice(0,80),[imported,search]);
  const selected=imported.find(c=>`${c.code}|${c.unit}`===selectedComposition);
  const catalogServices=useMemo(()=>{
    const query=catalogServiceQuery.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    return catalog.filter(item=>item.type==='servico' &&
      (!query || (item.name+' '+item.category).normalize('NFD')
        .replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query))).slice(0,45);
  },[catalog,catalogServiceQuery]);
  const selectedCatalogService=catalog.find(item=>item.id===catalogSelectedId && item.type==='servico');
  const onlineTerm=(catalogSinapiQuery.trim()||selectedCatalogService?.name.trim()||'').slice(0,100);
  useEffect(()=>{
    if(onlineTerm.length<2){setOnlineResults([]);setOnlineStatus('idle');setOnlineError('');return;}
    const controller=new AbortController();
    setOnlineStatus('loading');
    setOnlineError('');
    const id=window.setTimeout(()=>{
      searchSinapiOnline(onlineTerm,controller.signal).then(results=>{
        if(controller.signal.aborted)return;
        setOnlineResults(results);
        setOnlineStatus('ready');
      }).catch(e=>{
        if(controller.signal.aborted)return;
        setOnlineStatus('error');
        setOnlineResults([]);
        setOnlineError(e instanceof Error?e.message:'Consulta online indisponível.');
      });
    },550);
    return ()=>{window.clearTimeout(id);controller.abort();};
  },[onlineTerm]);
  const knownCompositions=useMemo(()=>{
    const items:SinapiComposition[]=[];
    const used=new Set<string>();
    const collect=(c:SinapiComposition)=>{
      const key=compositionIdentity(c);
      if(!used.has(key)){items.push(c);used.add(key);}
    };
    // A importação atual é prioritária; composições antigas são mostradas com fonte explícita.
    imported.forEach(collect);
    catalog.forEach(item=>{if(usableSinapiComposition(item.sinapiComposition))collect(item.sinapiComposition);});
    schedules.forEach(schedule=>schedule.tasks.forEach(task=>{
      if(usableSinapiComposition(task.composition))collect(task.composition);
    }));
    return items;
  },[imported,catalog,schedules]);
  const catalogCandidates=useMemo(()=>{
    // Pesquisa SINAPI funciona SEM exigir seleção prévia no catálogo.
    // Quando não há termo nem serviço escolhido, não despeja milhares de itens no Android.
    if(!selectedCatalogService && !catalogSinapiQuery.trim())return [];
    const target=selectedCatalogService||{name:'',unit:''};
    const results=findCatalogSinapiCandidates(target,knownCompositions,catalogSinapiQuery,50);
    const linked=selectedCatalogService?.sinapiComposition;
    if(usableSinapiComposition(linked) && !catalogSinapiQuery.trim() &&
       !results.some(c=>compositionIdentity(c)===compositionIdentity(linked)))
      return [linked,...results].slice(0,50);
    return results;
  },[selectedCatalogService,knownCompositions,catalogSinapiQuery]);
  const selectedCatalogComposition=knownCompositions.find(c=>compositionIdentity(c)===catalogChoice);
  const filteredOnlineResults=onlineResults.filter(row=>
    !knownCompositions.some(c=>c.code===row.code && sameServiceUnit(c.unit,row.unit)));
  const selectedCatalogQuantity=decimalFromInput(catalogQuantity);
  const catalogSimulation=useMemo(()=>{
    if(!current||!selectedCatalogComposition||!Number.isFinite(selectedCatalogQuantity)||selectedCatalogQuantity<=0)
      return {result:null as ReturnType<typeof simulateCrewForQuote>|null,error:''};
    try{
      return {result:simulateCrewForQuote(selectedCatalogComposition,selectedCatalogQuantity,
        current.hoursPerDay,current.efficiency,catalogTargetDays.trim()?Number(catalogTargetDays):undefined),error:''};
    }catch(err){return {result:null,error:err instanceof Error?err.message:'Quantidade ou equipe inválida.'};}
  },[current,selectedCatalogComposition,selectedCatalogQuantity,catalogTargetDays]);
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
    setBusy(true);setError('');setImportInfo('');setSinapiSession({compositions:[],reference:'',uf:'',regime:'',info:''});setSelectedComposition('');
    try{
      const reports=[];
      for(const file of Array.from(files))reports.push({file:file.name,report:await importSinapiFile(file)});
      const result=mergeSinapiReports(reports.map(f=>f.report));
      setSelectedComposition('');
      const names=reports.map(r=>`${r.file}: ${r.report.compositions.length} composição(ões) elegíveis`).join(' | ');
      const info=`${names}. Total: ${result.compositions.length} serviço(s) com HH identificadas. ${result.issues.join(' ')}`;
      setImportInfo(info);
      setSinapiSession({compositions:result.compositions,reference:result.reference||'',uf:'',regime:'',info});
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
    const linkedItem = selectedQuoteItem ? attached?.items.find(x=>x.id===selectedQuoteItem) : undefined;
    if (selectedQuoteItem && (!linkedItem || !sameServiceUnit(linkedItem.unit,composition.unit) || Math.abs(linkedItem.quantity-q)>0.000001)){
      setError('O item associado precisa ter a mesma unidade e quantidade da composição.');return;
    }
    if (linkedItem && current.tasks.some(t=>t.quoteItemId===linkedItem.id)){
      setError('Este item do orçamento já está associado a outra etapa.');return;
    }
    const task:ScheduleTask={id:newId('etapa'),composition,quantity:q,crew:{},quoteItemId:linkedItem?.id,dependencies:current.scheduleMode==='dependencias' && current.tasks.length?[current.tasks[current.tasks.length-1].id]:[]};
    change({tasks:[...current.tasks,task]});setError('');setQuantity('');setSelectedQuoteItem('');
  };
  const appendFromQuote=(quoteItemId:string)=>{
    if(!current || !attached){setError('Vincule um orçamento para importar os serviços.');return;}
    const item=attached.items.find(i=>i.id===quoteItemId);
    if(!item){setError('Item do orçamento não encontrado.');return;}
    if(current.tasks.length>=180){setError('Limite de 180 etapas atingido. Divida a obra por cronograma.');return;}
    if(current.tasks.some(t=>t.quoteItemId===item.id)){setError('Este item já está vinculado ao cronograma.');return;}
    const key=quoteComposition[item.id]||'';
    const stored=savedSinapiForQuote(item,catalog);
    const chosen=knownCompositions.find(c=>`${c.code}|${c.unit}`===key)
      || (stored && `${stored.code}|${stored.unit}`===key?stored:undefined);
    if(!chosen || !sameServiceUnit(chosen.unit,item.unit)){
      setError('Selecione uma composição SINAPI compatível com a unidade do serviço.');return;
    }
    if(!usableSinapiComposition(chosen) && (!regionalUF || !regionalRegime || !validCompetence(reference.trim()))){
      setError('Antes de gerar as etapas informe competência, UF e encargos da planilha SINAPI.');return;
    }
    const input=(quoteTargetDays[item.id]||'').trim();
    const days=input===''?undefined:Number(input);
    let composition:SinapiComposition;
    let simulated:ReturnType<typeof simulateCrewForQuote>;
    try{
      composition=usableSinapiComposition(chosen)?chosen:
        withSinapiProvenance(chosen,{reference:reference.trim(),uf:regionalUF as SinapiUF,regime:regionalRegime as SinapiRegime});
      simulated=simulateCrewForQuote(composition,item.quantity,current.hoursPerDay,current.efficiency,days);
    }catch(err){setError(err instanceof Error?err.message:'Não foi possível dimensionar a equipe.');return;}
    const newTask:ScheduleTask={
      id:newId('etapa'),composition,quantity:item.quantity,crew:simulated.crew,quoteItemId:item.id,
      dependencies:current.scheduleMode==='dependencias' && current.tasks.length?[current.tasks[current.tasks.length-1].id]:[]
    };
    change({tasks:[...current.tasks,newTask]});
    const origin=item.catalogItemId?catalog.find(c=>c.id===item.catalogItemId):undefined;
    if(origin?.type==='servico' && (!origin.sinapiComposition || compositionIdentity(origin.sinapiComposition)!==compositionIdentity(composition)))
      updateCatalogItem({...origin,sinapiComposition:composition});
    setActiveQuoteItem('');setError('');
    setImportInfo(`Etapa ${composition.code} criada e vinculada ao item "${item.name}". Revise a equipe simulada e a disponibilidade real antes de enviar o prazo.`);
  };
  const appendFromCatalog=()=>{
    if(!current||!selectedCatalogComposition){
      setError('Selecione uma composição SINAPI para adicionar ao cronograma.');return;
    }
    if(!Number.isFinite(selectedCatalogQuantity)||selectedCatalogQuantity<=0){
      setError('Informe uma quantidade válida na unidade da composição SINAPI.');return;
    }
    if(current.tasks.length>=180){setError('Limite de 180 serviços por cronograma.');return;}
    let composition:SinapiComposition;
    try {
      if(usableSinapiComposition(selectedCatalogComposition)){
        composition=selectedCatalogComposition;
      }else {
        if(!regionalUF||!regionalRegime||!validCompetence(reference.trim()))
          throw Error('Informe a competência, UF e encargos da planilha antes de usar esta composição.');
        composition=withSinapiProvenance(selectedCatalogComposition,{
          reference:reference.trim(),uf:regionalUF,regime:regionalRegime
        });
      }
      // A equipe de 1 pessoa por função é uma SIMULAÇÃO, revisável na etapa.
      const simulated=simulateCrewForQuote(composition,selectedCatalogQuantity,
        current.hoursPerDay,current.efficiency,catalogTargetDays.trim()?Number(catalogTargetDays):undefined);
      const task:ScheduleTask={
        id:newId('etapa'),composition,quantity:selectedCatalogQuantity,crew:simulated.crew,
        notes:selectedCatalogService
          ?`Serviço do catálogo: ${selectedCatalogService.name} (ref. ${selectedCatalogService.id}).`
          :undefined,
        dependencies:current.scheduleMode==='dependencias' && current.tasks.length
          ?[current.tasks[current.tasks.length-1].id]:[]
      };
      change({tasks:[...current.tasks,task]});
      if(selectedCatalogService && (!selectedCatalogService.sinapiComposition ||
         compositionIdentity(selectedCatalogService.sinapiComposition)!==compositionIdentity(composition)))
        updateCatalogItem({...selectedCatalogService,sinapiComposition:composition});
      setError('');
      setCatalogNotice(selectedCatalogService
        ?`Etapa criada: ${selectedCatalogService.name} → SINAPI ${composition.code}. A composição foi salva no catálogo para reutilização. Revise equipe e quantidade.`
        :`Etapa SINAPI ${composition.code} criada sem vínculo com catálogo ou orçamento. Revise equipe e quantidade.`);
      setCatalogQuantity('');
      setCatalogChoice('');
    }catch(err){setError(err instanceof Error?err.message:'Não foi possível associar o serviço SINAPI.');}
  };
  const appendOnlinePending=()=>{
    if(!current||!selectedOnline){setError('Selecione a composição para registrar a etapa.');return;}
    const q=decimalFromInput(catalogQuantity);
    if(!Number.isFinite(q)||q<=0){setError('Informe uma quantidade válida na unidade SINAPI.');return;}
    if(current.tasks.length>=180){setError('Limite de 180 serviços por cronograma.');return;}
    const quoteItem=catalogQuoteItemId?attached?.items.find(x=>x.id===catalogQuoteItemId):undefined;
    if(quoteItem && current.tasks.some(t=>t.quoteItemId===quoteItem.id)){setError('Este item do orçamento já tem etapa vinculada.');return;}
    const linked=quoteItem && sameServiceUnit(quoteItem.unit,selectedOnline.unit)
      && Math.abs(quoteItem.quantity-q)<0.000001?quoteItem.id:undefined;
    const composition=onlineSinapiPendingComposition(selectedOnline);
    const task:ScheduleTask={
      id:newId('etapa'),composition,quantity:q,crew:{},quoteItemId:linked,
      notes:'Catálogo textual SINPRES (não oficial). SEM coeficientes analíticos: equipe e prazo pendentes de confirmação.',
      dependencies:current.scheduleMode==='dependencias'&&current.tasks.length?[current.tasks[current.tasks.length-1].id]:[]
    };
    change({tasks:[...current.tasks,task]});
    setCatalogNotice(`Composição ${composition.code} registrada como ETAPA PENDENTE, com ${fmt(q)} ${composition.unit}. Código e descrição vieram do catálogo de terceiros. O sistema NÃO calculou horas-homem nem prazo. Importe os coeficientes analíticos para finalizar o planejamento.`);
    setSelectedOnline(null);setCatalogQuoteItemId('');setCatalogQuantity('');setError('');
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
    {current&&<ScheduleOverview schedule={current} quote={attached} company={company} onPreparePDF={()=>setPrintHtml(buildScheduleDocument(current,attached,company))}/>}
    <section id="orcapro-schedule-settings" className={`${tile} space-y-3 p-4`}><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Obra / cronograma</h2><span className="text-[10px] text-slate-500">{schedules.length} registrado(s)</span></div>
      {schedules.length>0?<select className={control} aria-label="Selecionar cronograma" value={current?.id||''} onChange={e=>setSelectedScheduleId(e.target.value)}>{schedules.map(p=><option key={p.id} value={p.id}>{p.title||'Sem título'} · {p.tasks?.length||0} etapa(s) {quotes.find(q=>q.id===p.quoteId)?.number||''}</option>)}</select>:<div className="rounded-xl border border-dashed border-white/15 p-5 text-center text-sm text-slate-400">Sem cronogramas cadastrados. Clique em <strong className="text-slate-200">Novo</strong> para começar.</div>}
      {current?.tasks.length===0 && schedules.some(p=>p.id!==current.id && p.tasks?.length>0) &&
        <button type="button" className="w-full rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2.5 text-left text-xs text-orange-200" onClick={()=>{const other=schedules.find(p=>p.id!==current.id && p.tasks?.length>0);if(other)setSelectedScheduleId(other.id);}}>
          Este cronograma está vazio. Abrir o cronograma com serviços cadastrados →
        </button>}
      {current&&<><label className="block text-[11px] text-slate-400">Identificação da obra<input className={`${control} mt-1`} value={current.title} maxLength={120} onChange={e=>change({title:e.target.value})} placeholder="Nome real da obra"/></label><label className="block text-[11px] text-slate-400">Local / endereço da obra<input className={`${control} mt-1`} value={current.siteAddress||''} maxLength={180} onChange={e=>change({siteAddress:e.target.value})} placeholder="Local real da obra (opcional)"/></label><label className="block text-[11px] text-slate-400">Vincular a um orçamento existente<select className={`${control} mt-1`} value={current.quoteId||''} onChange={e=>change({quoteId:e.target.value||undefined,tasks:current.tasks.map(t=>({...t,quoteItemId:undefined}))})}><option value="">Sem orçamento vinculado</option>{quotes.map(q=><option value={q.id} key={q.id}>{q.number} · {q.clientName} · {q.status}</option>)}</select></label>{attached&&attached.status!=='aprovado'&&<div className="text-[11px] text-amber-300">O orçamento vinculado ainda está como “{attached.status}”. O cronograma é apenas uma previsão, não uma execução contratada.</div>}
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
    {/* Entrada de arquivos sempre montada: a busca mobile pode abrir o seletor mesmo com painel de importação fechado. */}
    <input aria-label="Importar planilha SINAPI" ref={fileRef} type="file" accept=".xlsx,.csv,.tsv" className="hidden" multiple onChange={e=>void loadFiles(e.target.files)}/>
    <section className={`${tile} space-y-3 p-4`}><button type="button" onClick={()=>setShowImport(v=>!v)} className="flex w-full items-center justify-between text-left"><span className="flex items-center gap-2 text-sm font-semibold"><FileSpreadsheet size={17} style={{color:theme.primaryColor}}/> Importar composições SINAPI</span><ChevronDown size={17} className={`text-slate-400 transition ${showImport?'rotate-180':''}`}/></button>
      {showImport&&<><p className="text-[11px] leading-relaxed text-slate-400">Importe o arquivo <strong>SINAPI Referência</strong> (aba <strong>Analítico</strong>) em XLSX. Você também pode selecionar as quatro planilhas juntas: o sistema identificará a fonte de horas-homem e avisará quais arquivos são apenas de preços, percentuais, famílias ou manutenções. Planilhas CSV/TSV normalizadas continuam aceitas.</p>
      <button onClick={()=>fileRef.current?.click()} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-orange-500/30 bg-orange-500/10 px-3 py-3 text-xs font-semibold text-orange-200 hover:bg-orange-500/15 disabled:opacity-50"><Upload size={17}/>{busy?'Lendo planilha...':'Selecionar planilhas do SINAPI'}</button>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><label className="block text-[11px] text-slate-400">Competência (MM/AAAA)<input className={`${control} mt-1`} value={reference} maxLength={7} onChange={e=>setReference(e.target.value)} placeholder="MM/AAAA"/></label><label className="block text-[11px] text-slate-400">UF da referência<select className={`${control} mt-1`} value={regionalUF} onChange={e=>setRegionalUF(e.target.value as SinapiUF | '')}><option value="">Selecione a UF</option>{sinapiUFs.map(uf=><option key={uf} value={uf}>{uf}</option>)}</select></label><label className="block text-[11px] text-slate-400">Encargos SINAPI<select className={`${control} mt-1`} value={regionalRegime} onChange={e=>setRegionalRegime(e.target.value as SinapiRegime | '')}><option value="">Selecione</option><option value="sem_desoneracao">Sem desoneração</option><option value="com_desoneracao">Com desoneração</option></select></label></div><p className="text-[10px] text-amber-300">A planilha analítica informa HH, não preços. UF e encargos identificam a referência declarada e NÃO modificam os coeficientes nem calculam custo automaticamente. Selecione o regime correspondente ao documento.</p>
      <button type="button" onClick={exportModelCSV} className="mr-3 text-[11px] text-orange-300 hover:underline">Baixar modelo de colunas (CSV vazio)</button>
      <a href="https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-orange-300 hover:underline">Abrir fonte oficial SINAPI (CAIXA) <ExternalLink size={12}/></a>
      <p className="text-[11px] text-amber-300/90">Importante: o percentual de mão de obra não representa horas-homem. Prazo por serviço depende das composições analíticas, quantitativo, equipe e jornada reais.</p>
      {importInfo&&<p className="rounded-xl bg-white/5 p-3 text-[11px] leading-relaxed text-slate-300">{importInfo}</p>}
      {imported.length>0&&<><p className="text-[11px] text-slate-400">As composições importadas continuam disponíveis enquanto você navega entre Serviços, Orçamentos e Cronograma nesta sessão. Ao vincular um serviço do catálogo à composição, ela fica salva nesse serviço para o próximo acesso. Para novos serviços, após fechar a página, importe a planilha novamente.</p>
      <label className="relative block"><Search size={15} className="absolute left-3 top-3.5 text-slate-500"/><input className={`${control} pl-9`} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por código ou descrição"/></label>
      <div className="max-h-64 space-y-1 overflow-y-auto">{filtered.map(c=><button type="button" key={`${c.code}|${c.unit}`} onClick={()=>setSelectedComposition(`${c.code}|${c.unit}`)} className={`w-full rounded-xl border p-3 text-left ${selectedComposition===`${c.code}|${c.unit}`?'border-orange-500/60 bg-orange-500/10':'border-white/5 bg-[#0d1119]'}`}><div className="flex items-start justify-between gap-2"><strong className="text-xs text-slate-200">{c.code} · {c.unit}</strong><span className="text-[11px] text-orange-300">{fmt(c.labor.reduce((s,l)=>s+l.hoursPerUnit,0),4)} HH/{c.unit}</span></div><p className="mt-1 text-[11px] leading-snug text-slate-400">{c.description}</p></button>)}</div>
      {selected&&<div className="space-y-3 rounded-xl border border-orange-500/20 bg-orange-500/5 p-3"><div><strong className="text-xs">{selected.description}</strong><p className="mt-1 text-[10px] text-slate-400">{selected.labor.map(l=>`${l.role}: ${fmt(l.hoursPerUnit,5)} h/${selected.unit}`).join(' · ')}</p></div>
        {current?.quoteId&&<label className="block text-[11px] text-slate-400">Usar quantitativo de item do orçamento (opcional)<select className={`${control} mt-1`} value={selectedQuoteItem} onChange={e=>{setSelectedQuoteItem(e.target.value);const item=attached?.items.find(i=>i.id===e.target.value);if(item)setQuantity(String(item.quantity));}}><option value="">Inserir quantitativo manualmente</option>{attached?.items.filter(i=>sameServiceUnit(i.unit,selected.unit)).map(i=><option key={i.id} value={i.id}>{i.name} — {i.quantity} {i.unit}</option>)}</select></label>}
        <label className="block text-[11px] text-slate-400">Quantidade de serviço ({selected.unit})<input type="text" inputMode="decimal" value={quantity} onChange={e=>setQuantity(e.target.value)} className={`${control} mt-1`} placeholder={`Quantidade em ${selected.unit}`}/></label>
        <button disabled={!current} onClick={append} className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-40" style={{background:theme.primaryGradient}}><Plus size={16}/> Adicionar serviço ao cronograma</button>
      </div>}</>}
      </>}
    </section>
    <section id="orcapro-sinapi-lookup" aria-label="Serviços cadastrados e SINAPI" className={`${tile} scroll-mt-4 space-y-4 p-4`}>
      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold text-white"><Wrench size={18} className="text-orange-400"/> Meus serviços → SINAPI</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-300">Pesquise por nome ou código. O OrçaPro consulta composições analíticas salvas e também um catálogo online de terceiros, identificado separadamente. Você escolhe o serviço correto; horas-homem não são inventadas.</p>
        {!current&&<div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
          <p className="text-xs text-amber-100">Você pode pesquisar agora. Para adicionar o resultado à obra, crie primeiro um cronograma.</p>
          <button type="button" onClick={add} className="min-h-11 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white">Criar cronograma</button>
        </div>}
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <label className="block text-xs font-semibold text-slate-200">1. Serviço do catálogo (opcional)
            <input className={`${control} mt-1`} type="search" aria-label="Buscar serviço cadastrado" value={catalogServiceQuery} onChange={e=>setCatalogServiceQuery(e.target.value)} placeholder="Ex.: instalação de tomada, pintura..."/>
          </label>
          <div className="max-h-64 space-y-1.5 overflow-y-auto" role="group" aria-label="Selecionar serviço do catálogo">
            {catalogServices.map(item=><button key={item.id} type="button" aria-pressed={catalogSelectedId===item.id}
              onClick={()=>{setCatalogSelectedId(item.id);setCatalogSinapiQuery('');setCatalogChoice('');setSelectedOnline(null);setCatalogQuoteItemId('');setCatalogQuantity('');setCatalogTargetDays('');setCatalogNotice('');setError('');}}
              className={`w-full rounded-xl border p-3 text-left transition ${catalogSelectedId===item.id?'border-orange-500/60 bg-orange-500/10':'border-white/10 bg-[#0b0e15] hover:border-orange-500/30'}`}>
              <strong className="block text-xs text-slate-100">{item.name}</strong>
              <span className="mt-1 block text-[11px] text-slate-400">Unidade cadastrada: {item.unit} {usableSinapiComposition(item.sinapiComposition)?` · ✓ SINAPI ${item.sinapiComposition.code} salvo`:''}</span>
            </button>)}
            {!catalogServices.length&&<p className="rounded-xl border border-dashed border-white/15 p-4 text-xs text-slate-400">Nenhum serviço cadastrado com esse nome. Cadastre primeiro em <strong>Serviços</strong> no menu do OrçaPro.</p>}
          </div>
        </div>
        <div className="min-w-0 space-y-3">
          <label className="block text-xs font-semibold text-slate-200">2. Buscar composição SINAPI por nome ou código
            <input className={`${control} mt-1 min-h-12`} type="search" autoComplete="off" enterKeyHint="search"
              aria-label="Buscar composição SINAPI para o serviço" value={catalogSinapiQuery}
              onChange={e=>{setCatalogSinapiQuery(e.target.value);setCatalogChoice('');setSelectedOnline(null);}}
              placeholder="Digite tomada, pintura ou o código (ex.: 91996)"/>
          </label>
          <div className="space-y-2" aria-live="polite">
            {knownCompositions.length===0
              ?<div className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100">
                <p><strong>Campo pronto para digitar.</strong> Ainda não existe uma base analítica carregada nesta conta. Para resultados sem planilha, a consulta online de terceiros é exibida logo abaixo.</p>
                <p>Para calcular HH e prazos reais, é preciso ter a composição analítica com coeficientes. A consulta online textual identifica código, descrição e unidade; por si só não permite calcular equipe.</p>
                <button type="button" onClick={()=>{setShowImport(true);fileRef.current?.click();}}
                  className="min-h-11 w-full rounded-xl border border-orange-500/40 bg-orange-500/15 px-3 py-2 text-center font-bold text-orange-100">
                  <Upload size={15} className="mr-1 inline"/> Carregar composição SINAPI do arquivo
                </button>
                <a href="https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx"
                  target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 font-semibold text-orange-200 underline underline-offset-4">
                  Consultar a fonte oficial SINAPI (CAIXA) <ExternalLink size={13}/>
                </a>
              </div>
              :<>
                <p role="status" className="text-[11px] text-slate-300">
                  {catalogSinapiQuery.trim()
                    ?`${catalogCandidates.length} resultado(s) para “${catalogSinapiQuery.trim()}” nas ${knownCompositions.length} composições disponíveis.`
                    :selectedCatalogService
                      ?`${catalogCandidates.length} sugestão(ões) para o serviço. Digite nome ou código para refinar.`
                      :`${knownCompositions.length} composições disponíveis. Digite um nome ou código para pesquisar.`}
                </p>
                <div className="max-h-64 space-y-1.5 overflow-y-auto" role="group" aria-label="Escolher composição SINAPI">
                  {catalogCandidates.map(c=><button type="button" key={compositionIdentity(c)}
                    aria-pressed={catalogChoice===compositionIdentity(c)}
                    onClick={()=>{setCatalogChoice(compositionIdentity(c));setCatalogNotice('');setError('');}}
                    className={`w-full rounded-xl border p-2.5 text-left ${catalogChoice===compositionIdentity(c)?'border-orange-500/70 bg-orange-500/10':'border-white/10 bg-[#0b0e15] hover:border-orange-500/30'}`}>
                    <span className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <strong className="text-orange-200">SINAPI {c.code} · {c.unit}</strong>
                      <span className="text-emerald-300">{fmt(c.labor.reduce((n,l)=>n+l.hoursPerUnit,0),4)} HH/{c.unit}</span>
                    </span>
                    <span className="mt-1 block text-xs text-slate-100">{c.description}</span>
                    <small className="mt-1 block text-[10px] text-slate-400">{c.sourceFile} · {sinapiOriginLabel(c)}</small>
                  </button>)}
                  {!catalogCandidates.length && catalogSinapiQuery.trim() &&
                    <p className="rounded-xl border border-dashed border-white/15 p-3 text-xs text-slate-300">
                      Não encontrei “{catalogSinapiQuery}” nas composições carregadas. Confira o código, use uma palavra principal ou carregue outra planilha SINAPI.
                    </p>}
                </div>
              </>}
          </div>
        </div>
      </div>
      <section role="region" aria-label="Resultados da consulta online SINAPI" className="space-y-2 rounded-xl border border-sky-500/20 bg-[#101c2c] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-sky-200">Consulta online de composições SINAPI</h3>
          <span className="text-[10px] text-slate-400">SINPRES — serviço independente da CAIXA/IBGE</span>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-300">Digite uma descrição ou código no campo acima. A consulta externa mostra código, descrição e unidade; <strong>não apresenta coeficientes HH verificados</strong>. Caso escolha uma dessas composições, a etapa ficará pendente de dimensionamento.</p>
        {onlineStatus==='idle'&&<p className="text-xs text-slate-400">Digite um nome ou código para consultar o catálogo online.</p>}
        {onlineStatus==='loading'&&<p role="status" className="text-xs text-sky-200">Buscando “{onlineTerm}” no catálogo online…</p>}
        {onlineStatus==='error'&&<p role="alert" className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-xs text-amber-200">Consulta online indisponível: {onlineError} Você pode continuar com uma planilha importada.</p>}
        {onlineStatus==='ready'&&<p role="status" className="text-xs text-slate-300">{filteredOnlineResults.length} composição(ões) online para “{onlineTerm}” (além das que já estão carregadas).</p>}
        {onlineStatus==='ready'&&filteredOnlineResults.length===0&&<p className="text-xs text-slate-400">Não há novas composições no catálogo externo para essa busca. Experimente uma palavra ou o código exato.</p>}
        {onlineStatus==='ready'&&filteredOnlineResults.length>0&&<div role="group" aria-label="Selecionar composição SINAPI online" className="max-h-64 space-y-2 overflow-y-auto">
          {filteredOnlineResults.map(result=><button type="button" key={result.code+'|'+result.unit}
            aria-pressed={selectedOnline?.code===result.code}
            onClick={()=>{setSelectedOnline(result);setCatalogChoice('');setCatalogNotice('');setError('');}}
            className={`w-full rounded-lg border p-3 text-left text-xs ${selectedOnline?.code===result.code?'border-sky-400 bg-sky-500/10':'border-white/10 bg-[#0b141e] hover:border-sky-500/40'}`}>
            <strong className="block text-sky-200">SINAPI {result.code} · {result.unit} <span className="font-normal text-amber-200">· HH pendentes</span></strong>
            <span className="mt-1 block leading-relaxed text-slate-200">{result.description}</span>
          </button>)}
        </div>}
        {selectedOnline&&<div className="space-y-3 rounded-xl border border-sky-500/30 p-3">
          <strong className="block text-xs text-white">{selectedOnline.code} — {selectedOnline.description}</strong>
          <p className="text-xs leading-relaxed text-amber-200">Essa consulta não contém o relatório analítico de mão de obra. A etapa será criada SEM horas-homem, sem equipe estimada e sem prazo previsto até receber coeficientes confirmados.</p>
          <label className="block text-xs text-slate-200">Quantidade em {selectedOnline.unit}
            <input className={`${control} mt-1`} type="text" inputMode="decimal" aria-label="Quantidade SINAPI online" value={catalogQuantity} onChange={e=>setCatalogQuantity(e.target.value)} placeholder="Quantidade real"/>
          </label>
          {catalogQuoteItemId&&<p className="text-[11px] text-slate-300">Vínculo ao orçamento: {attached?.items.find(x=>x.id===catalogQuoteItemId)?.name||'Não encontrado'}. Só será registrado se unidade e quantidade forem exatamente iguais.</p>}
          {!current&&<p className="text-xs text-amber-200">Crie um cronograma antes de registrar essa composição na obra.</p>}
          <button type="button" disabled={!current} onClick={appendOnlinePending} className="min-h-11 w-full rounded-xl bg-sky-700 p-3 text-xs font-bold text-white hover:bg-sky-600 disabled:opacity-40">Registrar composição como etapa pendente de HH</button>
        </div>}
      </section>
      {selectedCatalogComposition&&<div className="space-y-3 rounded-xl border border-orange-500/25 bg-orange-500/5 p-3">
        <div>
          <h3 className="text-xs font-bold text-orange-200">3. Confirmar composição e quantidade</h3>
          <p className="mt-1 text-xs text-slate-200">{selectedCatalogService?.name||'Etapa independente'} → <strong>{selectedCatalogComposition.code}</strong> · {selectedCatalogComposition.description}</p>
          {selectedCatalogService && !sameServiceUnit(selectedCatalogService.unit,selectedCatalogComposition.unit)&&<p className="mt-2 rounded-lg border border-amber-500/25 p-2 text-[11px] leading-relaxed text-amber-200">A unidade do catálogo é “{selectedCatalogService.unit}”, mas a composição usa “{selectedCatalogComposition.unit}”. Informe abaixo a quantidade na <strong>unidade SINAPI</strong>. Esta etapa não receberá vínculo financeiro automático com o orçamento, para não confundir valores.</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-200">Quantidade real ({selectedCatalogComposition.unit})
            <input className={`${control} mt-1`} type="text" inputMode="decimal" aria-label="Quantidade na unidade SINAPI" value={catalogQuantity} onChange={e=>setCatalogQuantity(e.target.value)} placeholder="Ex.: 12"/>
          </label>
          <label className="block text-xs text-slate-200">Prazo desejado em dias úteis (opcional)
            <input className={`${control} mt-1`} type="number" min="1" max="10000" step="1" aria-label="Prazo para serviço do catálogo" value={catalogTargetDays} onChange={e=>setCatalogTargetDays(e.target.value)} placeholder="Ex.: 3"/>
          </label>
        </div>
        {!usableSinapiComposition(selectedCatalogComposition)&&<p className="text-[11px] text-amber-200">Para confirmar esta composição recém-importada, preencha competência, UF e encargos na seção de importação acima. O código e as HH vêm da planilha, não do nome do serviço.</p>}
        {catalogSimulation.result&&<p className="rounded-lg bg-[#101e2d] p-2.5 text-xs leading-relaxed text-slate-200">Mão de obra SINAPI: <strong>{fmt(catalogSimulation.result.totalHH,2)} HH</strong> · Prazo simulado: <strong>{catalogSimulation.result.projectedDays} dia(s) útil(eis)</strong> · Equipe inicial: {catalogSimulation.result.labor.map(l=>`${l.workers} × ${l.role}`).join(' + ')}. Confirme a disponibilidade antes de executar.</p>}
        {catalogSimulation.error&&<p role="alert" className="text-xs text-rose-300">{catalogSimulation.error}</p>}
        <button type="button" onClick={appendFromCatalog} disabled={!current||!catalogSimulation.result} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-3 py-3 text-xs font-bold text-white hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"><Plus size={16}/> {selectedCatalogService?'Adicionar etapa e salvar vínculo SINAPI':'Adicionar composição ao cronograma'}</button>
      </div>}
      {catalogNotice&&<p role="status" className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs leading-relaxed text-emerald-200">{catalogNotice}</p>}
      <p className="text-[11px] leading-relaxed text-slate-400">O catálogo guarda sua descrição comercial e preço de venda. A composição SINAPI fornece apenas mão de obra analítica, não materiais nem preço final. O vínculo é uma seleção sua, e o prazo continua sendo uma estimativa.</p>
    </section>
    {attached && current && <section aria-label="Do orçamento para o cronograma" className={`${tile} space-y-3 p-4`}>
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold"><HardHat size={17} style={{color:theme.primaryColor}}/> Do orçamento para o cronograma</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Transforme cada item do orçamento em etapa do cronograma. O OrçaPro sugere referências da planilha SINAPI importada, mas você escolhe a composição correta. A equipe é uma <strong>simulação</strong> que deve ser confirmada no canteiro.</p>
      </div>
      {!knownCompositions.length && <p className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200">Nenhuma composição analítica disponível. Use <strong>Pesquisar este serviço no catálogo SINAPI online</strong> para localizar código, descrição e unidade; a etapa ficará pendente de horas-homem até completar os coeficientes.</p>}
      {attached.items.length===0 && <p className="text-xs text-slate-400">O orçamento vinculado ainda não possui itens de serviço.</p>}
      {attached.items.map(item=>{
        const already=current.tasks.find(t=>t.quoteItemId===item.id);
        const expanded=activeQuoteItem===item.id;
        const query=quoteSearch[item.id]||'';
        const remembered=savedSinapiForQuote(item,catalog);
        const options=remembered && !knownCompositions.some(c=>`${c.code}|${c.unit}`===`${remembered.code}|${remembered.unit}`)
          ? [...knownCompositions,remembered]:knownCompositions;
        const matches=expanded?findCatalogSinapiCandidates(item,options,query,20)
          .filter(c=>sameServiceUnit(c.unit,item.unit)):[];
        const selectedKey=quoteComposition[item.id]||'';
        const chosen=options.find(c=>`${c.code}|${c.unit}`===selectedKey);
        if(chosen && !matches.some(c=>c===chosen))matches.unshift(chosen);
        const targetInput=(quoteTargetDays[item.id]||'').trim();
        const targetDays=targetInput?Number(targetInput):undefined;
        let simulation:ReturnType<typeof simulateCrewForQuote>|null=null;
        let simulationError='';
        if(chosen)try{simulation=simulateCrewForQuote(chosen,item.quantity,current.hoursPerDay,current.efficiency,targetDays);}
          catch(e){simulationError=e instanceof Error?e.message:'Equipe ou prazo inválido.';}
        return <div key={item.id} className="rounded-xl border border-white/10 bg-[#0b0e15] p-3">
          <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={()=>setActiveQuoteItem(expanded?'':item.id)}>
            <span className="min-w-0"><strong className="block truncate text-xs text-white">{item.name}</strong><span className="mt-1 block text-[11px] text-slate-400">{fmt(item.quantity,2)} {item.unit} · {already?'Etapa já vinculada': 'Aguardando composição SINAPI'}</span></span>
            <span className={`shrink-0 text-[11px] ${already?'text-emerald-300':'text-orange-300'}`}>{already?'Vinculado ✓':expanded?'Fechar':'Configurar →'}</span>
          </button>
          {expanded && !already && <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
            <label className="block text-[11px] text-slate-400">Buscar composição por nome ou código SINAPI
              <input className={`${control} mt-1`} value={query} onChange={e=>setQuoteSearch(old=>({...old,[item.id]:e.target.value}))} placeholder="Ex.: alvenaria, drywall, porcelanato, pintura ou código"/>
            </label>
             <button type="button" onClick={()=>{
               setCatalogSinapiQuery(query.trim()||item.name);
               setCatalogQuoteItemId(item.id);
               setCatalogQuantity(String(item.quantity));
               setCatalogChoice('');
               setSelectedOnline(null);
               const origin=item.catalogItemId?catalog.find(c=>c.id===item.catalogItemId):catalog.find(c=>c.name.toLowerCase()===item.name.toLowerCase());
               setCatalogSelectedId(origin?.type==='servico'?origin.id:'');
               document.getElementById('orcapro-sinapi-lookup')?.scrollIntoView({behavior:'smooth',block:'start'});
             }} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 p-3 text-xs font-bold text-sky-200 hover:bg-sky-500/20"><Search size={15}/> Pesquisar este serviço no catálogo SINAPI online</button>
            <label className="block text-[11px] text-slate-400">Confirme a composição adequada — apenas unidade {item.unit}
              <select className={`${control} mt-1`} value={selectedKey} onChange={e=>setQuoteComposition(old=>({...old,[item.id]:e.target.value}))}>
                <option value="">Selecione uma composição SINAPI</option>
                {matches.map(c=><option key={`${c.code}|${c.unit}`} value={`${c.code}|${c.unit}`}>{c.code} · {c.description.slice(0,110)}</option>)}
              </select>
            </label>
             {!matches.length && options.length>0 && <p className="text-[11px] text-amber-200">Nenhuma composição analítica com unidade “{item.unit}” nesta base. Use a busca online ou importe outra referência. Não será atribuído valor financeiro incorreto.</p>}
            {chosen && <div className="space-y-2 rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
              <p className="text-[11px] font-semibold text-orange-200">Coeficiente SINAPI por profissão — {chosen.code}</p>
              <p className="text-[11px] text-slate-300">{chosen.description}</p>
              <p className="text-[10px] text-slate-400">Fonte: {chosen.sourceFile} · {chosen.sourceSheet}</p>
              {chosen.labor.map(l=><p key={`${l.code}:${l.role}`} className="text-[11px] text-slate-300">{l.role}: <strong>{fmt(l.hoursPerUnit,5)} HH/{chosen.unit}</strong> × {fmt(item.quantity,2)} {item.unit} = {fmt(l.hoursPerUnit*item.quantity,2)} HH</p>)}
              <label className="block text-[11px] text-slate-400">Prazo desejado em dias úteis (opcional; deixe vazio para simular 1 pessoa por profissão)
                <input className={`${control} mt-1`} type="number" min="1" max="10000" step="1" value={quoteTargetDays[item.id]||''} onChange={e=>setQuoteTargetDays(old=>({...old,[item.id]:e.target.value}))} placeholder="Ex.: 10"/>
              </label>
              {simulation && <div className="rounded-lg bg-white/5 p-2">
                <p className="text-[11px] font-semibold text-slate-200">Equipe simulada: {simulation.labor.map(l=>`${l.workers} × ${l.role}`).join(' + ')}</p>
                <p className="mt-1 text-[11px] text-slate-300">{fmt(simulation.totalHH,2)} HH · <strong>{simulation.projectedDays} dia(s) úteis de execução</strong> com {fmt(current.hoursPerDay,1)} h/dia e {fmt(current.efficiency*100,0)}% de eficiência.</p>
              </div>}
              {simulationError&&<p role="alert" className="text-xs text-rose-300">{simulationError}</p>}
              <button type="button" disabled={!simulation} onClick={()=>appendFromQuote(item.id)} className="w-full rounded-xl bg-orange-600 px-3 py-3 text-xs font-semibold text-white disabled:opacity-40">Adicionar etapa com equipe simulada</button>
              <p className="text-[10px] text-amber-200">A simulação não comprova disponibilidade de profissionais, materiais ou equipamentos. Em serviços paralelos, ajuste equipes compartilhadas e dependências. Revise prazo e execução antes de enviar ao cliente.</p>
            </div>}
          </div>}
          {expanded && already && <p className="mt-2 text-[11px] text-emerald-300">Este item já está ligado à composição {already.composition.code}. A equipe pode ser ajustada na etapa abaixo.</p>}
        </div>;
      })}
    </section>}
    {printHtml&&<section ref={pdfPreviewRef} role="region" aria-label="Prévia do relatório do cronograma" className={`${tile} scroll-mt-4 space-y-3 p-3 sm:p-4`}><div className="flex flex-wrap items-center justify-between gap-3"><strong className="text-sm text-orange-300">Cronograma pronto para impressão</strong><div className="flex flex-wrap items-center gap-2"><button type="button" className="min-h-11 rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-500" onClick={()=>{const frame=printableFrameRef.current?.contentWindow;frame?.focus();frame?.print();}}>Imprimir / Salvar PDF</button>{printUrl&&<a href={printUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-orange-500/40 px-3 py-2 text-xs font-semibold text-orange-200 hover:bg-orange-500/10">Abrir relatório em nova aba ↗</a>}<button type="button" className="min-h-11 rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-white/10" onClick={()=>setPrintHtml('')}>Fechar prévia</button></div></div><p className="text-xs leading-relaxed text-slate-300">No computador, use “Imprimir / Salvar PDF”. No celular, caso a impressão integrada não abra, toque em “Abrir relatório em nova aba” e use a função Imprimir → Salvar como PDF do navegador. Nenhum arquivo é enviado a servidores externos.</p><iframe ref={printableFrameRef} title="Prévia do cronograma para PDF" srcDoc={printHtml} className="h-[480px] w-full rounded-xl border border-white/10 bg-white sm:h-[580px]" sandbox="allow-modals allow-same-origin"/></section>}
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

      <section className={`${tile} space-y-3 p-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-bold"><BarChart3 size={17} style={{color:theme.primaryColor}}/> Calendário da obra — dia a dia</h2><p className="mt-1 text-[11px] text-slate-400">Cada coluna identifica um <strong>dia útil com a data real</strong>. As faixas laranja mostram em quais dias cada serviço está previsto. Sábados, domingos e datas não úteis informadas são excluídos.</p></div>
          {pageCount>1&&<div className="flex items-center gap-2 text-[11px]"><button type="button" disabled={safeGanttPage===0} onClick={()=>setGanttPage(p=>Math.max(0,p-1))} className="rounded-lg border border-white/15 px-3 py-2 text-slate-100 disabled:opacity-30">← Dias anteriores</button><span className="whitespace-nowrap text-slate-400">Bloco {safeGanttPage+1} de {pageCount}</span><button type="button" disabled={safeGanttPage===pageCount-1} onClick={()=>setGanttPage(p=>Math.min(pageCount-1,p+1))} className="rounded-lg border border-white/15 px-3 py-2 text-slate-100 disabled:opacity-30">Próximos dias →</button></div>}
        </div>
        {report.workingDays!==null && ganttDates.length>0 ? <>
          <div className="rounded-xl border border-white/10 overflow-x-auto" role="region" aria-label="Cronograma Gantt com datas e dias úteis">
            <div className="min-w-[820px]">
              <div className="grid border-b border-white/10 bg-[#1e293b]" style={{gridTemplateColumns:`minmax(210px,240px) repeat(${ganttDates.length},minmax(38px,1fr))`}}>
                <div className="sticky left-0 z-10 border-r border-white/10 bg-[#1e293b] px-3 py-2 text-[10px] font-semibold text-slate-100">Atividade · duração</div>
                {ganttDates.map((day,i)=><div key={day} className="border-r border-white/10 px-0.5 py-1 text-center" title={`Dia útil ${safeGanttPage*15+i+1} · ${day.split('-').reverse().join('/')}`}><div className="text-[9px] font-bold text-orange-300">D{safeGanttPage*15+i+1}</div><div className="text-[10px] font-semibold text-white">{day.slice(8,10)}/{day.slice(5,7)}</div><div className="text-[9px] text-slate-400">{new Date(day+'T12:00:00Z').toLocaleDateString('pt-BR',{weekday:'short',timeZone:'UTC'}).replace('.','')}</div></div>)}
              </div>
              {report.entries.map((e,i)=><div key={e.task.id} className="grid border-b border-white/5 last:border-b-0" style={{gridTemplateColumns:`minmax(210px,240px) repeat(${ganttDates.length},minmax(38px,1fr))`}}>
                <div className="sticky left-0 z-10 border-r border-white/10 bg-[#111b29] px-2 py-2"><div className="truncate text-[10px] font-semibold text-white" title={e.task.composition.description}>{i+1}. {e.task.composition.description}</div><div className="mt-1 text-[9px] text-slate-400">{e.task.composition.code} · {e.days===null?'Prazo pendente':`${e.days} dia(s) útil(eis)`}</div><div className="text-[9px] text-slate-500">{e.start?.split('-').reverse().join('/')||'Início pendente'} → {e.end?.split('-').reverse().join('/')||'Fim pendente'}</div></div>
                {ganttDates.map(day=><div key={day} title={`${e.task.composition.code} · ${day.split('-').reverse().join('/')} · ${e.start&&e.end&&day>=e.start&&day<=e.end?'Execução prevista':'Sem execução prevista'}`} className={`min-h-[49px] border-r border-white/5 ${e.start&&e.end&&day>=e.start&&day<=e.end?'bg-orange-500/80':'bg-white/[0.025]'}`}></div>)}
              </div>)}
            </div>
          </div>
          <p className="text-[10px] text-slate-400">Exibindo de {ganttDates[0].split('-').reverse().join('/')} a {ganttDates[ganttDates.length-1].split('-').reverse().join('/')} · Período total previsto: {report.workingDays} dias úteis, de {timeline[0].split('-').reverse().join('/')} a {report.finishDate?.split('-').reverse().join('/')}. O PDF inclui os quadros de datas e duração de cada etapa.</p>
          <p className="text-[10px] text-amber-300/90">A disponibilidade de profissionais compartilhados entre frentes paralelas não é distribuída automaticamente. Confira as equipes antes de prometer datas ao cliente. Medição realizada não equivale a execução em uma data específica do gráfico.</p>
        </> : <div className="rounded-xl border border-dashed border-white/15 p-4 text-xs text-slate-400">Informe quantidade, coeficientes e equipe por função em todas as etapas para calcular datas e exibir o calendário. Sem esses dados, nenhum prazo é inventado.</div>}
      </section>
      <aside className="flex items-start gap-2 rounded-xl border border-white/10 bg-[#141822] p-3 text-[11px] leading-relaxed text-slate-400"><Info size={16} className="mt-0.5 shrink-0"/><span>O SINAPI fornece coeficientes referenciais de consumo de mão de obra por unidade, <strong className="text-slate-200">não um compromisso automático de duração</strong>. Materiais, equipamentos, estoque e disponibilidade de recursos compartilhados entre serviços não são dimensionados automaticamente. O prazo depende da equipe real, jornada, eficiência, condições da obra, feriados, logística, interferências e sequência executiva. Revise as composições e valide o cronograma tecnicamente antes de enviar ao cliente.</span></aside>
    </>}
    </>}
  </div>;
};
