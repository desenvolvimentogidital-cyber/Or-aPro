import {useEffect} from 'react';

/** Apenas campos quantitativos, monetários e percentuais. Exclui datas, telefone e senhas. */
export function isEditableNumericInput(input:HTMLInputElement):boolean {
  if(input.disabled||input.readOnly||input.dataset.selectOnFocus==='off')return false;
  const mode=input.getAttribute('inputmode');
  return input.type==='number'||mode==='decimal'||mode==='numeric';
}

/**
 * Seleciona o valor já preenchido com um toque (Android e desktop).
 * Não modifica o estado, valor persistido ou dispara salvamento até o usuário digitar.
 * O agendamento após focusin evita que o Chrome restabeleça o cursor no toque.
 */
export function useSelectNumericOnFocus():void {
  useEffect(()=>{
    let frame=0;
    const onFocus=(event:FocusEvent)=>{
      const input=event.target;
      if(!(input instanceof HTMLInputElement)||!isEditableNumericInput(input))return;
      window.cancelAnimationFrame(frame);
      frame=window.requestAnimationFrame(()=>{
        if(document.activeElement!==input)return;
        try{input.select();}catch{/* Alguns navegadores não selecionam campos type=number. */}
      });
    };
    document.addEventListener('focusin',onFocus);
    return ()=>{document.removeEventListener('focusin',onFocus);window.cancelAnimationFrame(frame);};
  },[]);
}

/** Número em rascunho: não substitua o texto do usuário por zero ao apagar tudo. */
export function parseNumericDraft(raw:string):number|null {
  const normalized=raw.trim().replace(/\s/g,'').replace(',','.');
  if(!normalized||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized))return null;
  const number=Number(normalized);
  return Number.isFinite(number)?number:null;
}
