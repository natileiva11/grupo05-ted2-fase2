// =========================================================
// Pestañas: cada sección vive en su propio panel (#inicio, #museo, ...)
// =========================================================
const panels = [...document.querySelectorAll('[data-panel]')];
const tabs = [...document.querySelectorAll('.tab')];
const tabNames = panels.map((p) => p.dataset.panel);

function showTab(name, { animate = true } = {}) {
  if (!tabNames.includes(name)) name = 'inicio';
  document.body.dataset.tab = name;
  panels.forEach((p) => {
    const active = p.dataset.panel === name;
    p.hidden = !active;
    p.classList.remove('is-entering', 'is-leaving');
    if (active && animate) {
      void p.offsetWidth; // reinicia la animación de entrada
      p.classList.add('is-entering');
    }
  });
  tabs.forEach((t) => {
    const active = t.dataset.tab === name;
    t.classList.toggle('is-active', active);
    if (active) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  window.scrollTo({ top: 0, behavior: 'instant' });
  // lo que depende de medidas se calcula cuando el panel ya es visible
  requestAnimationFrame(() => {
    drawTrails();
    drawSolutions();
    redrawFound();
  });
}

window.addEventListener('hashchange', () => showTab(location.hash.slice(1)));
showTab(location.hash.slice(1), { animate: false });

// "Tocá para entrar": la cámara atraviesa la puerta de la reja y entra al museo
const enter = document.getElementById('enter');
const inicio = document.getElementById('inicio');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
enter.addEventListener('click', (e) => {
  e.preventDefault();
  if (reduceMotion) { location.hash = 'museo'; return; }
  inicio.classList.add('is-leaving');
  setTimeout(() => { location.hash = 'museo'; }, 950);
});

// =========================================================
// Aparición de elementos al hacer scroll
// =========================================================
const revealables = document.querySelectorAll('[data-reveal], .cards-trail');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
  revealables.forEach((el) => io.observe(el));
} else {
  revealables.forEach((el) => el.classList.add('in'));
}

// =========================================================
// Tarjetas que se dan vuelta (clic, Enter o Espacio)
// =========================================================
function setFlipped(card, flipped) {
  card.classList.toggle('is-flipped', flipped);
  card.setAttribute('aria-pressed', String(flipped));
}
document.querySelectorAll('.flip').forEach((card) => {
  card.addEventListener('click', () => setFlipped(card, !card.classList.contains('is-flipped')));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setFlipped(card, !card.classList.contains('is-flipped'));
    }
  });
});

// =========================================================
// Caminito de puntos que serpentea detrás de las tarjetas del tesoro,
// irregular como un mapa dibujado a mano, con un rulo y una X al final
// =========================================================
// curva suave que pasa por todos los puntos (Catmull-Rom)
function smoothPath(pts) {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

// números "al azar" pero siempre iguales, para que el mapa no cambie al recargar
function seeded(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawTrails() {
  document.querySelectorAll('[data-trail]').forEach((box) => {
    const svg = box.querySelector('.trail');
    const path = box.querySelector('.trail-path');
    const cards = [...box.querySelectorAll('.flip')];
    const W = box.clientWidth;
    if (!W || !cards.length) return;
    const rnd = seeded(11);
    const jit = (a, b) => a + rnd() * (b - a);

    // agrupar las tarjetas por fila
    const rows = [];
    cards.forEach((c) => {
      const top = c.offsetTop;
      const row = rows.find((r) => Math.abs(r.top - top) < 10);
      if (row) row.bottom = Math.max(row.bottom, top + c.offsetHeight);
      else rows.push({ top, bottom: top + c.offsetHeight });
    });

    // dónde empiezan y terminan las tarjetas, para que las curvas se abran por fuera
    const L = Math.min(...cards.map((c) => c.offsetLeft));
    const R = Math.max(...cards.map((c) => c.offsetLeft + c.offsetWidth));
    const outside = (right, a, b) => (right ? R + (W - R) * jit(a, b) : L * (1 - jit(a, b)));

    const pts = [[W * 0.02, -12], [W * jit(0.18, 0.24), jit(10, 22)]];
    rows.forEach((r, i) => {
      const h = r.bottom - r.top;
      const right = i % 2 === 0; // las filas alternan hacia qué borde se abre el camino
      const side = (a, b) => (right ? W * jit(a, b) : W * (1 - jit(a, b)));
      pts.push([side(0.62, 0.72), r.top + h * jit(0.04, 0.12)]);
      pts.push([outside(right, 0.45, 0.8), r.top + h * jit(0.3, 0.42)]);
      pts.push([outside(right, 0.2, 0.45), r.top + h * jit(0.68, 0.8)]);

      const next = rows[i + 1];
      if (!next) return;
      const gy = (r.bottom + next.top) / 2;
      const gh = next.top - r.bottom;
      pts.push([side(0.7, 0.8), gy - gh * jit(0.05, 0.25)]);
      pts.push([W * jit(0.42, 0.58), gy + gh * jit(-0.15, 0.15)]);
      pts.push([side(0.24, 0.34), gy + gh * jit(0.1, 0.3)]);
    });

    // el final del camino da un rulo, como en los mapas, y llega a la X del tesoro
    const last = rows[rows.length - 1];
    const room = box.clientHeight - last.bottom;
    const rr = Math.max(16, Math.min(room * 0.22, 34));
    const cy = last.bottom + room * 0.5;
    const cx = W * 0.4;
    const fromLeft = rows.length % 2 === 0; // de qué lado viene el camino
    pts.push([outside(!fromLeft, 0.3, 0.5), last.bottom + room * 0.12]);
    if (fromLeft) {
      pts.push([cx - rr * 1.6, cy - rr * 0.1]);
      pts.push([cx, cy + rr]);
      pts.push([cx + rr, cy]);
      pts.push([cx, cy - rr]);
      pts.push([cx - rr * 0.9, cy + rr * 0.15]);
      pts.push([cx + rr * 0.3, cy + rr * 1.05]);
    } else {
      pts.push([cx + rr * 2.2, cy - rr * 0.4]);
      pts.push([cx + rr, cy - rr * 0.2]);
      pts.push([cx, cy - rr]);
      pts.push([cx - rr, cy]);
      pts.push([cx, cy + rr]);
      pts.push([cx + rr * 1.3, cy + rr * 0.6]);
    }
    const xEnd = [W * jit(0.6, 0.66), cy + rr * 0.5];
    pts.push(xEnd);

    const d = smoothPath(pts);
    path.setAttribute('d', d);

    // la X del tesoro
    let x = svg.querySelector('.trail-x');
    if (!x) {
      x = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      x.setAttribute('class', 'trail-x');
      x.innerHTML = '<g class="trail-x-mark"><path d="M -1 -1 L 1 1 M 1 -1 L -1 1"/></g>';
      svg.appendChild(x);
    }
    const size = W > 600 ? 15 : 11;
    x.setAttribute('transform', `translate(${xEnd[0] + size * 1.9} ${xEnd[1]}) scale(${size})`);
  });
}

// =========================================================
// Mapa animado "¿Qué hay debajo?" (reemplaza al video)
// El camino se dibuja tramo por tramo y en cada parada aparece un objeto.
// Coordenadas medidas sobre el último cuadro del video (1080 x 1640).
// =========================================================
const MAP_SEGMENTS = [
  // del título hasta el mochaware
  [[487, 425], [466, 498], [420, 546], [360, 586], [312, 632], [292, 700], [310, 768]],
  // del mochaware hasta las cuentas de hueso
  [[310, 768], [356, 808], [412, 826], [472, 827], [528, 818], [582, 812], [632, 826], [668, 856], [692, 888]],
  // de las cuentas hasta la cerámica hispano-indígena
  [[742, 984], [708, 1020], [642, 1050], [560, 1068], [470, 1080], [382, 1078], [330, 1086], [300, 1102]],
  // de la cerámica, con el rulo, hasta la mayólica europea
  [[334, 1154], [366, 1172], [397, 1222], [436, 1276], [470, 1304], [498, 1258], [542, 1290], [512, 1328],
   [478, 1345], [500, 1386], [555, 1388], [600, 1360], [634, 1322], [668, 1290], [714, 1278]],
];

const mapBox = document.querySelector('[data-map]');
if (mapBox) {
  const paths = [...mapBox.querySelectorAll('.map-path')];
  const reveals = [...mapBox.querySelectorAll('.map-reveal')];
  const objs = [...mapBox.querySelectorAll('.map-obj')];
  const replay = document.querySelector('.map-replay');
  MAP_SEGMENTS.forEach((pts, i) => {
    const d = smoothPath(pts);
    paths[i].setAttribute('d', d);
    reveals[i].setAttribute('d', d);
  });
  objs.forEach((o, i) => o.style.setProperty('--fd', `${-i * 1.1}s`));

  let run = 0; // cada reproducción tiene su número; si arranca otra, la anterior se corta
  let played = false;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function resetMap() {
    run++;
    mapBox.classList.remove('is-playing');
    reveals.forEach((r) => {
      r.getAnimations().forEach((a) => a.cancel());
      const L = r.getTotalLength();
      r.style.strokeDasharray = `${L} ${L}`;
      r.style.strokeDashoffset = L;
    });
    objs.forEach((o) => { o.getAnimations().forEach((a) => a.cancel()); o.classList.remove('is-floating'); });
    replay.hidden = true;
  }

  function showFinal() {
    mapBox.classList.add('is-playing');
    reveals.forEach((r) => { r.style.strokeDashoffset = 0; });
    objs.forEach((o) => { o.style.opacity = 1; });
  }

  const draw = (i, ms) => {
    const L = reveals[i].getTotalLength();
    return reveals[i].animate(
      [{ strokeDashoffset: L }, { strokeDashoffset: 0 }],
      { duration: ms, easing: 'cubic-bezier(.45, 0, .4, 1)', fill: 'forwards' }
    ).finished;
  };
  const pop = (i) => {
    const o = objs[i];
    o.animate([
      { opacity: 0, transform: 'scale(.3) rotate(-14deg)' },
      { opacity: 1, transform: 'scale(1.12) rotate(4deg)', offset: 0.6 },
      { opacity: 1, transform: 'scale(1) rotate(0deg)' },
    ], { duration: 700, easing: 'cubic-bezier(.2, .8, .3, 1)', fill: 'forwards' });
    setTimeout(() => o.classList.add('is-floating'), 700);
  };

  async function playMap() {
    resetMap();
    const me = run;
    played = true;
    if (reduceMotion) { showFinal(); return; }
    mapBox.classList.add('is-playing');
    const steps = [
      () => wait(900),
      () => draw(0, 1100), () => pop(0), () => wait(350),
      () => draw(1, 1200), () => pop(1), () => wait(350),
      () => draw(2, 1200), () => pop(2), () => wait(350),
      () => draw(3, 1600), () => pop(3), () => wait(260), () => pop(4), () => wait(900),
    ];
    for (const step of steps) {
      if (me !== run) return;
      try { await step(); } catch (e) { return; } // animación cancelada por una nueva
    }
    if (me === run) replay.hidden = false;
  }

  replay.addEventListener('click', playMap);

  // arranca cuando el mapa aparece en pantalla (y de nuevo cada vez que se vuelve a la pestaña)
  const mapIO = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !played) playMap();
  }, { threshold: 0.3 });
  mapIO.observe(mapBox);
  window.addEventListener('hashchange', () => {
    if (location.hash === '#tesoro') played = false;
  });
}

// =========================================================
// Sopa de letras
// =========================================================
const GRID = [
  'OLEMAYOLICAL',
  'ÑIOQUDIKXOLW',
  'RBSJHKXRYJCR',
  'SCOZEOFEUEOA',
  'EGMQAYMHRPRP',
  'RIFTUKIAIJAI',
  'EZAPÑIMPJSKP',
  'LSEJSILSOVSB',
  'IUXUCAULGHUZ',
  'FMFAIPLIALPU',
  'LPSDMIFJUSKD',
  'AYJONTXIMDAO',
  'LNERXÑLALVFL',
  'IPOWSRGUIDOY',
  'RHSTRSENOTOB',
].map((row) => [...row]);
const ROWS = GRID.length;
const COLS = GRID[0].length;
const WORDS = ['MAYOLICA', 'ALCORA', 'BOTONES', 'ALFILERES', 'BOQUILLAS', 'PIPA', 'HORNILLOS', 'CERAMICA'];
const DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];

// dónde está cada palabra en la grilla (para dibujar las soluciones)
const placements = {};
WORDS.forEach((w) => {
  for (let r = 0; r < ROWS && !placements[w]; r++) {
    for (let c = 0; c < COLS && !placements[w]; c++) {
      for (const [dr, dc] of DIRS) {
        const end = [r + dr * (w.length - 1), c + dc * (w.length - 1)];
        if (end[0] < 0 || end[0] >= ROWS || end[1] < 0 || end[1] >= COLS) continue;
        if ([...w].every((ch, k) => GRID[r + dr * k][c + dc * k] === ch)) {
          placements[w] = { from: [r, c], to: end };
          break;
        }
      }
    }
  }
});

const SVGNS = 'http://www.w3.org/2000/svg';
function buildGrid(el) {
  GRID.forEach((row, r) => row.forEach((ch, c) => {
    const cell = document.createElement('span');
    cell.className = 'cell';
    cell.textContent = ch;
    cell.dataset.r = r;
    cell.dataset.c = c;
    el.appendChild(cell);
  }));
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.classList.add('marks');
  svg.setAttribute('aria-hidden', 'true');
  el.appendChild(svg);
  return svg;
}

const gridEl = document.getElementById('grid');
const solutionEl = document.getElementById('grid-solution');
const marks = buildGrid(gridEl);
const solutionMarks = buildGrid(solutionEl);
const cellAt = (el, r, c) => el.children[r * COLS + c];

// cápsula redondeada entre dos letras (como en la tarjeta de soluciones)
function capsule(svg, el, from, to, cls) {
  const a = cellAt(el, ...from);
  const b = cellAt(el, ...to);
  if (!a.offsetWidth) return null;
  const ax = a.offsetLeft + a.offsetWidth / 2;
  const ay = a.offsetTop + a.offsetHeight / 2;
  const bx = b.offsetLeft + b.offsetWidth / 2;
  const by = b.offsetTop + b.offsetHeight / 2;
  const h = Math.min(a.offsetWidth, a.offsetHeight) * 1.08;
  const len = Math.hypot(bx - ax, by - ay) + h;
  const angle = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
  const g = document.createElementNS(SVGNS, 'g');
  g.setAttribute('transform', `translate(${(ax + bx) / 2} ${(ay + by) / 2}) rotate(${angle})`);
  const rect = document.createElementNS(SVGNS, 'rect');
  rect.setAttribute('x', -len / 2);
  rect.setAttribute('y', -h / 2);
  rect.setAttribute('width', len);
  rect.setAttribute('height', h);
  rect.setAttribute('rx', h / 2);
  rect.setAttribute('class', cls);
  g.appendChild(rect);
  svg.appendChild(g);
  return g;
}

function drawSolutions() {
  solutionMarks.innerHTML = '';
  WORDS.forEach((w) => placements[w] && capsule(solutionMarks, solutionEl, placements[w].from, placements[w].to, 'mark-solution'));
}

const found = new Map(); // palabra -> { from, to }
function redrawFound() {
  marks.querySelectorAll('.is-found-mark').forEach((m) => m.remove());
  found.forEach(({ from, to }) => {
    const g = capsule(marks, gridEl, from, to, 'mark');
    if (g) { g.classList.add('is-found-mark'); g.firstChild.style.animation = 'none'; }
  });
}

// Selección: arrastrar de una letra a otra, o tocar la primera y después la última
let start = null;
let current = null;
let live = null;
let dragging = false;
let moved = false;
let pending = false; // primera letra elegida con un toque, esperando la última

function cellFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  return el && el.classList.contains('cell') && gridEl.contains(el) ? [+el.dataset.r, +el.dataset.c] : null;
}

// fuerza la selección a una línea recta (horizontal, vertical o diagonal)
function snap(from, to) {
  const dr = to[0] - from[0];
  const dc = to[1] - from[1];
  if (!dr && !dc) return to;
  const step = Math.round(Math.atan2(dr, dc) / (Math.PI / 4));
  const ang = step * Math.PI / 4;
  const sr = Math.round(Math.sin(ang));
  const sc = Math.round(Math.cos(ang));
  let n = Math.max(Math.abs(dr), Math.abs(dc));
  while (n > 0) {
    const r = from[0] + sr * n;
    const c = from[1] + sc * n;
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) return [r, c];
    n--;
  }
  return from;
}

function lineCells(from, to) {
  const n = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]));
  const sr = Math.sign(to[0] - from[0]);
  const sc = Math.sign(to[1] - from[1]);
  return Array.from({ length: n + 1 }, (_, k) => [from[0] + sr * k, from[1] + sc * k]);
}

function paintLive(from, to) {
  gridEl.querySelectorAll('.cell.is-active').forEach((c) => c.classList.remove('is-active'));
  if (live) live.remove();
  live = null;
  if (!from) return;
  lineCells(from, to).forEach(([r, c]) => cellAt(gridEl, r, c).classList.add('is-active'));
  live = capsule(marks, gridEl, from, to, 'mark mark-live');
}

function check(from, to) {
  const word = lineCells(from, to).map(([r, c]) => GRID[r][c]).join('');
  const reversed = [...word].reverse().join('');
  const hit = WORDS.find((w) => !found.has(w) && (w === word || w === reversed));
  if (!hit) return false;
  found.set(hit, { from, to });
  const g = capsule(marks, gridEl, from, to, 'mark');
  if (g) g.classList.add('is-found-mark');
  updateProgress();
  return true;
}

const counter = document.getElementById('puzzle-count');
const pills = [...document.querySelectorAll('.pill')];
function updateProgress() {
  const n = found.size;
  counter.textContent = n === WORDS.length
    ? '¡Encontraste las 8 palabras!'
    : `Encontraste ${n} de ${WORDS.length} palabras`;
  counter.classList.toggle('is-complete', n === WORDS.length);
  pills.forEach((p) => {
    const done = p.dataset.words.split(' ').every((w) => found.has(w));
    p.classList.toggle('is-done', done);
  });
}

gridEl.addEventListener('pointerdown', (e) => {
  const cell = cellFromPoint(e.clientX, e.clientY);
  if (!cell) return;
  e.preventDefault();
  gridEl.setPointerCapture(e.pointerId);
  dragging = true;
  moved = false;
  if (pending && start[0] === cell[0] && start[1] === cell[1]) {
    // tocar de nuevo la misma letra cancela la selección
    pending = false;
    dragging = false;
    start = null;
    paintLive(null);
    return;
  }
  if (pending) {
    // segundo toque: marca la línea desde la letra elegida antes
    pending = false;
    current = snap(start, cell);
    paintLive(start, current);
    return;
  }
  start = cell;
  current = cell;
  paintLive(start, current);
});

gridEl.addEventListener('pointermove', (e) => {
  if (!dragging || !start) return;
  const cell = cellFromPoint(e.clientX, e.clientY);
  if (!cell) return;
  const next = snap(start, cell);
  if (next[0] !== current[0] || next[1] !== current[1]) {
    moved = true;
    current = next;
    paintLive(start, current);
  }
});

function finish() {
  if (!dragging) return;
  dragging = false;
  const single = start && current && start[0] === current[0] && start[1] === current[1];
  if (single && !moved) { pending = true; return; } // primer toque: queda elegida, esperando el segundo
  check(start, current);
  start = null;
  current = null;
  paintLive(null);
}
gridEl.addEventListener('pointerup', finish);
gridEl.addEventListener('pointercancel', () => { dragging = false; pending = false; start = null; paintLive(null); });

// Girá la tarjeta: muestra las soluciones
const puzzle = document.querySelector('.puzzle');
const flipBtn = document.getElementById('puzzle-flip');
flipBtn.addEventListener('click', () => {
  const flipped = puzzle.classList.toggle('is-flipped');
  flipBtn.textContent = flipped ? 'Volver a jugar' : 'Girá la tarjeta';
  puzzle.querySelector('.puzzle-back').setAttribute('aria-hidden', String(!flipped));
  puzzle.querySelector('.puzzle-front').setAttribute('aria-hidden', String(flipped));
});

// Los nombres de la lista abren la ficha del objeto
pills.forEach((p) => p.addEventListener('click', () => {
  const card = document.getElementById(p.dataset.target);
  card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  setTimeout(() => {
    setFlipped(card, true);
    card.classList.remove('is-highlight');
    void card.offsetWidth;
    card.classList.add('is-highlight');
  }, reduceMotion ? 0 : 650);
}));

// Recalcular dibujos al cambiar el tamaño de la ventana
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { drawTrails(); drawSolutions(); redrawFound(); }, 120);
});
window.addEventListener('load', () => { drawTrails(); drawSolutions(); redrawFound(); });
if (document.fonts) document.fonts.ready.then(() => { drawTrails(); drawSolutions(); redrawFound(); });
