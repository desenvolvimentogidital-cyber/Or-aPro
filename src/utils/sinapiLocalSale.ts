/** Ajuste COMERCIAL e voluntário da empresa/cidade, não um índice oficial SINAPI.
 * Nunca altera o custo unitário de referência nem os coeficientes HH.
 */
export function sinapiLocalSalePrice(referenceCost:number,adjustmentPercent:number):number{
  if(!Number.isFinite(referenceCost)||referenceCost<=0||referenceCost>1e9)
    throw Error('Custo base SINAPI inválido.');
  if(!Number.isFinite(adjustmentPercent)||adjustmentPercent<0||adjustmentPercent>300)
    throw Error('Ajuste da obra deve ser de 0% a 300%.');
  return Math.round((referenceCost*(1+adjustmentPercent/100)+Number.EPSILON)*100)/100;
}
