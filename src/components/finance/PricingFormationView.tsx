import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import {
  DollarSign,
  Calculator,
  Plus,
  Trash2,
  TrendingUp,
  Clock,
  Calendar,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Percent
} from 'lucide-react';
import { MonthlyExpense } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { pricingEstimate, newId } from '../../utils/quoteMath';
import { calculateBdi, type BdiRates } from '../../utils/bdi';

export const PricingFormationView: React.FC = () => {
  const { expenses, addExpense, deleteExpense } = useApp();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<'custos-mensais' | 'calculadora-bdi' | 'bdi-analitico'>('custos-mensais');

  // Form for new monthly expense
  const [newExpName, setNewExpName] = useState('');
  const [newExpAmount, setNewExpAmount] = useState<number>(0);
  const [newExpCategory, setNewExpCategory] = useState('Fixo');

  // Pricing & BDI Calculator States
  const [workHoursPerMonth, setWorkHoursPerMonth] = useState<number>(0);
  const [workDaysPerMonth, setWorkDaysPerMonth] = useState<number>(0);
  const [desiredProfitMargin, setDesiredProfitMargin] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [jobMaterialCost, setJobMaterialCost] = useState<number>(0);
  const [jobHours, setJobHours] = useState<number>(0);
  const [jobTravel, setJobTravel] = useState<number>(0);
  const [bdiCost,setBdiCost] = useState('');
  const [bdiRates,setBdiRates] = useState<Record<keyof BdiRates,string>>({administration:'',insurance:'',risk:'',guarantee:'',financial:'',profit:'',taxes:''});
  let bdiResult: ReturnType<typeof calculateBdi> | null = null; let bdiError='';
  if (bdiCost.trim() && Object.values(bdiRates).every(v=>v.trim()!=='')) {
    try { bdiResult=calculateBdi(Number(bdiCost.replace(',','.')),Object.fromEntries(Object.entries(bdiRates).map(([k,v])=>[k,Number(v.replace(',','.'))])) as unknown as BdiRates); }
    catch(e){bdiError=e instanceof Error?e.message:'Parâmetros de BDI inválidos';}
  }

  const totalMonthlyExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  let costPerDay = 0, costPerHour = 0, markupMultiplier = 0, jobDirectCost = 0, recommendedQuotePrice = 0, estimatedProfit = 0;
  let calculationError = '';
  try {
    const result = pricingEstimate({ monthlyExpenses: totalMonthlyExpenses, workDays: workDaysPerMonth, workHours: workHoursPerMonth,
      margin: desiredProfitMargin, tax: taxRate, material: jobMaterialCost, jobHours: jobHours, travel: jobTravel });
    ({ costPerDay, costPerHour, markup: markupMultiplier, directCost: jobDirectCost, price: recommendedQuotePrice, profit: estimatedProfit } = result);
  } catch (err) { calculationError = err instanceof Error ? err.message : 'Parâmetros inválidos'; }

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpName.trim() || newExpAmount <= 0) return;

    addExpense({
      id: newId('exp'),
      name: newExpName.trim(),
      amount: newExpAmount,
      category: newExpCategory
    });

    setNewExpName('');
    setNewExpAmount(0);
  };

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Formação de Preço</h1>
          <p className="text-xs text-slate-400">Custos operacionais e cálculo de markup</p>
        </div>
      </div>

      {calculationError && <div role="alert" className="p-3 rounded-xl bg-rose-950/70 text-rose-300 text-xs">{calculationError}. Corrija os valores para calcular o preço.</div>}

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-[#141822] border border-white/5 text-xs font-semibold text-center">
        <button
          onClick={() => setActiveTab('custos-mensais')}
          className={`py-2 rounded-xl transition-all ${
            activeTab === 'custos-mensais' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
          style={activeTab === 'custos-mensais' ? { background: theme.primaryGradient } : {}}
        >
          Custos Mensais
        </button>
        <button
          onClick={() => setActiveTab('calculadora-bdi')}
          className={`py-2 rounded-xl transition-all ${
            activeTab === 'calculadora-bdi' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
          style={activeTab === 'calculadora-bdi' ? { background: theme.primaryGradient } : {}}
        >
          Quanto Preciso Cobrar?
        </button>
        <button onClick={() => setActiveTab('bdi-analitico')} className={`py-2 rounded-xl transition-all ${activeTab === 'bdi-analitico' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'}`} style={activeTab === 'bdi-analitico' ? {background:theme.primaryGradient}:{}}>BDI Analítico</button>
      </div>

      {activeTab === 'bdi-analitico' ? <section className="space-y-4 rounded-2xl border border-white/10 bg-[#141822] p-4">
        <h2 className="text-sm font-bold">BDI analítico de obra — parâmetros informados</h2>
        <p className="text-xs leading-relaxed text-slate-400">Use custos diretos apurados e percentuais definidos para sua obra. Nenhuma taxa foi pré-preenchida: o sistema não presume impostos, lucro, seguros ou encargos SINAPI. Esta calculadora não modifica orçamentos automaticamente.</p>
        <label className="block text-xs text-slate-400">Custo direto da obra (R$)<input className="mt-1 w-full rounded-xl border border-white/10 bg-[#0b0e15] p-3 text-white" type="text" inputMode="decimal" placeholder="Informe seu custo direto" value={bdiCost} onChange={e=>setBdiCost(e.target.value)}/></label>
        <div className="grid grid-cols-2 gap-3">{([
          ['administration','Administração central (AC)'],['insurance','Seguro (S)'],['risk','Riscos (R)'],['guarantee','Garantia (G)'],['financial','Despesas financeiras (DF)'],['profit','Lucro previsto (L)'],['taxes','Tributos sobre receita (I)']
        ] as [keyof BdiRates,string][]).map(([k,label])=><label key={k} className="text-[11px] text-slate-400">{label} (%)<input type="text" inputMode="decimal" className="mt-1 w-full rounded-xl border border-white/10 bg-[#0b0e15] p-2.5 text-white" placeholder="Informar" value={bdiRates[k]} onChange={e=>setBdiRates(v=>({...v,[k]:e.target.value}))}/></label>)}</div>
        {bdiError&&<p role="alert" className="text-xs text-rose-300">{bdiError}</p>}
        {bdiResult?<div className="space-y-2 rounded-xl border border-orange-500/20 bg-orange-500/5 p-3"><div className="flex justify-between gap-2 text-xs"><span>BDI calculado</span><strong>{bdiResult.bdiPercent.toLocaleString('pt-BR',{maximumFractionDigits:4})}%</strong></div><div className="flex justify-between gap-2 text-xs"><span>Acréscimo de BDI</span><strong>{formatCurrency(bdiResult.bdiValue)}</strong></div><div className="flex justify-between gap-2 text-sm"><span>Preço de referência calculado</span><strong>{formatCurrency(bdiResult.sellingPrice)}</strong></div></div>:<p className="text-xs text-slate-500">Informe custo direto e todos os percentuais, inclusive 0% quando aplicável, para calcular. Sem parâmetros, não há resultado fictício.</p>}
        <p className="text-[11px] text-amber-300">Fórmula adotada: [(1+AC+S+R+G) × (1+DF) × (1+L) ÷ (1−I)] − 1, com percentuais em fração decimal. Revise as exigências contratuais, tributárias, jurisprudência e regime específico (inclusive desoneração) com profissional habilitado.</p>
      </section> : activeTab === 'custos-mensais' ? (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-2xl bg-[#141822] border border-white/5 text-center">
              <span className="text-[10px] text-slate-400 font-medium block">Custo Mensal</span>
              <span className="text-sm font-black text-white block mt-0.5">
                {formatCurrency(totalMonthlyExpenses)}
              </span>
              <span className="text-[10px] text-slate-500">Total Fixo</span>
            </div>

            <div className="p-3 rounded-2xl bg-[#141822] border border-white/5 text-center">
              <span className="text-[10px] text-slate-400 font-medium block">Custo / Dia</span>
              <span className="text-sm font-bold text-amber-400 block mt-0.5">
                {formatCurrency(costPerDay)}
              </span>
              <span className="text-[10px] text-slate-500">{workDaysPerMonth} dias</span>
            </div>

            <div className="p-3 rounded-2xl bg-[#141822] border border-white/5 text-center">
              <span className="text-[10px] text-slate-400 font-medium block">Custo / Hora</span>
              <span className="text-sm font-bold text-emerald-400 block mt-0.5">
                {formatCurrency(costPerHour)}
              </span>
              <span className="text-[10px] text-slate-500">{workHoursPerMonth}h úteis</span>
            </div>
          </div>

          {/* Add Expense Form */}
          <div className="p-4 rounded-2xl bg-[#141822] border border-white/5">
            <h3 className="text-xs font-bold text-white mb-2.5">Adicionar Despesa Mensal</h3>
            <form onSubmit={handleAddExpense} className="grid grid-cols-12 gap-2">
              <div className="col-span-6">
                <input
                  type="text"
                  placeholder="Nome (ex: Internet, Luz)"
                  value={newExpName}
                  onChange={e => setNewExpName(e.target.value)}
                  className="w-full bg-[#1b202c] text-xs text-white px-3 py-2 rounded-xl border border-white/10 focus:outline-none"
                  required
                />
              </div>
              <div className="col-span-4">
                <input
                  type="number"
                  step="0.01"
                  placeholder="R$ 0,00"
                  value={newExpAmount || ''}
                  onChange={e => setNewExpAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#1b202c] text-xs text-white px-3 py-2 rounded-xl border border-white/10 focus:outline-none font-mono"
                  required
                />
              </div>
              <div className="col-span-2">
                <button
                  type="submit"
                  className="w-full h-full flex items-center justify-center rounded-xl text-white font-bold text-xs shadow-md transition-all active:scale-95"
                  style={{ background: theme.primaryGradient || 'linear-gradient(135deg, #ffa114 0%, #ff6b00 50%, #ff3b00 100%)' }}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>

          {/* List of expenses */}
          <div className="p-4 rounded-2xl bg-[#141822] border border-white/5 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-xs font-bold text-slate-300">Despesas Cadastradas</span>
              <span className="text-xs font-bold text-white">{expenses.length} itens</span>
            </div>

            <div className="divide-y divide-white/5">
              {expenses.map(exp => (
                <div key={exp.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-white block">{exp.name}</span>
                    <span className="text-[10px] text-slate-500">{exp.category}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-white font-mono">
                      {formatCurrency(exp.amount)}
                    </span>
                    <button
                      onClick={() => { if (window.confirm('Excluir este despesa? Esta ação pode ser irreversível.')) deleteExpense(exp.id); }}
                      className="p-1 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Calculadora BDI / Quanto Cobrar */
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[#141822] border border-white/5 space-y-3.5">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Calculator className="w-4 h-4" style={{ color: theme.primaryColor }} />
              <span>Calculadora de preço com seus custos</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Custo de Materiais (R$)</label>
                <input
                  type="number"
                  value={jobMaterialCost}
                  onChange={e => setJobMaterialCost(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#1b202c] text-white px-3 py-2 rounded-xl border border-white/10 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Horas de Trabalho Estimadas</label>
                <input
                  type="number"
                  value={jobHours}
                  onChange={e => setJobHours(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#1b202c] text-white px-3 py-2 rounded-xl border border-white/10 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Margem de Lucro Desejada (%)</label>
                <input
                  type="number"
                  value={desiredProfitMargin}
                  onChange={e => setDesiredProfitMargin(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#1b202c] text-white px-3 py-2 rounded-xl border border-white/10 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Imposto Tributário (%)</label>
                <input
                  type="number"
                  value={taxRate}
                  onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#1b202c] text-white px-3 py-2 rounded-xl border border-white/10 font-mono"
                />
              </div>
            </div>

            {/* Resultado do Cálculo */}
            <div className="mt-4 pt-3 border-t border-white/5 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Custo Direto Operacional:</span>
                <span className="font-semibold text-white font-mono">
                  {formatCurrency(jobDirectCost)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Multiplicador Markup (BDI):</span>
                <span className="font-semibold text-white font-mono">
                  {markupMultiplier.toFixed(2)}x
                </span>
              </div>

              <div className="p-3 rounded-xl bg-gradient-to-r from-[#1c2230] to-[#161a24] border border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 font-semibold uppercase block">
                    Preço Recomendado de Venda
                  </span>
                  <span className="text-lg font-black text-white font-mono">
                    {formatCurrency(recommendedQuotePrice)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-emerald-400 block">Lucro Livre Est.</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    +{formatCurrency(estimatedProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
