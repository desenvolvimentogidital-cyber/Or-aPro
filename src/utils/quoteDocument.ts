import type { Client, CompanySettings, Quote, QuoteItem, QuoteVisibilitySettings } from '../types';

/**
 * OrçaPro print/PDF document. Only persisted quote/company/client fields are rendered.
 * No fake signatures, photos, logos, deadlines, or commercial terms are synthesized.
 * Browser PDF export preserves selectable text and paginates long item tables.
 */

export function escapeHtml(input: unknown): string {
  return String(input ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char] || char);
}

/** Prevent quotes or malformed URLs from injecting HTML/active content. */
export function safeImageSrc(input: unknown): string {
  if (typeof input !== 'string') return '';
  const value = input.trim();
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch { /* invalid or relative URLs are not rendered */ }
  return '';
}

const money = (value: number) => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(Number.isFinite(value) ? value : 0);
const date = (text: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text || '')) return escapeHtml(text);
  const [year, month, day] = text.split('-');
  return `${day}/${month}/${year}`;
};
const amount = (value: number) => new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 3}).format(value);

function svgIcon(kind: 'bolt'|'building'|'user'|'tools'|'product'|'calendar'|'document'|'clock'|'note') {
  const shared = 'width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#ff9a26" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const paths: Record<typeof kind, string> = {
    bolt:'<path d="M13 2 4 13h7l-1 9 10-12h-7V2z"/>',
    building:'<path d="M4 21V4l9-2v19M13 8h7v13M2 21h20"/><path d="M7 7h2m-2 4h2m-2 4h2m8-3h2m-2 4h2"/>',
    user:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    tools:'<path d="M14.7 6.3a5 5 0 0 0-7 6.5L3 17.5 6.5 21l4.7-4.7a5 5 0 0 0 6.5-7l-3.9 3.9-3.4-3.4z"/>',
    product:'<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 5v10l9 5 9-5V7M12 12v10"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 10h18"/>',
    document:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8m-8 4h8"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    note:'<path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9l-6-6H8z"/><path d="M15 3v6h6M7 13h10m-10 4h8"/>'
  };
  return `<svg ${shared}>${paths[kind]}</svg>`;
}

function field(value: unknown): string { return value ? escapeHtml(value) : ''; }
function detail(value: unknown): string { return value ? `<div>${field(value)}</div>` : ''; }

function itemsTable(items: QuoteItem[], title: string, icon: 'tools'|'product', v: QuoteVisibilitySettings): string {
  if (!items.length) return '';
  const showAmounts = v.showTotal !== false;
  const showQty = v.showQuantities !== false;
  const showUnit = v.showUnitPrices !== false;
  const headers = [
    '<th class="name-col">' + (icon === 'tools' ? 'Serviço' : 'Produto') + '</th>',
    showQty ? '<th class="qty-col">Quantidade</th><th class="unit-col">Unidade</th>' : '',
    showUnit ? '<th class="unit-price-col">Valor unit.</th>' : '',
    showAmounts ? '<th class="line-total-col">Valor total</th>' : ''
  ].join('');
  const rows = items.map(item => {
    const photo = safeImageSrc(item.imageUrl);
    const preview = photo
      ? `<img class="item-photo" src="${escapeHtml(photo)}" alt="" />`
      : `<div class="item-symbol">${svgIcon(icon)}</div>`;
    return `<tr><td class="item-name-cell"><div class="item-flex">${preview}<span class="item-name">${field(item.name)}</span></div></td>` +
      (showQty ? `<td class="numeric muted">${amount(item.quantity)}</td><td class="numeric muted">${field(item.unit)}</td>` : '') +
      (showUnit ? `<td class="numeric">${money(item.unitPrice)}</td>` : '') +
      (showAmounts ? `<td class="numeric orange strong">${money(item.totalPrice)}</td>` : '') +
      '</tr>';
  }).join('');
  return `<section class="line-section"><h2>${svgIcon(icon)} <span>${title}</span></h2><div class="line-table"><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

export interface QuoteDocumentInput { quote: Quote; company: CompanySettings; client?: Client | null; }

export function buildQuoteDocument({ quote, company, client }: QuoteDocumentInput): string {
  // Object.assign preserves defaults for legacy quotes without triggering TS2783
  // when a complete visibility object overrides these values.
  const v: QuoteVisibilitySettings = Object.assign({
    showServices:true, showMaterials:true, showQuantities:true, showUnitPrices:true,
    showTaxes:true, showProfitMargin:false, showDiscount:true, showTotal:true,
    showTerms:true, showPix:true, showSignature:true
  }, quote.visibility ?? {});
  const services = quote.items.filter(i => i.type !== 'material');
  const products = quote.items.filter(i => i.type === 'material');
  const shownServices = v.showServices ? services : [];
  const shownProducts = v.showMaterials ? products : [];
  const logo = safeImageSrc(company.logoUrl);
  const companyName = company.tradeName || company.name;
  const brandTitle = companyName || 'Empresa não identificada';
  const addr = [company.city, company.state].filter(Boolean).join(' - ');
  const custAddr = [client?.city].filter(Boolean).join('');
  const summaryRows = [
    (shownServices.length && v.showUnitPrices && v.showTotal) ? `<div><span>Serviços:</span><b>${money(shownServices.reduce((s,i) => s+i.totalPrice, 0))}</b></div>` : '',
    (shownProducts.length && v.showUnitPrices && v.showTotal) ? `<div><span>Produtos:</span><b>${money(shownProducts.reduce((s,i) => s+i.totalPrice, 0))}</b></div>` : '',
    (quote.travelCost > 0 && v.showTotal) ? `<div><span>Deslocamento / entrega:</span><b>${money(quote.travelCost)}</b></div>` : '',
    (quote.otherCosts > 0 && v.showTotal) ? `<div><span>Custos adicionais:</span><b>${money(quote.otherCosts)}</b></div>` : '',
    v.showTotal ? `<div><span>Subtotal:</span><b>${money(quote.subtotal)}</b></div>` : '',
    (v.showDiscount && quote.discountValue > 0 && v.showTotal) ? `<div><span>Desconto:</span><b>- ${money(quote.discountValue)}</b></div>` : '',
    (v.showTaxes && quote.taxRate > 0 && v.showTotal) ? `<div class="minor"><span>Tributos considerados (${amount(quote.taxRate)}%, incluídos):</span><b>${money(quote.total * quote.taxRate / 100)}</b></div>` : ''
  ].filter(Boolean).join('');
  const notes = [quote.paymentTerms ? `<div><b>Formas de pagamento:</b> ${field(quote.paymentTerms)}</div>` : '', quote.notes ? `<div>${field(quote.notes)}</div>` : '', company.termsAndConditions ? `<div>${field(company.termsAndConditions)}</div>` : '', v.showPix && company.pixKey ? `<div><b>Pix (${field(company.pixType)}):</b> ${field(company.pixKey)}</div>` : ''].filter(Boolean).join('');
  const pageTitle = `Orçamento ${quote.number} - ${brandTitle}`;
  const template = quote.modelTemplate === 'moderno' ? 'moderno' : quote.modelTemplate === 'profissional' ? 'profissional' : 'padrao';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${field(pageTitle)}</title>
<style>
:root{color-scheme:dark;--paper:#06101b;--panel:#0b1825;--orange:#ff820a;--text:#f8fafc;--muted:#a9b5c8}
body.template-moderno{--orange:#45c6f3}body.template-profissional{--orange:#e9ab50}body.template-moderno .background{filter:hue-rotate(170deg)}body.template-profissional .background{filter:saturate(.5)}
*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Arial,'DejaVu Sans',sans-serif;color:var(--text);background:var(--paper)}
body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;font-size:11px;line-height:1.4}
.background{position:fixed;inset:0;background:radial-gradient(ellipse 120mm 50mm at -8% 0,rgba(255,103,0,.32),transparent 78%),radial-gradient(ellipse 100mm 44mm at 110% 100%,rgba(255,102,0,.26),transparent 75%),linear-gradient(145deg,#020a13,#071525 48%,#020912);z-index:0;pointer-events:none}
.lightning{position:fixed;width:160px;height:180px;z-index:0;opacity:.65;filter:drop-shadow(0 0 8px #ff6d09)}.lightning.top{top:0;left:0}.lightning.bottom{right:0;bottom:0;transform:rotate(180deg)}
.sheet{position:relative;z-index:1;width:210mm;min-height:297mm;margin:auto;padding:11mm 10mm 12mm;}
.header{display:grid;grid-template-columns:1.06fr .94fr;gap:19px;margin-bottom:10px;align-items:center}
.brand{min-width:0;display:flex;align-items:center;gap:12px;padding:3px 0 9px;border-right:1px solid rgba(255,130,10,.48);min-height:101px}
.brand-icon{width:78px;height:78px;flex:none;border:3px solid var(--orange);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--orange);background:rgba(0,0,0,.22);box-shadow:0 0 17px rgba(255,113,0,.35)}
.brand-icon img{width:100%;height:100%;object-fit:contain;border-radius:50%}.brand-icon svg{height:43px;width:43px;stroke-width:1.5}
.brand-copy{min-width:0}.brand-title{font-size:23px;line-height:1.07;letter-spacing:.3px;font-weight:900;font-style:italic;text-transform:uppercase;overflow-wrap:anywhere}.brand-tagline{color:var(--muted);font-size:10px;margin-top:10px;overflow-wrap:anywhere}
.quote-heading h1{font-size:25px;font-weight:900;margin:0 0 2px}.quote-heading p{margin:0 0 10px;color:#b4bed0;font-size:12px}.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.meta{display:flex;gap:7px;align-items:center;background:linear-gradient(100deg,#0e1c2b,#091625);border:1px solid #263343;border-left:1px solid rgba(255,119,0,.52);border-radius:9px;padding:7px 8px;min-height:45px}.meta svg{width:17px;height:17px;color:var(--orange);flex:none}.meta label{display:block;color:#aab8cc;font-size:9px}.meta b{font-size:11px;white-space:normal;overflow-wrap:anywhere}
.card{background:linear-gradient(115deg,rgba(14,25,39,.96),rgba(5,16,29,.95));border:1px solid #223345;border-left:1.5px solid rgba(255,128,12,.73);border-radius:14px;padding:12px 14px;box-shadow:0 3px 19px rgba(0,0,0,.14);margin:0 0 8px;break-inside:avoid-page;page-break-inside:avoid}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:0}.party{display:flex;gap:11px;min-width:0}.party:first-child{padding-right:17px;border-right:1px solid #283749}.party:last-child{padding-left:18px}.round-icon{display:flex;align-items:center;justify-content:center;flex:none;border-radius:50%;width:39px;height:39px;background:linear-gradient(145deg,#ffb000,#ff5700);color:white;box-shadow:0 0 13px #ff690041}.round-icon svg{width:22px;height:22px}
.party-label{color:var(--orange);font-size:11px;font-weight:700;margin:0 0 4px}.party-title{font-size:17px;font-weight:800;color:#fff;margin:0 0 4px;overflow-wrap:anywhere}.party-details{font-size:10.5px;color:var(--muted);line-height:1.55;overflow-wrap:anywhere}
.line-section{border:1px solid #26384b;border-left:1.5px solid rgba(255,120,0,.65);border-radius:14px;padding:9px 10px 7px;background:linear-gradient(115deg,rgba(7,16,27,.95),rgba(6,19,32,.93));margin-bottom:8px;break-inside:auto}
h2{margin:0 0 9px;color:white;display:flex;align-items:center;gap:8px;font-size:19px;line-height:1.1}h2 svg{color:var(--orange);width:25px;height:25px}
.line-table{width:100%}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}thead th{font-size:10px;font-weight:600;color:#b7c3d5;background:#172536;padding:8px 7px;text-align:center;white-space:normal}thead th:first-child{text-align:left;border-radius:6px 0 0 6px}thead th:last-child{border-radius:0 6px 6px 0}tr{break-inside:avoid-page;page-break-inside:avoid}tbody td{border-bottom:1px solid #263341;padding:5px 7px;font-size:10.5px;vertical-align:middle}tbody tr:last-child td{border-bottom:0}
.name-col{width:auto}.qty-col{width:12%}.unit-col{width:11%}.unit-price-col{width:18%}.line-total-col{width:19%}.numeric{text-align:right;white-space:nowrap;font-size:10px}.orange{color:var(--orange)}.strong{font-weight:800}.muted{color:var(--muted)}
.item-flex{display:flex;align-items:center;gap:10px}.item-name{font-weight:600;overflow-wrap:anywhere;min-width:0}.item-photo,.item-symbol{width:58px;height:40px;flex:none;border-radius:7px;border:1px solid #334155;background:radial-gradient(circle at 30% 25%,#223043,#06101b);object-fit:contain}.item-symbol{display:flex;align-items:center;justify-content:center;color:#d4e0ef}.item-symbol svg{width:25px;height:25px}
.summary-card{display:flex;gap:14px;align-items:stretch;break-inside:avoid-page;page-break-inside:avoid;margin:0 0 8px;border:1px solid #25354a;border-left:1px solid rgba(255,130,0,.6);border-radius:14px;background:linear-gradient(115deg,#0c1724,#06101b);overflow:hidden;padding:10px}
.summary-art{width:39%;display:flex;align-items:center;justify-content:center;position:relative;color:rgba(255,123,0,.26);border-right:1px solid #26374a}.summary-art svg{width:87px;height:87px;stroke-width:.8}.summary-art:before{content:'';position:absolute;inset:-40px;background:radial-gradient(circle,rgba(255,114,0,.11),transparent 70%)}
.summary-info{flex:1;min-width:0}.summary-list>div{display:flex;justify-content:space-between;gap:9px;font-size:11px;color:#bdc8d8;margin-bottom:3px}.summary-list b{font-weight:500;color:#f4f7fb;white-space:nowrap}.summary-list .minor{font-size:9.5px;color:#99a7ba}
.summary-total{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid rgba(255,132,12,.4);padding-top:9px;margin-top:10px;font-size:14px;font-weight:800}.total-amount{color:#ff901a;font-size:22px;text-shadow:0 0 11px rgba(255,104,0,.4);background:#160d08;border:1px solid var(--orange);padding:7px 12px;border-radius:10px;box-shadow:inset 0 0 10px #ff6a0036,0 0 8px #ff6a0038;white-space:nowrap}
.note-title{font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px}.note-title svg{color:var(--orange)}.note-body{padding:6px 12px 6px 42px;color:#c8d2e0;font-size:11px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}.note-body>div{margin-bottom:4px}
.signatures{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 8px;break-inside:avoid-page;page-break-inside:avoid}.signature-box{min-height:77px;text-align:center;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;border:1px solid #314155;border-left:1.5px solid var(--orange);border-radius:13px;background:linear-gradient(115deg,#111b26,#061321);padding:12px 14px}.signature-line{width:80%;border-top:1px solid #95a0b1;margin-top:22px;margin-bottom:5px}.signatures b{font-size:12px}.signatures small{color:#a2b0c5}
.footer{margin-top:10px;display:flex;align-items:center;gap:16px;justify-content:center;color:#acb7c6;font-size:10px;overflow-wrap:anywhere;text-align:center}.footer:before,.footer:after{content:'';display:block;height:1px;background:#314054;flex:1}
@media screen and (max-width:790px){.sheet{width:100%;min-height:0;padding:12px}.header{grid-template-columns:1fr;gap:9px}.brand{border-right:0;border-bottom:1px solid #3d2e26;min-height:90px}.brand-icon{height:57px;width:57px}.brand-title{font-size:20px}.parties{grid-template-columns:1fr;gap:12px}.party:first-child{border-right:0;border-bottom:1px solid #283749;padding-right:0;padding-bottom:12px}.party:last-child{padding-left:0}.summary-art{display:none}.numeric{font-size:9px}.item-photo,.item-symbol{width:37px;height:35px}.summary-total{font-size:11px}.total-amount{font-size:16px}.signatures{grid-template-columns:1fr}}
@media print{ @page{size:A4;margin:0}html,body{width:210mm;min-height:0!important;margin:0;background:var(--paper)!important;color:var(--text)!important} .sheet{width:210mm;min-height:0;padding:11mm 10mm 12mm} .background,.lightning{position:fixed} .line-section,.card,.summary-card,.signature-box,thead th,.meta{background-color:var(--panel)!important} }
</style></head><body class="template-${template}">
<div class="background"></div>
<svg class="lightning top" viewBox="0 0 180 190" aria-hidden="true"><path d="M-12 96 27 85 62 35 86 46 118 -10 M8 0 44 40 20 65 37 83 5 105 M0 142 42 113 60 130 101 110" fill="none" stroke="#ff8109" stroke-width="2.1"/><path d="M-12 96 27 85 62 35 86 46 118 -10" fill="none" stroke="#fff1ad" stroke-width=".7"/></svg>
<svg class="lightning bottom" viewBox="0 0 180 190" aria-hidden="true"><path d="M-12 96 27 85 62 35 86 46 118 -10 M8 0 44 40 20 65 37 83 5 105" fill="none" stroke="#ff8109" stroke-width="2.1"/></svg>
<main class="sheet">
<header class="header"><div class="brand"><div class="brand-icon">${logo ? `<img alt="Logotipo da empresa" src="${escapeHtml(logo)}">` : svgIcon('bolt')}</div><div class="brand-copy"><div class="brand-title">${field(brandTitle)}</div>${company.tagline ? `<div class="brand-tagline">${field(company.tagline)}</div>` : ''}</div></div>
<div class="quote-heading"><h1>Orçamento</h1><p>Proposta comercial personalizada</p><div class="meta-grid">
<div class="meta">${svgIcon('calendar')}<div><label>Data</label><b>${date(quote.date)}</b></div></div><div class="meta">${svgIcon('document')}<div><label>Orçamento Nº</label><b>${field(quote.number)}</b></div></div>
<div class="meta">${svgIcon('calendar')}<div><label>Válido até</label><b>${date(quote.validUntil)}</b></div></div>${quote.executionDeadline ? `<div class="meta">${svgIcon('clock')}<div><label>Prazo de execução</label><b>${field(quote.executionDeadline)}</b></div></div>` : ''}
</div></div></header>
<section class="card parties"><div class="party"><div class="round-icon">${svgIcon('building')}</div><div><div class="party-label">Empresa</div><div class="party-title">${field(brandTitle)}</div><div class="party-details">${detail(company.document ? `CPF/CNPJ: ${company.document}` : '')}${detail(company.address)}${detail(addr)}${detail(company.whatsapp || company.phone)}${detail(company.email)}</div></div></div><div class="party"><div class="round-icon">${svgIcon('user')}</div><div><div class="party-label">Cliente</div><div class="party-title">${field(quote.clientName)}</div><div class="party-details">${detail(client?.document ? `CPF/CNPJ: ${client.document}` : '')}${detail(client?.address)}${detail(custAddr)}${detail(quote.clientPhone)}${detail(quote.clientEmail)}</div></div></div></section>
${itemsTable(shownServices,'Serviços','tools',v)}${itemsTable(shownProducts,'Produtos','product',v)}
${v.showTotal ? `<section class="summary-card"><div class="summary-art">${svgIcon('bolt')}</div><div class="summary-info"><div class="summary-list">${summaryRows}</div><div class="summary-total"><span>Total estimado:</span><span class="total-amount">${money(quote.total)}</span></div></div></section>` : ''}
${v.showTerms && notes ? `<section class="card"><div class="note-title">${svgIcon('note')}<span>Observações</span></div><div class="note-body">${notes}</div></section>` : ''}
${v.showSignature ? `<section class="signatures"><div class="signature-box"><div class="signature-line"></div><b>${field(quote.clientName)}</b><small>Cliente · espaço para assinatura</small></div><div class="signature-box"><div class="signature-line"></div><b>${field(company.signatureName || brandTitle)}</b><small>Empresa · espaço para assinatura</small></div></section>` : ''}
<footer class="footer">${field(brandTitle)}${company.tagline ? ` · ${field(company.tagline)}` : ''}</footer>
</main></body></html>`;
}
