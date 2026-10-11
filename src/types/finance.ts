export interface FinanceEntry {
  id: string;
  type: 'recebimento' | 'despesa';
  date: string;
  amount: number; // BRL, positive, actually paid or received
  description: string;
  category: string;
  quoteId?: string; // Links to an existing quote but does not change its approval state
  scheduleId?:string; // Vínculo EXPLÍCITO à obra para confrontar pago/recebido; não é medição nem pagamento projetado
  createdAt: string;
}
