import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';

export function BackupPanel() {
  const { exportBackup, importBackup, importLegacyData, syncStatus, syncError, retrySync } = useApp();
  const ref = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const readFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      if (file.size > 12_000_000) throw new Error('Arquivo muito grande. Limite: 12 MB.');
      const data = JSON.parse(await file.text());
      if (!window.confirm('Substituir TODOS os registros atuais pelos dados do backup? Exporte o estado atual antes de continuar.')) return;
      importBackup(data);
      setMessage('Backup carregado. Confira o indicador de salvamento antes de sair.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível importar o arquivo.'); }
    finally { event.currentTarget.value = ''; }
  };
  return <>
    <button onClick={() => setOpen(true)} className="underline text-slate-300 text-xs hover:text-white">Backup</button>
    {open && <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
      <section role="dialog" aria-modal="true" aria-label="Backup de dados" className="w-full max-w-md rounded-2xl bg-[#161b26] text-white p-5 border border-white/15 space-y-4">
        <div className="flex justify-between items-center"><h2 className="font-bold text-lg">Backup e recuperação</h2><button onClick={() => setOpen(false)} aria-label="Fechar">✕</button></div>
        <p className="text-xs text-slate-400">{'Conta autenticada: cópias JSON são uma proteção adicional. Mantenha os arquivos em local seguro.'}</p>
        <button className="block w-full py-3 rounded-xl bg-sky-700 font-bold text-sm" onClick={exportBackup}>Exportar dados em JSON</button>
        <input className="hidden" ref={ref} type="file" accept="application/json,.json" onChange={readFile} />
        <button className="block w-full py-3 rounded-xl bg-white/10 font-bold text-sm" onClick={() => ref.current?.click()}>Restaurar backup JSON</button>
        {<button className="block w-full py-3 rounded-xl bg-white/10 font-bold text-sm" onClick={() => {
          if (!window.confirm('Atenção: dados locais antigos podem conter REGISTROS DE EXEMPLO da versão anterior. Você confirmou que são dados reais e deseja SUBSTITUIR todos os registros desta conta?')) return;
          try { importLegacyData(); setMessage('Dados locais importados. Aguarde o salvamento em nuvem.'); }
          catch (error) { setMessage(error instanceof Error ? error.message : 'Importação não concluída.'); }
        }}>Migrar dados antigos deste navegador</button>}
        <p className={`text-xs ${syncStatus === 'error' ? 'text-rose-400' : 'text-slate-400'}`} role="status">Sincronização: {syncStatus === 'saved' ? 'salvo' : syncStatus === 'saving' ? 'salvando' : 'falhou'} {syncError}</p>
        {syncStatus === 'error' && <button className="w-full p-3 rounded-xl bg-amber-700 font-bold text-xs" onClick={() => { void retrySync(); }}>Tentar salvar novamente</button>}
        {message && <p role="status" className="text-sm bg-white/10 p-3 rounded-lg">{message}</p>}
      </section>
    </div>}
  </>;
}
