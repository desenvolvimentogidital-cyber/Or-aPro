import React, { useEffect, useState } from 'react';
import { decideProposal, publicProposal, type PublicProposal } from '../../services/cloud';
import { formatCurrency, formatDate } from '../../utils/formatters';
export function PublicQuoteView({ token }: { token: string }) {
  const [proposal, setProposal] = useState<PublicProposal | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { void publicProposal(token).then(result => {
    if (result) { setProposal(result.payload); setStatus(result.status); }
    else setError('Link inexistente ou expirado.');
  }).catch(() => setError('Não foi possível carregar o orçamento.')); }, [token]);
  const decide = async (decision: 'aprovado' | 'recusado') => {
    setBusy(true); setError('');
    try {
      if (!await decideProposal(token, decision)) throw new Error('Essa proposta já foi respondida ou expirou.');
      setStatus(decision);
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível enviar a resposta.'); }
    finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-[#0c0e14] text-slate-100 p-4 sm:p-10">
    <article className="max-w-xl mx-auto bg-[#161b26] rounded-3xl border border-white/10 p-6 space-y-5">
      <h1 className="text-2xl font-black text-orange-400">OrçaPro · Proposta</h1>
      {error && <div role="alert" className="bg-red-900/40 p-4 rounded-xl">{error}</div>}
      {!proposal && !error && <p>Carregando proposta…</p>}
      {proposal && <>
        <h2 className="text-xl font-bold">{proposal.company.tradeName || proposal.company.name}</h2>
        <div className="text-sm text-slate-300">Orçamento {proposal.quote.number} para {proposal.quote.clientName}</div>
        <p className="text-xs text-slate-400">Emitido em {formatDate(proposal.quote.date)} · Válido até {formatDate(proposal.quote.validUntil)}</p>
        <div className="space-y-3 border-t border-white/10 pt-4">
          {proposal.quote.items.map((item, index) => <div key={index} className="flex gap-2 justify-between text-sm"><span>{item.name}{item.quantity === undefined ? '' : ` — ${item.quantity} ${item.unit}`}</span><span>{item.totalPrice === undefined ? '' : formatCurrency(item.totalPrice)}</span></div>)}
        </div>
        {proposal.quote.total !== undefined && <div className="border-t border-white/10 pt-4 flex justify-between font-bold"><span>Total</span><span>{formatCurrency(proposal.quote.total)}</span></div>}
        {proposal.quote.paymentTerms && <p className="text-sm"><b>Condições:</b> {proposal.quote.paymentTerms}</p>}
        {proposal.quote.notes && <p className="text-sm"><b>Observações:</b> {proposal.quote.notes}</p>}
        <p className="text-xs text-slate-400">Resposta mediante posse deste link; não constitui assinatura digital verificada.</p>
        {status === 'pendente' ? <div className="grid grid-cols-2 gap-3">
          <button disabled={busy} onClick={() => decide('aprovado')} className="rounded-xl bg-emerald-600 p-3 font-bold disabled:opacity-50">Aprovar</button>
          <button disabled={busy} onClick={() => decide('recusado')} className="rounded-xl bg-rose-800 p-3 font-bold disabled:opacity-50">Recusar</button>
        </div> : <p role="status" className="rounded-xl bg-white/10 p-4">Situação: {status}.</p>}
      </>}
    </article>
  </main>;
}
