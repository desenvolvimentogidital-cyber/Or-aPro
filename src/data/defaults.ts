import type { CompanySettings, PlatformTheme } from '../types';

// Only empty input defaults: no fabricated customers, prices, sales or company details.
export const emptyCompany: CompanySettings = {
  name: '', tradeName: '', document: '', phone: '', whatsapp: '', email: '', address: '',
  city: '', state: '', logoUrl: '', tagline: '', pixKey: '', pixType: 'Aleatória',
  bankInfo: '', signatureName: '', termsAndConditions: ''
};

// Design defaults are not commercial records.
export const defaultTheme: PlatformTheme = {
  primaryColor: '#ff6b00', primaryHover: '#e05d00', secondaryColor: '#ff8a33',
  primaryGradient: 'linear-gradient(135deg, #ffa012 0%, #ff6b00 50%, #ff3b00 100%)',
  backgroundColor: '#0c0e14', cardColor: '#161922', textColor: '#f3f4f6',
  successColor: '#10b981', dangerColor: '#ef4444', warningColor: '#f59e0b',
  borderRadius: 'rounded-2xl', brandName: 'OrçaPro', brandTagline: 'Gestão e orçamentos', brandLogo: '◈'
};
