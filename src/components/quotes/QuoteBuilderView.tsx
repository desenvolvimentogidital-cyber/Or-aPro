import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronRight,
  User,
  Search,
  Check,
  Percent,
  DollarSign,
  Truck,
  Eye,
  Sliders,
  X,
  Boxes,
  Wrench,
  Briefcase,
  Zap,
  Info
} from 'lucide-react';
import { Client, CatalogItem, QuoteItem, Quote, QuoteVisibilitySettings, ItemType } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { quoteTotals, newId, dateKey } from '../../utils/quoteMath';

export const QuoteBuilderView: React.FC = () => {
  const { clients, catalog, addQuote, updateQuote, editingQuote, setEditingQuote, draftClientId, setDraftClientId, getNextQuoteNumber, setActiveView, setActiveQuoteForPreview } = useApp();
  const { theme } = useTheme();

  // Selected client
  const [selectedClientId, setSelectedClientId] = useState<string>(editingQuote?.clientId || draftClientId || '');
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  // Items are real user-selected catalog entries, never generated examples
  const [items, setItems] = useState<QuoteItem[]>(() => editingQuote ? editingQuote.items.map(item => ({ ...item })) : []);

  // Catalog item picker modal state
  const [isItemPickerOpen, setIsItemPickerOpen] = useState(false);
  const [itemPickerTab, setItemPickerTab] = useState<'todos' | 'materiais' | 'servicos' | 'mao_de_obra'>('todos');
  const [itemPickerSearch, setItemPickerSearch] = useState('');

  // Additional costs & adjustments
  const [travelCost, setTravelCost] = useState<number>(editingQuote?.travelCost ?? 0);
  const [discountValue, setDiscountValue] = useState<number>(editingQuote ? (editingQuote.discountType === 'percentage' ? (editingQuote.subtotal ? editingQuote.discountValue / editingQuote.subtotal * 100 : 0) : editingQuote.discountValue) : 0);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>(editingQuote?.discountType ?? 'fixed');
  const [taxRate, setTaxRate] = useState<number>(editingQuote?.taxRate ?? 0); // %
  const [targetMarginRate, setTargetMarginRate] = useState<number>(editingQuote?.targetMarginRate ?? 0); // %
  const [paymentTerms, setPaymentTerms] = useState(editingQuote?.paymentTerms ?? '');
  const [executionDeadline, setExecutionDeadline] = useState(editingQuote?.executionDeadline ?? '');
  const [validUntil, setValidUntil] = useState(editingQuote?.validUntil ?? dateKey(new Date(Date.now() + 15 * 86400000)));
  const [notes, setNotes] = useState(editingQuote?.notes ?? '');
  const [modelTemplate, setModelTemplate] = useState<'padrao' | 'moderno' | 'profissional'>(editingQuote?.modelTemplate ?? 'padrao');

  // Client document visibility configuration (Section 7 of user spec!)
  const [visibility, setVisibility] = useState<QuoteVisibilitySettings>(editingQuote?.visibility ?? {
    showServices: true,
    showMaterials: true,
    showQuantities: true,
    showUnitPrices: true,
    showTaxes: false, // Prestador decide ocultar impostos por padrão
    showProfitMargin: false, // Lucro é interno
    showDiscount: true,
    showTotal: true,
    showTerms: true,
    showPix: true,
    showSignature: true
  });

  const selectedClient = clients.find(c => c.id === selectedClientId);

  // A missing acquisition cost is reported, never guessed as a percentage of sale price.
  let calculationError = '';
  let subtotal = 0, calculatedDiscount = 0, total = 0, netProfit = 0, missingCostCount = 0;
  try {
    const result = quoteTotals({ items, travelCost: Number(travelCost), otherCosts: editingQuote?.otherCosts ?? 0, discountType, discountValue: Number(discountValue), taxRate: Number(taxRate) });
    ({ subtotal, discount: calculatedDiscount, total, netProfit, missingCostCount } = result);
  } catch (error) { calculationError = error instanceof Error ? error.message : 'Confira os valores informados.'; }

  // Add item from catalog picker
  const handleAddItemFromCatalog = (catalogItem: CatalogItem) => {
    setItems(prev => {
      const existing = prev.find(i => i.name === catalogItem.name && i.type === catalogItem.type);
      if (existing) {
        return prev.map(i =>
          i.id === existing.id
            ? {
                ...i,
                quantity: i.quantity + 1,
                totalPrice: (i.quantity + 1) * i.unitPrice
              }
            : i
        );
      }
      return [
        ...prev,
        {
          id: newId('item'),
          name: catalogItem.name,
          type: catalogItem.type,
          unit: catalogItem.unit,
          quantity: 1,
          unitPrice: catalogItem.price,
          totalPrice: catalogItem.price,
          unitCost: catalogItem.cost,
          costConfirmed: catalogItem.costConfirmed,
          imageUrl: catalogItem.imageUrl,
          laborType: catalogItem.laborType
        }
      ];
    });
  };

  const handleUpdateItemQty = (id: string, delta: number) => {
    setItems(prev =>
      prev
        .map(item => {
          if (item.id === id) {
            const newQty = Math.max(0, item.quantity + delta);
            return {
              ...item,
              quantity: newQty,
              totalPrice: newQty * item.unitPrice
            };
          }
          return item;
        })
        .filter(item => item.quantity > 0)
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleProceedToPreview = () => {
    if (calculationError || !selectedClient || items.length === 0) return;
    const newQuote: Quote = {
      id: editingQuote?.id ?? newId('orc'),
      number: editingQuote?.number ?? getNextQuoteNumber(),
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      clientPhone: selectedClient.phone || '',
      clientEmail: selectedClient.email || '',
      date: editingQuote?.date ?? dateKey(new Date()),
      validUntil,
      executionDeadline: executionDeadline.trim() || undefined,
      status: editingQuote?.status ?? 'rascunho',
      items,
      subtotal,
      travelCost: Number(travelCost) || 0,
      otherCosts: editingQuote?.otherCosts ?? 0,
      discountType,
      discountValue: calculatedDiscount,
      taxRate,
      targetMarginRate,
      total,
      netProfit,
      visibility,
      notes,
      paymentTerms,
      modelTemplate,
      history: [...(editingQuote?.history || []), { date: new Date().toISOString(), action: editingQuote ? 'Orçamento editado' : 'Orçamento criado', user: 'Responsável pela conta' }]
    };

    if (editingQuote) updateQuote(newQuote);
    else addQuote(newQuote);
    setEditingQuote(null);
    setDraftClientId('');
    setActiveQuoteForPreview(newQuote);
  };

  // Filter catalog in picker
  const filteredCatalogItems = catalog.filter(item => {
    if (itemPickerTab === 'materiais' && item.type !== 'material') return false;
    if (itemPickerTab === 'servicos' && item.type !== 'servico') return false;
    if (itemPickerTab === 'mao_de_obra' && item.type !== 'mao_de_obra') return false;
    if (itemPickerSearch) {
      const term = itemPickerSearch.toLowerCase();
      return item.name.toLowerCase().includes(term) || item.category.toLowerCase().includes(term);
    }
    return true;
  });

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={() => { setEditingQuote(null); setActiveView('orcamentos'); }}
          className="p-1.5 rounded-xl bg-[#141822] text-slate-400 hover:text-white border border-white/5"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-white tracking-tight">{editingQuote ? `Editar ${editingQuote.number}` : 'Novo Orçamento'}</h1>
        <div className="w-8" />
      </div>

      {/* 1. Client Card (Referência visual #4 "Dados do Cliente") */}
      <div className="rounded-2xl bg-[#141822] border border-white/5 p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400 font-medium">Dados do Cliente</span>
          <button
            onClick={() => setIsClientPickerOpen(true)}
            className="text-xs font-semibold px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 flex items-center gap-1"
          >
            Trocar
          </button>
        </div>

        {selectedClient ? (
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-md ring-2 ring-white/10"
                style={{ background: theme.primaryGradient || 'linear-gradient(135deg, #ffa114 0%, #ff6b00 50%, #ff3b00 100%)' }}
              >
                {selectedClient.initials || selectedClient.name.charAt(0)}
              </div>
              <div>
                <span className="text-sm font-bold text-white block leading-tight">
                  {selectedClient.name}
                </span>
                <span className="text-xs text-slate-400">{selectedClient.phone}</span>
              </div>
            </div>
            <span className="text-xs text-slate-500">{selectedClient.city || 'Cidade não informada'}</span>
          </div>
        ) : (
          <button
            onClick={() => setIsClientPickerOpen(true)}
            className="w-full py-2.5 text-xs text-slate-400 text-center border border-dashed border-white/10 rounded-xl mt-2"
          >
            + Selecionar Cliente
          </button>
        )}
      </div>

      {/* 2. Items do Orçamento (Referência visual #4) */}
      <div className="rounded-2xl bg-[#141822] border border-white/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Itens do Orçamento</h2>
          <button
            onClick={() => setIsItemPickerOpen(true)}
            className="text-xs font-bold flex items-center gap-1 hover:underline"
            style={{ color: theme.primaryColor }}
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            Adicionar item
          </button>
        </div>

        {/* Items List */}
        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-white/5 rounded-xl text-slate-500 text-xs">
              Nenhum item adicionado ainda. Toque em "+ Adicionar item" acima.
            </div>
          ) : (
            items.map(item => {
              const icon =
                item.type === 'servico' ? (
                  <Wrench className="w-4 h-4 text-sky-400" />
                ) : item.type === 'mao_de_obra' ? (
                  <Briefcase className="w-4 h-4 text-purple-400" />
                ) : (
                  <Boxes className="w-4 h-4 text-amber-400" />
                );

              return (
                <div
                  key={item.id}
                  className="p-2.5 rounded-xl bg-[#1b202c] border border-white/5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{item.name}</h4>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                        <span>{item.quantity} {item.unit}</span>
                        <span>•</span>
                        <span>{formatCurrency(item.unitPrice)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <div className="text-right">
                      <span className="text-xs font-bold text-white block">
                        {formatCurrency(item.totalPrice)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 bg-[#141822] rounded-lg p-0.5 border border-white/5">
                      <button
                        onClick={() => handleUpdateItemQty(item.id, -1)}
                        className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white text-xs font-bold"
                      >
                        -
                      </button>
                      <span className="text-[11px] font-bold text-white px-1">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateItemQty(item.id, 1)}
                        className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white text-xs font-bold"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Despesas extras & Descontos */}
      <div className="rounded-2xl bg-[#141822] border border-white/5 p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Ajustes & Deslocamento
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-400 font-medium block mb-1">
              Deslocamento / Frete (R$)
            </label>
            <input
              type="number"
              min="0"
              value={travelCost || ''}
              onChange={e => setTravelCost(parseFloat(e.target.value) || 0)}
              placeholder="0,00"
              className="w-full bg-[#1b202c] text-xs font-semibold text-white px-3 py-2 rounded-xl border border-white/10 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 font-medium block mb-1">
              Desconto {discountType === 'percentage' ? '(%)' : '(R$)'}
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                value={discountValue || ''}
                onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                placeholder="0,00"
                className="w-full bg-[#1b202c] text-xs font-semibold text-white px-3 py-2 rounded-xl border border-white/10 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setDiscountType(discountType === 'fixed' ? 'percentage' : 'fixed')}
                className="px-2 py-2 rounded-xl bg-white/5 text-[10px] font-bold text-slate-300 hover:text-white"
              >
                {discountType === 'fixed' ? 'R$' : '%'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Formação de Preço & Visibilidade no Orçamento (Seção 6 e 7 da especificação) */}
      <div className="rounded-2xl bg-[#141822] border border-white/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Visibilidade no Orçamento do Cliente</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-normal">
                Personalizável
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Escolha o que o cliente poderá ver no documento final
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-slate-300">
          <label className="flex items-center gap-2 p-2 rounded-xl bg-[#1b202c] cursor-pointer">
            <input
              type="checkbox"
              checked={visibility.showServices}
              onChange={e => setVisibility(v => ({ ...v, showServices: e.target.checked }))}
              className="rounded accent-orange-500"
            />
            <span>Mostrar serviços</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-xl bg-[#1b202c] cursor-pointer">
            <input
              type="checkbox"
              checked={visibility.showMaterials}
              onChange={e => setVisibility(v => ({ ...v, showMaterials: e.target.checked }))}
              className="rounded accent-orange-500"
            />
            <span>Mostrar materiais</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-xl bg-[#1b202c] cursor-pointer">
            <input
              type="checkbox"
              checked={visibility.showQuantities}
              onChange={e => setVisibility(v => ({ ...v, showQuantities: e.target.checked }))}
              className="rounded accent-orange-500"
            />
            <span>Mostrar quantidades</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-xl bg-[#1b202c] cursor-pointer">
            <input
              type="checkbox"
              checked={visibility.showTaxes}
              onChange={e => setVisibility(v => ({ ...v, showTaxes: e.target.checked }))}
              className="rounded accent-orange-500"
            />
            <span>Mostrar impostos</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-xl bg-[#1b202c] cursor-pointer">
            <input
              type="checkbox"
              checked={visibility.showProfitMargin}
              onChange={e => setVisibility(v => ({ ...v, showProfitMargin: e.target.checked }))}
              className="rounded accent-orange-500"
            />
            <span>Mostrar margem</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-xl bg-[#1b202c] cursor-pointer">
            <input
              type="checkbox"
              checked={visibility.showDiscount}
              onChange={e => setVisibility(v => ({ ...v, showDiscount: e.target.checked }))}
              className="rounded accent-orange-500"
            />
            <span>Mostrar desconto</span>
          </label>
        </div>

        {/* Internal Profit Indicator (Visible only here to the technician) */}
        <div className="p-2.5 rounded-xl bg-[#121620] border border-white/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Info className="w-3.5 h-3.5 text-amber-400" />
            <span>Resultado estimado (custos diretos):</span>
          </div>
          <span className={`font-bold ${missingCostCount>0?'text-amber-400':netProfit < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{missingCostCount>0?'Custos incompletos':formatCurrency(netProfit)}</span>
        </div>
      </div>

      <div className="rounded-2xl bg-[#141822] border border-white/5 p-4 space-y-3">
        <h2 className="text-sm font-bold text-white">Informações do PDF</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-slate-300 font-semibold">Válido até
            <input type="date" value={validUntil} min={editingQuote?.date ?? dateKey(new Date())}
              onChange={e => setValidUntil(e.target.value)} required
              className="block w-full mt-1.5 bg-[#1b202c] text-white px-3 py-2.5 rounded-xl border border-white/10" />
          </label>
          <label className="text-xs text-slate-300 font-semibold">Prazo de execução (opcional)
            <input type="text" maxLength={100} value={executionDeadline}
              onChange={e => setExecutionDeadline(e.target.value)}
              placeholder="Informe o prazo contratado"
              className="block w-full mt-1.5 bg-[#1b202c] text-white px-3 py-2.5 rounded-xl border border-white/10" />
          </label>
        </div>
        <label className="block text-xs font-semibold text-slate-300">Condições e formas de pagamento
          <textarea rows={2} value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
            placeholder="Informe as condições combinadas com o cliente"
            className="block w-full mt-1.5 bg-[#1b202c] text-white px-3 py-2.5 rounded-xl border border-white/10 resize-y" />
        </label>
        <label className="block text-xs font-semibold text-slate-300">Observações do orçamento
          <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Inclua detalhes de execução, garantias ou observações reais"
            className="block w-full mt-1.5 bg-[#1b202c] text-white px-3 py-2.5 rounded-xl border border-white/10 resize-y" />
        </label>
        <p className="text-[11px] text-slate-400">O prazo só aparece no PDF quando você informar um valor. Nenhum prazo é inventado.</p>
      </div>

      {calculationError && <p role="alert" className="p-3 rounded-xl bg-rose-950 text-rose-300 text-xs">{calculationError}</p>}
      {missingCostCount > 0 && <p className="p-3 rounded-xl bg-amber-950/70 text-amber-200 text-xs">{missingCostCount} item(ns) sem custo cadastrado. O lucro estimado pode estar acima do real.</p>}

      {/* 5. Totals Breakdown Card (Referência visual #4 bottom) */}
      <div className="rounded-2xl bg-[#141822] border border-white/5 p-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Subtotal</span>
          <span className="font-semibold text-white">{formatCurrency(subtotal)}</span>
        </div>

        {calculatedDiscount > 0 && (
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Desconto</span>
            <span className="font-semibold text-rose-400">- {formatCurrency(calculatedDiscount)}</span>
          </div>
        )}

        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
          <span className="text-sm font-bold text-white">Total</span>
          <span className="text-lg font-black text-white">{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Action Button: Continuar (Referência visual #4 button with degradê) */}
      <button
        onClick={handleProceedToPreview}
        disabled={items.length === 0 || !selectedClient || !!calculationError}
        className="w-full py-4 px-4 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 shadow-xl transition-all active:scale-[0.98] disabled:opacity-50"
        style={{
          background: theme.primaryGradient || 'linear-gradient(135deg, #ffa114 0%, #ff6b00 50%, #ff3b00 100%)',
          boxShadow: `0 10px 25px -4px ${theme.primaryColor}66`
        }}
      >
        <span>{editingQuote ? 'Salvar alterações' : 'Salvar e visualizar'}</span>
        <ChevronRight className="w-4 h-4 stroke-[3]" />
      </button>

      {/* MODAL 1: Client Selector */}
      {isClientPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#141822] border border-white/10 rounded-2xl w-full max-w-sm p-4 shadow-2xl animate-in zoom-in-95 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">Selecionar Cliente</h3>
              <button
                onClick={() => setIsClientPickerOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full bg-[#1b202c] text-xs text-white placeholder-slate-500 pl-9 pr-3 py-2 rounded-xl border border-white/10 focus:outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {clients
                .filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                .map(client => (
                  <div
                    key={client.id}
                    onClick={() => {
                      setSelectedClientId(client.id);
                      setIsClientPickerOpen(false);
                    }}
                    className={`p-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-colors ${
                      client.id === selectedClientId
                        ? 'bg-[#1e2433] border border-white/10'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: theme.primaryColor }}
                      >
                        {client.initials || client.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{client.name}</h4>
                        <p className="text-[10px] text-slate-400">{client.phone}</p>
                      </div>
                    </div>
                    {client.id === selectedClientId && (
                      <Check className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Adicionar Item (Referência visual #6 exactly: Todos, Materiais, Serviços, Mão de Obra) */}
      {isItemPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm">
          <div className="bg-[#141822] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl w-full max-w-md p-4 sm:p-5 shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsItemPickerOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h3 className="text-sm font-bold text-white">Adicionar Item</h3>
              </div>
              <button
                onClick={() => setIsItemPickerOpen(false)}
                className="text-xs font-semibold px-3 py-1 rounded-lg bg-white/5 text-slate-300 hover:text-white"
              >
                Concluir
              </button>
            </div>

            {/* Search Input */}
            <div className="relative my-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={itemPickerSearch}
                onChange={e => setItemPickerSearch(e.target.value)}
                placeholder="Buscar itens..."
                className="w-full bg-[#1b202c] text-xs text-white placeholder-slate-500 pl-9 pr-3 py-2 rounded-xl border border-white/10 focus:outline-none"
              />
            </div>

            {/* Tabs: Todos, Materiais, Serviços, Mão de Obra (Referência visual #6) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 text-xs font-semibold no-scrollbar">
              <button
                onClick={() => setItemPickerTab('todos')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                  itemPickerTab === 'todos' ? 'text-white shadow-sm' : 'bg-[#1b202c] text-slate-400'
                }`}
                style={itemPickerTab === 'todos' ? { background: theme.primaryGradient } : {}}
              >
                Todos
              </button>
              <button
                onClick={() => setItemPickerTab('materiais')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                  itemPickerTab === 'materiais' ? 'text-white shadow-sm' : 'bg-[#1b202c] text-slate-400'
                }`}
                style={itemPickerTab === 'materiais' ? { background: theme.primaryGradient } : {}}
              >
                Materiais
              </button>
              <button
                onClick={() => setItemPickerTab('servicos')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                  itemPickerTab === 'servicos' ? 'text-white shadow-sm' : 'bg-[#1b202c] text-slate-400'
                }`}
                style={itemPickerTab === 'servicos' ? { background: theme.primaryGradient } : {}}
              >
                Serviços
              </button>
              <button
                onClick={() => setItemPickerTab('mao_de_obra')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                  itemPickerTab === 'mao_de_obra' ? 'text-white shadow-sm' : 'bg-[#1b202c] text-slate-400'
                }`}
                style={itemPickerTab === 'mao_de_obra' ? { background: theme.primaryGradient } : {}}
              >
                Mão de Obra
              </button>
            </div>

            {/* Items list with orange "+" icon (Referência visual #6) */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredCatalogItems.map(catalogItem => {
                const countInQuote =
                  items.find(i => i.name === catalogItem.name)?.quantity || 0;

                const icon =
                  catalogItem.type === 'servico' ? (
                    <Wrench className="w-4 h-4 text-sky-400" />
                  ) : catalogItem.type === 'mao_de_obra' ? (
                    <Briefcase className="w-4 h-4 text-purple-400" />
                  ) : (
                    <Boxes className="w-4 h-4 text-amber-400" />
                  );

                return (
                  <div
                    key={catalogItem.id}
                    className="p-3 rounded-2xl bg-[#1b202c] border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                        {icon}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">
                          {catalogItem.name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <span className="capitalize">{catalogItem.type.replace('_', ' ')}</span>
                          <span>•</span>
                          <span className="font-semibold text-slate-200">
                            {formatCurrency(catalogItem.price)} {catalogItem.unit !== 'un' ? `/${catalogItem.unit}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {countInQuote > 0 && (
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white shadow-sm"
                          style={{ background: theme.primaryGradient }}
                        >
                          {countInQuote}x
                        </span>
                      )}
                      <button
                        onClick={() => handleAddItemFromCatalog(catalogItem)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white active:scale-95 transition-all shadow-md"
                        style={{ background: theme.primaryGradient || 'linear-gradient(135deg, #ffa114 0%, #ff6b00 50%, #ff3b00 100%)' }}
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
