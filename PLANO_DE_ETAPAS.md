# OrçaPro — quadro de evolução consolidada v2.4

Atualizado em 09/10/2026. Versão de código consolidada, **ainda sem homologação integral em ambiente real**.

| Etapa | Código | Homologação | Entrega |
|---|---|---|---|
| v1.8 — medição e financeiro | Implementado | Parcial | Obras, lançamentos reais e dashboard |
| v1.9 — cronograma físico-financeiro | Implementado | Parcial | Paralelismo, dependências, feriados, vínculo financeiro |
| v2.0 — gestão operacional | Implementado | Parcial | Diário de obra, responsáveis, ocorrências |
| v2.1 — SINAPI e BDI | Implementado parcialmente | Parcial | HH XLSX real, BDI analítico, custos CSV estruturados, origem regional declarada; falta auto-mapeamento de planilhas oficiais de preços XLSX |
| v2.2 — desktop e relatórios | Implementado | Parcial | Modo fluido, PDF cronograma, PDF proposta; falta QA visual no navegador |
| v2.3 — segurança e estabilidade | Implementado parcialmente | Parcial | Backups validados, 95 testes, foco de teclado; permanecem alertas Supabase e testes de integração |
| v2.4 — custos SINAPI XLSX por UF | Implementado | Parcial | Leitura CSD/CCD, cache de fórmulas, verificação de referência e regime; falta interface integrada no navegador |
| v2.4.1 — correção de TypeScript e testes | Implementado | Aguardando validação Windows | PDF TS2783, tipos Node, TS5112, testes 96/96 no ambiente de manutenção |
| Pré-lançamento | Pendente | Pendente | Build + lint, e2e real, RLS segundo usuário, PDF mobile, segurança, checklist de release |

Não publicar como produção comercial antes das validações indicadas em `docs/VALIDACAO_FINAL.md`.

