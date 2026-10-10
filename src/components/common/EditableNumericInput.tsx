import React,{useState} from 'react';
import {parseNumericDraft} from '../../utils/numericEditing';

type Props=Omit<React.InputHTMLAttributes<HTMLInputElement>,
  'value'|'defaultValue'|'type'|'inputMode'|'onChange'|'onBlur'|'onFocus'> & {
  value:number;
  onCommit:(value:number)=>void;
  integer?:boolean;
  emptyAsBlank?:boolean;
  min?:number;
  max?:number;
};

/**
 * Guarda o texto de edição até sair do campo: o usuário consegue selecionar,
 * apagar completamente e digitar números como 0,5, 12,75 ou 1000.
 * Nunca persiste 0/NaN temporário só porque a pessoa apagou para substituir.
 */
export const EditableNumericInput:React.FC<Props>=({
  value,onCommit,integer=false,emptyAsBlank=false,min,max,required,...rest
})=>{
  const [draft,setDraft]=useState<string|null>(null);
  const [invalid,setInvalid]=useState(false);
  const displayed=draft??(emptyAsBlank&&value===0?'':Number.isFinite(value)?String(value):'');
  const finish=()=>{
    if(draft===null)return;
    const result=parseNumericDraft(draft);
    const allowed=result!==null&&(!integer||Number.isInteger(result))
      &&(min===undefined||result>=min)&&(max===undefined||result<=max);
    if(allowed){onCommit(result);setInvalid(false);}
    else if(!draft.trim()&&!required){onCommit(0);setInvalid(false);}
    else setInvalid(true);
    setDraft(null);
  };
  return <input {...rest}
    type="text" inputMode={integer?'numeric':'decimal'}
    value={displayed}
    aria-invalid={invalid||undefined}
    onFocus={e=>{setInvalid(false);setDraft(displayed);e.currentTarget.select();}}
    onChange={e=>setDraft(e.target.value)}
    onBlur={finish}
  />;
};
