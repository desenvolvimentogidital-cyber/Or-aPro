import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { Plus, Search, Wrench, Boxes, Briefcase, Trash2, Edit3, X, Zap } from 'lucide-react';
import { CatalogItem, ItemType, LaborType } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { newId } from '../../utils/quoteMath';
import { preparePhoto } from '../../utils/imageUpload';
import {parseSinapiUnitCosts, type SinapiUnitCost} from '../../utils/sinapiCosts';
import {importSinapiOfficialCosts} from '../../utils/sinapiFile';
import {sinapiUFs,type SinapiUF,type SinapiRegime} from '../../utils/sinapiRegional';
import { usableSinapiComposition } from '../../utils/catalogSinapi';
import { EditableNumericInput } from '../common/EditableNumericInput';

interface CatalogViewProps {
  initialType?: ItemType;
}

export const CatalogView: React.FC<CatalogViewProps> = ({ initialType }) => {
  const { catalog, addCatalogItem, updateCatalogItem, deleteCatalogItem } = useApp();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<'todos' | ItemType>(initialType || 'todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSinapiCosts,setShowSinapiCosts]=useState(false);
  const [sinapiCostUF,setSinapiCostUF]=useState<SinapiUF|''>('');
  const [sinapiCostRef,setSinapiCostRef]=useState('');
  const [sinapiCostRegime,setSinapiCostRegime]=useState<SinapiRegime|''>('');
  const [sinapiCostRows,setSinapiCostRows]=useState<SinapiUnitCost[]>([]);
  const [sinapiCostQuery,setSinapiCostQuery]=useState('');
  const [sinapiCostError,setSinapiCostError]=useState('');
  const [sinapiNeedsSalePrice,setSinapiNeedsSalePrice]=useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<CatalogItem | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<ItemType>('material');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [cost, setCost] = useState<string>('');
  const [unit, setUnit] = useState('un');
  const [laborType, setLaborType] = useState<LaborType>('servico');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageError, setImageError] = useState('');
  const uploadPhoto = async (file?: File) => {
    if (!file) return;
    setImageError('');
    try { const value = await preparePhoto(file, 420); setImageUrl(value); }
    catch (e) { setImageError(e instanceof Error ? e.message : 'Falha ao carregar imagem.'); }
  };

  const filteredItems = catalog.filter(item => {
    if (activeTab !== 'todos' && item.type !== activeTab) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const openAddModal = (defaultType?: ItemType) => {
    setItemToEdit(null);setSinapiNeedsSalePrice(false);
    setName('');
    setType(defaultType || (activeTab === 'todos' ? 'material' : activeTab));
    setCategory('');
    setPrice(0);
    setCost('');
    setUnit(defaultType === 'servico' ? 'serviço' : defaultType === 'mao_de_obra' ? 'hora' : 'un');
    setLaborType('servico');
    setDescription('');
    setImageUrl(''); setImageError('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: CatalogItem) => {
    setSinapiNeedsSalePrice(false);
    setItemToEdit(item);
    setName(item.name);
    setType(item.type);
    setCategory(item.category);
    setPrice(item.price);
    setCost(item.cost === undefined || item.cost === null ? '' : String(item.cost));
    setUnit(item.unit);
    setLaborType(item.laborType || 'servico');
    setDescription(item.description || '');
    setImageUrl(item.imageUrl || ''); setImageError('');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (sinapiNeedsSalePrice && (!Number.isFinite(price)||price<=0)) {window.alert('Defina um preço de VENDA maior que zero. O valor SINAPI importado é apenas o custo de referência.');return;}
    if (cost.trim() !== '' && (!Number.isFinite(Number(cost.trim().replace(',','.'))) || Number(cost.trim().replace(',','.')) < 0)) { window.alert('Informe um custo válido ou deixe o campo em branco.'); return; }
    const confirmedCost = cost.trim() !== '';

    if (itemToEdit) {
      updateCatalogItem({
        ...itemToEdit,
        name: name.trim(),
        type,
        category: category.trim() || 'Geral',
        price: Number(price) || 0,
        cost: confirmedCost ? Number(cost.trim().replace(',','.')) : undefined,
        costConfirmed: confirmedCost,
        unit,
        laborType: type === 'mao_de_obra' ? laborType : undefined,
        description: description.trim(),
        imageUrl: imageUrl || undefined
      });
    } else {
      const newItem: CatalogItem = {
        id: newId('cat'),
        name: name.trim(),
        type,
        category: category.trim() || 'Geral',
        price: Number(price) || 0,
        cost: confirmedCost ? Number(cost.trim().replace(',','.')) : undefined,
        costConfirmed: confirmedCost,
        unit,
        laborType: type === 'mao_de_obra' ? laborType : undefined,
        description: description.trim(),
        imageUrl: imageUrl || undefined
      };
      addCatalogItem(newItem);
    }
    setIsModalOpen(false);
  };

  const readSinapiCostCSV=async(file?:File)=>{
    if(!file)return;
    setSinapiCostError('');setSinapiCostRows([]);
    try {
      if(!/\.(csv|xlsx)$/i.test(file.name)||file.size>35_000_000)throw Error('Selecione CSV ou SINAPI Referência XLSX de até 35 MB.');
      if(!sinapiCostUF||!sinapiCostRegime)throw Error('Selecione UF e encargos antes de importar.');
      const origin={uf:sinapiCostUF,reference:sinapiCostRef,regime:sinapiCostRegime};
      let result;
      if(/\.xlsx$/i.test(file.name))result=await importSinapiOfficialCosts(file,origin);
      else {
        const bytes=new Uint8Array(await file.arrayBuffer());
        let text=new TextDecoder('utf-8').decode(bytes);
        if(text.includes('\uFFFD'))text=new TextDecoder('windows-1252').decode(bytes);
        result=parseSinapiUnitCosts(text,origin);
      }
      setSinapiCostRows(result.rows);
      if(result.ignored)setSinapiCostError(`${result.ignored} linha(s) ignoradas por dados incompletos. Confira a fonte.`);
    }catch(err){setSinapiCostError(err instanceof Error?err.message:'Não foi possível ler custos SINAPI.');}
  };
  const prepareSinapiItem=(item:SinapiUnitCost)=>{
    openAddModal('servico');
    setName(`${item.code} · ${item.description}`);
    setType('servico');
    setUnit(item.unit);
    setCost(String(item.unitCost));
    setPrice(0);
    setCategory(`SINAPI ${item.source.reference} · ${item.source.uf}`);
    setDescription(`Custo unitário de referência importado: ${item.source.reference}, ${item.source.uf}, ${item.source.regime==='com_desoneracao'?'com desoneração':'sem desoneração'}. Informe preço de venda comercial à parte.`);
    setSinapiNeedsSalePrice(true);
  };
  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Catálogo de Itens</h1>
          <p className="text-xs text-slate-400">Serviços, materiais e mão de obra</p>
        </div>
        <button
          onClick={() => openAddModal()}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md active:scale-95 transition-all"
          style={{ background: theme.primaryGradient || 'linear-gradient(135deg, #ffa114 0%, #ff6b00 50%, #ff3b00 100%)' }}
          title="Novo Item"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      <section className="rounded-2xl border border-orange-500/20 bg-[#141822] p-3 space-y-3">
        <button type="button" className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold text-orange-200" onClick={()=>setShowSinapiCosts(v=>!v)} aria-expanded={showSinapiCosts}>Custos SINAPI — importar XLSX oficial ou CSV <span>{showSinapiCosts?'▴':'▾'}</span></button>
        {showSinapiCosts&&<>
          <p className="text-[11px] leading-relaxed text-slate-400">Importe diretamente SINAPI Referência XLSX (aba CSD sem desoneração ou CCD com desoneração), ou CSV estruturado com Código composição, Descrição, Unidade e Custo unitário. A competência e o regime devem coincidir com a planilha. Custo SINAPI NÃO substitui preço de venda.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><label className="text-[11px] text-slate-400">Competência<input type="text" className="mt-1 w-full rounded-xl border border-white/10 bg-[#090c13] p-2 text-white" maxLength={7} value={sinapiCostRef} onChange={e=>setSinapiCostRef(e.target.value)} placeholder="MM/AAAA"/></label><label className="text-[11px] text-slate-400">UF<select className="mt-1 w-full rounded-xl border border-white/10 bg-[#090c13] p-2 text-white" value={sinapiCostUF} onChange={e=>setSinapiCostUF(e.target.value as SinapiUF|'')}><option value="">Selecione</option>{sinapiUFs.map(uf=><option key={uf} value={uf}>{uf}</option>)}</select></label><label className="text-[11px] text-slate-400">Encargos<select className="mt-1 w-full rounded-xl border border-white/10 bg-[#090c13] p-2 text-white" value={sinapiCostRegime} onChange={e=>setSinapiCostRegime(e.target.value as SinapiRegime|'')}><option value="">Selecione</option><option value="sem_desoneracao">Sem desoneração</option><option value="com_desoneracao">Com desoneração</option></select></label></div>
          <label className="block cursor-pointer rounded-xl border border-dashed border-orange-500/40 p-3 text-center text-xs font-semibold text-orange-200">Selecionar XLSX ou CSV de custos<input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={e=>{void readSinapiCostCSV(e.target.files?.[0]);e.target.value='';}}/></label>
          {sinapiCostError&&<p role="alert" className="text-[11px] text-amber-300">{sinapiCostError}</p>}
          {sinapiCostRows.length>0&&<div className="space-y-2"><p className="text-xs text-emerald-300">{sinapiCostRows.length} custos válidos carregados apenas nesta sessão. Escolha uma composição para preencher o cadastro e informe o preço de venda.</p><input className="w-full rounded-lg border border-white/10 bg-[#090c13] p-2 text-xs text-white" value={sinapiCostQuery} onChange={e=>setSinapiCostQuery(e.target.value)} placeholder="Buscar código ou descrição"/>
            <div className="max-h-60 space-y-2 overflow-y-auto">{sinapiCostRows.filter(v=>`${v.code} ${v.description}`.toLowerCase().includes(sinapiCostQuery.toLowerCase())).slice(0,40).map(item=><button type="button" key={`${item.code}|${item.unit}`} onClick={()=>prepareSinapiItem(item)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-2 text-left text-[11px] text-slate-200"><span className="min-w-0 flex-1 truncate">{item.code} · {item.description} ({item.unit})</span><span className="shrink-0 text-orange-200">Custo {formatCurrency(item.unitCost)}</span></button>)}</div>
          </div>}
        </>}
      </section>
      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Buscar no catálogo..."
          className="w-full bg-[#141822] text-sm text-white placeholder-slate-500 pl-10 pr-4 py-2.5 rounded-2xl border border-white/5 focus:outline-none focus:border-white/20 transition-colors"
        />
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-[#141822] border border-white/5 text-xs font-semibold text-center">
        <button
          onClick={() => setActiveTab('todos')}
          className={`py-2 rounded-xl transition-all ${
            activeTab === 'todos' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
          style={activeTab === 'todos' ? { background: theme.primaryGradient } : {}}
        >
          Todos
        </button>
        <button
          onClick={() => setActiveTab('material')}
          className={`py-2 rounded-xl transition-all ${
            activeTab === 'material' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
          style={activeTab === 'material' ? { background: theme.primaryGradient } : {}}
        >
          Materiais
        </button>
        <button
          onClick={() => setActiveTab('servico')}
          className={`py-2 rounded-xl transition-all ${
            activeTab === 'servico' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
          style={activeTab === 'servico' ? { background: theme.primaryGradient } : {}}
        >
          Serviços
        </button>
        <button
          onClick={() => setActiveTab('mao_de_obra')}
          className={`py-2 rounded-xl transition-all ${
            activeTab === 'mao_de_obra' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
          style={activeTab === 'mao_de_obra' ? { background: theme.primaryGradient } : {}}
        >
          Mão de Obra
        </button>
      </div>

      {/* Items List */}
      <div className="space-y-2.5">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-[#141822] rounded-2xl border border-white/5 p-6">
            <p className="text-sm text-slate-400 font-medium">Nenhum item encontrado no catálogo</p>
            <button
              onClick={() => openAddModal()}
              className="mt-3 text-xs font-semibold px-4 py-2 rounded-xl text-white inline-block shadow-md"
              style={{ backgroundColor: theme.primaryColor }}
            >
              + Adicionar Item
            </button>
          </div>
        ) : (
          filteredItems.map(item => {
            const icon =
              item.type === 'servico' ? (
                <Wrench className="w-4 h-4 text-sky-400" />
              ) : item.type === 'mao_de_obra' ? (
                <Briefcase className="w-4 h-4 text-purple-400" />
              ) : (
                <Boxes className="w-4 h-4 text-amber-400" />
              );

            const typeLabel =
              item.type === 'servico'
                ? 'Serviço'
                : item.type === 'mao_de_obra'
                ? 'Mão de Obra'
                : 'Material';

            return (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-[#141822] border border-white/5 hover:border-white/10 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                    {item.imageUrl ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" /> : icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-white truncate">{item.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                      <span>{typeLabel}</span>
                      <span>•</span>
                      <span className="text-slate-500">{item.category}</span>
                    </div>
                    {item.type==='servico' && usableSinapiComposition(item.sinapiComposition) &&
                      <span className="mt-1 inline-flex rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">✓ SINAPI {item.sinapiComposition.code} · {item.sinapiComposition.reference}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <div className="text-right">
                    <span className="text-xs font-bold text-white block">
                      {formatCurrency(item.price)}
                    </span>
                    <span className="text-[10px] text-slate-500">por {item.unit}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(item)}
                      aria-label={`Editar ${item.name}`}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { if (window.confirm('Excluir este item do catálogo? Esta ação pode ser irreversível.')) deleteCatalogItem(item.id); }}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Add / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#141822] border border-white/10 rounded-2xl w-full max-w-md p-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">
                {itemToEdit ? 'Editar Item' : 'Novo Item no Catálogo'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Tipo de Cadastro *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setType('material');
                      setUnit('un');
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold transition-all ${
                      type === 'material' ? 'text-white shadow-sm' : 'bg-[#1b202c] text-slate-400'
                    }`}
                    style={type === 'material' ? { background: theme.primaryGradient } : {}}
                  >
                    Material
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setType('servico');
                      setUnit('serviço');
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold transition-all ${
                      type === 'servico' ? 'text-white shadow-sm' : 'bg-[#1b202c] text-slate-400'
                    }`}
                    style={type === 'servico' ? { background: theme.primaryGradient } : {}}
                  >
                    Serviço
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setType('mao_de_obra');
                      setUnit('hora');
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold transition-all ${
                      type === 'mao_de_obra' ? 'text-white shadow-sm' : 'bg-[#1b202c] text-slate-400'
                    }`}
                    style={type === 'mao_de_obra' ? { background: theme.primaryGradient } : {}}
                  >
                    Mão de Obra
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Nome do Item *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Disjuntor DIN 32A ou Troca de Fiação"
                  className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="Ex: Proteção, Iluminação"
                    className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Unidade de Medida
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    placeholder="un, m², m³, hora ou serviço"
                    className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>
              {type==='servico' && <p className="text-[11px] leading-relaxed text-slate-400">Para relacionar o serviço ao SINAPI no cronograma, informe a unidade real (ex.: un, m², m³). Se manter “serviço”, o cronograma pedirá a quantidade na unidade oficial antes de criar a etapa, sem vincular valores automaticamente.</p>}

              {type === 'mao_de_obra' && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Modalidade de Cobrança da Mão de Obra
                  </label>
                  <select
                    value={laborType}
                    onChange={e => setLaborType(e.target.value as LaborType)}
                    className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-white/30"
                  >
                    <option value="hora">Por Hora</option>
                    <option value="diaria">Por Diária</option>
                    <option value="unidade">Por Unidade</option>
                    <option value="servico">Por Serviço</option>
                    <option value="fixo">Valor Fixo</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Preço de Venda (R$) *
                  </label>
                  <EditableNumericInput
                    min={0} required
                    value={price} emptyAsBlank
                    onCommit={setPrice}
                    placeholder="0.00"
                    className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-white/30 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Custo direto do item (R$)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cost}
                    onChange={e => setCost(e.target.value)}
                    placeholder="Deixe vazio se desconhecido"
                    className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-white/30 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1b202c] border border-white/10">
                {imageUrl ? <img src={imageUrl} alt="Foto cadastrada do item" className="w-16 h-14 object-contain rounded-lg bg-[#080f1a]" /> : <div className="w-16 h-14 rounded-lg border border-dashed border-white/10 flex items-center justify-center text-[10px] text-slate-500">Sem foto</div>}
                <div className="flex-1 min-w-0">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Foto real do produto/serviço no PDF (opcional)</label>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { void uploadPhoto(e.target.files?.[0]); e.target.value = ''; }} className="w-full text-[10px] text-slate-300" />
                  {imageUrl && <button type="button" onClick={() => setImageUrl('')} className="text-[10px] text-orange-300 underline mt-1">Remover foto</button>}
                  {imageError && <p role="alert" className="text-xs text-red-400">{imageError}</p>}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Descrição ou Observações
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Detalhes técnicos, norma ou garantia"
                  className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2 rounded-xl border border-white/10 focus:outline-none focus:border-white/30 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all active:scale-95"
                  style={{ background: theme.primaryGradient || 'linear-gradient(135deg, #ffa114 0%, #ff6b00 50%, #ff3b00 100%)' }}
                >
                  {itemToEdit ? 'Atualizar Item' : 'Adicionar ao Catálogo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
