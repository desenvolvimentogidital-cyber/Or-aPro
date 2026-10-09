import type {WorkSchedule} from './schedule';
import type {FinanceEntry} from './finance';
import type {Quote,Client,CatalogItem,MonthlyExpense,CompanySettings,AppNotification} from './index';
export interface WorkspaceData {
  quotes:Quote[];clients:Client[];catalog:CatalogItem[];expenses:MonthlyExpense[];
  company:CompanySettings;notifications:AppNotification[];
  schedules?:WorkSchedule[];financeEntries?:FinanceEntry[];lastQuoteNumber:number;
}
