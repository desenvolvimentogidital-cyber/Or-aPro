import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { ArrowLeft, Check, LayoutTemplate, Sparkles, FileText } from 'lucide-react';

export const QuoteModelsView: React.FC = () => {
  const { setActiveView, quotes, updateQuote, setActiveQuoteForPreview } = useApp();
  const { theme } = useTheme();

  const [activeCategory, setActiveCategory] = useState<'todos' | 'residencial' | 'comercial' | 'industrial'>('todos');
  const [selectedTemplate, setSelectedTemplate] = useState<'padrao' | 'moderno' | 'profissional' | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');

  const models = [
    {
      id: 'padrao' as const,
      name: 'Modelo Padrão',
      tagline: 'PDF oficial inspirado na referência preto e laranja',
      category: 'residencial',
      previewDark: true,
      features: ['Tema escuro com realce laranja', 'Dados e fotos reais', 'Quebra automática de páginas A4']
    },
    {
      id: 'moderno' as const,
      name: 'Modelo Moderno',
      tagline: 'Mesmo PDF, com acentos em azul-ciano',
      category: 'comercial',
      previewDark: true,
      features: ['Acentos em ciano', 'Mesmas tabelas e valores reais', 'Paginação A4']
    },
    {
      id: 'profissional' as const,
      name: 'Modelo Profissional',
      tagline: 'Mesmo PDF, com detalhes em dourado suave',
      category: 'industrial',
      previewDark: true,
      features: ['Dourado suave', 'Identificação e campos de assinatura', 'Paginação A4']
    }
  ];

  const handleApplyModel = (modelId: 'padrao' | 'moderno' | 'profissional') => {
    setSelectedTemplate(modelId);
  };
  const applyToQuote = () => {
    const quote = quotes.find(q => q.id === selectedQuoteId);
    if (!quote || !selectedTemplate) return;
    const modified = { ...quote, modelTemplate: selectedTemplate };
    updateQuote(modified);
    setActiveQuoteForPreview(modified);
    setSelectedTemplate(null);
  };

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={() => setActiveView('dashboard')}
          className="p-1.5 rounded-xl bg-[#141822] text-slate-400 hover:text-white border border-white/5"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-white tracking-tight">Modelos de Orçamento</h1>
        <div className="w-8" />
      </div>

      {/* Tabs (Referência visual #7: Todos, Residencial, Comercial, Industrial) */}
      <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-[#141822] border border-white/5 text-xs font-semibold text-center">
        <button
          onClick={() => setActiveCategory('todos')}
          className={`py-2 rounded-xl transition-all ${
            activeCategory === 'todos' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
          style={activeCategory === 'todos' ? { background: theme.primaryGradient } : {}}
        >
          Todos
        </button>
        <button
          onClick={() => setActiveCategory('residencial')}
          className={`py-2 rounded-xl transition-all ${
            activeCategory === 'residencial' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
          style={activeCategory === 'residencial' ? { background: theme.primaryGradient } : {}}
        >
          Residencial
        </button>
        <button
          onClick={() => setActiveCategory('comercial')}
          className={`py-2 rounded-xl transition-all ${
            activeCategory === 'comercial' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
          style={activeCategory === 'comercial' ? { background: theme.primaryGradient } : {}}
        >
          Comercial
        </button>
        <button
          onClick={() => setActiveCategory('industrial')}
          className={`py-2 rounded-xl transition-all ${
            activeCategory === 'industrial' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
          style={activeCategory === 'industrial' ? { background: theme.primaryGradient } : {}}
        >
          Industrial
        </button>
      </div>

      {selectedTemplate && <section className="p-4 rounded-2xl bg-[#141822] border border-orange-500/30 space-y-3" role="region" aria-label="Aplicar modelo ao orçamento">
        <h2 className="text-sm font-bold">Aplicar modelo a um orçamento real</h2>
        <p className="text-xs text-slate-400">Selecione o orçamento que receberá o novo modelo. Nenhum outro orçamento será alterado.</p>
        <select value={selectedQuoteId} onChange={e => setSelectedQuoteId(e.target.value)} className="w-full bg-[#0c0e14] rounded-xl border border-white/20 p-3 text-sm text-white">
          <option value="">Escolha um orçamento cadastrado</option>
          {quotes.map(q => <option value={q.id} key={q.id}>{q.number} · {q.clientName}</option>)}
        </select>
        <div className="flex gap-2"><button disabled={!selectedQuoteId} onClick={applyToQuote} className="bg-orange-600 disabled:opacity-40 text-white rounded-xl p-3 text-xs font-bold">Aplicar e visualizar</button><button onClick={() => setSelectedTemplate(null)} className="text-xs text-slate-300 px-3">Cancelar</button></div>
        {quotes.length === 0 && <p className="text-xs text-amber-400">Crie um orçamento para aplicar um modelo.</p>}
      </section>}
      {/* Models List (visual themes; not fictitious quotes) */}
      <div className="space-y-4">
        {models
          .filter(m => activeCategory === 'todos' || m.category === activeCategory)
          .map(model => (
            <div
              key={model.id}
              className="p-4 rounded-2xl bg-[#141822] border border-white/5 hover:border-white/10 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
            >
              {/* Miniature Thumbnail */}
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-16 h-20 rounded-xl border flex flex-col justify-between p-2 shadow-inner shrink-0 ${
                    model.previewDark
                      ? 'bg-[#0a0c10] border-white/10'
                      : 'bg-slate-100 border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: theme.primaryColor }}
                    />
                    <div
                      className={`w-6 h-1 rounded ${
                        model.previewDark ? 'bg-white/20' : 'bg-slate-300'
                      }`}
                    />
                  </div>
                  <div className="space-y-1">
                    <div
                      className={`w-full h-1 rounded ${
                        model.previewDark ? 'bg-white/10' : 'bg-slate-300'
                      }`}
                    />
                    <div
                      className={`w-3/4 h-1 rounded ${
                        model.previewDark ? 'bg-white/10' : 'bg-slate-300'
                      }`}
                    />
                  </div>
                  <div
                    className="w-8 h-1 rounded"
                    style={{ backgroundColor: theme.primaryColor }}
                  />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{model.name}</span>
                    {selectedTemplate === model.id && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-semibold">
                        Selecionado para aplicar
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{model.tagline}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {model.features.map((f, i) => (
                      <span
                        key={i}
                        className="text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded-md"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button: Usar */}
              <div className="shrink-0 flex items-center justify-end">
                <button
                  onClick={() => handleApplyModel(model.id)}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all active:scale-95"
                  style={{
                    background: theme.primaryGradient || 'linear-gradient(135deg, #ffa114 0%, #ff6b00 50%, #ff3b00 100%)',
                    boxShadow: `0 4px 16px -2px ${theme.primaryColor}77`
                  }}
                >
                  Selecionar
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
