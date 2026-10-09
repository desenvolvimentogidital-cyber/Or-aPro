/** Layout inicial a partir da largura real da janela.
 * Telefones e tablets estreitos usam navegação mobile em tela cheia;
 * telas >= 768px usam área de trabalho fluida/web.
 * Não altera registros do usuário, URLs, rotas nem estado persistido.
 */
export type ViewMode = 'mobile' | 'responsive';
export const LAYOUT_BREAKPOINT = 768;
export function modeForViewport(width: number): ViewMode {
  return Number.isFinite(width) && width >= LAYOUT_BREAKPOINT ? 'responsive' : 'mobile';
}
