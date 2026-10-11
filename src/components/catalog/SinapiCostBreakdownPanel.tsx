import React,{useEffect,useRef,useState} from 'react';
import {Layers3,AlertTriangle,Loader2} from 'lucide-react';
import {useAuth} from '../../context/AuthContext';
import type {SinapiComposition} from '../../types/schedule';
import type {SinapiUF,SinapiRegime} from '../../utils/sinapiRegional';
import {loadSinapiCostBreakdown} from '../../services/sinapiAnalyticalBreakdown';
import type {SinapiCostBreakdown} from '../../utils/sinapiCostBreakdown';
import {formatCurrency} from '../../utils/formatters';

export const SinapiCostBreakdownPanel:React.FC<{
 composition:SinapiComposition;uf:SinapiUF|'';regime:SinapiRegime|''
}>=({composition,uf,regime})=>{
 const {session}=useAuth();
 const [state,setState]=useState<'idle'|'loading'|'ready'|'error'>('idle');
 const [data,setData]=useState<SinapiCostBreakdown|null>(null);
 const [error,setError]=useState('');
 const active=useRef<AbortController|null>(null);
 useEffect(()=>()=>{active.current?.abort();},[]);
 const fetchDetails=()=>{
   if(!session||!uf||!regime)return;
   active.current?.abort();
   const controller=new AbortController();active.current=controller;
   setState('loading');setData(null);setError('');
   void loadSinapiCostBreakdown(session,composition,
     {uf,regime,reference:composition.reference||''},controller.signal)
     .then(value=>{if(!controller.signal.aborted){setData(value);setState('ready');}})
     .catch(e=>{if(!controller.signal.aborted){
       setError(e instanceof Error?e.message:'Falha ao consultar a composição.');
       setState('error');
     }});
 };
 const totalKnown=data?.knownTotal??0;
 return <section className="space-y-2 rounded-xl border border-sky-500/25 bg-sky-500/5 p-3"
   aria-label={'Detalhamento dos custos SINAPI '+composition.code}>
   <p className="flex items-center gap-2 text-xs font-semibold text-slate-100">
     <Layers3 size={15} className="text-sky-300"/> Composição de custos (insumos oficiais)
   </p>
   <p className="text-[11px] text-slate-300">
     Verifique separadamente mão de obra, materiais, equipamentos e demais custos,
     incluindo composições auxiliares. Usa somente a mesma UF, competência e regime.
   </p>
   <button type="button" disabled={!uf||!regime||!session||state==='loading'}
     onClick={fetchDetails} aria-label="Consultar detalhamento oficial dos insumos SINAPI"
     className="min-h-11 w-full rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 text-xs font-semibold text-sky-100 disabled:opacity-50">
     {state==='loading'?'Consultando insumos…':state==='ready'?'Atualizar detalhamento':'Consultar detalhamento oficial'}
   </button>
   {state==='loading'&&<p role="status" className="flex items-center gap-2 text-[11px] text-sky-200">
     <Loader2 size={13} className="animate-spin"/> Calculando componentes e validando os preços…
   </p>}
   {state==='error'&&<p role="alert" className="text-[11px] text-amber-200">{error}</p>}
   {data&&state==='ready'&&<>
     <div className="grid grid-cols-2 gap-2 text-[11px]">
       {([['Mão de obra',data.labor],['Materiais',data.material],
          ['Equipamentos',data.equipment],['Encargos, serviços e outros',data.other]] as const)
        .map(([label,amount])=><div className="rounded-lg bg-black/20 p-2" key={label}>
          <span className="block text-slate-400">{label}</span>
          <strong className="text-xs text-white">{formatCurrency(amount)}</strong>
        </div>)}
     </div>
     <div className="space-y-1 rounded-lg border border-white/10 p-2 text-[11px] text-slate-200">
       <div className="flex justify-between gap-2"><span>Soma dos insumos com preço</span><strong>{formatCurrency(totalKnown)}</strong></div>
       <div className="flex justify-between gap-2"><span>Custo integral SINAPI para {uf}</span>
         <strong>{data.officialTotal===null?'Não publicado':formatCurrency(data.officialTotal)}</strong></div>
       {data.difference!==null&&
         <div className="flex justify-between gap-2"><span>Diferença na conciliação</span>
           <strong>{formatCurrency(data.difference)}</strong></div>}
     </div>
     {data.status==='reconciled'?
       <p role="status" className="text-[11px] text-emerald-200">
         Conferido: todos os insumos têm preço e a soma concilia com a referência
         dentro da tolerância de R$ 0,02 por unidade.
       </p>:
       <p role="alert" className="flex items-start gap-2 text-[11px] text-amber-200">
         <AlertTriangle size={15} className="shrink-0"/>
         {data.status==='partial'
           ?'Detalhamento parcial: ainda faltam preços ou componentes oficiais. Valores mostrados não representam o custo total.'
           :'Componentes não conciliados com o custo integral: confira a diferença antes de usar esta divisão.'}
       </p>}
     {data.issues.slice(0,4).map((msg,i)=><p key={i} className="text-[10px] text-amber-200">{msg}</p>)}
     <p className="text-[10px] text-slate-400">Custos de referência da planilha, não preço de venda.
       Não modifica os valores editados nem o orçamento salvo.</p>
   </>}
 </section>;
};
