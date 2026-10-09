import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { loadWorkspace, saveWorkspace, type WorkspaceData } from '../services/cloud';
import { newId, nextQuoteNumber, dateKey } from '../utils/quoteMath';
import { containsOldExampleRecords } from '../utils/legacyFixtures';
import {validateWorkspaceBackup} from '../utils/backupValidation';
import { Quote, Client, CatalogItem, MonthlyExpense, CompanySettings, AppNotification, QuoteStatus } from '../types';
import { emptyCompany } from '../data/defaults';
import type { WorkSchedule } from '../types/schedule';
import type { FinanceEntry } from '../types/finance';
import { validateEntry } from '../utils/financeMetrics';

export type AppView = 
  | 'dashboard'
  | 'clientes'
  | 'orcamentos'
  | 'novo-orcamento'
  | 'cronograma'
  | 'obras'
  | 'financeiro'
  | 'servicos'
  | 'materiais'
  | 'mao-de-obra'
  | 'custos-mensais'
  | 'formacao-preco'
  | 'empresa'
  | 'modelos'
  | 'relatorios'
  | 'configuracoes'
  | 'admin';

interface AppContextType {
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  ready: boolean;
  syncStatus: 'saved' | 'saving' | 'error';
  syncError: string;
  getNextQuoteNumber: () => string;
  exportBackup: () => void;
  importBackup: (data: unknown) => void;
  importLegacyData: () => void;
  retrySync: () => Promise<void>;
  schedules: WorkSchedule[];
  selectedScheduleId: string;
  setSelectedScheduleId: (id:string)=>void;
  financeEntries: FinanceEntry[];
  addFinanceEntry: (entry: FinanceEntry) => void;
  deleteFinanceEntry: (id: string) => void;
  addSchedule: (schedule: WorkSchedule) => void;
  updateSchedule: (schedule: WorkSchedule) => void;
  deleteSchedule: (id: string) => void;
  // Quotes
  quotes: Quote[];
  activeQuoteForPreview: Quote | null;
  setActiveQuoteForPreview: (quote: Quote | null) => void;
  editingQuote: Quote | null;
  draftClientId: string;
  setDraftClientId: (id: string) => void;
  setEditingQuote: (quote: Quote | null) => void;
  addQuote: (quote: Quote) => void;
  updateQuote: (quote: Quote) => void;
  deleteQuote: (id: string) => void;
  changeQuoteStatus: (id: string, status: QuoteStatus) => void;
  duplicateQuote: (id: string) => void;
  // Clients
  clients: Client[];
  addClient: (client: Client) => void;
  updateClient: (client: Client) => void;
  deleteClient: (id: string) => void;
  // Catalog
  catalog: CatalogItem[];
  addCatalogItem: (item: CatalogItem) => void;
  updateCatalogItem: (item: CatalogItem) => void;
  deleteCatalogItem: (id: string) => void;
  // Expenses
  expenses: MonthlyExpense[];
  addExpense: (expense: MonthlyExpense) => void;
  updateExpense: (expense: MonthlyExpense) => void;
  deleteExpense: (id: string) => void;
  // Company
  company: CompanySettings;
  updateCompany: (settings: Partial<CompanySettings>) => void;
  // Notifications
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  pushPermission: NotificationPermission | 'unsupported';
  requestPushPermission: () => Promise<void>;
  sendSystemNotification: (title: string, message: string, type?: 'success' | 'warning' | 'info' | 'alert', quoteId?: string) => void;
  // UI states
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (open: boolean) => void;
  viewMode: 'mobile' | 'responsive';
  setViewMode: (mode: 'mobile' | 'responsive') => void;
  // Filters
  quoteStatusFilter: string;
  setQuoteStatusFilter: (filter: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [syncError, setSyncError] = useState('');
  const revisionRef = useRef(0);
  const saveBusyRef = useRef(false);
  const latestRef = useRef<WorkspaceData | null>(null);
  const numberRef = useRef(0);

  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [activeQuoteForPreview, setActiveQuoteForPreview] = useState<Quote | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [draftClientId, setDraftClientId] = useState('');
  useEffect(() => { if (activeView !== 'novo-orcamento' && draftClientId) setDraftClientId(''); }, [activeView, draftClientId]);
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<string>('todos');

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [financeEntries,setFinanceEntries] = useState<FinanceEntry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [company, setCompany] = useState<CompanySettings>(emptyCompany);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'mobile' | 'responsive'>(()=>typeof window !== 'undefined' && window.innerWidth>=1024?'responsive':'mobile');

  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermission(Notification.permission);
    } else {
      setPushPermission('unsupported');
    }
  }, []);

  const snapshot = (): WorkspaceData => ({
    quotes, clients, catalog, expenses, company, notifications, schedules, financeEntries, lastQuoteNumber: numberRef.current
  });

  const applySnapshot = (data: WorkspaceData) => {
    data = validateWorkspaceBackup(data);
    setQuotes(data.quotes); setSchedules(Array.isArray(data.schedules) ? data.schedules : []); setFinanceEntries(Array.isArray(data.financeEntries) ? data.financeEntries : []); setClients(data.clients); setCatalog(data.catalog);
    setExpenses(data.expenses); setCompany(data.company); setNotifications(data.notifications);
    numberRef.current = Math.max(data.lastQuoteNumber || 0, ...data.quotes.map(q => Number(/^#(\d+)$/.exec(q.number)?.[1] || 0)));
  };

  // A new authenticated account starts with NO commercial data.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setReady(false);
    loadWorkspace(session).then(({ data, revision }) => {
      if (cancelled) return;
      revisionRef.current = revision;
      if (data) applySnapshot(data);
      else applySnapshot({ quotes: [], clients: [], catalog: [], expenses: [], company: emptyCompany, notifications: [], financeEntries: [], lastQuoteNumber: 0 });
      setSyncError(''); setSyncStatus('saved'); setReady(true);
    }).catch(err => {
      if (!cancelled) { setSyncStatus('error'); setSyncError(`Não foi possível carregar seus dados: ${err.message}`); }
    });
    return () => { cancelled = true; };
  }, [session?.user.id]);

  // In cloud mode serialize all writes; revision check avoids silent overwrites between tabs/devices.
  useEffect(() => {
    if (!ready) return;
    if (!session || syncStatus === 'error') return;
    latestRef.current = snapshot();
    setSyncStatus('saving');
    const timer = window.setTimeout(async () => {
      if (saveBusyRef.current) return;
      saveBusyRef.current = true;
      try {
        while (latestRef.current) {
          const next = latestRef.current;
          latestRef.current = null;
          revisionRef.current = await saveWorkspace(session, next, revisionRef.current);
        }
        setSyncStatus('saved');
      } catch (err) {
        // Keep the unsent data in memory; never pretend it was saved.
        setSyncStatus('error');
        setSyncError(err instanceof Error ? err.message : 'Erro desconhecido de sincronização.');
      } finally { saveBusyRef.current = false; }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [quotes, clients, catalog, expenses, company, notifications, schedules, financeEntries, ready, session?.user.id]);

  useEffect(() => {
    if (!ready || !session) return;
    const reload = async () => {
      if (document.visibilityState !== 'visible' || saveBusyRef.current || latestRef.current || syncStatus !== 'saved') return;
      try {
        const remote = await loadWorkspace(session);
        if (remote.revision > revisionRef.current && remote.data) {
          revisionRef.current = remote.revision;
          applySnapshot(remote.data);
        }
      } catch { /* existing data stays available, next focused sync may retry */ }
    };
    // Public-link decisions update the remote workspace even if this tab stays open.
    // Refresh while visible, never overwriting edits queued in this browser.
    const interval = window.setInterval(reload, 30_000);
    document.addEventListener('visibilitychange', reload);
    window.addEventListener('focus', reload);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', reload); window.removeEventListener('focus', reload); };
  }, [ready, session?.user.id, syncStatus]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (syncStatus === 'saving' || syncStatus === 'error') { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [syncStatus]);

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify({ format: 'orcapro-backup-v1', exportedAt: new Date().toISOString(), data: snapshot() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `orcapro_backup_${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const importBackup = (value: unknown) => {
    const content = value as { format?: string; data?: WorkspaceData };
    if (content?.format !== 'orcapro-backup-v1' || !content.data) throw new Error('Arquivo não é um backup OrçaPro válido.');
    const validated = validateWorkspaceBackup(content.data);
    if (containsOldExampleRecords(validated)) {
      throw new Error('Backup contém identificadores dos registros demonstrativos da versão antiga. Revise o arquivo e remova os dados fictícios antes de importar.');
    }
    applySnapshot(validated);
  };
  const importLegacyData = () => {
    const read = (key: string, fallback: unknown) => {
      const data = localStorage.getItem(`orcapro_${key}`);
      return data ? JSON.parse(data) : fallback;
    };
    const hasLegacyRecords = ['quotes', 'clients', 'catalog', 'expenses', 'company'].some(key => localStorage.getItem(`orcapro_${key}`));
    if (!hasLegacyRecords) throw new Error('Não há dados antigos neste navegador.');
    const legacyQuotes = read('quotes', []) as Quote[];
    const legacyClients = read('clients', []) as Client[];
    const legacyCatalog = read('catalog', []) as CatalogItem[];
    const legacyExpenses = read('expenses', []) as MonthlyExpense[];
    const legacyCompany = read('company', emptyCompany) as CompanySettings;
    if (containsOldExampleRecords({ quotes: legacyQuotes, clients: legacyClients, catalog: legacyCatalog, expenses: legacyExpenses, company: legacyCompany })) {
      throw new Error('Foram identificados registros demonstrativos da versão antiga. Para não misturar dados fictícios com dados reais, a migração automática foi bloqueada. Exporte e revise o backup antes de importar dados reais.');
    }
    applySnapshot({
      quotes: legacyQuotes, clients: legacyClients,
      catalog: legacyCatalog, expenses: legacyExpenses, company: legacyCompany,
      notifications: read('notifications', []) as AppNotification[],
      lastQuoteNumber: Number(localStorage.getItem('orcapro_lastQuoteNumber') || 0)
    } as WorkspaceData);
  };
  const retrySync = async () => {
    if (!ready || saveBusyRef.current) return;
    if (!session) return;
    saveBusyRef.current = true;
    setSyncStatus('saving');
    try {
      revisionRef.current = await saveWorkspace(session, snapshot(), revisionRef.current);
      latestRef.current = null;
      setSyncStatus('saved'); setSyncError('');
    } catch (err) {
      setSyncStatus('error'); setSyncError(err instanceof Error ? err.message : 'Falha de sincronização.');
    } finally { saveBusyRef.current = false; }
  };
  const getNextQuoteNumber = () => nextQuoteNumber(quotes, numberRef.current);

  // Schedules are stored in the existing workspace JSONB under the authenticated user's RLS.
  // A missing schedules field in old backups is intentionally treated as an empty list.
  const addSchedule = (schedule: WorkSchedule) => setSchedules(prev => [schedule, ...prev]);
  const updateSchedule = (schedule: WorkSchedule) => setSchedules(prev => prev.map(s => s.id === schedule.id ? schedule : s));
  const deleteSchedule = (id: string) => setSchedules(prev => prev.filter(s => s.id !== id));
  const addFinanceEntry = (entry: FinanceEntry) => { validateEntry(entry); setFinanceEntries(prev => [entry, ...prev]); };
  const deleteFinanceEntry = (id: string) => setFinanceEntries(prev => prev.filter(e => e.id !== id));

  // Quote operations
  const addQuote = (quote: Quote) => {
    numberRef.current = Math.max(numberRef.current, Number(/^#(\d+)$/.exec(quote.number)?.[1] || 0));
    setQuotes(prev => [quote, ...prev]);
    sendSystemNotification(
      'Novo Orçamento Criado',
      `Orçamento ${quote.number} para ${quote.clientName} criado com sucesso.`,
      'info',
      quote.id
    );
  };

  const updateQuote = (quote: Quote) => {
    numberRef.current = Math.max(numberRef.current, Number(/^#(\d+)$/.exec(quote.number)?.[1] || 0));
    setQuotes(prev => prev.map(q => (q.id === quote.id ? quote : q)));
  };

  const deleteQuote = (id: string) => {
    setQuotes(prev => prev.filter(q => q.id !== id));
  };

  const changeQuoteStatus = (id: string, status: QuoteStatus) => {
    const existing = quotes.find(q => q.id === id);
    if (!existing || existing.status === status) return;
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, status,
      history: [...(q.history || []), { date: new Date().toISOString(), action: `Status alterado manualmente para ${status}`, user: 'Responsável pela conta' }] } : q));
    sendSystemNotification('Atualização manual de orçamento', `Orçamento ${existing.number}: situação alterada manualmente para ${status}.`, 'info', id);
  };

  const duplicateQuote = (id: string) => {
    const orig = quotes.find(q => q.id === id);
    if (!orig) return;
    const newNum = getNextQuoteNumber();
    const clone: Quote = {
      ...orig,
      id: newId('orc'),
      number: newNum,
      status: 'rascunho',
      date: dateKey(new Date()),
      validUntil: dateKey(new Date(Date.now() + 15 * 86400000)),
      history: [{ date: new Date().toISOString(), action: `Criado por duplicação do orçamento ${orig.number}`, user: 'Responsável pela conta' }],
      items: orig.items.map(item => ({ ...item, id: newId('item') }))
    };
    addQuote(clone);
  };

  // Client operations
  const addClient = (client: Client) => {
    setClients(prev => [client, ...prev]);
  };

  const updateClient = (client: Client) => {
    setClients(prev => prev.map(c => (c.id === client.id ? client : c)));
  };

  const deleteClient = (id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
  };

  // Catalog operations
  const addCatalogItem = (item: CatalogItem) => {
    setCatalog(prev => [item, ...prev]);
  };

  const updateCatalogItem = (item: CatalogItem) => {
    setCatalog(prev => prev.map(c => (c.id === item.id ? item : c)));
  };

  const deleteCatalogItem = (id: string) => {
    setCatalog(prev => prev.filter(c => c.id !== id));
  };

  // Expenses operations
  const addExpense = (exp: MonthlyExpense) => {
    setExpenses(prev => [...prev, exp]);
  };

  const updateExpense = (exp: MonthlyExpense) => {
    setExpenses(prev => prev.map(e => (e.id === exp.id ? exp : e)));
  };

  const deleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  // Company settings
  const updateCompany = (settings: Partial<CompanySettings>) => {
    setCompany(prev => ({ ...prev, ...settings }));
  };

  // Notifications
  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const requestPushPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        setPushPermission(permission);
        if (permission === 'granted') {
          new Notification('OrçaPro - Notificações Ativadas', {
            body: 'Alertas serão exibidos neste navegador enquanto o OrçaPro estiver aberto.',
            icon: '/favicon.ico'
          });
        }
      } catch (err) {
        console.error('Error requesting push permission', err);
      }
    }
  };

  const sendSystemNotification = (
    title: string,
    message: string,
    type: 'success' | 'warning' | 'info' | 'alert' = 'info',
    quoteId?: string
  ) => {
    const newNotif: AppNotification = {
      id: newId('notif'),
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
      type,
      quoteId
    };

    setNotifications(prev => [newNotif, ...prev]);

    // Send browser native notification if permitted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          icon: '/favicon.ico'
        });
      } catch (e) {
        console.error('Browser notification error', e);
      }
    }
  };

  return (
    <AppContext.Provider
      value={{
        activeView,
        setActiveView,
        ready, syncStatus, syncError, getNextQuoteNumber, exportBackup, importBackup, importLegacyData, retrySync,
        quotes,
        schedules, selectedScheduleId, setSelectedScheduleId, addSchedule, updateSchedule, deleteSchedule,
        financeEntries, addFinanceEntry, deleteFinanceEntry,
        activeQuoteForPreview,
        setActiveQuoteForPreview,
        editingQuote,
        setEditingQuote,
        draftClientId,
        setDraftClientId,
        addQuote,
        updateQuote,
        deleteQuote,
        changeQuoteStatus,
        duplicateQuote,
        clients,
        addClient,
        updateClient,
        deleteClient,
        catalog,
        addCatalogItem,
        updateCatalogItem,
        deleteCatalogItem,
        expenses,
        addExpense,
        updateExpense,
        deleteExpense,
        company,
        updateCompany,
        notifications,
        unreadNotificationsCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        pushPermission,
        requestPushPermission,
        sendSystemNotification,
        isMenuOpen,
        setIsMenuOpen,
        isNotificationsOpen,
        setIsNotificationsOpen,
        viewMode,
        setViewMode,
        quoteStatusFilter,
        setQuoteStatusFilter
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
