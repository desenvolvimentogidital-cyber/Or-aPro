import React,{useEffect,useRef,useState} from 'react';
import {useAuth} from '../../context/AuthContext';
import {browseSinapiLibrary,type SinapiBrowseEntry} from '../../services/sinapiLibrary';
import {sinapiCategoryOptions,type SinapiCategoryFilter} from '../../utils/sinapiCategories';
import type {SinapiComposition} from '../../types/schedule';

interface Props {
  onSelect:(composition:SinapiComposition)=>void;
  title?:string;
}

/** A lista permanece no Supabase; carrega 30 composições por vez no Android.
 * Todos os 9.136 registros podem ser consultados; não persistir a biblioteca
 * inteira no orçamento nem transformar HH em valor monetário.
 */
export const SinapiReferencePicker:React.FC<Props>=({onSelect,title='Buscar todos os serviços SINAPI'})=>{
  const {session}=useAuth();
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState<SinapiCategoryFilter>('todas');
  const [entries,setEntries]=useState<SinapiBrowseEntry[]>([]);
  const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(false);
  const [moreLoading,setMoreLoading]=useState(false);
  const [error,setError]=useState('');
  const abort=useRef<AbortController|null>(null);
  const epoch=useRef(0);
  useEffect(()=>{
    const generation=++epoch.current;
    abort.current?.abort();
    setEntries([]);setTotal(0);setError('');
    if(!session){setLoading(false);setError('Faça login para consultar o SINAPI.');return;}
    setLoading(true);
    const controller=new AbortController();
    abort.current=controller;
    const timer=window.setTimeout(()=>{
      browseSinapiLibrary(session,query,category,0,30,controller.signal)
        .then(page=>{
          if(controller.signal.aborted||generation!==epoch.current)return;
          setEntries(page.entries);setTotal(page.total);setLoading(false);
        })
        .catch(err=>{
          if(controller.signal.aborted||generation!==epoch.current)return;
          setError(err instanceof Error?err.message:'A biblioteca SINAPI não respondeu.');
          setLoading(false);
        });
    },query.trim()?330:60);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[session?.user.id,session?.access_token,query,category]);

  const loadMore=async()=>{
    if(!session||loading||moreLoading||entries.length>=total)return;
    const generation=epoch.current;
    const controller=new AbortController();
    abort.current?.abort();abort.current=controller;
    setMoreLoading(true);setError('');
    try{
      const page=await browseSinapiLibrary(session,query,category,entries.length,30,controller.signal);
      if(generation!==epoch.current||controller.signal.aborted)return;
      setEntries(old=>[...old,...page.entries]);setTotal(page.total);
    }catch(err){
      if(generation!==epoch.current||controller.signal.aborted)return;
      setError(err instanceof Error?err.message:'Não foi possível carregar mais serviços.');
    }finally{
      if(generation===epoch.current)setMoreLoading(false);
    }
  };

  return <section role="region" aria-label="Biblioteca SINAPI de serviços"
    className="space-y-3 rounded-2xl border border-sky-500/25 bg-[#101a28] p-3">
    <div>
      <h3 className="text-sm font-bold text-sky-100">{title}</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
        Biblioteca SINAPI 09/2026 salva no Supabase: todos os serviços estão acessíveis por código, nome e categoria.
        As composições incluem horas-homem, <strong>não preço de venda</strong>.
      </p>
    </div>
    <label className="block text-xs text-slate-200">
      Pesquisar código ou descrição do serviço
      <input type="search" value={query} onChange={e=>setQuery(e.target.value)}
        aria-label="Pesquisar serviços da tabela SINAPI"
        placeholder="Ex.: chuveiro, tomada, pintura, 91991, padrão monofásico"
        className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-[#0b101a] px-3 text-xs text-white"/>
    </label>
    <label className="block text-xs text-slate-200">
      Categoria / especialidade
      <select value={category} onChange={e=>setCategory(e.target.value as SinapiCategoryFilter)}
        aria-label="Categoria dos serviços SINAPI"
        className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-[#0b101a] px-3 text-xs text-white">
        {sinapiCategoryOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
    <p role="status" className="text-xs text-sky-200">
      {loading?'Consultando biblioteca SINAPI…':`${total.toLocaleString('pt-BR')} serviço(s) encontrado(s) · mostrando ${entries.length}`}
    </p>
    {error&&<p role="alert" className="rounded-lg bg-rose-500/10 p-2 text-xs text-rose-200">{error}</p>}
    {!loading&&!error&&total===0&&<p className="text-xs text-slate-300">Nenhum serviço encontrado. Experimente outra palavra ou código.</p>}
    <div role="group" aria-label="Resultados dos serviços SINAPI" className="max-h-72 space-y-2 overflow-y-auto">
      {entries.map(({composition:c,category:cat})=><button
        type="button" key={`${c.reference}:${c.code}`} onClick={()=>onSelect(c)}
        aria-label={`Selecionar SINAPI ${c.code}: ${c.description}`}
        className="w-full rounded-lg border border-white/10 bg-[#0c121e] p-3 text-left hover:border-sky-400/60 focus-visible:outline-2 focus-visible:outline-sky-400">
        <span className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <strong className="text-sky-200">SINAPI {c.code} · {c.unit}</strong>
          <span className="text-emerald-300">{c.labor.reduce((n,l)=>n+l.hoursPerUnit,0).toLocaleString('pt-BR',{maximumFractionDigits:4})} HH/{c.unit}</span>
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-white">{c.description}</span>
        <span className="mt-1 block text-[10px] text-slate-400">Especialidade: {sinapiCategoryOptions.find(x=>x.value===cat)?.label||cat} · {c.reference}</span>
      </button>)}
    </div>
    {entries.length<total&&<button type="button" disabled={loading||moreLoading} onClick={()=>void loadMore()}
      className="min-h-11 w-full rounded-lg border border-sky-500/30 px-3 text-xs font-bold text-sky-200 disabled:opacity-40">
      {moreLoading?'Carregando…':'Mostrar mais serviços SINAPI'}
    </button>}
  </section>;
};
