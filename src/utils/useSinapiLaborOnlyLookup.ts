import {useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import type {SinapiComposition} from '../types/schedule';
import {findSinapiLaborOnlyCost,type SinapiLaborEstimate} from '../services/sinapiLaborOnly';
import type {SinapiUF,SinapiRegime} from './sinapiRegional';
export interface SinapiLaborLookup{
  value:SinapiLaborEstimate|null;
  status:'idle'|'loading'|'ready'|'missing'|'error';
  error:string;
}
export function useSinapiLaborOnlyLookup(
  composition:SinapiComposition|null,uf:SinapiUF|'',regime:SinapiRegime|'',
  enabled:boolean,revision=0
):SinapiLaborLookup{
  const {session}=useAuth();
  const [value,setValue]=useState<SinapiLaborLookup>({value:null,status:'idle',error:''});
  useEffect(()=>{
    if(!enabled||!composition||!uf||!regime||!session){
      setValue({value:null,status:'idle',error:''});return;
    }
    const ac=new AbortController();
    setValue({value:null,status:'loading',error:''});
    void findSinapiLaborOnlyCost(session,composition,{
      uf,regime,reference:composition.reference||''
    },ac.signal).then(result=>{
      if(!ac.signal.aborted)setValue({
        value:result,status:result.unitCost!==null?'ready':'missing',error:''
      });
    }).catch(err=>{
      if(!ac.signal.aborted)setValue({value:null,status:'error',
        error:err instanceof Error?err.message:'Falha ao calcular mão de obra.'});
    });
    return ()=>ac.abort();
  },[enabled,composition?.code,composition?.reference,composition?.unit,
    session?.user.id,session?.access_token,uf,regime,revision]);
  return value;
}
