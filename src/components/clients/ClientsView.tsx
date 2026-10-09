import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { Search, Plus, MoreVertical, Phone, Mail, MapPin, FileText, Trash2, Edit3, X, Check } from 'lucide-react';
import { Client } from '../../types';
import { newId } from '../../utils/quoteMath';

export const ClientsView: React.FC = () => {
  const { clients, addClient, updateClient, deleteClient, setActiveView, setEditingQuote, setDraftClientId } = useApp();
  const { theme } = useTheme();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientForMenu, setSelectedClientForMenu] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formDocument, setFormDocument] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAddModal = () => {
    setClientToEdit(null);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormDocument('');
    setFormAddress('');
    setFormCity('');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setClientToEdit(client);
    setFormName(client.name);
    setFormPhone(client.phone);
    setFormEmail(client.email);
    setFormDocument(client.document || '');
    setFormAddress(client.address || '');
    setFormCity(client.city || '');
    setFormNotes(client.notes || '');
    setIsModalOpen(true);
    setSelectedClientForMenu(null);
  };

  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (clientToEdit) {
      updateClient({
        ...clientToEdit,
        name: formName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim(),
        document: formDocument.trim(),
        address: formAddress.trim(),
        city: formCity.trim(),
        notes: formNotes.trim(),
        initials: formName.trim().charAt(0).toUpperCase()
      });
    } else {
      const newClient: Client = {
        id: newId('cli'),
        name: formName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim(),
        document: formDocument.trim(),
        address: formAddress.trim(),
        city: formCity.trim(),
        notes: formNotes.trim(),
        avatarColor: 'bg-amber-500',
        initials: formName.trim().charAt(0).toUpperCase()
      };
      addClient(newClient);
    }

    setIsModalOpen(false);
  };

  const handleCreateQuoteForClient = (client: Client) => {
    setSelectedClientForMenu(null);
    setEditingQuote(null);
    setDraftClientId(client.id);
    setActiveView('novo-orcamento');
  };

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <h1 className="text-xl font-bold text-white tracking-tight">Clientes</h1>
        <button
          onClick={openAddModal}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md active:scale-95 transition-all"
          style={{ background: theme.primaryGradient || 'linear-gradient(135deg, #ffa114 0%, #ff6b00 50%, #ff3b00 100%)' }}
          title="Adicionar Cliente"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* Search Input (referência visual #3) */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Buscar clientes..."
          className="w-full bg-[#141822] text-sm text-white placeholder-slate-500 pl-10 pr-4 py-2.5 rounded-2xl border border-white/5 focus:outline-none focus:border-white/20 transition-colors"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Clients List */}
      <div className="space-y-2.5">
        {filteredClients.length === 0 ? (
          <div className="text-center py-12 bg-[#141822] rounded-2xl border border-white/5 p-6">
            <p className="text-sm text-slate-400 font-medium">Nenhum cliente encontrado</p>
            <button
              onClick={openAddModal}
              className="mt-3 text-xs font-semibold px-4 py-2 rounded-xl text-white inline-block"
              style={{ backgroundColor: theme.primaryColor }}
            >
              + Cadastrar Cliente
            </button>
          </div>
        ) : (
          filteredClients.map(client => (
            <div
              key={client.id}
              className="relative p-3.5 rounded-2xl bg-[#141822] border border-white/5 hover:border-white/10 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Round Avatar Circle (matches orange gradient circle in mockup #3) */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-md ring-2 ring-white/10"
                  style={{ background: theme.primaryGradient || 'linear-gradient(135deg, #ffa114 0%, #ff6b00 50%, #ff3b00 100%)' }}
                >
                  {client.initials || client.name.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{client.name}</h3>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{client.phone}</p>
                  <p className="text-[11px] text-slate-500 truncate">{client.email}</p>
                </div>
              </div>

              {/* Three dots options */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setSelectedClientForMenu(selectedClientForMenu === client.id ? null : client.id)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* Dropdown Menu */}
                {selectedClientForMenu === client.id && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setSelectedClientForMenu(null)}
                    />
                    <div className="absolute right-0 top-8 z-30 w-48 rounded-xl bg-[#1b202c] border border-white/10 shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                      <button
                        onClick={() => handleCreateQuoteForClient(client)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/5 rounded-lg text-left"
                      >
                        <FileText className="w-3.5 h-3.5" style={{ color: theme.primaryColor }} />
                        Novo Orçamento
                      </button>
                      <a
                        href={`https://wa.me/55${client.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 rounded-lg text-left"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-400" />
                        Chamar no WhatsApp
                      </a>
                      <button
                        onClick={() => openEditModal(client)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 rounded-lg text-left"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                        Editar Cliente
                      </button>
                      <button
                        onClick={() => {
                          if (!window.confirm('Excluir este cliente? Orçamentos existentes manterão uma cópia dos dados já cadastrados.')) return;
                          deleteClient(client.id);
                          setSelectedClientForMenu(null);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg text-left"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Excluir
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#141822] border border-white/10 rounded-2xl w-full max-w-md p-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">
                {clientToEdit ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Ex: Maria Silva"
                  className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Telefone / WhatsApp *
                  </label>
                  <input
                    type="text"
                    required
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    placeholder="(11) 98765-4321"
                    className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    CPF ou CNPJ
                  </label>
                  <input
                    type="text"
                    value={formDocument}
                    onChange={e => setFormDocument(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">E-mail</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-white/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Endereço</label>
                  <input
                    type="text"
                    value={formAddress}
                    onChange={e => setFormAddress(e.target.value)}
                    placeholder="Rua, número e apto"
                    className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Cidade / UF</label>
                  <input
                    type="text"
                    value={formCity}
                    onChange={e => setFormCity(e.target.value)}
                    placeholder="São Paulo - SP"
                    className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Observações</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Preferências, horários de acesso ou notas"
                  className="w-full bg-[#1b202c] text-sm text-white px-3.5 py-2 rounded-xl border border-white/10 focus:outline-none focus:border-white/30 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all active:scale-95"
                  style={{ background: theme.primaryGradient || 'linear-gradient(135deg, #ffa114 0%, #ff6b00 50%, #ff3b00 100%)' }}
                >
                  {clientToEdit ? 'Atualizar' : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
