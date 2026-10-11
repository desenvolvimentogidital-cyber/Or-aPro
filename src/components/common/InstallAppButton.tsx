import React,{useEffect,useState,useSyncExternalStore} from 'react';
import {Download,Smartphone,X,CheckCircle2} from 'lucide-react';

type Choice={outcome:'accepted'|'dismissed';platform?:string};
interface InstallEvent extends Event {
  prompt:()=>Promise<void>;
  userChoice:Promise<Choice>;
}
type InstallState={canPrompt:boolean;installed:boolean};

const listeners=new Set<()=>void>();
const installedNow=()=>typeof window!=='undefined'&&(
  window.matchMedia('(display-mode: standalone)').matches ||
  Boolean((navigator as Navigator&{standalone?:boolean}).standalone)
);
let deferredInstall:InstallEvent|null=null;
let state:InstallState={canPrompt:false,installed:false};
function publish(patch:Partial<InstallState>){
  const next={...state,...patch};
  if(state.canPrompt===next.canPrompt&&state.installed===next.installed)return;
  state=next;
  for(const l of listeners)l();
}
const subscribe=(callback:()=>void)=>{listeners.add(callback);return ()=>{listeners.delete(callback);};};
const snapshot=()=>state;

// Registered at module load so the Chrome prompt survives a login transition.
if(typeof window!=='undefined'){
  state={canPrompt:false,installed:installedNow()};
  window.addEventListener('beforeinstallprompt',event=>{
    if(installedNow())return;
    event.preventDefault();
    deferredInstall=event as InstallEvent;
    publish({canPrompt:true});
  });
  window.addEventListener('appinstalled',()=>{
    deferredInstall=null;
    publish({canPrompt:false,installed:true});
  });
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change',()=>{
    publish({installed:installedNow()});
  });
}
function nativeInstall(){
  const prompt=deferredInstall;
  if(!prompt)return false;
  deferredInstall=null;
  publish({canPrompt:false});
  // Called directly from an actual click (browser user-activation requirement).
  void prompt.prompt().then(()=>prompt.userChoice).catch(()=>{});
  return true;
}

export const InstallAppButton:React.FC=()=>{
  const install=useSyncExternalStore(subscribe,snapshot,()=>({canPrompt:false,installed:false}));
  const [showHelp,setShowHelp]=useState(false);
  const [isIOS,setIsIOS]=useState(false);
  useEffect(()=>{
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1));
  },[]);
  if(install.installed)return null;
  return <>
    <button type="button"
      aria-label="Instalar aplicativo OrçaPro no celular"
      className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-2.5 text-[11px] font-semibold text-orange-200 hover:bg-orange-500/15 focus-visible:outline-2 focus-visible:outline-orange-400 md:hidden"
      onClick={()=>{if(!nativeInstall())setShowHelp(true);}}>
      <Download className="h-4 w-4" aria-hidden="true"/>
      <span>Instalar app</span>
    </button>
    {showHelp&&<div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4"
      role="dialog" aria-modal="true" aria-labelledby="orcapro-install-title">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-white/15 bg-[#141b27] p-5 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-orange-300"/>
            <h2 id="orcapro-install-title" className="text-lg font-bold">Instalar OrçaPro</h2>
          </div>
          <button aria-label="Fechar instruções" type="button" onClick={()=>setShowHelp(false)}
            className="min-h-10 min-w-10 rounded-lg text-slate-300"><X className="mx-auto"/></button>
        </div>
        <p className="text-sm text-slate-200">
          {isIOS?'No iPhone, use o menu de compartilhamento do navegador:':
            'No Android, use o menu do navegador para instalar o aplicativo:'}
        </p>
        <ol className="list-inside list-decimal space-y-2 text-sm text-slate-300">
          {isIOS?<>
            <li>Toque em <strong>Compartilhar</strong> (ícone da seta para cima).</li>
            <li>Escolha <strong>Adicionar à Tela de Início</strong>.</li>
            <li>Confirme em <strong>Adicionar</strong>.</li>
          </>:<>
            <li>Abra o menu <strong>⋮</strong> do Chrome ou navegador compatível.</li>
            <li>Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
            <li>Confirme a instalação do OrçaPro.</li>
          </>}
        </ol>
        <p className="text-xs text-amber-200">O OrçaPro será aberto como aplicativo, sem Play Store ou APK. Para carregar e salvar seus dados, é necessária conexão à internet.</p>
        <button type="button" onClick={()=>setShowHelp(false)}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 text-sm font-bold text-white">
          <CheckCircle2 className="h-4 w-4"/> Entendi
        </button>
      </div>
    </div>}
  </>;
};
