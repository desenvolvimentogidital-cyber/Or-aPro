import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import {
  ArrowLeft,
  Share2,
  Printer,
  Send,
  CheckCircle2,
  Edit3,
  Copy,
  Download,
  X,
  FileCheck,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Quote } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { shareProposal } from '../../services/cloud';
import { buildQuoteDocument } from '../../utils/quoteDocument';

interface QuotePreviewModalProps {
  quote: Quote;
  onClose: () => void;
}

export const QuotePreviewModal: React.FC<QuotePreviewModalProps> = ({ quote, onClose }) => {
  const { company, clients, changeQuoteStatus, setActiveView, setEditingQuote } = useApp();
  const { theme } = useTheme();
  const { session } = useAuth();
  const { syncStatus } = useApp();
  const [shareLink, setShareLink] = useState('');
  const [shareError, setShareError] = useState('');
  const [sharing, setSharing] = useState(false);
  const printFrameRef = useRef<HTMLIFrameElement>(null);
  const [printError, setPrintError] = useState('');
  const client = clients.find(c => c.id === quote.clientId);
  const documentHtml = useMemo(() => buildQuoteDocument({ quote, company, client }), [quote, company, client]);

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handlePrint = () => {
    if (!company.tradeName?.trim() && !company.name?.trim()) {
      setPrintError('Cadastre o nome da sua empresa em Dados da Empresa antes de emitir o PDF.');
      return;
    }
    const printableWindow = printFrameRef.current?.contentWindow;
    if (!printableWindow) {
      setPrintError('A pré-visualização ainda está carregando. Aguarde e tente novamente.');
      return;
    }
    setPrintError('');
    printableWindow.focus();
    printableWindow.print(); // Select 'Salvar como PDF' in the native print dialog.
  };

  const handleMarkApproved = () => {
    if (!window.confirm('Confirmar aprovação MANUAL? Isso não comprova o aceite do cliente.')) return;
    changeQuoteStatus(quote.id, 'aprovado');
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // ignore
    }
  };

  const createShareLink = async () => {
    if (!session || syncStatus !== 'saved') return;
    setSharing(true); setShareError('');
    try {
      const safeItems = quote.items.filter(item => (item.type === 'material' ? quote.visibility?.showMaterials : quote.visibility?.showServices)).map(item => ({
        name: item.name, ...(quote.visibility?.showQuantities ? { quantity: item.quantity } : {}), unit: item.unit,
        ...(quote.visibility?.showUnitPrices ? { totalPrice: item.totalPrice } : {})
      }));
      const url = await shareProposal(session, { quote: {
        id: quote.id, number: quote.number, date: quote.date, validUntil: quote.validUntil,
        clientName: quote.clientName, items: safeItems, ...(quote.visibility?.showTotal ? { total: quote.total } : {}),
        notes: quote.visibility?.showTerms ? quote.notes : undefined,
        paymentTerms: quote.visibility?.showTerms ? quote.paymentTerms : undefined
      }, company: { name: company.name, tradeName: company.tradeName, phone: company.phone, email: company.email, pixKey: quote.visibility?.showPix ? company.pixKey : '' }, status: 'pendente' });
      setShareLink(url);
    } catch (e) { setShareError(e instanceof Error ? e.message : 'Falha ao compartilhar'); }
    finally { setSharing(false); }
  };

  // WhatsApp share message
  const waMessage = encodeURIComponent(
    `Olá ${quote.clientName}! Segue a proposta comercial ${quote.number} da ${company.tradeName}:\n\n` +
    `• Itens: ${quote.items.length} itens inclusos\n` +
    `• Valor Total: ${formatCurrency(quote.total)}\n` +
    `• Validade: até ${formatDate(quote.validUntil)}\n\n` +
    `Podemos confirmar para dar início ao serviço? Fico à total disposição!\n` +
    `${company.tradeName} - ${company.whatsapp}`
  );

  const cleanPhone = quote.clientPhone.replace(/\D/g, '');
  const waUrl = `https://wa.me/${cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`}?text=${waMessage}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg min-h-screen sm:min-h-0 sm:my-6 bg-[#0c0e14] sm:rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
        
        {/* Top bar (Referência visual #8) */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#141822] sticky top-0 z-10">
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 text-slate-300 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h2 className="text-sm font-bold text-white">Pré-visualizar</h2>
            <span className="text-[10px] text-slate-400 font-mono">{quote.number}</span>
          </div>
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="p-1.5 rounded-xl bg-white/5 text-slate-300 hover:text-white hover:bg-white/10"
            title="Compartilhar"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {/* Preview and print use precisely the same document (no mock values). */}
        <div className="px-4 py-3 bg-[#10141d] border-b border-white/5">
          <p className="text-xs font-bold text-orange-300">PDF — modelo preto e laranja</p>
          <p className="text-[11px] text-slate-400 mt-1">Layout baseado na referência enviada. Os dados e imagens vêm dos seus cadastros; tabelas longas continuam nas páginas seguintes.</p>
        </div>
        <div className="bg-[#080f1a] p-2 sm:p-3">
          <iframe
            ref={printFrameRef}
            title={`Pré-visualização do documento ${quote.number}`}
            srcDoc={documentHtml}
            className="w-full h-[67vh] min-h-[560px] rounded-xl border border-orange-500/20 bg-[#06101b]"
          />
          {printError && <p role="alert" className="mt-2 text-xs text-red-400">{printError}</p>}
          <button
            onClick={handlePrint}
            className="w-full mt-3 flex items-center justify-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-500 py-3 text-white font-bold text-xs"
          >
            <Printer className="w-4 h-4" /> Salvar como PDF / Imprimir
          </button>
          <p className="text-[11px] text-slate-400 text-center mt-2">No diálogo de impressão, selecione <b>Salvar como PDF</b>. O arquivo utiliza páginas A4 e mantém o fundo colorido.</p>
        </div>

        {/* Bottom Actions Bar (Referência visual #8: "Editar" + "Enviar") */}
        <div className="p-4 border-t border-white/10 bg-[#141822] grid grid-cols-2 gap-3 sticky bottom-0 z-10">
          <button
            onClick={() => { setEditingQuote(quote); onClose(); setActiveView('novo-orcamento'); }}
            className="py-3 px-4 rounded-2xl font-bold text-xs text-white bg-[#1b202c] hover:bg-[#232938] border border-white/5 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <Edit3 className="w-4 h-4 text-slate-400" />
            <span>Editar</span>
          </button>

          <button
            onClick={() => setIsShareModalOpen(true)}
            className="py-3.5 px-4 rounded-2xl font-black text-xs text-white flex items-center justify-center gap-2 shadow-xl transition-all active:scale-[0.98]"
            style={{
              background: theme.primaryGradient || 'linear-gradient(135deg, #ffa114 0%, #ff6b00 50%, #ff3b00 100%)',
              boxShadow: `0 10px 25px -4px ${theme.primaryColor}66`
            }}
          >
            <Send className="w-4 h-4 stroke-[2.8]" />
            <span>Enviar</span>
          </button>
        </div>

        {/* Share & Actions Modal */}
        {isShareModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#141822] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Enviar Orçamento</h3>
                <button
                  onClick={() => setIsShareModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5">
                {/* 1. Enviar via WhatsApp */}
                <a
                  href={cleanPhone ? waUrl : undefined}
                  aria-disabled={!cleanPhone}
                  onClick={e => { if (!cleanPhone) e.preventDefault(); }}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
                >
                  <Send className="w-4 h-4" />
                  <span>{cleanPhone ? 'Abrir WhatsApp (confirme envio)' : 'Cadastre o telefone do cliente para enviar'}</span>
                </a>

                {<div className="space-y-2 p-3 rounded-xl border border-white/10 bg-[#0c0e14]">
                  <p className="text-xs font-semibold text-slate-200">Link público de aprovação</p>
                  <button disabled={sharing || syncStatus !== 'saved'} onClick={createShareLink} className="w-full rounded-xl py-2 bg-sky-700 text-white text-xs font-bold disabled:opacity-40">{sharing ? 'Gerando…' : 'Gerar link válido por 30 dias'}</button>
                  {shareLink && <button className="text-xs text-sky-300 break-all text-left" onClick={async () => { await navigator.clipboard.writeText(shareLink); setCopiedLink(true); }}>{copiedLink ? 'Link copiado!' : `Copiar link: ${shareLink}`}</button>}
                  {shareError && <p role="alert" className="text-xs text-red-400">{shareError}</p>}
                </div>}

                <p className="text-[11px] text-slate-400">Abrir o WhatsApp não envia a proposta automaticamente; confirme o envio no aplicativo do WhatsApp. A situação “enviado” deve ser registrada manualmente.</p>

                {/* 2. Imprimir / Salvar em PDF */}
                <button
                  onClick={handlePrint}
                  className="w-full py-3 px-4 rounded-xl bg-[#1b202c] hover:bg-[#252c3c] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all border border-white/10"
                >
                  <Printer className="w-4 h-4 text-sky-400" />
                  <span>Salvar como PDF / Imprimir</span>
                </button>

                {/* 3. Marcar como Aprovado */}
                <button
                  onClick={() => {
                    handleMarkApproved();
                    setIsShareModalOpen(false);
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 transition-all border border-emerald-500/20"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Aprovar manualmente (sem aceite digital)</span>
                </button>

                {/* 4. Copiar link ou resumo */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Orçamento ${quote.number} - ${quote.clientName}: Total ${formatCurrency(quote.total)}`
                    );
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl text-slate-400 hover:text-white text-xs flex items-center justify-center gap-1.5"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copiado para área de transferência!' : 'Copiar resumo do orçamento'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
