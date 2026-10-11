import type {EmployeeCost} from '../types/index.js';
import type {WorkSchedule} from '../types/schedule.js';
import type {ScheduleEstimate,TaskEstimate} from './scheduleMath.js';
import {pricingWorkload} from './pricingWorkload.js';

/** Planejamento de custos de EQUIPE, sem movimentar caixa ou recalcular o orçamento.
 * Mensalista: alocação gerencial de folha já contabilizada no custo fixo da empresa.
 * Horista: custo variável previsto das horas de serviço efetivamente dimensionadas.
 * Cada trabalhador em uma equipe com N profissionais recebe 1/N das HH dessa função.
 */
export interface WorkAssignmentLine {
  employeeId:string;
  employeeName:string;
  roleKey:string;
  hours:number;
  cost:number|null;
  paymentBasis:'monthly'|'hourly';
}
export interface TaskCrewCost {
  taskId:string;
  compositionCode:string;
  variableHourly:number;
  allocatedMonthly:number;
  assignedHH:number;
  unassignedHH:number;
  /** HH de funcionários vinculados com remuneração ausente ou inválida. */
  unpricedAssignedHH:number;
  workers:WorkAssignmentLine[];
  warnings:string[];
}
export interface WorkCrewCostReport {
  tasks:TaskCrewCost[];
  variableHourly:number;
  allocatedMonthly:number;
  estimatedAssignedCost:number;
  assignedHH:number;
  unassignedHH:number;
  /** HH de funcionários vinculados com remuneração ausente ou inválida. */
  unpricedAssignedHH:number;
  issues:string[];
}
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
const normalized=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .trim().replace(/\s+/g,' ').toUpperCase();
export const roleKey=(code:string,role:string)=>code+':'+role;
export function employeeMatchesLabor(employee:EmployeeCost,code:string,role:string):boolean {
  if(employee.sinapiCode)return employee.sinapiCode===code;
  return normalized(employee.role)===normalized(role);
}
export function setTaskCrewEmployee(
  task:WorkSchedule['tasks'][number], key:string, employeeId:string, selected:boolean,
  employees:readonly EmployeeCost[]
):WorkSchedule['tasks'][number] {
  const labor=task.composition.labor.find(l=>roleKey(l.code,l.role)===key);
  if(!labor)throw Error('Profissão não pertence à composição SINAPI.');
  if(!employees.some(e=>e.id===employeeId&&employeeMatchesLabor(e,labor.code,labor.role)))
    throw Error('Funcionário não cadastrado nessa profissão.');
  const old=task.employeeAssignments||{};
  const ids=Array.isArray(old[key])?old[key]:[];
  const next=selected?[...new Set([...ids,employeeId])]:ids.filter(id=>id!==employeeId);
  const crew=task.crew?.[key]||0;
  if(selected && (!Number.isSafeInteger(crew)||crew<1))
    throw Error('Defina a quantidade de pessoas dessa profissão antes de alocar funcionários.');
  if(next.length>crew)throw Error('Há mais funcionários selecionados que vagas na equipe da função.');
  if(next.length>25)throw Error('Máximo de 25 funcionários identificados por função e etapa.');
  if(selected&&Object.entries(old).some(([otherKey,assigned])=>otherKey!==key&&
    Array.isArray(assigned)&&assigned.includes(employeeId)))
    throw Error('O mesmo funcionário não pode ocupar duas profissões na mesma etapa.');
  return {...task,employeeAssignments:{...old,[key]:next}};
}
/** Não atribui salário/hora fictício nem arredonda HH por profissional antes do custo.
 * Equipes externas e pessoas sem cadastro permanecem HH NÃO PRECIFICADAS.
 */
export function estimateWorkCrewCosts(
  schedule:WorkSchedule,
  report:ScheduleEstimate,
  employees:readonly EmployeeCost[],
  daysPerMonth?:number,hoursPerDay?:number
):WorkCrewCostReport{
  const lookup=new Map(employees.map(e=>[e.id,e]));
  const workload=pricingWorkload(daysPerMonth,hoursPerDay);
  const entries:TaskCrewCost[]=[];
  const usage=new Map<string,Array<{taskId:string;start:string;end:string}>>();
  for(const entry of report.entries){
    const current:TaskCrewCost={taskId:entry.task.id,compositionCode:entry.task.composition.code,
      variableHourly:0,allocatedMonthly:0,assignedHH:0,unassignedHH:0,unpricedAssignedHH:0,
      workers:[],warnings:[]};
    const assignments=entry.task.employeeAssignments||{};
    const usedInTask=new Set<string>();
    for(const labor of entry.labor){
      if(!Number.isFinite(labor.hours)||labor.hours<=0)continue;
      const key=roleKey(labor.code,labor.role);
      const ids=Array.isArray(assignments[key])?assignments[key]:[];
      if(new Set(ids).size!==ids.length)current.warnings.push(
        `Profissão ${labor.role}: alocações duplicadas foram ignoradas.`);
      const crew=labor.workers;
      if(!Number.isSafeInteger(crew)||crew<1||crew>500){
        current.unassignedHH+=labor.hours;
        current.warnings.push(`Profissão ${labor.role}: informe a equipe para estimar o custo.`);
        continue;
      }
      const selected=Array.from(new Set(ids));
      if(selected.length>crew){
        current.unassignedHH+=labor.hours;
        current.warnings.push(`Profissão ${labor.role}: ${selected.length} cadastrados para apenas ${crew} vaga(s). Corrija a equipe.`);
        continue;
      }
      let valid=0;
      for(const id of selected){
        const employee=lookup.get(id);
        if(!employee){
          current.warnings.push(`Funcionário excluído ou ausente (${id}): reatribua na etapa.`);
          continue;
        }
        if(!employeeMatchesLabor(employee,labor.code,labor.role)){
          current.warnings.push(`${employee.name}: profissão incompatível com ${labor.role}.`);
          continue;
        }
        if(usedInTask.has(id)){
          current.warnings.push(`${employee.name}: já alocado a outra função nesta etapa.`);
          continue;
        }
        usedInTask.add(id);
        const hours=labor.hours/crew;
        let cost:number|null=null;
        if(employee.paymentBasis==='hourly'){
          if(Number.isFinite(employee.paymentAmount)&&employee.paymentAmount>0){
            cost=round(hours*employee.paymentAmount);
            current.variableHourly+=cost;
          }else current.warnings.push(
            `${employee.name}: informe um valor por hora maior que zero para estimar o custo.`);
        }else if(!workload.valid||workload.hoursPerMonth<=0){
          current.warnings.push(
            `Defina dias/mês e horas/dia nos custos da empresa para ratear ${employee.name}.`);
        }else if(!Number.isFinite(employee.paymentAmount)||employee.paymentAmount<=0){
          current.warnings.push(
            `${employee.name}: informe um salário mensal maior que zero para estimar o custo.`);
        }else{
          // Alocação do salário, não uma nova despesa financeira.
          cost=round(hours*employee.paymentAmount/workload.hoursPerMonth);
          current.allocatedMonthly+=cost;
        }
        if(cost===null)current.unpricedAssignedHH+=hours;
        current.workers.push({employeeId:id,employeeName:employee.name,
          roleKey:key,hours:round(hours),cost,paymentBasis:employee.paymentBasis});
        current.assignedHH+=hours;
        valid++;
        if(entry.start&&entry.end){
          const all=usage.get(id)||[];all.push({taskId:entry.task.id,start:entry.start,end:entry.end});
          usage.set(id,all);
        }
      }
      current.unassignedHH+=labor.hours*(crew-valid)/crew;
      if(crew>valid)current.warnings.push(
        `${labor.role}: ${crew-valid} de ${crew} vaga(s) sem funcionário cadastrado nesta etapa.`);
    }
    current.variableHourly=round(current.variableHourly);
    current.allocatedMonthly=round(current.allocatedMonthly);
    current.assignedHH=round(current.assignedHH);
    current.unassignedHH=round(current.unassignedHH);
    current.unpricedAssignedHH=round(current.unpricedAssignedHH);
    entries.push(current);
  }
  // Mesmo CPF/nome NÃO é assumido por coincidência: usa somente IDs internos.
  for(const [id,windows] of usage){
    windows.sort((a,b)=>a.start.localeCompare(b.start));
    for(let i=0;i<windows.length;i++){
      for(let j=i+1;j<windows.length;j++){
        if(windows[j].start>windows[i].end)break;
        const name=lookup.get(id)?.name||'Funcionário';
        const warning=`${name} está alocado simultaneamente em duas etapas (${windows[i].taskId} e ${windows[j].taskId}). Confira a disponibilidade; o cronograma não muda automaticamente.`;
        for(const task of entries)if(task.taskId===windows[i].taskId||task.taskId===windows[j].taskId)
          task.warnings.push(warning);
      }
    }
  }
  const variableHourly=round(entries.reduce((sum,e)=>sum+e.variableHourly,0));
  const allocatedMonthly=round(entries.reduce((sum,e)=>sum+e.allocatedMonthly,0));
  return {tasks:entries,variableHourly,allocatedMonthly,
    estimatedAssignedCost:round(variableHourly+allocatedMonthly),
    assignedHH:round(entries.reduce((n,e)=>n+e.assignedHH,0)),
    unassignedHH:round(entries.reduce((n,e)=>n+e.unassignedHH,0)),
    unpricedAssignedHH:round(entries.reduce((n,e)=>n+e.unpricedAssignedHH,0)),
    issues:[...new Set(entries.flatMap(e=>e.warnings))]};
}
