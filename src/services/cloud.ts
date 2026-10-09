import type { WorkSchedule } from '../types/schedule';
import type { FinanceEntry } from '../types/finance';
import type { Quote, Client, CatalogItem, MonthlyExpense, CompanySettings, AppNotification } from '../types';

const origin = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const apiKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const cloudEnabled = !!(origin && apiKey);

export interface Session { access_token: string; refresh_token: string; expires_at: number; user: { id: string; email: string }; }
export type {WorkspaceData} from '../types/workspace';
import type {WorkspaceData} from '../types/workspace';

const sessionKey = 'orcapro_cloud_session';
export function readSession(): Session | null {
  try { const value = sessionStorage.getItem(sessionKey); return value ? JSON.parse(value) as Session : null; }
  catch { return null; }
}
export function persistSession(session: Session | null) {
  if (session) sessionStorage.setItem(sessionKey, JSON.stringify(session));
  else sessionStorage.removeItem(sessionKey);
}

async function jsonRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  if (!cloudEnabled) throw new Error('Configure o Supabase para ativar o modo em nuvem.');
  const response = await fetch(`${origin}${path}`, {
    ...options,
    headers: {
      apikey: apiKey,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : apiKey.startsWith('eyJ') ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...options.headers
    }
  });
  if (!response.ok) {
    let msg: string = 'O serviço não conseguiu concluir a operação.';
    try { const error = await response.json(); msg = error.msg || error.message || error.error_description || error.error || msg; } catch { /* no response JSON */ }
    throw new Error(`${msg} (HTTP ${response.status})`);
  }
  return response.status === 204 ? undefined as T : await response.json() as T;
}

function parseAuthSession(value: {access_token: string; refresh_token: string; expires_in: number; user: Session['user'] }): Session {
  return { access_token: value.access_token, refresh_token: value.refresh_token, expires_at: Date.now() + value.expires_in * 1000, user: { id: value.user.id, email: value.user.email } };
}

export async function signIn(email: string, password: string) {
  const result = await jsonRequest<any>('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
  return parseAuthSession(result);
}
export async function signUp(email: string, password: string) {
  const result = await jsonRequest<any>('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
  return result.session ? parseAuthSession({ ...result.session, user: result.user }) : (result.access_token ? parseAuthSession(result) : null);
}
export async function resetPassword(email: string): Promise<void> {
  await jsonRequest(`/auth/v1/recover?redirect_to=${encodeURIComponent(window.location.origin + window.location.pathname)}`, { method: 'POST', body: JSON.stringify({ email }) });
}
export async function setRecoveredPassword(accessToken: string, password: string): Promise<void> {
  await jsonRequest('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password }) }, accessToken);
}
export async function refreshSession(refreshToken: string) {
  const result = await jsonRequest<any>('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) });
  return parseAuthSession(result);
}
export async function signOut(token: string) {
  try { await jsonRequest('/auth/v1/logout', { method: 'POST' }, token); } finally { persistSession(null); }
}

export async function loadWorkspace(session: Session): Promise<{ data: WorkspaceData | null; revision: number }> {
  const result = await jsonRequest<{ payload: WorkspaceData; revision: number }[]>(
    `/rest/v1/orcapro_workspaces?user_id=eq.${encodeURIComponent(session.user.id)}&select=payload,revision`, {}, session.access_token);
  return result.length ? { data: result[0].payload, revision: result[0].revision } : { data: null, revision: 0 };
}

export async function saveWorkspace(session: Session, payload: WorkspaceData, revision: number): Promise<number> {
  const uri = revision === 0 ? '/rest/v1/orcapro_workspaces' : `/rest/v1/orcapro_workspaces?user_id=eq.${encodeURIComponent(session.user.id)}&revision=eq.${revision}`;
  const rows = await jsonRequest<{revision: number}[]>(uri, {
    method: revision === 0 ? 'POST' : 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(revision === 0 ? { user_id: session.user.id, revision: 1, payload } : { revision: revision + 1, payload })
  }, session.access_token);
  if (rows.length !== 1) throw new Error('Conflito de sincronização: existem alterações feitas em outra sessão. Exporte um backup antes de atualizar.');
  return rows[0].revision;
}

export interface PublicProposal { quote: Pick<Quote, 'id' | 'number' | 'date' | 'validUntil' | 'clientName' | 'notes' | 'paymentTerms'> & { total?: number; items: {name: string; quantity?: number; unit: string; totalPrice?: number}[] }; company: Pick<CompanySettings, 'tradeName' | 'name' | 'phone' | 'email' | 'pixKey'>; status: string; }
export function proposalUrl(token: string): string { return `${window.location.origin}${window.location.pathname}?proposta=${encodeURIComponent(token)}`; }
export async function shareProposal(session: Session, proposal: PublicProposal): Promise<string> {
  const persisted = await loadWorkspace(session);
  if (!persisted.data?.quotes.some(q => q.id === proposal.quote.id)) throw new Error('Aguarde o salvamento do orçamento na nuvem antes de compartilhar.');
  const rows = await jsonRequest<{ token: string }[]>(`/rest/v1/orcapro_shared_quotes`, {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: session.user.id, quote_id: proposal.quote.id, payload: proposal })
  }, session.access_token);
  if (!rows[0]?.token) throw new Error('Não foi possível gerar link de compartilhamento.');
  return proposalUrl(rows[0].token);
}
export async function publicProposal(token: string): Promise<{ payload: PublicProposal; status: string; expires_at: string } | null> {
  return jsonRequest('/rest/v1/rpc/orcapro_public_quote', { method: 'POST', body: JSON.stringify({ p_token: token }) });
}
export async function decideProposal(token: string, status: 'aprovado' | 'recusado'): Promise<boolean> {
  return jsonRequest('/rest/v1/rpc/orcapro_decide_quote', { method: 'POST', body: JSON.stringify({ p_token: token, p_status: status }) });
}
export async function readProposalDecisions(session: Session): Promise<{quote_id:string;status:string}[]> {
  return jsonRequest(`/rest/v1/orcapro_shared_quotes?user_id=eq.${encodeURIComponent(session.user.id)}&status=in.(aprovado,recusado)&select=quote_id,status`, {}, session.access_token);
}
