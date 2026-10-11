import type {EmployeeCost} from '../types/index.js';
import type {PricingWorkload} from './pricingWorkload.js';

export function validateEmployeeCost(e:EmployeeCost):void{
  if(!e.id||!e.name.trim()||e.name.length>150||!e.role.trim()||e.role.length>150)
    throw Error('Informe o nome e a função do funcionário.');
  if(e.paymentBasis!=='monthly'&&e.paymentBasis!=='hourly')
    throw Error('Escolha pagamento por mês ou por hora.');
  if(!Number.isFinite(e.paymentAmount)||e.paymentAmount<=0||e.paymentAmount>1e9)
    throw Error('Informe o valor real de pagamento, maior que zero.');
  if(!Number.isFinite(e.monthlyExtras)||e.monthlyExtras<0||e.monthlyExtras>1e9)
    throw Error('Encargos ou benefícios extras devem ser positivos ou zero.');
  if(e.paymentBasis==='hourly'&&
    (!Number.isFinite(e.plannedHoursPerMonth)||e.plannedHoursPerMonth<0||
      e.plannedHoursPerMonth>744))
    throw Error('Informe até 744 horas previstas por mês para o horista.');
  if(e.reference&&(e.reference.hourlyCost<=0||!Number.isFinite(e.reference.hourlyCost)))
    throw Error('Referência SINAPI inválida.');
}
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export function employeeMonthlyCosts(employees:readonly EmployeeCost[]){
  let fixed=0,variable=0,unplannedHourly=0;
  for(const e of employees){
    validateEmployeeCost(e);
    if(e.paymentBasis==='monthly'){
      fixed+=e.paymentAmount+e.monthlyExtras;
    }else if(e.plannedHoursPerMonth>0){
      variable+=e.paymentAmount*e.plannedHoursPerMonth+e.monthlyExtras;
    }else{
      unplannedHourly++;
    }
  }
  return {fixed:round(fixed),variableEstimate:round(variable),
    forecast:round(fixed+variable),unplannedHourly};
}
/** O SINAPI publica custo COM ENCARGOS por hora, não um salário registrado.
 * Só gera equivalência orçamentária de mês quando a jornada foi declarada.
 */
export function sinapiMonthlyReference(hourly:number,schedule:PricingWorkload):number|null{
  if(!schedule.valid||!Number.isFinite(hourly)||hourly<=0)return null;
  return round(hourly*schedule.hoursPerMonth);
}
