export type QuoteStatus = 'rascunho' | 'enviado' | 'aprovado' | 'recusado';

export type ItemType = 'servico' | 'material' | 'mao_de_obra';

export type LaborType = 'hora' | 'diaria' | 'unidade' | 'servico' | 'fixo';

export interface CatalogItem {
  id: string;
  name: string;
  type: ItemType;
  category: string;
  price: number;
  unit: string;
  laborType?: LaborType;
  description?: string;
  imageUrl?: string; // Optional real product/service photo uploaded by the user
  cost?: number; // Custo de aquisição para cálculo de margem real
  costConfirmed?: boolean; // Diferencia custo zero declarado do campo não informado
  sinapiComposition?: import('./schedule').SinapiComposition; // Analítico com HH explicitamente associado pelo operador
}

export interface QuoteItem {
  id: string;
  name: string;
  type: ItemType;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unitCost?: number;
  costConfirmed?: boolean; // Snapshot da confirmação de custo, inclusive quando zero
  imageUrl?: string; // Snapshot of the real catalog image at quote creation
  laborType?: LaborType;
  catalogItemId?: string; // ID de origem do catálogo (itens antigos não possuem)
  sinapiComposition?: import('./schedule').SinapiComposition; // Snapshot opcional da referência confirmada
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  document?: string; // CPF ou CNPJ
  address?: string;
  city?: string;
  notes?: string;
  avatarColor?: string;
  initials?: string;
}

export interface QuoteVisibilitySettings {
  showServices: boolean;
  showMaterials: boolean;
  showQuantities: boolean;
  showUnitPrices: boolean;
  showTaxes: boolean;
  showProfitMargin: boolean;
  showDiscount: boolean;
  showTotal: boolean;
  showTerms: boolean;
  showPix: boolean;
  showSignature: boolean;
}

export interface Quote {
  id: string;
  number: string; // Ex: #018
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  date: string; // YYYY-MM-DD
  validUntil: string;
  executionDeadline?: string; // Only shown when provided by the user
  status: QuoteStatus;
  items: QuoteItem[];
  subtotal: number;
  travelCost: number;
  otherCosts: number;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  taxRate: number; // %
  targetMarginRate: number; // %
  total: number;
  netProfit: number;
  visibility: QuoteVisibilitySettings;
  notes?: string;
  paymentTerms?: string;
  modelTemplate: 'padrao' | 'moderno' | 'profissional';
  history?: {
    date: string;
    action: string;
    user: string;
  }[];
}

export interface MonthlyExpense {
  id: string;
  category: string;
  name: string;
  amount: number;
}

export interface CompanySettings {
  /** Dias trabalhados por mês para ratear custos fixos (configuração voluntária). */
  pricingWorkDaysPerMonth?: number;
  /** Horas por dia; o total do mês é calculado, não duplicado no cadastro. */
  pricingHoursPerDay?: number;
  name: string;
  tradeName: string; // Nome fantasia
  document: string; // CNPJ / CPF
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  state: string;
  logoUrl: string;
  tagline: string;
  pixKey: string;
  pixType: 'CNPJ' | 'CPF' | 'Email' | 'Telefone' | 'Aleatória';
  bankInfo: string;
  signatureName: string;
  termsAndConditions: string;
}

export interface PlatformTheme {
  primaryColor: string; // Laranja padrão: #ff6b00
  primaryHover: string;
  secondaryColor: string;
  primaryGradient: string; // Degradê laranja/primário
  backgroundColor: string;
  cardColor: string;
  textColor: string;
  successColor: string;
  dangerColor: string;
  warningColor: string;
  borderRadius: string; // 'rounded-xl' | 'rounded-2xl'
  brandName: string;
  brandTagline: string;
  brandLogo: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'success' | 'warning' | 'info' | 'alert';
  quoteId?: string;
}
