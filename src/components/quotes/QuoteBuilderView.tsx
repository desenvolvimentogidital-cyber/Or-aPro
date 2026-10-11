import React, { useEffect,useRef,useState } from 'react';
import {useSinapiCostLookup} from '../../utils/useSinapiCostLookup';
import {SinapiReferencePicker} from '../catalog/SinapiReferencePicker';
import {useSinapiLaborOnlyLookup} from '../../utils/useSinapiLaborOnlyLookup';
import {sinapiLocalSalePrice} from '../../utils/sinapiLocalSale';
import type {SinapiComposition} from '../../types/schedule';
import {sinapiUFs,withSinapiProvenance,type SinapiUF,type SinapiRegime} from '../../utils/sinapiRegional';
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
import { ReferencePreferences } from '../references/ReferencePreferences';
import {defaultConstructionReferences,validReferenceSettings,type ConstructionReferenceSettings} from '../../utils/constructionReferences';
import { EditableNumericInput } from '../common/EditableNumericInput';
import {laborDemandForQuantity, sameServiceUnit} from '../../utils/quoteSchedule';
import {categoryLabel,matchesSinapiCategory,sinapiCategoryOptions,type SinapiCategoryFilter} from '../../utils/sinapiCategories';

export const QuoteBuilderView: React.FC = () => {
  const { clients, catalog, company, addCatalogItem, addQuote, updateQuote, editingQuote, setEditingQuote, draftClientId, setDraftClientId, getNextQuoteNumber, setActiveView, setActiveQuoteForPreview } = useApp();
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
  const [itemPickerSpecialty,setItemPickerSpecialty]=useState<SinapiCategoryFilter>('todas');
  const [itemPickerSearch, setItemPickerSearch] = useState('');
  const [sinapiBrowseOpen,setSinapiBrowseOpen]=useState(false);
  const [pickedSinapi,setPickedSinapi]=useState<SinapiComposition|null>(null);
  const [sinapiPrice,setSinapiPrice]=useState(0);
  const [sinapiPricingScope,setSinapiPricingScope]=useState<'complete'|'labor_only'>('complete');
  const [localAdjustment,setLocalAdjustment]=useState(0);
  const [sinapiCost,setSinapiCost]=useState(0);
  const [sinapiCostConfirmed,setSinapiCostConfirmed]=useState(false);
  const sinapiSaleEdited=useRef(false);
  const sinapiCostEdited=useRef(false);
  const [sinapiUF,setSinapiUF]=useState<SinapiUF|''>(
    sinapiUFs.includes(company.state as SinapiUF)?company.state as SinapiUF:'');
  const [sinapiRegime,setSinapiRegime]=useState<SinapiRegime|''>('');
  const sinapiLookup=useSinapiCostLookup(pickedSinapi,sinapiUF,sinapiRegime);
  const laborLookup=useSinapiLaborOnlyLookup(pickedSinapi,sinapiUF,sinapiRegime,
    Boolean(pickedSinapi));
  useEffect(()=>{
    const cost=sinapiLookup.cost;
    if(sinapiPricingScope!=='complete'||!pickedSinapi||!cost||cost.code!==pickedSinapi.code||
      cost.source.reference!==pickedSinapi.reference||
      cost.source.uf!==sinapiUF||cost.source.regime!==sinapiRegime||
      !sameServiceUnit(cost.unit,pickedSinapi.unit))return;
    if(!sinapiCostEdited.current){
      setSinapiCost(cost.unitCost);setSinapiCostConfirmed(true);
    }
    if(!sinapiSaleEdited.current)setSinapiPrice(sinapiLocalSalePrice(cost.unitCost,localAdjustment));
  },[sinapiLookup.cost,pickedSinapi?.code,sinapiUF,sinapiRegime,sinapiPricingScope,localAdjustment]);
  useEffect(()=>{
    const result=laborLookup.value;
    if(sinapiPricingScope!=='labor_only'||!pickedSinapi||
      !result||result.unitCost===null||
      result.source.reference!==pickedSinapi.reference||
      result.source.uf!==sinapiUF||result.source.regime!==sinapiRegime)return;
    if(!sinapiCostEdited.current){
      setSinapiCost(result.unitCost);setSinapiCostConfirmed(true);
    }
    if(!sinapiSaleEdited.current)setSinapiPrice(sinapiLocalSalePrice(result.unitCost,localAdjustment));
  },[laborLookup.value,pickedSinapi?.code,sinapiUF,sinapiRegime,sinapiPricingScope,localAdjustment]);
  const [sinapiAddError,setSinapiAddError]=useState('');

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
  const [referenceSettings,setReferenceSettings]=useState<ConstructionReferenceSettings>(()=>editingQuote?.referenceSettings??defaultConstructionReferences());
  const invalidReference=!validReferenceSettings(referenceSettings);

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
  const handleAddItemFromCatalog = (catalogItem: CatalogItem, updatePriceOnDuplicate=false) => {
    setItems(prev => {
      // Dois serviços de nomes iguais em catálogos distintos não são o mesmo escopo.
      // Não mesclar indevidamente elétrica e hidráulica no orçamento.
      const existing = prev.find(i => i.catalogItemId === catalogItem.id && i.type === catalogItem.type);
      if (existing) {
        return prev.map(i =>
          i.id === existing.id
            ? {
                ...i,
                quantity: i.quantity + 1,
                totalPrice: (i.quantity + 1) * (updatePriceOnDuplicate?catalogItem.price:i.unitPrice),
                ...(updatePriceOnDuplicate?{unitPrice:catalogItem.price,unitCost:catalogItem.cost,costConfirmed:catalogItem.costConfirmed}:{})
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
          laborType: catalogItem.laborType,
          catalogItemId: catalogItem.id,
          sinapiComposition: catalogItem.sinapiComposition,
          sinapiPricingScope:catalogItem.sinapiPricingScope,
          sinapiLocalAdjustmentPercent:catalogItem.sinapiLocalAdjustmentPercent
        }
      ];
    });
  };

  const prepareSinapiForQuote=(c:SinapiComposition)=>{
    setPickedSinapi(c);setSinapiBrowseOpen(false);setSinapiAddError('');
    sinapiSaleEdited.current=false;sinapiCostEdited.current=false;
    const sameCode=catalog.filter(item=>item.type==='servico' &&
      item.sinapiComposition?.code===c.code && item.sinapiComposition?.reference===c.reference);
    // A biblioteca sempre começa pela composição completa, mesmo quando há
    // uma versão de mão de obra com preço comercial já cadastrado.
    const previously=sameCode.find(item=>(item.sinapiPricingScope||'complete')==='complete' &&
      item.sinapiComposition?.uf===company.state) ||
      sameCode.find(item=>(item.sinapiPricingScope||'complete')==='complete') ||
      sameCode[0];
    setSinapiPricingScope(previously?.sinapiPricingScope||'complete');
    setLocalAdjustment(previously?.sinapiLocalAdjustmentPercent||0);
    setSinapiPrice(previously?.price||0);
    setSinapiCost(previously?.cost||0);
    setSinapiCostConfirmed(previously?.costConfirmed||false);
    if(previously){sinapiSaleEdited.current=true;sinapiCostEdited.current=true;}
    setSinapiUF(previously?.sinapiComposition?.uf ||
      (sinapiUFs.includes(company.state as SinapiUF)?company.state as SinapiUF:''));
    setSinapiRegime(previously?.sinapiComposition?.regime||'');
  };
  const resetRegionalQuoteCost=()=>{
    // Nunca reutilizar preço automático de outro estado ou regime.
    // Valor explicitamente editado pela pessoa permanece inalterado.
    if(!sinapiSaleEdited.current)setSinapiPrice(0);
    if(!sinapiCostEdited.current){setSinapiCost(0);setSinapiCostConfirmed(false);}
    setSinapiAddError('');
  };
  const addSinapiToQuote=()=>{
    if(!pickedSinapi)return;
    if((sinapiPricingScope==='complete'?sinapiLookup.status:laborLookup.status)==='loading'&&!sinapiSaleEdited.current&&!sinapiCostEdited.current){
      setSinapiAddError('Aguarde a consulta do custo oficial antes de adicionar.');return;
    }
    if(!Number.isFinite(sinapiPrice)||sinapiPrice<=0){
      setSinapiAddError('Informe o preço comercial de venda do serviço. A composição SINAPI informa HH, não preço.');
      return;
    }
    if(!sinapiUF||!sinapiRegime){
      setSinapiAddError('Informe UF e regime de encargos da obra antes de adicionar.');return;
    }
    try{
      const composition=withSinapiProvenance(pickedSinapi,{
        reference:pickedSinapi.reference||'',uf:sinapiUF,regime:sinapiRegime
      });
      const known=catalog.find(item=>item.type==='servico' &&
        (item.sinapiPricingScope||'complete')===sinapiPricingScope &&
        item.sinapiComposition?.code===composition.code &&
        item.sinapiComposition?.reference===composition.reference &&
        item.sinapiComposition?.uf===composition.uf &&
        item.sinapiComposition?.regime===composition.regime &&
        item.unit===composition.unit);
      const catalogItem:CatalogItem=known||{
        id:newId('cat'),type:'servico',
        name:sinapiPricingScope==='labor_only'
          ?`SINAPI ${composition.code} · Somente mão de obra · ${composition.description}`
          :`SINAPI ${composition.code} · ${composition.description}`,
        category:categoryLabel(composition),price:sinapiPrice,unit:composition.unit,
        cost:sinapiCostConfirmed?sinapiCost:undefined,costConfirmed:sinapiCostConfirmed,
        description:`Composição analítica ${composition.reference}; HH oficiais do arquivo ${composition.sourceFile}. Preço comercial declarado pelo usuário.`,
        sinapiComposition:composition,sinapiPricingScope,sinapiLocalAdjustmentPercent:localAdjustment
      };
      if(!known)addCatalogItem(catalogItem);
      handleAddItemFromCatalog({...catalogItem,price:sinapiPrice,sinapiPricingScope,sinapiLocalAdjustmentPercent:localAdjustment,
        cost:sinapiCostConfirmed?sinapiCost:undefined,costConfirmed:sinapiCostConfirmed},true);
      setPickedSinapi(null);setSinapiAddError('');
    }catch(err){
      setSinapiAddError(err instanceof Error?err.message:'Não foi possível inserir o serviço SINAPI.');
    }
  };

  const handleSetItemUnitPrice = (id:string, unitPrice:number)=>{
    if(!Number.isFinite(unitPrice)||unitPrice<0)return;
    setItems(prev=>prev.map(i=>i.id===id?
      {...i,unitPrice,totalPrice:i.quantity*unitPrice}:i));
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

  const handleSetItemQty = (id:string, quantity:number) => {
    if (!Number.isFinite(quantity) || quantity<=0) return;
    setItems(prev=>prev.map(item=>item.id===id
      ? {...item, quantity, totalPrice:quantity*item.unitPrice}
      : item));
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleProceedToPreview = () => {
    if (calculationError || invalidReference || !selectedClient || items.length === 0) return;
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
      referenceSettings,
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
    if (itemPickerSpecialty !== 'todas' && (item.type !== 'servico' || !item.sinapiComposition ||
      !matchesSinapiCategory(item.sinapiComposition,itemPickerSpecialty)))return false;
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
              // Exibe as HH de uma composição previamente associada, sem confundir
              // produtividade física com preço de mão de obra no orçamento.
              const sinapi = item.sinapiComposition || catalog.find(c=>c.id===item.catalogItemId)?.sinapiComposition;
              let labor: ReturnType<typeof laborDemandForQuantity> = [];
              try {
                if (item.type==='servico' && sinapi && sameServiceUnit(item.unit,sinapi.unit))
                  labor=laborDemandForQuantity(sinapi,item.quantity);
              } catch {/* Composição incompleta: não apresentar HH artificiais. */}
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
                  className="p-2.5 rounded-xl bg-[#1b202c] border border-white/5 flex flex-wrap items-center justify-between gap-2"
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
                        <label className="flex flex-wrap items-center gap-1">
                          <span className="sr-only">Preço unitário do item {item.name}</span>
                          <span>R$</span>
                          <EditableNumericInput aria-label={`Preço unitário do item ${item.name}`}
                            value={item.unitPrice} min={0} required emptyAsBlank
                            onCommit={n=>handleSetItemUnitPrice(item.id,n)}
                            className="w-20 min-h-8 rounded-md border border-white/15 bg-[#0b0e15] px-1 text-[11px] text-white"/>
                        </label>
                      </div>
                      {labor.length>0 && <p className="mt-1 text-[10px] leading-relaxed text-sky-300" title={labor.map(l=>`${l.role}: ${l.hours.toFixed(3)} HH`).join(' | ')}>
                        {sinapi?categoryLabel(sinapi):'Serviço'} · SINAPI {sinapi?.code} · {labor.reduce((sum,l)=>sum+l.hours,0).toLocaleString('pt-BR',{maximumFractionDigits:2})} HH referenciais · dimensione a equipe no Cronograma
                      </p>}
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
                      <EditableNumericInput
                        aria-label={`Quantidade do item ${item.name}`}
                        className="w-16 rounded-md bg-[#0b0e15] px-1 py-1 text-center text-[11px] font-bold text-white outline-none focus:ring-1 focus:ring-orange-500"
                        value={item.quantity} min={0.000001} required
                        onCommit={quantity=>handleSetItemQty(item.id,quantity)}
                      />
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

      <ReferencePreferences value={referenceSettings} onChange={setReferenceSettings}/>
      {invalidReference&&<p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">Revise o nome da referência personalizada e a competência no formato MM/AAAA antes de salvar a proposta.</p>}

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
            <EditableNumericInput
              min={0}
              value={travelCost} emptyAsBlank
              onCommit={setTravelCost}
              placeholder="0,00"
              className="w-full bg-[#1b202c] text-xs font-semibold text-white px-3 py-2 rounded-xl border border-white/10 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 font-medium block mb-1">
              Desconto {discountType === 'percentage' ? '(%)' : '(R$)'}
            </label>
            <div className="flex items-center gap-1">
              <EditableNumericInput
                min={0} max={discountType==='percentage'?100:undefined}
                value={discountValue} emptyAsBlank
                onCommit={setDiscountValue}
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
        disabled={items.length === 0 || !selectedClient || !!calculationError || invalidReference}
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
          <div className="bg-[#141822] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl w-full max-w-md p-4 sm:p-5 shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto overscroll-contain flex flex-col">
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

            <label className="block pb-2 text-[11px] text-slate-300">Especialidade do serviço (quando já vinculada ao SINAPI Analítico)
              <select aria-label="Filtrar itens do orçamento por especialidade"
                className="mt-1 min-h-10 w-full rounded-lg border border-white/10 bg-[#1b202c] px-3 text-slate-100"
                value={itemPickerSpecialty} onChange={e=>setItemPickerSpecialty(e.target.value as SinapiCategoryFilter)}>
                {sinapiCategoryOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            {itemPickerSpecialty!=='todas'&&<p className="mb-2 text-[11px] text-amber-200">Somente serviços já vinculados a composições analíticas verificadas aparecem neste filtro. Cadastre e vincule outras especialidades no catálogo/cronograma antes de selecionar.</p>}
            {(itemPickerTab==='todos'||itemPickerTab==='servicos')&&
              <div className="mb-3 space-y-2">
                <button type="button" onClick={()=>setSinapiBrowseOpen(v=>!v)}
                  className="min-h-11 w-full rounded-xl border border-sky-500/35 bg-sky-500/10 px-3 text-left text-xs font-bold text-sky-200">
                  {sinapiBrowseOpen?'Ocultar biblioteca SINAPI':'Adicionar serviço da tabela SINAPI (todos os 9.136)'}
                </button>
                {sinapiBrowseOpen&&<SinapiReferencePicker onSelect={prepareSinapiForQuote}
                  title="Selecionar serviço SINAPI para o orçamento"/>}
                {pickedSinapi&&<div className="shrink-0 space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <strong className="block text-xs text-emerald-200">SINAPI {pickedSinapi.code} · {categoryLabel(pickedSinapi)}</strong>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-200">O que entra no orçamento?</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" aria-pressed={sinapiPricingScope==='complete'}
                        className={`min-h-11 rounded-lg border p-2 text-[11px] font-semibold ${sinapiPricingScope==='complete'?'border-orange-400 bg-orange-500/20 text-orange-100':'border-white/15 text-slate-300'}`}
                        onClick={()=>{if(sinapiPricingScope==='complete')return;
                          setSinapiPricingScope('complete');setLocalAdjustment(0);
                          sinapiSaleEdited.current=false;sinapiCostEdited.current=false;
                          setSinapiPrice(0);setSinapiCost(0);setSinapiCostConfirmed(false);
                          setSinapiAddError('');
                        }}>Completo (com material)</button>
                      <button type="button" aria-pressed={sinapiPricingScope==='labor_only'}
                        className={`min-h-11 rounded-lg border p-2 text-[11px] font-semibold ${sinapiPricingScope==='labor_only'?'border-orange-400 bg-orange-500/20 text-orange-100':'border-white/15 text-slate-300'}`}
                        onClick={()=>{if(sinapiPricingScope==='labor_only')return;
                          setSinapiPricingScope('labor_only');setLocalAdjustment(0);
                          sinapiSaleEdited.current=false;sinapiCostEdited.current=false;
                          const current=laborLookup.status==='ready'&&
                            laborLookup.value?.source.uf===sinapiUF&&
                            laborLookup.value?.source.regime===sinapiRegime
                            ?laborLookup.value.unitCost:null;
                          setSinapiPrice(current??0);
                          setSinapiCost(current??0);
                          setSinapiCostConfirmed(current!==null);
                          setSinapiAddError('');
                        }}>Só mão de obra</button>
                    </div>
                    <p className="text-[10px] text-slate-400">{sinapiPricingScope==='labor_only'?'Materiais fornecidos pelo cliente. HH continuam no cronograma.':'Composição completa, com materiais e execução.'}</p>
                  </div>
                  <p className="text-xs text-slate-200">{pickedSinapi.description}</p>
                  <p className="text-[11px] text-emerald-200">Profissionais: {pickedSinapi.labor.map(l=>`${l.role}: ${l.hoursPerUnit.toLocaleString('pt-BR',{maximumFractionDigits:5})} HH/${pickedSinapi.unit}`).join(' · ')}</p>
                  <label className="block text-xs text-slate-200">Preço comercial de venda (R$ por {pickedSinapi.unit})
                    <EditableNumericInput value={sinapiPrice} min={0.01} emptyAsBlank required
                      onCommit={value=>{sinapiSaleEdited.current=true;setSinapiPrice(value);}} aria-label="Preço de venda do serviço SINAPI"
                      className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-[#0b101a] px-3 text-white"/>
                  </label>
                  <label className="block text-xs text-slate-200">Custo direto do serviço (R$ por {pickedSinapi.unit})
                    <EditableNumericInput value={sinapiCost} min={0} emptyAsBlank
                      onCommit={value=>{sinapiCostEdited.current=true;setSinapiCost(value);setSinapiCostConfirmed(true);}}
                      aria-label="Custo unitário do serviço SINAPI"
                      className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-[#0b101a] px-3 text-white"/>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input type="checkbox" checked={sinapiCostConfirmed}
                      onChange={e=>{sinapiCostEdited.current=true;setSinapiCostConfirmed(e.target.checked);}}
                      aria-label="Confirmar custo unitário SINAPI"/>
                    Confirmar custo informado (desmarque se não souber)
                  </label>
                  {sinapiPricingScope==='labor_only'&&<>
                    {laborLookup.status==='loading'&&<p role="status" className="text-[11px] text-sky-200">Consultando preço por HH dos profissionais…</p>}
                    {laborLookup.value&&<div className="space-y-1 text-[11px] text-slate-200">
                      {laborLookup.value.workers.map(w=><div className="flex justify-between gap-2" key={w.code+':'+w.role}>
                        <span>{w.role} ({w.hoursPerUnit.toLocaleString('pt-BR',{maximumFractionDigits:5})} HH)</span>
                        <span className="shrink-0">{w.subtotal===null?'Sem preço/h':formatCurrency(w.subtotal)}</span>
                      </div>)}
                    </div>}
                    {laborLookup.status==='ready'&&<p role="status" className="text-[11px] text-emerald-200">Estimativa só mão de obra: {formatCurrency(laborLookup.value!.unitCost!)}/{pickedSinapi.unit}. Materiais não incluídos. Preço editável.</p>}
                    {laborLookup.status==='missing'&&<p className="text-[11px] text-amber-200">Um ou mais profissionais sem preço/h na UF: importe o XLSX em Serviços → Custos SINAPI ou informe o preço da execução manualmente, sem material.</p>}
                    {laborLookup.status==='error'&&<p role="alert" className="text-[11px] text-rose-200">{laborLookup.error}</p>}
                  </>}
                  {sinapiPricingScope==='complete'&&<>
                  {sinapiLookup.status==='loading'&&<p role="status" className="text-[11px] text-sky-200">Consultando custo regional SINAPI…</p>}
                  {sinapiLookup.status==='found'&&<p className="text-[11px] text-emerald-200">
                    Referência importada: {formatCurrency(sinapiLookup.cost!.unitCost)}/{pickedSinapi.unit},
                    {sinapiLookup.cost!.source.uf} · {sinapiLookup.cost!.source.reference} ·
                    {sinapiLookup.cost!.source.regime==='com_desoneracao'?'com':'sem'} desoneração.
                    Preço comercial sugerido inicialmente igual ao custo, editável.
                  </p>}
                  {sinapiLookup.status==='missing'&&<p className="text-[11px] text-amber-200">
                    Ainda sem custo oficial importado para esta UF, competência e encargos. Cadastre custos em Serviços → Custos SINAPI, ou informe preço e custo manualmente.
                  </p>}
                  {sinapiLookup.status==='error'&&<p role="alert" className="text-[11px] text-rose-200">{sinapiLookup.error}</p>}
                  </>}
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-[11px] text-slate-200">UF da obra
                      <select aria-label="UF da composição SINAPI no orçamento" value={sinapiUF}
                        onChange={e=>{resetRegionalQuoteCost();setSinapiUF(e.target.value as SinapiUF|'');}}
                        className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-[#0b101a] p-2 text-white">
                        <option value="">Selecionar</option>{sinapiUFs.map(uf=><option key={uf} value={uf}>{uf}</option>)}
                      </select>
                    </label>
                    <label className="block text-[11px] text-slate-200">Encargos
                      <select aria-label="Encargos da composição SINAPI no orçamento" value={sinapiRegime}
                        onChange={e=>{resetRegionalQuoteCost();setSinapiRegime(e.target.value as SinapiRegime|'');}}
                        className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-[#0b101a] p-2 text-white">
                        <option value="">Selecionar</option>
                        <option value="sem_desoneracao">Sem desoneração</option>
                        <option value="com_desoneracao">Com desoneração</option>
                      </select>
                    </label>
                  </div>
                  {sinapiPricingScope==='complete'&&sinapiLookup.cost&&laborLookup.status==='ready'&&laborLookup.value?.unitCost!==null&&
                    <div className="rounded-lg border border-sky-500/20 p-2 text-[11px] text-slate-200">
                      <div className="flex justify-between gap-2"><span>Custo completo</span><strong>{formatCurrency(sinapiLookup.cost.unitCost)}</strong></div>
                      <div className="flex justify-between gap-2"><span>Mão de obra HH</span><strong>{formatCurrency(laborLookup.value!.unitCost!)}</strong></div>
                      {sinapiLookup.cost.unitCost>=laborLookup.value!.unitCost!&&<div className="flex justify-between gap-2"><span>Demais custos (material/equipamento/outros)</span><strong>{formatCurrency(Math.round((sinapiLookup.cost.unitCost-laborLookup.value!.unitCost!)*100)/100)}</strong></div>}
                    </div>}
                  {sinapiPricingScope==='complete'&&sinapiLookup.status==='missing'&&laborLookup.status==='ready'&&<p className="text-[11px] text-sky-200">Sem custo integral nesta UF, mas mão de obra calculada em {formatCurrency(laborLookup.value!.unitCost!)}. Se o cliente fornece material, escolha “Só mão de obra”.</p>}
                  <label className="block text-xs text-slate-200">Ajuste comercial da cidade/obra (% opcional)
                    <EditableNumericInput min={0} value={localAdjustment} emptyAsBlank
                      onCommit={value=>{
                        if(!Number.isFinite(value)||value>300)return;
                        setLocalAdjustment(value);
                        const base=sinapiPricingScope==='complete'
                          ?(sinapiLookup.cost?.code===pickedSinapi.code && sinapiLookup.cost.source.uf===sinapiUF &&
                              sinapiLookup.cost.source.regime===sinapiRegime?sinapiLookup.cost.unitCost:null)
                          :(laborLookup.value?.source.uf===sinapiUF&&laborLookup.value?.source.regime===sinapiRegime
                              ?laborLookup.value.unitCost:null);
                        if(base!==null&&base!==undefined){
                          setSinapiPrice(sinapiLocalSalePrice(base,value));sinapiSaleEdited.current=false;
                        }
                      }} aria-label="Ajuste comercial local do orçamento SINAPI"
                      className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-[#0b101a] px-3 text-white"/>
                  </label>
                  <p className="text-[10px] text-slate-400">Ajuste escolhido pela empresa, não um custo de referência oficial da cidade.</p>
                  <p className="text-[10px] text-amber-200">{sinapiPricingScope==='labor_only'?'Mão de obra por HH × custo/h com encargos; materiais não entram.':'Custo integral da composição.'} A margem comercial é definida por você.</p>
                  {sinapiAddError&&<p role="alert" className="text-xs text-rose-200">{sinapiAddError}</p>}
                  <button type="button" onClick={addSinapiToQuote}
                    className="min-h-11 w-full rounded-lg bg-sky-700 p-2 text-xs font-bold text-white">
                    Adicionar serviço SINAPI ao orçamento
                  </button>
                </div>}
              </div>}
            {/* Items list with orange "+" icon (Referência visual #6) */}
            <div className="max-h-56 shrink-0 overflow-y-auto space-y-2 pr-1">
              {filteredCatalogItems.map(catalogItem => {
                const countInQuote =
                  items.find(i => i.catalogItemId === catalogItem.id)?.quantity || 0;

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
                        {catalogItem.type==='servico'&&<p className="mt-1 text-[10px] text-sky-300">{catalogItem.sinapiComposition?categoryLabel(catalogItem.sinapiComposition):catalogItem.category||'Especialidade ainda não confirmada no SINAPI'}</p>}
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
