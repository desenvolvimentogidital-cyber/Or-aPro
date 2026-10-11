import {useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import type {SinapiComposition} from '../types/schedule';
import {findOfficialSinapiCost,type SavedSinapiUnitCost} from '../services/sinapiUnitCosts';
import type {SinapiRegime,SinapiUF} from './sinapiRegional';

export type SinapiCostLookup={
  cost:SavedSinapiUnitCost|null;
  status:'idle'|'loading'|'found'|'missing'|'error';
  error:string;
};
export function useSinapiCostLookup(
  composition:SinapiComposition|null,uf:SinapiUF|'',
  regime:SinapiRegime|'',revision=0
):SinapiCostLookup{
  const {session}=useAuth();
  const [result,setResult]=useState<SinapiCostLookup>({cost:null,status:'idle',error:''});
  useEffect(()=>{
    if(!composition||!uf||!regime||!session){
      setResult({cost:null,status:'idle',error:''});return;
    }
    const controller=new AbortController();
    setResult({cost:null,status:'loading',error:''});
    void findOfficialSinapiCost(session,composition,{
      uf,regime,reference:composition.reference||''
    },controller.signal).then(cost=>{
      if(!controller.signal.aborted)
        setResult({cost,status:cost?'found':'missing',error:''});
    }).catch(error=>{
      if(!controller.signal.aborted)
        setResult({cost:null,status:'error',error:error instanceof Error?error.message:'Falha ao consultar preços SINAPI.'});
    });
    return()=>controller.abort();
  },[session?.user.id,session?.access_token,composition?.code,
    composition?.reference,composition?.unit,uf,regime,revision]);
  return result;
}
