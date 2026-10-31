// Generates watercolor-style floral SVGs into the directory given as argv[2].
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2];

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rand = rng(7);
const between = (a, b) => a + rand() * (b - a);
const pick = (list) => list[Math.floor(rand() * list.length)];
const f = (n) => n.toFixed(1);

const LEAF_GREENS = ['#6f8b5e', '#7f9a6c', '#5d7a52', '#93a882', '#a9b994', '#4f6a47'];
const EUCA = ['#9db3a0', '#a9bfae', '#8aa391'];
const BLUSH = ['#f6d3cc', '#eeb4ab', '#e29a90', '#c46f66'];
const IVORY = ['#fbf2e3', '#f1e0c6', '#e6cfab', '#bf9f74'];
const DUSTY = ['#ecd2d8', '#dcaab5', '#c98e9c', '#a0606e'];

const FILTER = `
  <filter id="wc" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="4" result="warp"/>
    <feDisplacementMap in="SourceGraphic" in2="warp" scale="6" xChannelSelector="R" yChannelSelector="G" result="rough"/>
    <feGaussianBlur in="rough" stdDeviation="0.7" result="soft"/>
    <feGaussianBlur in="rough" stdDeviation="2.5" result="wide"/>
    <feComposite in="soft" in2="wide" operator="arithmetic" k1="0" k2="1.45" k3="-0.45" k4="0" result="pooled"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="9" result="paper"/>
    <feColorMatrix in="paper" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -0.25 1.1" result="paperMask"/>
    <feComposite in="pooled" in2="paperMask" operator="in"/>
  </filter>`;

function leaf(x, y, angle, length, width, color) {
  const w = width;
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)})" opacity="${f(between(0.72, 0.92))}">
    <path d="M0 0 C${f(length * 0.25)} ${f(-w * 1.1)} ${f(length * 0.7)} ${f(-w)} ${f(length)} 0 C${f(length * 0.7)} ${f(w * 0.9)} ${f(length * 0.3)} ${f(w)} 0 0 Z" fill="${color}"/>
    <path d="M${f(length * 0.05)} 0 Q${f(length * 0.5)} ${f(-w * 0.15)} ${f(length * 0.92)} 0" fill="none" stroke="#3f5838" stroke-width="0.8" opacity="0.35"/>
  </g>`;
}

function bloom(x, y, r, palette) {
  const parts = [`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.7)}" fill="${palette[0]}" opacity="0.35"/>`];
  const rings = [[1.05, 9, 0], [0.95, 8, 1], [0.72, 7, 1], [0.5, 5, 2], [0.28, 4, 2]];
  for (const [scale, count, tone] of rings) {
    const offset = rand() * 360;
    for (let i = 0; i < count; i++) {
      const a = offset + (360 / count) * i + between(-12, 12);
      const rad = (a * Math.PI) / 180;
      const d = r * scale * between(0.48, 0.6);
      const px = x + Math.cos(rad) * d;
      const py = y + Math.sin(rad) * d;
      const len = r * scale * between(0.42, 0.55);
      const wid = r * scale * between(0.38, 0.5);
      // Cupped petal: rounded outer edge, pinched toward the centre.
      parts.push(`<path d="M${f(-len)} 0 C${f(-len * 0.4)} ${f(-wid * 0.6)} ${f(len * 0.2)} ${f(-wid * 1.1)} ${f(len * 0.9)} ${f(-wid * 0.5)} C${f(len * 1.15)} 0 ${f(len * 0.9)} ${f(wid * 0.5)} ${f(len * 0.9)} ${f(wid * 0.5)} C${f(len * 0.2)} ${f(wid * 1.1)} ${f(-len * 0.4)} ${f(wid * 0.6)} ${f(-len)} 0 Z" transform="translate(${f(px)} ${f(py)}) rotate(${f(a)})" fill="${palette[tone]}" opacity="${f(between(0.4, 0.65))}"/>`);
    }
  }
  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2;
    const rr = r * between(0.35, 0.85);
    const a2 = a + between(0.6, 1.2);
    parts.push(`<path d="M${f(x + Math.cos(a) * rr)} ${f(y + Math.sin(a) * rr)} A${f(rr)} ${f(rr)} 0 0 1 ${f(x + Math.cos(a2) * rr)} ${f(y + Math.sin(a2) * rr)}" fill="none" stroke="${palette[3]}" stroke-width="${f(r * 0.03 + 0.6)}" opacity="0.45" stroke-linecap="round"/>`);
  }
  parts.push(`<path d="M${f(x - r * 0.12)} ${f(y)} q${f(r * 0.1)} ${f(-r * 0.18)} ${f(r * 0.2)} ${f(-r * 0.02)} q${f(r * 0.06)} ${f(r * 0.14)} ${f(-r * 0.12)} ${f(r * 0.14)}" fill="none" stroke="${palette[3]}" stroke-width="${f(r * 0.05 + 0.5)}" opacity="0.7" stroke-linecap="round"/>`);
  return parts.join('\n');
}

function bud(x, y, angle, size, palette) {
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)})">
    <path d="M0 0 C${f(-size * 0.6)} ${f(-size * 0.5)} ${f(-size * 0.4)} ${f(-size * 1.3)} 0 ${f(-size * 1.5)} C${f(size * 0.4)} ${f(-size * 1.3)} ${f(size * 0.6)} ${f(-size * 0.5)} 0 0 Z" fill="${palette[2]}" opacity="0.8"/>
    <path d="M0 0 C${f(-size * 0.5)} ${f(-size * 0.2)} ${f(-size * 0.7)} ${f(-size * 0.6)} ${f(-size * 0.5)} ${f(-size * 0.8)} M0 0 C${f(size * 0.5)} ${f(-size * 0.2)} ${f(size * 0.7)} ${f(-size * 0.6)} ${f(size * 0.5)} ${f(-size * 0.8)}" fill="none" stroke="#5d7a52" stroke-width="1.6" opacity="0.8"/>
  </g>`;
}

// Points along a cubic Bezier with tangent angles.
function along(...args) {
  const steps = args.pop();
  const [p0, p1, p2, p3] = args.map((point) => point.split(' ').map(Number));
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt ** 3 * p0[0] + 3 * mt ** 2 * t * p1[0] + 3 * mt * t ** 2 * p2[0] + t ** 3 * p3[0];
    const y = mt ** 3 * p0[1] + 3 * mt ** 2 * t * p1[1] + 3 * mt * t ** 2 * p2[1] + t ** 3 * p3[1];
    const dx = 3 * mt ** 2 * (p1[0] - p0[0]) + 6 * mt * t * (p2[0] - p1[0]) + 3 * t ** 2 * (p3[0] - p2[0]);
    const dy = 3 * mt ** 2 * (p1[1] - p0[1]) + 6 * mt * t * (p2[1] - p1[1]) + 3 * t ** 2 * (p3[1] - p2[1]);
    points.push({ x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI, t });
  }
  return points;
}

function branch(p0, p1, p2, p3, { steps, length, width, taper = true, hasStem = true }) {
  const parts = hasStem ? [`<path d="M${p0} C${p1} ${p2} ${p3}" fill="none" stroke="#61744f" stroke-width="1.8" opacity="0.8"/>`] : [];
  along(p0, p1, p2, p3, steps).slice(1).forEach((p, i) => {
    const scale = taper ? 1 - p.t * 0.55 : 1;
    const side = i % 2 === 0 ? -1 : 1;
    parts.push(leaf(p.x, p.y, p.angle + side * between(30, 55), length * scale * between(0.8, 1.15), width * scale, pick(LEAF_GREENS)));
  });
  return parts.join('\n');
}

function eucalyptus(p0, p1, p2, p3, { steps, radius }) {
  const parts = [`<path d="M${p0} C${p1} ${p2} ${p3}" fill="none" stroke="#7d8f73" stroke-width="1.4" opacity="0.8"/>`];
  along(p0, p1, p2, p3, steps).slice(1).forEach((p) => {
    const r = radius * (1 - p.t * 0.5);
    for (const side of [-1, 1]) {
      const rad = ((p.angle + side * 90) * Math.PI) / 180;
      parts.push(`<circle cx="${f(p.x + Math.cos(rad) * r * 0.9)}" cy="${f(p.y + Math.sin(rad) * r * 0.9)}" r="${f(r)}" fill="${pick(EUCA)}" opacity="${f(between(0.65, 0.85))}"/>`);
    }
  });
  return parts.join('\n');
}

function babysBreath(cx, cy, spread, count) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    parts.push(`<circle cx="${f(cx + between(-spread, spread))}" cy="${f(cy + between(-spread, spread))}" r="${f(between(1.6, 3.2))}" fill="#fffaf2" opacity="${f(between(0.7, 0.95))}"/>`);
  }
  return parts.join('\n');
}

// Leaves radiating outward from the corner, used as a bed behind the blooms.
function foliage(cx, cy, count, spread, length) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const angle = between(-15, 105);
    const rad = (angle * Math.PI) / 180;
    const d = between(0, spread);
    parts.push(leaf(cx + Math.cos(rad) * d, cy + Math.sin(rad) * d, angle + between(-20, 20), length * between(0.75, 1.2), length * between(0.26, 0.34), pick(LEAF_GREENS)));
  }
  return parts.join('\n');
}

function svg(width, height, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>${FILTER}</defs>
  <g filter="url(#wc)">
${body}
  </g>
</svg>
`;
}

function corner() {
  rand = rng(42);
  const parts = [
    foliage(40, 40, 22, 200, 95),
    // Edge branches have no stem: a long straight line along the page edge looks artificial.
    branch('20 30', '160 10', '330 40', '540 22', { steps: 14, length: 64, width: 18, hasStem: false }),
    branch('30 20', '10 160', '40 330', '22 540', { steps: 14, length: 64, width: 18, hasStem: false }),
    branch('60 60', '150 130', '230 230', '330 330', { steps: 9, length: 58, width: 17 }),
    eucalyptus('60 70', '170 60', '300 90', '450 80', { steps: 10, radius: 13 }),
    eucalyptus('70 60', '60 170', '90 300', '80 450', { steps: 10, radius: 13 }),
    branch('120 40', '220 60', '300 130', '380 160', { steps: 7, length: 50, width: 15 }),
    branch('40 120', '60 220', '130 300', '160 380', { steps: 7, length: 50, width: 15 }),
    foliage(150, 150, 10, 90, 70),
    bloom(236, 86, 46, IVORY),
    bloom(86, 236, 46, IVORY),
    bloom(196, 196, 32, DUSTY),
    bloom(110, 110, 72, BLUSH),
    bloom(330, 58, 26, BLUSH),
    bloom(58, 330, 26, BLUSH),
    bud(388, 44, 70, 14, BLUSH),
    bud(44, 388, 200, 14, BLUSH),
    bud(276, 150, 50, 12, DUSTY),
    bud(150, 276, 220, 12, DUSTY),
    babysBreath(285, 110, 26, 14),
    babysBreath(110, 285, 26, 14),
    babysBreath(250, 250, 18, 8),
  ];
  return svg(560, 560, parts.join('\n'));
}

// Seamless horizontal vine: stem enters and leaves at the same height and slope.
function vineContent(seed) {
  rand = rng(seed);
  const parts = [];
  const stemY = (x) => 46 + 9 * Math.sin((x / 480) * Math.PI * 2);
  parts.push(`<path d="${Array.from({ length: 49 }, (_, i) => `${i === 0 ? 'M' : 'L'}${i * 10} ${f(stemY(i * 10))}`).join(' ')}" fill="none" stroke="#61744f" stroke-width="1.6" opacity="0.75"/>`);
  for (let x = 26, i = 0; x <= 450; x += 22, i++) {
    const slope = (Math.atan2(stemY(x + 1) - stemY(x), 1) * 180) / Math.PI;
    const side = i % 2 === 0 ? -1 : 1;
    parts.push(leaf(x, stemY(x), slope + side * between(35, 60) - 10, between(26, 36), between(8, 10), pick(LEAF_GREENS)));
  }
  for (let x = 40; x <= 440; x += 32) {
    const slope = Math.atan2(stemY(x + 1) - stemY(x), 1);
    const r = between(5, 7);
    parts.push(`<circle cx="${f(x + 6)}" cy="${f(stemY(x) + Math.cos(slope) * 12)}" r="${f(r)}" fill="${pick(EUCA)}" opacity="0.7"/>`);
  }
  parts.push(bloom(150, stemY(150) - 4, 13, BLUSH), bloom(340, stemY(340) + 2, 11, IVORY), bud(250, stemY(250), 15, 9, DUSTY));
  parts.push(babysBreath(200, stemY(200) - 10, 10, 5), babysBreath(410, stemY(410) - 8, 10, 4));
  return parts.join('\n');
}

writeFileSync(join(outDir, 'flowers-corner.svg'), corner());
writeFileSync(join(outDir, 'vine-horizontal.svg'), svg(480, 100, vineContent(11)));
writeFileSync(join(outDir, 'vine-vertical.svg'), svg(100, 480, `<g transform="matrix(0 1 1 0 0 0)">\n${vineContent(23)}\n</g>`));
console.log('written');
