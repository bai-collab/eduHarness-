// ===== 教學動畫共用圖形（不得與範本播放器或工具重名）=====
const C = { yellow: 'var(--yellow)', blue: 'var(--blue)', green: 'var(--green)', red: 'var(--red)', orange: 'var(--orange)', purple: '#b9a3e3', chalk: 'var(--chalk)', dim: 'var(--chalk-dim)', deep: 'var(--board-deep)' };
function arrow(x1, y1, x2, y2, color = C.dim, op = 1, both = false, k = 1, dash = '') {
  const ex = lerp(x1, x2, k), ey = lerp(y1, y2, k);
  const ang = Math.atan2(y2 - y1, x2 - x1), h = 16;
  const head = (x, y, a) => `<polygon points="${x},${y} ${x - h * Math.cos(a - 0.45)},${y - h * Math.sin(a - 0.45)} ${x - h * Math.cos(a + 0.45)},${y - h * Math.sin(a + 0.45)}" fill="${color}"/>`;
  let g = `<g opacity="${op}"><line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}" stroke="${color}" stroke-width="4" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  if (k >= 0.99) { g += head(x2, y2, ang); if (both) g += head(x1, y1, ang + Math.PI); }
  return g + '</g>';
}
// 曲線箭頭：二次貝茲，k 為繪製進度（以 dasharray 截斷）
function curve(x1, y1, cx, cy, x2, y2, color = C.dim, op = 1, k = 1, label = '', lx = 0, ly = 0) {
  const len = 1400;
  let g = `<g opacity="${op}"><path d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="4" stroke-dasharray="10 9" pathLength="${len}" style="stroke-dashoffset:0"/>`;
  if (k < 0.99) g = `<g opacity="${op}"><path d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="4" pathLength="${len}" stroke-dasharray="${(len * k).toFixed(1)} ${len}"/>`;
  else {
    const a = Math.atan2(y2 - cy, x2 - cx), h = 16;
    g += `<polygon points="${x2},${y2} ${x2 - h * Math.cos(a - 0.45)},${y2 - h * Math.sin(a - 0.45)} ${x2 - h * Math.cos(a + 0.45)},${y2 - h * Math.sin(a + 0.45)}" fill="${color}"/>`;
  }
  if (label) g += txt(lx, ly, label, { c: 't-body', s: 24, f: color, o: k >= 0.99 ? 1 : 0 });
  return g + '</g>';
}
function hframe(x, y, w, h, op, label = '', color = C.yellow, glow = 0, size = 32) {
  return `<g opacity="${op}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="26" fill="rgba(242,193,78,${0.04 + 0.08 * glow})" stroke="${color}" stroke-width="${4 + 2 * glow}" stroke-dasharray="16 12"/>` +
    (label ? txt(x + 26, y + 44, label, { s: size, w: 1, f: color }) : '') + '</g>';
}
function card(x, y, W, h, op, lines, color = C.chalk) {
  // lines: [[文字, 字級, 顏色, 粗體, 字型類別, 置中]]，依序往下排
  let g = `<g opacity="${op}">${box(x, y, W, h, color, 1, C.deep)}`;
  let yy = y + 14;
  for (const [s, size = 28, f = C.chalk, bold = false, c = 't-chalk', cx = false] of lines) {
    yy += size * 1.25;
    g += txt(cx ? x + W / 2 : x + 24, yy, s, { s: size, f, w: bold, c, a: cx ? 'middle' : 'start' });
    yy += size * 0.3;
  }
  return g + '</g>';
}
function ccard(x, y, w, h, op, title, sub, color = C.chalk, tsize = 32, ssize = 24) {
  return `<g opacity="${op}">${box(x, y, w, h, color, 1, C.deep)}` +
    txt(x + w / 2, y + h / 2 + (sub ? -6 : tsize * 0.35), title, { a: 'middle', s: tsize, w: 1, f: color }) +
    (sub ? txt(x + w / 2, y + h / 2 + ssize + 8, sub, { a: 'middle', c: 't-body', s: ssize, f: C.dim }) : '') + '</g>';
}
function chip(x, y, w, label, op, color = C.chalk, size = 26, h = 58) {
  return `<g opacity="${op}">${box(x, y, w, h, color, 1, C.deep)}${txt(x + w / 2, y + h / 2 + size * 0.36, label, { a: 'middle', s: size, f: color })}</g>`;
}
function tick(x, y, s, op, color = C.green) {
  return `<path d="M${x - s} ${y} L${x - s / 3} ${y + s * 0.7} L${x + s} ${y - s * 0.8}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`;
}
function cross(x, y, s, op, color = C.red) {
  return `<g opacity="${op}" stroke="${color}" stroke-width="12" stroke-linecap="round"><line x1="${x - s}" y1="${y - s}" x2="${x + s}" y2="${y + s}"/><line x1="${x + s}" y1="${y - s}" x2="${x - s}" y2="${y + s}"/></g>`;
}
function dot(x, y, r, color, op = 1) { return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${op}"/>`; }
function underline(x1, x2, y, k, color = C.yellow, op = 1) { return `<line x1="${x1}" y1="${y}" x2="${lerp(x1, x2, k)}" y2="${y}" stroke="${color}" stroke-width="4" opacity="${op}"/>`; }
// 依進度逐一出現：第 i 個元素在 t0 + i*step 開始、花 dur 秒
const stagger = (u, t0, i, step = 0.6, dur = 0.7) => ease(P(u, t0 + i * step, t0 + i * step + dur));
