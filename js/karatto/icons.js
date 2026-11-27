import { leafSVG } from './leaf.js?v=9';
/* カラット: pictograms. Flat, square, one colour (currentColor), drawn on a 24-unit grid. */
const svg = (b, s = 24) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="currentColor" aria-hidden="true">${b}</svg>`;
export const ICON = {
  /* 労働組合 the union: a hard hat over a raised fist */
  union: s => svg('<path d="M4 9a8 8 0 0 1 16 0v1H4z"/><rect x="3" y="10" width="18" height="2"/><rect x="11" y="3" width="2" height="5"/><path d="M8 14h8v3l-1 4H9l-1-4z"/><rect x="9" y="13" width="1.6" height="2"/><rect x="11.2" y="13" width="1.6" height="2"/><rect x="13.4" y="13" width="1.6" height="2"/>', s),
  /* 取締役会 the board: a gavel over a block */
  board: s => svg('<rect x="3" y="18" width="12" height="3"/><path d="M9.2 4.6l4.2-4.2 4.6 4.6-4.2 4.2z"/><path d="M11 9.6l2-2 9 9-2 2z"/><rect x="5" y="15" width="8" height="2"/>', s),
  /* 住民会議 residents: three houses */
  res: s => svg('<path d="M2 12l5-5 5 5v9H2z"/><path d="M12 13l5-5 5 5v8h-10z" opacity=".75"/><rect x="5" y="15" width="3" height="6" fill="#000" opacity=".5"/><rect x="15" y="16" width="3" height="5" fill="#000" opacity=".5"/>', s),
  /* 技術者連盟 engineers: a gear */
  eng: s => svg('<path d="M10 2h4l.6 2.6 2.2.9 2.3-1.4 2.8 2.8-1.4 2.3.9 2.2L22 10v4l-2.6.6-.9 2.2 1.4 2.3-2.8 2.8-2.3-1.4-2.2.9L14 22h-4l-.6-2.6-2.2-.9-2.3 1.4-2.8-2.8 1.4-2.3-.9-2.2L2 14v-4l2.6-.6.9-2.2-1.4-2.3 2.8-2.8 2.3 1.4 2.2-.9z"/><circle cx="12" cy="12" r="3.6" fill="#000"/>', s),
  /* the AI: an eye in a square */
  ai: s => leafSVG(s),   /* the AI and the corporation: the momiji leaf (leaf.js) */
  /* rival AI: a cracked square */
  rival: s => svg('<path d="M3 3h18v18H3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 5l-2 6 4 2-2 6" fill="none" stroke="currentColor" stroke-width="2"/>', s) };
