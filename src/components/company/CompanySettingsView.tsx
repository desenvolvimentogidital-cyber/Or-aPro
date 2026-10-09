import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { ArrowLeft, Building2, Save, QrCode, FileText, CheckCircle2 } from 'lucide-react';
import { CompanySettings } from '../../types';
import { preparePhoto } from '../../utils/imageUpload';

export const CompanySettingsView: React.FC = () => {
  const { company, updateCompany, setActiveView } = useApp();
  const { theme } = useTheme();

  const [formData, setFormData] = useState<CompanySettings>(company);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [imageError, setImageError] = useState('');
  const uploadLogo = async (file?: File) => {
    if (!file) return;
    setImageError('');
    try { const url = await preparePhoto(file, 550); setFormData(prev => ({ ...prev, logoUrl: url })); }
    catch (e) { setImageError(e instanceof Error ? e.message : 'Não foi possível carregar o logotipo.'); }
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompany(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
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
        <h1 className="text-base font-bold text-white tracking-tight">Dados da Empresa</h1>
        <div className="w-8" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Identificação */}
        <div className="p-4 rounded-2xl bg-[#141822] border border-white/5 space-y-3">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-4 h-4" style={{ color: theme.primaryColor }} />
            <span>Identificação do Negócio</span>
          </h2>

          <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-[#0e1420]">
            {formData.logoUrl ? <img src={formData.logoUrl} alt="Logotipo cadastrado" className="w-16 h-16 rounded-xl object-contain bg-white/5" /> : <div className="w-16 h-16 rounded-xl border border-dashed border-orange-500/30 text-slate-500 text-[10px] text-center flex items-center justify-center">Sem logo</div>}
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">Logotipo real para o PDF</label>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { void uploadLogo(e.target.files?.[0]); e.target.value = ''; }} className="text-[11px] text-slate-300 w-full" />
              {formData.logoUrl && <button type="button" onClick={() => setFormData(prev => ({ ...prev, logoUrl: '' }))} className="text-[11px] text-orange-300 mt-2 underline">Remover logotipo</button>}
              {imageError && <p role="alert" className="text-xs text-red-400 mt-2">{imageError}</p>}
              <p className="text-[10px] text-slate-500 mt-1">Imagem enviada por você, reduzida para sincronizar com segurança.</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Nome Fantasia (Como o cliente conhece) *
              </label>
              <input
                type="text"
                required
                value={formData.tradeName}
                onChange={e => setFormData({ ...formData, tradeName: e.target.value })}
                className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Razão Social Oficial
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">CNPJ / CPF</label>
                <input
                  type="text"
                  value={formData.document}
                  onChange={e => setFormData({ ...formData, document: e.target.value })}
                  className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Slogan / Tagline</label>
                <input
                  type="text"
                  value={formData.tagline}
                  onChange={e => setFormData({ ...formData, tagline: e.target.value })}
                  placeholder="Ex: Energia • Confiança • Soluções"
                  className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Contato & Localização */}
        <div className="p-4 rounded-2xl bg-[#141822] border border-white/5 space-y-3">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Contato & Endereço
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">WhatsApp</label>
              <input
                type="text"
                value={formData.whatsapp}
                onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">E-mail</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-300 block mb-1">Endereço</label>
              <input
                type="text"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Cidade / UF</label>
              <input
                type="text"
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Chave Pix e Pagamento */}
        <div className="p-4 rounded-2xl bg-[#141822] border border-white/5 space-y-3">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span>Dados de Recebimento Pix</span>
          </h2>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Tipo de Chave</label>
              <select
                value={formData.pixType}
                onChange={e => setFormData({ ...formData, pixType: e.target.value as any })}
                className="w-full bg-[#1b202c] text-sm text-white px-3 py-2.5 rounded-xl border border-white/10 focus:outline-none"
              >
                <option value="CNPJ">CNPJ</option>
                <option value="CPF">CPF</option>
                <option value="Telefone">Telefone</option>
                <option value="Email">Email</option>
                <option value="Aleatória">Aleatória</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-300 block mb-1">Chave Pix</label>
              <input
                type="text"
                value={formData.pixKey}
                onChange={e => setFormData({ ...formData, pixKey: e.target.value })}
                placeholder="Insira sua chave Pix"
                className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Assinatura & Termos */}
        <div className="p-4 rounded-2xl bg-[#141822] border border-white/5 space-y-3">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-sky-400" />
            <span>Assinatura & Condições Padrão</span>
          </h2>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Nome do Responsável Técnico para Assinatura
            </label>
            <input
              type="text"
              value={formData.signatureName}
              onChange={e => setFormData({ ...formData, signatureName: e.target.value })}
              placeholder="Nome do responsável e registro profissional"
              className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Condições Comerciais Padrão
            </label>
            <textarea
              rows={3}
              value={formData.termsAndConditions}
              onChange={e => setFormData({ ...formData, termsAndConditions: e.target.value })}
              className="w-full bg-[#1b202c] text-xs text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none leading-relaxed"
            />
          </div>
        </div>

        {/* Submit with Degradê */}
        <button
          type="submit"
          className="w-full py-4 px-4 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 shadow-xl transition-all active:scale-[0.98]"
          style={{
            background: theme.primaryGradient || 'linear-gradient(135deg, #ffa114 0%, #ff6b00 50%, #ff3b00 100%)',
            boxShadow: `0 10px 25px -4px ${theme.primaryColor}66`
          }}
        >
          {savedSuccess ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-white" />
              <span>Dados Salvos com Sucesso!</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>Salvar Dados da Empresa</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
