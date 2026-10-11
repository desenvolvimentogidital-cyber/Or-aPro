import React, { useEffect,useRef,useState } from 'react';
import {useAuth} from '../../context/AuthContext';
import {saveOfficialSinapiCosts} from '../../services/sinapiUnitCosts';
import {useSinapiCostLookup} from '../../utils/useSinapiCostLookup';
import {useSinapiLaborOnlyLookup} from '../../utils/useSinapiLaborOnlyLookup';
import {SinapiReferencePicker} from './SinapiReferencePicker';
import type {SinapiComposition} from '../../types/schedule';
import {categoryLabel} from '../../utils/sinapiCategories';
import {withSinapiProvenance} from '../../utils/sinapiRegional';
import {sameServiceUnit} from '../../utils/quoteSchedule';
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
  const { catalog, company, addCatalogItem, updateCatalogItem, deleteCatalogItem } = useApp();
  const { theme } = useTheme();
  const {session}=useAuth();

  const [activeTab, setActiveTab] = useState<'todos' | ItemType>(initialType || 'todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSinapiCosts,setShowSinapiCosts]=useState(false);
  const [sinapiCostUF,setSinapiCostUF]=useState<SinapiUF|''>(
    sinapiUFs.includes(company.state as SinapiUF)?company.state as SinapiUF:'');
  const [sinapiCostRef,setSinapiCostRef]=useState('09/2026');
  const [sinapiCostRegime,setSinapiCostRegime]=useState<SinapiRegime|'ambos'|''>('ambos');
  const [sinapiImportProgress,setSinapiImportProgress]=useState('');
  const [sinapiCostRows,setSinapiCostRows]=useState<SinapiUnitCost[]>([]);
  const [sinapiCostQuery,setSinapiCostQuery]=useState('');
  const [sinapiCostError,setSinapiCostError]=useState('');
  const [savedCostCount,setSavedCostCount]=useState(0);
  const [savingCostFile,setSavingCostFile]=useState(false);
  const [inlinePriceError,setInlinePriceError]=useState('');
  const [inlinePriceProgress,setInlinePriceProgress]=useState('');
  const [costRevision,setCostRevision]=useState(0);
  const salePriceEdited=useRef(false);
  const directCostEdited=useRef(false);
  const [sinapiNeedsSalePrice,setSinapiNeedsSalePrice]=useState(false);
  const [sinapiPricingScope,setSinapiPricingScope]=useState<'complete'|'labor_only'>('complete');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<CatalogItem | null>(null);
  const [selectedSinapi,setSelectedSinapi]=useState<SinapiComposition|null>(null);
  const [showSinapiPicker,setShowSinapiPicker]=useState(false);
  const [sinapiServiceUF,setSinapiServiceUF]=useState<SinapiUF|''>(
    sinapiUFs.includes(company.state as SinapiUF)?company.state as SinapiUF:'');
  const [sinapiServiceRegime,setSinapiServiceRegime]=useState<SinapiRegime|''>('');
  const sinapiLookup=useSinapiCostLookup(selectedSinapi,sinapiServiceUF,
    sinapiServiceRegime,costRevision);
  const laborLookup=useSinapiLaborOnlyLookup(selectedSinapi,sinapiServiceUF,
    sinapiServiceRegime,Boolean(selectedSinapi),costRevision);
  useEffect(()=>{
    const record=sinapiLookup.cost;
    if(sinapiPricingScope!=='complete'||!selectedSinapi||itemToEdit||!record||
       record.code!==selectedSinapi.code||
       record.source.reference!==selectedSinapi.reference||
       record.source.uf!==sinapiServiceUF||
       record.source.regime!==sinapiServiceRegime||
       !sameServiceUnit(record.unit,selectedSinapi.unit))return;
    if(!directCostEdited.current)setCost(String(record.unitCost));
    if(!salePriceEdited.current)setPrice(record.unitCost);
  },[sinapiLookup.cost,selectedSinapi?.code,itemToEdit?.id,
     sinapiServiceUF,sinapiServiceRegime,sinapiPricingScope]);
  useEffect(()=>{
    const estimate=laborLookup.value;
    if(sinapiPricingScope!=='labor_only'||!selectedSinapi||itemToEdit||
      !estimate||estimate.unitCost===null||
      estimate.source.reference!==selectedSinapi.reference||
      estimate.source.uf!==sinapiServiceUF||
      estimate.source.regime!==sinapiServiceRegime)return;
    if(!directCostEdited.current)setCost(String(estimate.unitCost));
    if(!salePriceEdited.current)setPrice(estimate.unitCost);
  },[laborLookup.value,selectedSinapi?.code,itemToEdit?.id,
     sinapiServiceUF,sinapiServiceRegime,sinapiPricingScope]);

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
    setItemToEdit(null);setSinapiNeedsSalePrice(false);setSelectedSinapi(null);
    setSinapiPricingScope('complete');
    setInlinePriceError('');setInlinePriceProgress('');
    salePriceEdited.current=false;directCostEdited.current=false;
    setShowSinapiPicker(defaultType==='servico'||activeTab==='servico');
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
    setSinapiNeedsSalePrice(false);setSelectedSinapi(item.sinapiComposition||null);
    setSinapiPricingScope(item.sinapiPricingScope||'complete');
    setInlinePriceError('');setInlinePriceProgress('');
    salePriceEdited.current=true;directCostEdited.current=true;
    setSinapiServiceUF(item.sinapiComposition?.uf|| (sinapiUFs.includes(company.state as SinapiUF)?company.state as SinapiUF:''));
    setSinapiServiceRegime(item.sinapiComposition?.regime||'');
    setShowSinapiPicker(false);
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
    if (type==='servico' && sinapiNeedsSalePrice && (!Number.isFinite(price)||price<=0)) {window.alert('Informe um preço de VENDA maior que zero. A tabela de HH não contém preços.');return;}
    if (selectedSinapi && (!sinapiServiceUF||!sinapiServiceRegime)) {
      window.alert('Selecione a UF da obra e o regime de encargos para salvar a composição SINAPI.');return;
    }
    let analytical=type==='servico'?(selectedSinapi||undefined):undefined;
    if(analytical && !sameServiceUnit(unit,analytical.unit)){
      window.alert(`A composição SINAPI ${analytical.code} exige a unidade ${analytical.unit}. Não altere a unidade técnica após a seleção.`);return;
    }
    if(analytical)try{analytical=withSinapiProvenance(analytical,{
      reference:analytical.reference||'',uf:sinapiServiceUF as SinapiUF,regime:sinapiServiceRegime as SinapiRegime
    });}catch(err){window.alert(err instanceof Error?err.message:'Referência SINAPI inválida.');return;}
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
        imageUrl: imageUrl || undefined,
        sinapiComposition:type==='servico'?analytical:undefined,
        sinapiPricingScope:type==='servico'&&analytical?sinapiPricingScope:undefined
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
        imageUrl: imageUrl || undefined,
        sinapiComposition:type==='servico'?analytical:undefined,
        sinapiPricingScope:type==='servico'&&analytical?sinapiPricingScope:undefined
      };
      addCatalogItem(newItem);
    }
    setIsModalOpen(false);
  };

  const prepareSinapiReference=(composition:SinapiComposition)=>{
    // Uma mesma composição não deve criar itens iguais repetidamente.
    const known=catalog.find(c=>c.type==='servico' &&
      c.sinapiComposition?.code===composition.code &&
      c.sinapiComposition?.reference===composition.reference);
    if(known)openEditModal(known);
    else {
      setItemToEdit(null);
      setSinapiPricingScope('complete');
      salePriceEdited.current=false;directCostEdited.current=false;
      setName(`SINAPI ${composition.code} · ${composition.description}`);
      setType('servico');
      setUnit(composition.unit);
      setCategory(categoryLabel(composition));
      setPrice(0);
      setCost('');
      setDescription(`Composição analítica SINAPI ${composition.code}, competência ${composition.reference}. Fonte: ${composition.sourceFile}. Coeficientes HH conforme documento; custo e preço comercial não informados.`);
      setImageUrl('');
      setSelectedSinapi(composition);
      setInlinePriceError('');setInlinePriceProgress('');
      setSinapiServiceUF(sinapiUFs.includes(company.state as SinapiUF)?company.state as SinapiUF:'');
      setSinapiServiceRegime('');
      setSinapiNeedsSalePrice(true);
      setShowSinapiPicker(false);
    }
  };

  /** Importa custos da UF/regime do serviço sem sair do cadastro no celular. */
  const importSelectedSinapiPrice=async(file?:File)=>{
    if(!file||savingCostFile)return;
    setInlinePriceError('');setInlinePriceProgress('');
    try {
      if(!selectedSinapi||!sinapiServiceUF||!sinapiServiceRegime)
        throw Error('Selecione UF e encargos antes de importar o XLSX.');
      if(!session)throw Error('Entre na sua conta para salvar os preços da tabela.');
      if(!/\.xlsx$/i.test(file.name)||file.size>35_000_000)
        throw Error('Escolha o arquivo SINAPI Referência 09/2026 em XLSX de até 35 MB.');
      setSavingCostFile(true);
      const {rows}=await importSinapiOfficialCosts(file,{
        reference:selectedSinapi.reference||'',uf:sinapiServiceUF,regime:sinapiServiceRegime
      });
      const total=rows.length;
      const count=await saveOfficialSinapiCosts(session,rows,file.name,(saved)=>{
        setInlinePriceProgress(`Salvando ${saved.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')} custos…`);
      });
      setInlinePriceProgress(`${count.toLocaleString('pt-BR')} custos guardados para ${sinapiServiceUF} e ${sinapiServiceRegime==='com_desoneracao'?'com':'sem'} desoneração.`);
      setSavedCostCount(count);
      setCostRevision(v=>v+1);
    }catch(err){
      setInlinePriceError(err instanceof Error?err.message:'Não foi possível importar os valores SINAPI.');
    }finally{setSavingCostFile(false);}
  };
  const resetRegionalAutoPrice=()=>{
    // O preço da UF anterior não deve ficar na tela quando a referência muda.
    // Valores já editados manualmente continuam intocados.
    if(!salePriceEdited.current)setPrice(0);
    if(!directCostEdited.current)setCost('');
  };
  const clearSinapiWhenChangingKind=()=>{
    // Evitar que um serviço de revestimento se torne material/hora avulsa.
    if(selectedSinapi&&!itemToEdit){
      setName('');setCategory('');setDescription('');setPrice(0);setCost('');
      salePriceEdited.current=false;directCostEdited.current=false;
    }
    setSelectedSinapi(null);setSinapiNeedsSalePrice(false);
    setSinapiPricingScope('complete');
    setShowSinapiPicker(false);
    setInlinePriceError('');setInlinePriceProgress('');
  };
  const readSinapiCostCSV=async(file?:File)=>{
    if(!file||savingCostFile)return;
    setSinapiCostError('');setSinapiCostRows([]);setSavedCostCount(0);
    setSinapiImportProgress('');
    try {
      if(!/\.(csv|xlsx)$/i.test(file.name)||file.size>35_000_000)
        throw Error('Selecione CSV ou SINAPI Referência XLSX de até 35 MB.');
      if(!sinapiCostUF||!sinapiCostRegime)
        throw Error('Selecione UF e encargos antes de importar.');
      if(/\.csv$/i.test(file.name)&&sinapiCostRegime==='ambos')
        throw Error('CSV identifica apenas um regime: selecione com ou sem desoneração.');
      if(!session)throw Error('Entre na sua conta antes de importar preços SINAPI.');
      setSavingCostFile(true);
      const regimes:SinapiRegime[]=sinapiCostRegime==='ambos'
        ?['sem_desoneracao','com_desoneracao']:[sinapiCostRegime];
      let combined:SinapiUnitCost[]=[];
      let savedCount=0,ignored=0;
      for(const regime of regimes){
        const origin={uf:sinapiCostUF,reference:sinapiCostRef,regime};
        setSinapiImportProgress(`Lendo ${regime==='com_desoneracao'?'CCD (com desoneração)':'CSD (sem desoneração)'} da planilha…`);
        let result:{rows:SinapiUnitCost[];ignored:number};
        if(/\\.xlsx$/i.test(file.name))result=await importSinapiOfficialCosts(file,origin);
        else{
          const bytes=new Uint8Array(await file.arrayBuffer());
          let text=new TextDecoder('utf-8').decode(bytes);
          if(text.includes('\uFFFD'))text=new TextDecoder('windows-1252').decode(bytes);
          result=parseSinapiUnitCosts(text,origin);
        }
        ignored+=result.ignored;
        const saved=await saveOfficialSinapiCosts(session,result.rows,file.name,(progress,total)=>{
          setSinapiImportProgress(`Salvando ${regime==='com_desoneracao'?'com':'sem'} desoneração: ${progress.toLocaleString('pt-BR')}/${total.toLocaleString('pt-BR')} custos…`);
        });
        savedCount+=saved;combined=combined.concat(result.rows);
        setSavedCostCount(savedCount);
        setCostRevision(v=>v+1);
      }
      setSinapiCostRows(combined);
      setSinapiImportProgress(`Importação concluída para ${sinapiCostUF}: ${savedCount.toLocaleString('pt-BR')} preços guardados, incluindo custos horários dos profissionais.`);
      if(ignored)setSinapiCostError(`${ignored} registros sem custo foram ignorados; não serão apresentados como valor zero.`);
    }catch(err){
      setSinapiCostError(err instanceof Error?err.message:'Não foi possível ler custos SINAPI.');
    }finally{setSavingCostFile(false);}
  };
  const prepareSinapiItem=(item:SinapiUnitCost)=>{
    openAddModal('servico');
    setName(`${item.code} · ${item.description}`);
    setType('servico');
    setUnit(item.unit);
    setCost(String(item.unitCost));
    setPrice(item.unitCost);
    setCategory(`SINAPI ${item.source.reference} · ${item.source.uf}`);
    setDescription(`Custo unitário de referência importado: ${item.source.reference}, ${item.source.uf}, ${item.source.regime==='com_desoneracao'?'com desoneração':'sem desoneração'}. Informe preço de venda comercial à parte.`);
    setSinapiNeedsSalePrice(false);
    salePriceEdited.current=false;directCostEdited.current=false;
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
          <p className="text-[11px] leading-relaxed text-slate-400">Importe o XLSX oficial uma vez para sua UF. Escolha “Ambos” para carregar CSD e CCD no mesmo envio, incluindo os preços/h dos profissionais. Isso ajuda a preencher os serviços da tabela que ainda não têm custo. Preço de venda continua editável.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><label className="text-[11px] text-slate-400">Competência<input type="text" className="mt-1 w-full rounded-xl border border-white/10 bg-[#090c13] p-2 text-white" maxLength={7} value={sinapiCostRef} onChange={e=>setSinapiCostRef(e.target.value)} placeholder="MM/AAAA"/></label><label className="text-[11px] text-slate-400">UF<select className="mt-1 w-full rounded-xl border border-white/10 bg-[#090c13] p-2 text-white" value={sinapiCostUF} onChange={e=>setSinapiCostUF(e.target.value as SinapiUF|'')}><option value="">Selecione</option>{sinapiUFs.map(uf=><option key={uf} value={uf}>{uf}</option>)}</select></label><label className="text-[11px] text-slate-400">Encargos<select className="mt-1 w-full rounded-xl border border-white/10 bg-[#090c13] p-2 text-white" value={sinapiCostRegime} onChange={e=>setSinapiCostRegime(e.target.value as SinapiRegime|'ambos'|'')}><option value="">Selecione</option><option value="ambos">Ambos (CSD + CCD)</option><option value="sem_desoneracao">Sem desoneração</option><option value="com_desoneracao">Com desoneração</option></select></label></div>
          <label className="block cursor-pointer rounded-xl border border-dashed border-orange-500/40 p-3 text-center text-xs font-semibold text-orange-200">Selecionar XLSX ou CSV de custos<input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={savingCostFile} className="sr-only" onChange={e=>{void readSinapiCostCSV(e.target.files?.[0]);e.target.value='';}}/></label>
          {sinapiImportProgress&&<p role="status" className="text-xs text-sky-200">{sinapiImportProgress}</p>}
          {savingCostFile&&<p role="status" className="text-xs text-sky-200">Processando tabela, aguarde até confirmar a conclusão…</p>}
          {savedCostCount>0&&<p role="status" className="text-xs text-emerald-300">{savedCostCount.toLocaleString('pt-BR')} custos SINAPI salvos na sua conta. Eles serão preenchidos ao selecionar um serviço correspondente.</p>}
          {sinapiCostError&&<p role="alert" className="text-[11px] text-amber-300">{sinapiCostError}</p>}
          {sinapiCostRows.length>0&&<div className="space-y-2"><p className="text-xs text-emerald-300">{sinapiCostRows.length} custos gravados. Escolha uma composição para preencher o cadastro; ajuste o custo e o preço de venda conforme necessário.</p><input className="w-full rounded-lg border border-white/10 bg-[#090c13] p-2 text-xs text-white" value={sinapiCostQuery} onChange={e=>setSinapiCostQuery(e.target.value)} placeholder="Buscar código ou descrição"/>
            <div className="max-h-60 space-y-2 overflow-y-auto">{sinapiCostRows.filter(v=>`${v.code} ${v.description}`.toLowerCase().includes(sinapiCostQuery.toLowerCase())).slice(0,40).map(item=><button type="button" key={`${item.code}|${item.unit}|${item.source.regime}`} onClick={()=>prepareSinapiItem(item)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-2 text-left text-[11px] text-slate-200"><span className="min-w-0 flex-1 truncate">{item.code} · {item.description} ({item.unit}) — {item.source.regime==='com_desoneracao'?'com':'sem'} desoneração</span><span className="shrink-0 text-orange-200">Custo {formatCurrency(item.unitCost)}</span></button>)}</div>
          </div>}
        </>}
      </section>
      {(activeTab==='servico'||activeTab==='todos')&&
        <div className="rounded-2xl border border-sky-500/25 p-3">
          <p className="text-xs text-slate-200">Para incluir qualquer serviço da tabela SINAPI, abra o cadastro e escolha a composição analítica. Os serviços já cadastrados continuam aparecendo abaixo.</p>
          <button type="button" onClick={()=>openAddModal('servico')} className="mt-2 min-h-11 w-full rounded-lg bg-sky-700 px-3 text-xs font-bold text-white">
            <Plus size={14} className="mr-2 inline"/> Adicionar serviço da tabela SINAPI
          </button>
        </div>}
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
          <div className="bg-[#141822] border border-white/10 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-5 shadow-2xl animate-in zoom-in-95">
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
              {type==='servico'&&<div className="space-y-2">
                <button type="button" onClick={()=>setShowSinapiPicker(v=>!v)}
                  className="min-h-11 w-full rounded-lg border border-sky-500/35 bg-sky-500/10 p-3 text-left text-xs font-semibold text-sky-200">
                  {showSinapiPicker?'Ocultar busca SINAPI':'Pesquisar todos os serviços SINAPI'}
                </button>
                {showSinapiPicker&&<SinapiReferencePicker onSelect={prepareSinapiReference}/>}
                {selectedSinapi&&<div className="space-y-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                  <strong className="text-xs text-emerald-200">SINAPI {selectedSinapi.code} · {categoryLabel(selectedSinapi)}</strong>
                  <p className="text-[11px] text-slate-300">{selectedSinapi.description}</p>
                  <p className="text-[11px] text-emerald-200">Coeficientes: {selectedSinapi.labor.map(l=>`${l.role}: ${l.hoursPerUnit.toLocaleString('pt-BR',{maximumFractionDigits:5})} HH/${selectedSinapi.unit}`).join(' · ')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] text-slate-300">UF da obra
                      <select required aria-label="UF para o serviço SINAPI" value={sinapiServiceUF}
                        onChange={e=>{resetRegionalAutoPrice();setSinapiServiceUF(e.target.value as SinapiUF|'');}}
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b101a] p-2 text-white">
                        <option value="">Selecione</option>{sinapiUFs.map(uf=><option key={uf} value={uf}>{uf}</option>)}
                      </select>
                    </label>
                    <label className="text-[11px] text-slate-300">Encargos declarados
                      <select required aria-label="Encargos para o serviço SINAPI" value={sinapiServiceRegime}
                        onChange={e=>{resetRegionalAutoPrice();setSinapiServiceRegime(e.target.value as SinapiRegime|'');}}
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b101a] p-2 text-white">
                        <option value="">Selecione</option><option value="sem_desoneracao">Sem desoneração</option><option value="com_desoneracao">Com desoneração</option>
                      </select>
                    </label>
                  </div>
                  <div className="space-y-2 rounded-xl border border-white/10 bg-black/15 p-2.5">
                    <p className="text-xs font-semibold text-slate-200">O que você vai fornecer?</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" aria-pressed={sinapiPricingScope==='complete'}
                        onClick={()=>{if(sinapiPricingScope==='complete')return;
                          if(itemToEdit)setItemToEdit(null);
                          setSinapiPricingScope('complete');
                          salePriceEdited.current=false;directCostEdited.current=false;
                          setPrice(0);setCost('');
                          setName(`SINAPI ${selectedSinapi.code} · ${selectedSinapi.description}`);
                        }}
                        className={`min-h-11 rounded-lg border px-2 text-[11px] font-semibold ${sinapiPricingScope==='complete'?'border-orange-400 bg-orange-500/20 text-orange-100':'border-white/15 text-slate-300'}`}>
                        Serviço completo
                      </button>
                      <button type="button" aria-pressed={sinapiPricingScope==='labor_only'}
                        onClick={()=>{if(sinapiPricingScope==='labor_only')return;
                          if(itemToEdit)setItemToEdit(null);
                          setSinapiPricingScope('labor_only');
                          salePriceEdited.current=false;directCostEdited.current=false;
                          // Custos H já consultados enquanto a modalidade completa estava visível:
                          // preencher imediatamente e evitar campos vazios até o próximo efeito.
                          const current=laborLookup.status==='ready'&&
                            laborLookup.value?.source.uf===sinapiServiceUF&&
                            laborLookup.value?.source.regime===sinapiServiceRegime
                            ?laborLookup.value.unitCost:null;
                          setPrice(current??0);setCost(current===null?'':String(current));
                          setName(`SINAPI ${selectedSinapi.code} · Mão de obra · ${selectedSinapi.description}`);
                        }}
                        className={`min-h-11 rounded-lg border px-2 text-[11px] font-semibold ${sinapiPricingScope==='labor_only'?'border-orange-400 bg-orange-500/20 text-orange-100':'border-white/15 text-slate-300'}`}>
                        Somente mão de obra
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">{sinapiPricingScope==='labor_only'?
                      'Material fornecido pelo cliente. O serviço permanece vinculado ao SINAPI e às HH do cronograma.':'Incluir material e execução no preço da composição completa.'}</p>
                  </div>
                  {sinapiPricingScope==='labor_only'&&<>
                    {laborLookup.status==='loading'&&<p role="status" className="text-[11px] text-sky-200">Consultando custos/h dos profissionais…</p>}
                    {laborLookup.value&&<div className="space-y-1 text-[11px] text-slate-200">
                      {laborLookup.value.workers.map(w=><div key={w.code+':'+w.role} className="flex justify-between gap-2">
                        <span className="min-w-0">{w.role}: {w.hoursPerUnit.toLocaleString('pt-BR',{maximumFractionDigits:5})} HH</span>
                        <span className="shrink-0">{w.subtotal===null?'Sem preço/h':formatCurrency(w.subtotal)}</span>
                      </div>)}
                    </div>}
                    {laborLookup.status==='ready'&&<p role="status" className="text-[11px] text-emerald-200">Mão de obra estimada: {formatCurrency(laborLookup.value!.unitCost!)}/{selectedSinapi.unit}. Sem materiais do serviço; valor de venda editável.</p>}
                    {laborLookup.status==='missing'&&<p className="text-[11px] text-amber-200">Alguns profissionais não têm preço/h publicado nesta UF. Importe custos CSD/CCD ou informe o valor da sua mão de obra manualmente. Não será somado material.</p>}
                    {laborLookup.status==='error'&&<p role="alert" className="text-[11px] text-rose-200">{laborLookup.error}</p>}
                    <p className="text-[10px] text-amber-200">Custo estimado por HH × custo/h dos profissionais com encargos; não é uma separação oficial completa de materiais e equipamentos.</p>
                  </>}
                  {sinapiPricingScope==='complete'&&<>
                  {sinapiLookup.status==='loading'&&<p className="text-[11px] text-sky-200">Consultando custo regional SINAPI…</p>}
                  {sinapiLookup.status==='found'&&<p role="status" className="text-[11px] text-emerald-200">
                    Custo importado: {formatCurrency(sinapiLookup.cost!.unitCost)}/{selectedSinapi.unit},
                    {sinapiLookup.cost!.source.uf}, {sinapiLookup.cost!.source.reference},
                    {sinapiLookup.cost!.source.regime==='com_desoneracao'?'com':'sem'} desoneração.
                    Sugestão de venda igual ao custo, editável.
                  </p>}
                  {sinapiLookup.status==='missing'&&<p className="text-[11px] text-amber-200">
                    Sem preço para este código, UF e encargos. Importe aqui o arquivo XLSX SINAPI Referência ou informe o valor manualmente.
                  </p>}
                  {sinapiLookup.status==='error'&&<p role="alert" className="text-[11px] text-rose-200">{sinapiLookup.error}</p>}
                  {(sinapiLookup.status==='missing'||sinapiLookup.status==='error')&&
                    <label className="block rounded-xl border border-dashed border-amber-400/40 bg-amber-500/5 p-3 text-[11px] font-semibold text-amber-100">
                      <span className="block">Importar preço oficial aqui (XLSX CSD/CCD)</span>
                      <span className="mt-1 block text-[10px] font-normal text-slate-300">Usa {sinapiServiceUF||'UF pendente'} · {sinapiServiceRegime==='com_desoneracao'?'com desoneração':sinapiServiceRegime==='sem_desoneracao'?'sem desoneração':'regime pendente'} · {selectedSinapi.reference}.</span>
                      <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        disabled={savingCostFile||!sinapiServiceUF||!sinapiServiceRegime}
                        className="mt-2 block w-full max-w-full text-[10px] text-slate-200 file:mr-2 file:rounded-md file:border-0 file:bg-amber-500 file:px-2 file:py-2 file:font-semibold file:text-[#18130a]"
                        onChange={e=>{void importSelectedSinapiPrice(e.target.files?.[0]);e.target.value='';}}/>
                    </label>}
                  {inlinePriceProgress&&<p role="status" className="text-[11px] text-sky-200">{inlinePriceProgress}</p>}
                  {inlinePriceError&&<p role="alert" className="text-[11px] text-rose-200">{inlinePriceError}</p>}
                  </>}
                  {sinapiPricingScope==='complete'&&sinapiLookup.cost&&laborLookup.value?.unitCost!==null&&laborLookup.status==='ready'&&
                    <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 p-2 text-[11px] text-slate-200">
                      <div className="flex justify-between gap-2"><span>Composição completa</span><strong>{formatCurrency(sinapiLookup.cost.unitCost)}</strong></div>
                      <div className="flex justify-between gap-2"><span>Mão de obra estimada por HH</span><strong>{formatCurrency(laborLookup.value!.unitCost!)}</strong></div>
                      {sinapiLookup.cost.unitCost>=laborLookup.value!.unitCost!&&<div className="flex justify-between gap-2"><span>Demais custos (materiais/equipamentos/outros)</span><strong>{formatCurrency(Math.round((sinapiLookup.cost.unitCost-laborLookup.value!.unitCost!)*100)/100)}</strong></div>}
                      <p className="mt-1 text-slate-400">Estimativa de decomposição, não uma discriminação oficial exata dos materiais.</p>
                    </div>}
                  {sinapiPricingScope==='complete'&&sinapiLookup.status==='missing'&&laborLookup.status==='ready'&&<p className="text-[11px] text-sky-200">Não há custo completo, mas a mão de obra tem referência de {formatCurrency(laborLookup.value!.unitCost!)}. Se o cliente fornece material, escolha “Somente mão de obra”.</p>}
                  <p className="text-[10px] text-amber-200">O custo de referência não contém margem ou BDI comercial. Confira e altere os valores livremente.</p>
                </div>}
              </div>}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Tipo de Cadastro *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      clearSinapiWhenChangingKind();setType('material');
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
                      if(type!=='servico')setUnit('serviço');
                      setShowSinapiPicker(true);
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
                      clearSinapiWhenChangingKind();setType('mao_de_obra');
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
                    onCommit={value=>{salePriceEdited.current=true;setPrice(value);}}
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
                    onChange={e => {directCostEdited.current=true;setCost(e.target.value);}}
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
