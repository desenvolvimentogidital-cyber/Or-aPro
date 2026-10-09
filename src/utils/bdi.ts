/** BDI analítico para referência de orçamento. Todos os percentuais são informados pelo responsável.
 * Fórmula: ((1+AC+S+R+G)*(1+DF)*(1+L)/(1-I)-1) * 100.
 * BDI não substitui composição SINAPI, validação de regime tributário ou auditoria contábil.
 */
export interface BdiRates {
  administration: number; // AC, %
  insurance: number; // S, %
  risk: number; // R, %
  guarantee: number; // G, %
  financial: number; // DF, %
  profit: number; // L, %
  taxes: number; // I, % da receita
}
export function calculateBdi(directCost: number, rates: BdiRates) {
  if (!Number.isFinite(directCost) || directCost <= 0 || directCost > 1e12) throw new Error('Informe o custo direto real maior que zero.');
  for (const [name, value] of Object.entries(rates)) {
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`Percentual inválido: ${name}.`);
  }
  if (rates.taxes >= 100) throw new Error('Tributos sobre faturamento devem ser menores que 100%.');
  const overhead = 1 + (rates.administration + rates.insurance + rates.risk + rates.guarantee)/100;
  const financial = 1 + rates.financial/100;
  const profit = 1 + rates.profit/100;
  const taxes = 1 - rates.taxes/100;
  const factor = overhead * financial * profit / taxes;
  const bdiPercent = (factor - 1) * 100;
  const sellingPrice = directCost * factor;
  if (!Number.isFinite(factor) || !Number.isFinite(sellingPrice) || sellingPrice > 1e15) throw new Error('Resultado fora dos limites suportados.');
  return {factor,bdiPercent,sellingPrice,bdiValue:sellingPrice-directCost};
}
