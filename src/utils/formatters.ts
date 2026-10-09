export const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return '';
  try {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateString);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateString;
  }
};

export const getStatusBadge = (status: string) => {
  switch (status) {
    case 'aprovado':
      return {
        label: 'Aprovado',
        bg: 'bg-emerald-500/15',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
        dot: 'bg-emerald-400'
      };
    case 'enviado':
      return {
        label: 'Enviado',
        bg: 'bg-amber-500/15',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        dot: 'bg-amber-400'
      };
    case 'rascunho':
      return {
        label: 'Rascunho',
        bg: 'bg-slate-500/15',
        text: 'text-slate-400',
        border: 'border-slate-500/30',
        dot: 'bg-slate-400'
      };
    case 'recusado':
      return {
        label: 'Recusado',
        bg: 'bg-rose-500/15',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
        dot: 'bg-rose-400'
      };
    default:
      return {
        label: status,
        bg: 'bg-slate-500/15',
        text: 'text-slate-400',
        border: 'border-slate-500/30',
        dot: 'bg-slate-400'
      };
  }
};
