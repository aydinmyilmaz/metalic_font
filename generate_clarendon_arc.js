/**
 * Clarendon-style arched chrome text generator.
 *
 * Goal:
 * - Arched text
 * - Purple -> white -> purple chrome gradient
 * - White outline
 * - Outer + inner glow
 * - Bold serif look (prefers Clarendon Blk BT if available)
 *
 * Usage:
 *   node generate_clarendon_arc.js
 *   node generate_clarendon_arc.js --text "KEREM" --bend 0.28 --size 220 --out clarendon_kerem
 *
 * Optional font install:
 *   Put a licensed Clarendon Blk BT font file into ./fonts and pass:
 *   --fontFile ClarendonBlkBT.ttf
 */

const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  text: 'KEREM',
  width: 1280,
  height: 1600,
  size: 300,
  out: 'clarendon_blk_bt_style',
  bend: 0.18,
  curve: 16,
  rotateFactor: 0.28,
  apexYRatio: 0.25,
  verticalOffset: 0,
  letterSpacing: -0.02,
  glowOpacity: 0.60,
  glowSize: 24,
  strokeSize: 10,
  gradientOpacity: 0.92,
  bevelHighlightOpacity: 0.90,
  bevelShadowOpacity: 0.62,
  topShadowOpacity: 0.18,
  bevelSize: 20,
  extrudeDepth: 12,
  extrudeOpacity: 0.32,
  renderScale: 3.0,
  edge3dStrength: 1.0,
  fontFile: '',
  preset: '',
  curveMode: 'flat',
  warpStartRatio: 0.62,
  warpPower: 1.4,
  warpDirection: 'down',
  warpIncludeExtrude: false,
  curveScope: 'full',
  topColor: '#b66eb8',
  midColor: '#ffffff',
  bottomColor: '#4a0f59',
  outlineColor: '#f2ebff',
  glowColor: '#ffffff',
};

const INTEGER_KEYS = ['width', 'height', 'size', 'curve', 'glowSize', 'strokeSize', 'bevelSize', 'extrudeDepth'];
const FLOAT_KEYS = [
  'bend', 'letterSpacing', 'glowOpacity', 'apexYRatio', 'verticalOffset',
  'gradientOpacity', 'bevelHighlightOpacity', 'bevelShadowOpacity', 'topShadowOpacity',
  'extrudeOpacity', 'renderScale', 'rotateFactor', 'edge3dStrength',
  'warpStartRatio', 'warpPower',
];

function applyPreset(cfg, presetName) {
  if (presetName !== 'photoshop') return;

  // Photoshop-like recipe:
  // Arc bend + purple chrome gradient + white stroke + strong glow + bevel.
  cfg.bend = 0.26;
  cfg.gradientOpacity = 0.92;
  cfg.strokeSize = 10;
  cfg.glowOpacity = 0.60;
  cfg.glowSize = 24;
  cfg.bevelHighlightOpacity = 0.90;
  cfg.bevelShadowOpacity = 0.62;
  cfg.topShadowOpacity = 0.18;
  cfg.bevelSize = 20;
  cfg.extrudeDepth = 12;
  cfg.extrudeOpacity = 0.32;
  cfg.edge3dStrength = 1.0;
  cfg.curveMode = 'flat';
  cfg.warpStartRatio = 0.62;
  cfg.warpPower = 1.4;
  cfg.topColor = '#b66eb8';
  cfg.midColor = '#ffffff';
  cfg.bottomColor = '#4a0f59';
  cfg.outlineColor = '#f2ebff';
  cfg.glowColor = '#ffffff';
}

function normalizeConfig(input = {}) {
  const raw = { ...input };
  const cfg = { ...DEFAULT_CONFIG };

  const presetName = String(raw.preset || '');
  if (presetName) applyPreset(cfg, presetName);

  for (const key of Object.keys(raw)) {
    const value = raw[key];
    if (typeof value === 'undefined' || value === null || value === '') continue;
    cfg[key] = value;
  }

  for (const key of INTEGER_KEYS) {
    const num = Number(cfg[key]);
    cfg[key] = Number.isFinite(num) ? Math.round(num) : DEFAULT_CONFIG[key];
  }
  for (const key of FLOAT_KEYS) {
    const num = Number(cfg[key]);
    cfg[key] = Number.isFinite(num) ? num : DEFAULT_CONFIG[key];
  }

  cfg.text = String(cfg.text || DEFAULT_CONFIG.text);
  cfg.out = String(cfg.out || DEFAULT_CONFIG.out).replace(/[^a-zA-Z0-9_-]/g, '_');
  cfg.fontFile = String(cfg.fontFile || '');
  cfg.preset = String(cfg.preset || '');
  cfg.curveMode = String(cfg.curveMode || DEFAULT_CONFIG.curveMode);
  if (!['flat', 'arc', 'arcCurve', 'bottomWarp'].includes(cfg.curveMode)) {
    cfg.curveMode = DEFAULT_CONFIG.curveMode;
  }
  cfg.warpDirection = String(cfg.warpDirection || DEFAULT_CONFIG.warpDirection);
  if (!['down', 'up'].includes(cfg.warpDirection)) {
    cfg.warpDirection = DEFAULT_CONFIG.warpDirection;
  }
  cfg.curveScope = String(cfg.curveScope || DEFAULT_CONFIG.curveScope);
  if (!['full', 'bottomOnly'].includes(cfg.curveScope)) {
    cfg.curveScope = DEFAULT_CONFIG.curveScope;
  }
  cfg.curve = Math.max(-100, Math.min(100, Number.isFinite(Number(cfg.curve)) ? Number(cfg.curve) : DEFAULT_CONFIG.curve));
  cfg.topColor = normalizeHexColor(cfg.topColor, DEFAULT_CONFIG.topColor);
  cfg.midColor = normalizeHexColor(cfg.midColor, DEFAULT_CONFIG.midColor);
  cfg.bottomColor = normalizeHexColor(cfg.bottomColor, DEFAULT_CONFIG.bottomColor);
  cfg.outlineColor = normalizeHexColor(cfg.outlineColor, DEFAULT_CONFIG.outlineColor);
  cfg.glowColor = normalizeHexColor(cfg.glowColor, DEFAULT_CONFIG.glowColor);
  cfg.edge3dStrength = Math.max(0, Math.min(1.5, Number(cfg.edge3dStrength) || DEFAULT_CONFIG.edge3dStrength));
  if (typeof cfg.warpIncludeExtrude === 'string') {
    cfg.warpIncludeExtrude = cfg.warpIncludeExtrude.toLowerCase() === 'true';
  } else {
    cfg.warpIncludeExtrude = Boolean(cfg.warpIncludeExtrude);
  }

  return cfg;
}

function getTopShadowAlpha(opacity) {
  const v = Math.max(0, Math.min(1, Number(opacity) || 0));
  // Top side is naturally brighter due to highlight + gradient stops.
  // Stronger gain so topShadow=1 can visibly darken like the lower section.
  return Math.min(1, Math.pow(v, 0.72) * 1.45);
}

function normalizeHexColor(value, fallback) {
  const raw = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback.toLowerCase();
}

function hexToRgb(hex) {
  const c = normalizeHexColor(hex, '#000000');
  return {
    r: parseInt(c.slice(1, 3), 16),
    g: parseInt(c.slice(3, 5), 16),
    b: parseInt(c.slice(5, 7), 16),
  };
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}

function mixColor(a, b, t) {
  const p = Math.max(0, Math.min(1, t));
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * p);
  const g = Math.round(ca.g + (cb.g - ca.g) * p);
  const b2 = Math.round(ca.b + (cb.b - ca.b) * p);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b2.toString(16).padStart(2, '0')}`;
}

function darken(hex, t) {
  return mixColor(hex, '#000000', t);
}

function lighten(hex, t) {
  return mixColor(hex, '#ffffff', t);
}

function addChromeStops(grad, cfg) {
  const top = cfg.topColor;
  const mid = cfg.midColor;
  const bottom = cfg.bottomColor;
  grad.addColorStop(0.00, top);
  grad.addColorStop(0.14, mixColor(top, mid, 0.35));
  grad.addColorStop(0.28, mixColor(top, mid, 0.58));
  grad.addColorStop(0.42, mid);
  grad.addColorStop(0.54, mixColor(mid, top, 0.12));
  grad.addColorStop(0.68, mixColor(mid, bottom, 0.42));
  grad.addColorStop(0.82, mixColor(bottom, top, 0.15));
  grad.addColorStop(0.92, darken(bottom, 0.12));
  grad.addColorStop(1.00, darken(bottom, 0.22));
}

function parseArgs(args = process.argv.slice(2)) {
  const raw = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i] ? args[i].replace(/^--/, '') : '';
    const val = args[i + 1];
    if (!key || typeof val === 'undefined') continue;
    raw[key] = val;
  }
  return normalizeConfig(raw);
}

function collectFontFiles(baseDir, relDir = '') {
  const dirPath = path.join(baseDir, relDir);
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relPath = relDir ? path.join(relDir, entry.name) : entry.name;
    if (entry.isDirectory()) {
      files.push(...collectFontFiles(baseDir, relPath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(ttf|otf|ttc)$/i.test(entry.name)) continue;
    files.push(relPath);
  }
  return files;
}

function findFontByBasename(fontsDir, basename) {
  const wanted = String(basename || '').toLowerCase();
  if (!wanted) return null;
  const allFonts = collectFontFiles(fontsDir);
  for (const rel of allFonts) {
    if (path.basename(rel).toLowerCase() === wanted) {
      return path.join(fontsDir, rel);
    }
  }
  return null;
}

function resolveUserFontPath(fontsDir, fontFileArg) {
  const raw = String(fontFileArg || '').trim();
  if (!raw) return null;

  if (path.isAbsolute(raw)) {
    return fs.existsSync(raw) ? raw : null;
  }

  const direct = path.resolve(fontsDir, raw);
  if (direct === fontsDir || direct.startsWith(fontsDir + path.sep)) {
    if (fs.existsSync(direct)) return direct;
  }
  return findFontByBasename(fontsDir, raw);
}

function pickFont(fontFileArg) {
  const fontsDir = path.join(__dirname, 'fonts');
  const systemSuperClarendon = '/System/Library/Fonts/Supplemental/SuperClarendon.ttc';
  const explicit = resolveUserFontPath(fontsDir, fontFileArg);

  if (fontFileArg) {
    if (!explicit) throw new Error(`Font file bulunamadi: ${fontFileArg}`);
    try {
      registerFont(explicit, { family: 'ClarendonBlkBT' });
      return { family: 'ClarendonBlkBT', file: explicit, source: 'clarendon' };
    } catch {
      throw new Error(`Could not parse font file: ${fontFileArg}`);
    }
  }

  const autoCandidates = [
    'Clarendon Blk BT.ttf',
    'ClarendonBlkBT.ttf',
    'ClarendonBT-Black.ttf',
    'Clarendon-Bold.ttf',
    'CLRNDNB.TTF',
    'Clarendon Blk BT Black.ttf',
  ];

  for (const name of autoCandidates) {
    const fp = findFontByBasename(fontsDir, name);
    if (!fp) continue;
    try {
      registerFont(fp, { family: 'ClarendonBlkBT' });
      return { family: 'ClarendonBlkBT', file: fp, source: 'clarendon' };
    } catch {
      continue;
    }
  }

  if (fs.existsSync(systemSuperClarendon)) {
    registerFont(systemSuperClarendon, { family: 'SuperClarendonSys' });
    return { family: 'SuperClarendonSys', file: systemSuperClarendon, source: 'fallback-superclarendon' };
  }

  const fallback = path.join(fontsDir, 'Ultra.ttf');
  if (fs.existsSync(fallback)) {
    registerFont(fallback, { family: 'Ultra' });
    return { family: 'Ultra', file: fallback, source: 'fallback-ultra' };
  }

  throw new Error('No usable font found. Add a Clarendon Blk BT file or Ultra.ttf under fonts/.');
}

function drawBackground(ctx, w, h) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);
}

function measureTextWithSpacing(ctx, text, spacing) {
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    total += ctx.measureText(text[i]).width;
    if (i < text.length - 1) total += spacing;
  }
  return total;
}

function drawTextWithSpacing(ctx, text, x, y, spacing, mode) {
  const total = measureTextWithSpacing(ctx, text, spacing);
  let cx = x - total / 2;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const w = ctx.measureText(ch).width;
    const px = cx + w / 2;
    if (mode === 'stroke') ctx.strokeText(ch, px, y);
    else ctx.fillText(ch, px, y);
    cx += w + spacing;
  }
}

function getAlphaBounds(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a > 2) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 };
  return { minX, minY, maxX, maxY };
}

function warpBottomWeightedCanvas(
  srcCanvas,
  bendPx,
  startRatio = 0.56,
  power = 1.2,
  boundsCanvas = srcCanvas,
  direction = 'down'
) {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const bend = Math.max(0, bendPx);
  const dir = direction === 'up' ? -1 : 1;
  const extraTop = dir < 0 ? Math.ceil(bend) + 2 : 2;
  const extraBottom = dir > 0 ? Math.ceil(bend) + 2 : 2;
  const outH = h + extraTop + extraBottom;

  const out = createCanvas(w, outH);
  const outCtx = out.getContext('2d');

  const srcCtx = srcCanvas.getContext('2d');
  const srcData = srcCtx.getImageData(0, 0, w, h).data;
  const outPixels = outCtx.createImageData(w, outH);
  const outData = outPixels.data;

  const bounds = getAlphaBounds(boundsCanvas || srcCanvas);
  const glyphTop = bounds.minY;
  const glyphBottom = Math.max(bounds.minY + 1, bounds.maxY);
  const startWarpY = glyphTop + (glyphBottom - glyphTop) * startRatio;
  const warpRange = Math.max(1, glyphBottom - startWarpY);

  // Reusable forward-map buffer: src_y → dst_y for current column
  const fwd = new Float32Array(h);

  for (let ox = 0; ox < w; ox++) {
    const t = (ox / Math.max(1, w - 1)) * 2 - 1;
    const curve = 1 - t * t;
    const maxShift = dir * bend * curve;

    // Build forward mapping for this column
    for (let sy = 0; sy < h; sy++) {
      let shift = 0;
      if (sy > startWarpY) {
        const n = Math.min(1, (sy - startWarpY) / warpRange);
        shift = maxShift * Math.pow(n, power);
      }
      fwd[sy] = sy + extraTop + shift;
    }

    // Enforce monotonicity (guards against extreme 'up' params)
    for (let sy = 1; sy < h; sy++) {
      if (fwd[sy] <= fwd[sy - 1]) fwd[sy] = fwd[sy - 1] + 0.01;
    }

    // Inverse map via monotone scan + bilinear interpolation
    let sy = 0;
    for (let oy = 0; oy < outH; oy++) {
      const outIdx = (oy * w + ox) * 4;

      while (sy < h - 2 && fwd[sy + 1] <= oy) sy++;

      if (oy < fwd[0] || oy > fwd[h - 1]) {
        outData[outIdx] = outData[outIdx + 1] = outData[outIdx + 2] = outData[outIdx + 3] = 0;
        continue;
      }

      const sy1 = Math.min(h - 1, sy + 1);
      const span = fwd[sy1] - fwd[sy];
      const frac = span > 0.0001 ? Math.max(0, Math.min(1, (oy - fwd[sy]) / span)) : 0;
      const f1 = 1 - frac;

      const s0 = (sy  * w + ox) * 4;
      const s1 = (sy1 * w + ox) * 4;

      outData[outIdx]     = (srcData[s0]     * f1 + srcData[s1]     * frac + 0.5) | 0;
      outData[outIdx + 1] = (srcData[s0 + 1] * f1 + srcData[s1 + 1] * frac + 0.5) | 0;
      outData[outIdx + 2] = (srcData[s0 + 2] * f1 + srcData[s1 + 2] * frac + 0.5) | 0;
      outData[outIdx + 3] = (srcData[s0 + 3] * f1 + srcData[s1 + 3] * frac + 0.5) | 0;
    }
  }

  outCtx.putImageData(outPixels, 0, 0);
  return out;
}

function warpParabolicVerticalCanvas(srcCanvas, arcPx, boundsCanvas = srcCanvas) {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const srcCtx = srcCanvas.getContext('2d');
  const srcData = srcCtx.getImageData(0, 0, w, h).data;
  const bounds = getAlphaBounds(boundsCanvas || srcCanvas);

  const left = Math.max(0, bounds.minX);
  const right = Math.min(w - 1, Math.max(bounds.minX + 1, bounds.maxX));
  const centerX = (left + right) / 2;
  const halfWidth = Math.max(1, (right - left) / 2);

  const shifts = new Float32Array(w);
  let minShift = 0;
  let maxShift = 0;

  for (let x = 0; x < w; x++) {
    const nx = (x - centerX) / halfWidth;
    const curve = Math.abs(nx) <= 1 ? Math.max(0, 1 - nx * nx) : 0;
    const shift = -arcPx * curve;
    shifts[x] = shift;
    if (shift < minShift) minShift = shift;
    if (shift > maxShift) maxShift = shift;
  }

  const extraTop = Math.ceil(Math.max(0, -minShift)) + 2;
  const extraBottom = Math.ceil(Math.max(0, maxShift)) + 2;
  const outH = h + extraTop + extraBottom;
  const out = createCanvas(w, outH);
  const outCtx = out.getContext('2d');
  const outPixels = outCtx.createImageData(w, outH);
  const outData = outPixels.data;

  for (let x = 0; x < w; x++) {
    const shift = shifts[x] + extraTop;
    for (let oy = 0; oy < outH; oy++) {
      const sy = oy - shift;
      const outIdx = (oy * w + x) * 4;

      if (sy < 0 || sy > h - 1) {
        outData[outIdx] = outData[outIdx + 1] = outData[outIdx + 2] = outData[outIdx + 3] = 0;
        continue;
      }

      const sy0 = Math.floor(sy);
      const sy1 = Math.min(h - 1, sy0 + 1);
      const frac = sy - sy0;
      const inv = 1 - frac;
      const s0 = (sy0 * w + x) * 4;
      const s1 = (sy1 * w + x) * 4;

      outData[outIdx] = (srcData[s0] * inv + srcData[s1] * frac + 0.5) | 0;
      outData[outIdx + 1] = (srcData[s0 + 1] * inv + srcData[s1 + 1] * frac + 0.5) | 0;
      outData[outIdx + 2] = (srcData[s0 + 2] * inv + srcData[s1 + 2] * frac + 0.5) | 0;
      outData[outIdx + 3] = (srcData[s0 + 3] * inv + srcData[s1 + 3] * frac + 0.5) | 0;
    }
  }

  outCtx.putImageData(outPixels, 0, 0);
  return out;
}

function warpParabolicBottomOnlyCanvas(
  srcCanvas,
  arcPx,
  boundsCanvas = srcCanvas,
  power = 1.7,
  startRatio = 0.72
) {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const srcCtx = srcCanvas.getContext('2d');
  const srcData = srcCtx.getImageData(0, 0, w, h).data;
  const bounds = getAlphaBounds(boundsCanvas || srcCanvas);

  const left = Math.max(0, bounds.minX);
  const right = Math.min(w - 1, Math.max(bounds.minX + 1, bounds.maxX));
  const top = Math.max(0, bounds.minY);
  const bottom = Math.min(h - 1, Math.max(bounds.minY + 1, bounds.maxY));
  const centerX = (left + right) / 2;
  const halfWidth = Math.max(1, (right - left) / 2);
  const glyphHeight = Math.max(1, bottom - top);
  const startY = top + glyphHeight * Math.max(0.35, Math.min(0.9, startRatio));
  const bendRange = Math.max(1, bottom - startY);
  const safeArc = Math.sign(arcPx) * Math.min(Math.abs(arcPx), (bendRange * 2.2) / Math.max(1.01, power));

  const xCurve = new Float32Array(w);
  let minShift = 0;
  let maxShift = 0;

  for (let x = 0; x < w; x++) {
    const nx = (x - centerX) / halfWidth;
    const curve = Math.abs(nx) <= 1 ? Math.max(0, 1 - nx * nx) : 0;
    xCurve[x] = curve;
    const edgeShift = -safeArc * curve;
    if (edgeShift < minShift) minShift = edgeShift;
    if (edgeShift > maxShift) maxShift = edgeShift;
  }

  const extraTop = Math.ceil(Math.max(0, -minShift)) + 2;
  const extraBottom = Math.ceil(Math.max(0, maxShift)) + 2;
  const outH = h + extraTop + extraBottom;
  const out = createCanvas(w, outH);
  const outCtx = out.getContext('2d');
  const outPixels = outCtx.createImageData(w, outH);
  const outData = outPixels.data;
  const fwd = new Float32Array(h);

  for (let x = 0; x < w; x++) {
    const curve = xCurve[x];

    for (let sy = 0; sy < h; sy++) {
      let shift = 0;
      if (sy > startY && curve > 0) {
        const t = Math.min(1, Math.max(0, (sy - startY) / bendRange));
        shift = -safeArc * curve * Math.pow(t, power);
      }
      fwd[sy] = sy + extraTop + shift;
    }

    for (let sy = 1; sy < h; sy++) {
      if (fwd[sy] <= fwd[sy - 1]) fwd[sy] = fwd[sy - 1] + 0.01;
    }

    let sy = 0;
    for (let oy = 0; oy < outH; oy++) {
      const outIdx = (oy * w + x) * 4;
      while (sy < h - 2 && fwd[sy + 1] <= oy) sy++;

      if (oy < fwd[0] || oy > fwd[h - 1]) {
        outData[outIdx] = outData[outIdx + 1] = outData[outIdx + 2] = outData[outIdx + 3] = 0;
        continue;
      }

      const sy1 = Math.min(h - 1, sy + 1);
      const span = fwd[sy1] - fwd[sy];
      const frac = span > 0.0001 ? Math.max(0, Math.min(1, (oy - fwd[sy]) / span)) : 0;
      const inv = 1 - frac;
      const s0 = (sy * w + x) * 4;
      const s1 = (sy1 * w + x) * 4;

      outData[outIdx] = (srcData[s0] * inv + srcData[s1] * frac + 0.5) | 0;
      outData[outIdx + 1] = (srcData[s0 + 1] * inv + srcData[s1 + 1] * frac + 0.5) | 0;
      outData[outIdx + 2] = (srcData[s0 + 2] * inv + srcData[s1 + 2] * frac + 0.5) | 0;
      outData[outIdx + 3] = (srcData[s0 + 3] * inv + srcData[s1 + 3] * frac + 0.5) | 0;
    }
  }

  outCtx.putImageData(outPixels, 0, 0);
  return out;
}

function createStyledTextLayers(cfg, fontFamily, opts = {}) {
  const text = cfg.text.toUpperCase();
  const font = `900 ${cfg.size}px "${fontFamily}"`;
  const measureCanvas = createCanvas(16, 16);
  const measureCtx = measureCanvas.getContext('2d');
  measureCtx.font = font;
  measureCtx.textAlign = 'center';
  measureCtx.textBaseline = 'alphabetic';

  const spacing = cfg.size * cfg.letterSpacing;
  const textWidth = measureTextWithSpacing(measureCtx, text, spacing);
  const pad = Math.ceil(cfg.size * 0.95 + cfg.glowSize + cfg.strokeSize);
  const layerW = Math.ceil(textWidth + pad * 2);
  const layerH = Math.ceil(cfg.size * 2.8 + pad * 2);
  const x = layerW / 2;
  const y = pad + cfg.size * 1.15;

  const baseLayer = createCanvas(layerW, layerH);
  const b = baseLayer.getContext('2d');
  b.font = font;
  b.textAlign = 'center';
  b.textBaseline = 'alphabetic';

  // 3D side extrusion layer.
  const sideLayer = createCanvas(layerW, layerH);
  const s = sideLayer.getContext('2d');
  s.font = font;
  s.textAlign = 'center';
  s.textBaseline = 'alphabetic';
  s.lineJoin = 'miter';
  s.miterLimit = 4.5;
  b.lineJoin = 'miter';
  b.miterLimit = 4.5;

  for (let d = cfg.extrudeDepth; d >= 1; d--) {
    const t = d / cfg.extrudeDepth;
    const a = 0.12 + (1 - t) * cfg.extrudeOpacity;
    s.fillStyle = rgba(darken(cfg.bottomColor, 0.08), a);
    drawTextWithSpacing(s, text, x + d * 1.05, y + d * 0.82, spacing, 'fill');
  }
  s.strokeStyle = rgba(darken(cfg.bottomColor, 0.25), 0.95);
  s.lineWidth = Math.max(2, cfg.strokeSize * 0.40);
  drawTextWithSpacing(s, text, x + cfg.extrudeDepth * 1.05, y + cfg.extrudeDepth * 0.82, spacing, 'stroke');

  // Base fill
  b.fillStyle = mixColor(cfg.topColor, cfg.bottomColor, 0.35);
  drawTextWithSpacing(b, text, x, y, spacing, 'fill');

  // Gradient Overlay (skipped when caller will apply post-warp gradient)
  if (!opts.skipGradient) {
    const grad = b.createLinearGradient(0, y - cfg.size * 1.2, 0, y + cfg.size * 0.30);
    addChromeStops(grad, cfg);
    b.globalAlpha = cfg.gradientOpacity;
    b.fillStyle = grad;
    drawTextWithSpacing(b, text, x, y, spacing, 'fill');
    b.globalAlpha = 1;
  }

  // Bevel and Emboss simulation (Inner Bevel, depth high)
  const topShadowMix = Math.max(0, Math.min(1, cfg.topShadowOpacity || 0));
  const hiFade = 1 - topShadowMix * 0.86;
  const hiStrong = cfg.bevelHighlightOpacity * hiFade;
  const hi = b.createLinearGradient(0, y - cfg.size * 0.38, 0, y + cfg.size * 0.38);
  hi.addColorStop(0.00, rgba(cfg.midColor, 0.00));
  hi.addColorStop(0.34, rgba(cfg.midColor, hiStrong * 0.58));
  hi.addColorStop(0.52, rgba(cfg.midColor, Math.min(1, hiStrong * 1.08)));
  hi.addColorStop(0.76, rgba(cfg.midColor, 0.10 * hiFade));
  hi.addColorStop(1.00, rgba(cfg.midColor, 0.00));
  b.fillStyle = hi;
  drawTextWithSpacing(b, text, x, y, spacing, 'fill');

  const sh = b.createLinearGradient(0, y - cfg.size * 0.20, 0, y + cfg.size * 0.95);
  sh.addColorStop(0.0, rgba(cfg.bottomColor, 0.00));
  sh.addColorStop(0.50, rgba(darken(cfg.bottomColor, 0.20), 0.08));
  sh.addColorStop(0.78, rgba(darken(cfg.bottomColor, 0.08), 0.28));
  sh.addColorStop(1.0, rgba(darken(cfg.bottomColor, 0.14), Math.min(0.72, cfg.bevelShadowOpacity)));
  b.fillStyle = sh;
  drawTextWithSpacing(b, text, x, y, spacing, 'fill');

  // Keep center bright while letting top also fall into darker tones.
  const topA = getTopShadowAlpha(cfg.topShadowOpacity);
  b.save();
  b.globalCompositeOperation = 'multiply';
  const topShade = b.createLinearGradient(0, y - cfg.size * 1.05, 0, y - cfg.size * 0.04);
  topShade.addColorStop(0.0, rgba(darken(cfg.topColor, 0.22), topA * 0.82));
  topShade.addColorStop(0.44, rgba(darken(cfg.topColor, 0.34), topA * 0.48));
  topShade.addColorStop(0.74, rgba(cfg.topColor, 0.00));
  topShade.addColorStop(1.0, rgba(cfg.topColor, 0.00));
  b.fillStyle = topShade;
  drawTextWithSpacing(b, text, x, y, spacing, 'fill');
  b.restore();

  // Edge bevel rims for stronger 3D contour.
  const edgeK = cfg.edge3dStrength;
  b.strokeStyle = rgba(lighten(cfg.outlineColor, 0.14), Math.min(1, 0.62 * edgeK));
  b.lineWidth = Math.max(1.2, cfg.strokeSize * (0.18 + edgeK * 0.12));
  drawTextWithSpacing(b, text, x - cfg.strokeSize * 0.045, y - cfg.strokeSize * 0.050, spacing, 'stroke');

  b.strokeStyle = rgba(darken(cfg.bottomColor, 0.52), Math.min(1, 0.78 * edgeK));
  b.lineWidth = Math.max(1.3, cfg.strokeSize * (0.20 + edgeK * 0.14));
  drawTextWithSpacing(b, text, x + cfg.strokeSize * 0.060, y + cfg.strokeSize * 0.065, spacing, 'stroke');

  b.strokeStyle = rgba(mixColor(cfg.outlineColor, cfg.bottomColor, 0.58), Math.min(1, 0.84 * edgeK));
  b.lineWidth = Math.max(1.0, cfg.strokeSize * (0.14 + edgeK * 0.08));
  drawTextWithSpacing(b, text, x + cfg.strokeSize * 0.010, y + cfg.strokeSize * 0.016, spacing, 'stroke');

  b.strokeStyle = rgba(cfg.outlineColor, 0.36);
  b.lineWidth = Math.max(2, cfg.bevelSize * 0.11);
  b.lineJoin = 'round';
  drawTextWithSpacing(b, text, x, y, spacing, 'stroke');

  b.strokeStyle = rgba(darken(cfg.bottomColor, 0.42), 0.20);
  b.lineWidth = Math.max(1.5, cfg.bevelSize * 0.07);
  drawTextWithSpacing(b, text, x, y, spacing, 'stroke');
  b.strokeStyle = rgba(darken(cfg.bottomColor, 0.24), 0.52);
  b.lineWidth = Math.max(1.8, cfg.bevelSize * 0.09);
  drawTextWithSpacing(b, text, x, y + cfg.bevelSize * 0.02, spacing, 'stroke');

  // Stroke + Outer Glow layer (separate layer like Photoshop stack)
  const fxLayer = createCanvas(layerW, layerH);
  const f = fxLayer.getContext('2d');
  f.font = font;
  f.textAlign = 'center';
  f.textBaseline = 'alphabetic';
  f.lineJoin = 'miter';
  f.miterLimit = 4.5;

  f.strokeStyle = rgba(cfg.outlineColor, 0.98);
  f.lineWidth = cfg.strokeSize;
  f.shadowColor = rgba(cfg.glowColor, cfg.glowOpacity);
  f.shadowBlur = cfg.glowSize;
  drawTextWithSpacing(f, text, x, y, spacing, 'stroke');
  f.shadowBlur = 0;
  drawTextWithSpacing(f, text, x, y, spacing, 'stroke');
  f.lineWidth = Math.max(1.0, cfg.strokeSize * 0.24);
  f.strokeStyle = rgba(mixColor(cfg.outlineColor, cfg.bottomColor, 0.62), 0.86);
  drawTextWithSpacing(f, text, x + cfg.strokeSize * 0.01, y + cfg.strokeSize * 0.01, spacing, 'stroke');

  return { sideLayer, baseLayer, fxLayer };
}

function drawWarpedStyledText(ctx, cfg, fontFamily) {
  // Create layers without the chrome gradient — it will be re-applied post-warp
  // based on the actual warped glyph bounds, ensuring full color coverage.
  const { sideLayer, baseLayer, fxLayer } = createStyledTextLayers(cfg, fontFamily, { skipGradient: true });

  const startRatio = Math.max(0.2, Math.min(0.9, cfg.warpStartRatio || 0.62));
  const power = Math.max(0.5, Math.min(3, cfg.warpPower || 1.4));
  const direction = cfg.warpDirection === 'up' ? 'up' : 'down';

  // Auto-clamp bendPx so it never exceeds the available warp range.
  // Without this, direction='up' with large bend causes the bottom to fold
  // back over itself, compressing the gradient into invisible pixels.
  const glyphBounds = getAlphaBounds(baseLayer);
  const glyphH = Math.max(1, glyphBounds.maxY - glyphBounds.minY);
  const warpRangePx = (1 - startRatio) * glyphH;
  const rawBendPx = cfg.size * Math.max(0.08, Math.min(0.9, cfg.bend));
  const bendPx = Math.min(rawBendPx, warpRangePx * 0.88);

  // Warp body (side + base) and fx (stroke/glow) separately.
  // Gradient is applied only to the warped body so the white glow/stroke
  // in fxLayer is not tinted — it is composited on top as a final step.
  const bodyRaw = createCanvas(baseLayer.width, baseLayer.height);
  const bodyCtx = bodyRaw.getContext('2d');
  if (cfg.warpIncludeExtrude) bodyCtx.drawImage(sideLayer, 0, 0);
  bodyCtx.drawImage(baseLayer, 0, 0);

  const warpedBody = warpBottomWeightedCanvas(bodyRaw, bendPx, startRatio, power, baseLayer, direction);
  const warpedFx   = warpBottomWeightedCanvas(fxLayer,  bendPx, startRatio, power, baseLayer, direction);

  // Re-apply chrome gradient to warped body, clipped to its solid pixels.
  const wbounds = getAlphaBounds(warpedBody);
  const gradCanvas = createCanvas(warpedBody.width, warpedBody.height);
  const gc = gradCanvas.getContext('2d');
  const chromGrad = gc.createLinearGradient(0, wbounds.minY, 0, wbounds.maxY);
  addChromeStops(chromGrad, cfg);
  gc.fillStyle = chromGrad;
  gc.fillRect(0, 0, warpedBody.width, warpedBody.height);
  gc.globalCompositeOperation = 'destination-in';
  gc.drawImage(warpedBody, 0, 0);   // clip gradient to body alpha

  const bCtx = warpedBody.getContext('2d');
  bCtx.globalAlpha = cfg.gradientOpacity;
  bCtx.drawImage(gradCanvas, 0, 0);
  bCtx.globalAlpha = 1;

  // Composite fxLayer (white stroke + glow) on top — fully preserved, no gradient tint.
  bCtx.drawImage(warpedFx, 0, 0);

  const bounds = getAlphaBounds(warpedBody);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const targetX = cfg.width / 2 - centerX;
  const targetY = cfg.height * cfg.apexYRatio - centerY + cfg.verticalOffset;
  ctx.drawImage(warpedBody, targetX, targetY);
}

function drawClassicArcStyledText(ctx, cfg, fontFamily) {
  const isFlat = cfg.curveMode === 'flat';
  const text = cfg.text.toUpperCase();
  if (!text) return;
  const size = cfg.size;
  const font = `900 ${size}px "${fontFamily}"`;
  const scaleX = 0.86;
  const scaleY = 1.08;
  const radius = cfg.width * 1.02;
  const centerX = cfg.width / 2;
  const centerY = radius + cfg.height * 0.27 + cfg.verticalOffset;
  const flatBaselineY = cfg.height * 0.27 + cfg.verticalOffset;

  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const spacing = size * cfg.letterSpacing;
  const charWidths = [];
  let totalArc = 0;
  let totalWidth = 0;
  for (const ch of text) {
    const w = ctx.measureText(ch).width * scaleX;
    charWidths.push(w);
    totalWidth += w;
    if (!isFlat) totalArc += w / radius;
  }
  totalWidth += spacing * (text.length - 1);
  if (!isFlat) totalArc += (spacing / radius) * (text.length - 1);
  let angle = -totalArc / 2;
  let cursorX = centerX - totalWidth / 2;
  const maskCanvas = createCanvas(cfg.width, cfg.height);
  const maskCtx = maskCanvas.getContext('2d');

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const w = charWidths[i];
    let x = 0;
    let y = 0;
    let rotation = 0;
    let half = 0;

    if (isFlat) {
      x = cursorX + w / 2;
      y = flatBaselineY;
      rotation = 0;
      cursorX += w + spacing;
    } else {
      half = (w / radius) / 2;
      angle += half;
      x = centerX + Math.sin(angle) * radius;
      y = centerY - Math.cos(angle) * radius;
      rotation = angle * cfg.rotateFactor;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(scaleX, scaleY);
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    for (let d = cfg.extrudeDepth; d >= 1; d--) {
      const t = d / cfg.extrudeDepth;
      const a = Math.min(1, 0.10 + (1 - t) * cfg.extrudeOpacity);
      ctx.fillStyle = rgba(darken(cfg.bottomColor, 0.08), a);
      ctx.fillText(ch, d * 1.10, d * 0.98);
    }

    ctx.shadowColor = rgba(cfg.glowColor, cfg.glowOpacity);
    ctx.shadowBlur = cfg.glowSize;
    ctx.fillStyle = rgba(cfg.midColor, 0.12);
    for (let p = 0; p < 3; p++) ctx.fillText(ch, 0, 0);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    ctx.strokeStyle = rgba(cfg.outlineColor, 0.98);
    ctx.lineWidth = cfg.strokeSize;
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 4.5;
    ctx.strokeText(ch, 0, 0);

    ctx.strokeStyle = rgba(darken(cfg.bottomColor, 0.10), 0.56);
    ctx.lineWidth = Math.max(2, cfg.strokeSize * 0.44);
    ctx.strokeText(ch, 0, 0);

    const grad = ctx.createLinearGradient(0, -size * 1.02, 0, size * 0.24);
    addChromeStops(grad, cfg);
    ctx.globalAlpha = cfg.gradientOpacity;
    ctx.fillStyle = grad;
    ctx.fillText(ch, 0, 0);
    ctx.globalAlpha = 1;

    // Unified global shading mask so left/right letters keep consistent tone.
    maskCtx.save();
    maskCtx.translate(x, y);
    maskCtx.rotate(rotation);
    maskCtx.scale(scaleX, scaleY);
    maskCtx.font = font;
    maskCtx.textAlign = 'center';
    maskCtx.textBaseline = 'alphabetic';
    maskCtx.fillStyle = '#ffffff';
    maskCtx.fillText(ch, 0, 0);
    maskCtx.restore();

    const edgeK = cfg.edge3dStrength;
    ctx.strokeStyle = rgba(lighten(cfg.outlineColor, 0.14), Math.min(1, 0.62 * edgeK));
    ctx.lineWidth = Math.max(1.1, cfg.strokeSize * (0.18 + edgeK * 0.12));
    ctx.strokeText(ch, -cfg.strokeSize * 0.045, -cfg.strokeSize * 0.050);

    ctx.strokeStyle = rgba(darken(cfg.bottomColor, 0.52), Math.min(1, 0.78 * edgeK));
    ctx.lineWidth = Math.max(1.2, cfg.strokeSize * (0.20 + edgeK * 0.14));
    ctx.strokeText(ch, cfg.strokeSize * 0.060, cfg.strokeSize * 0.065);

    ctx.strokeStyle = rgba(mixColor(cfg.outlineColor, cfg.bottomColor, 0.58), Math.min(1, 0.84 * edgeK));
    ctx.lineWidth = Math.max(1.0, cfg.strokeSize * (0.14 + edgeK * 0.08));
    ctx.strokeText(ch, cfg.strokeSize * 0.010, cfg.strokeSize * 0.016);

    ctx.strokeStyle = rgba(darken(cfg.bottomColor, 0.24), 0.42);
    ctx.lineWidth = Math.max(1.5, cfg.strokeSize * 0.30);
    ctx.strokeText(ch, 1.4, 1.2);

    ctx.restore();
    if (!isFlat) angle += half + spacing / radius;
  }

  const bounds = getAlphaBounds(maskCanvas);
  const bw = Math.max(8, bounds.maxX - bounds.minX + 1);
  const bh = Math.max(8, bounds.maxY - bounds.minY + 1);
  const bx = bounds.minX - 2;
  const by = bounds.minY - 2;
  const topA = getTopShadowAlpha(cfg.topShadowOpacity);
  const bottomA = getTopShadowAlpha(cfg.bevelShadowOpacity);
  const hiFade = 1 - Math.max(0, Math.min(1, cfg.topShadowOpacity || 0)) * 0.86;

  const topLayer = createCanvas(cfg.width, cfg.height);
  const tl = topLayer.getContext('2d');
  tl.drawImage(maskCanvas, 0, 0);
  tl.globalCompositeOperation = 'source-in';
  const topGrad = tl.createLinearGradient(0, by, 0, by + bh * 0.72);
  topGrad.addColorStop(0.0, rgba(darken(cfg.topColor, 0.22), topA * 0.82));
  topGrad.addColorStop(0.46, rgba(darken(cfg.topColor, 0.34), topA * 0.52));
  topGrad.addColorStop(0.76, rgba(cfg.topColor, 0.00));
  topGrad.addColorStop(1.0, rgba(cfg.topColor, 0.00));
  tl.fillStyle = topGrad;
  tl.fillRect(bx, by, bw + 4, bh + 4);

  const bottomLayer = createCanvas(cfg.width, cfg.height);
  const bl = bottomLayer.getContext('2d');
  bl.drawImage(maskCanvas, 0, 0);
  bl.globalCompositeOperation = 'source-in';
  const bottomGrad = bl.createLinearGradient(0, by + bh * 0.28, 0, by + bh);
  bottomGrad.addColorStop(0.0, rgba(cfg.bottomColor, 0.00));
  bottomGrad.addColorStop(0.54, rgba(darken(cfg.bottomColor, 0.10), bottomA * 0.64));
  bottomGrad.addColorStop(1.0, rgba(darken(cfg.bottomColor, 0.20), bottomA * 0.92));
  bl.fillStyle = bottomGrad;
  bl.fillRect(bx, by, bw + 4, bh + 4);

  const hiLayer = createCanvas(cfg.width, cfg.height);
  const hl = hiLayer.getContext('2d');
  hl.drawImage(maskCanvas, 0, 0);
  hl.globalCompositeOperation = 'source-in';
  const hiGrad = hl.createLinearGradient(0, by + bh * 0.08, 0, by + bh * 0.78);
  hiGrad.addColorStop(0.00, rgba(cfg.midColor, 0.00));
  hiGrad.addColorStop(0.30, rgba(cfg.midColor, cfg.bevelHighlightOpacity * hiFade * 0.52));
  hiGrad.addColorStop(0.48, rgba(cfg.midColor, cfg.bevelHighlightOpacity * hiFade * 0.94));
  hiGrad.addColorStop(0.74, rgba(cfg.midColor, 0.06 * hiFade));
  hiGrad.addColorStop(1.00, rgba(cfg.midColor, 0.00));
  hl.fillStyle = hiGrad;
  hl.fillRect(bx, by, bw + 4, bh + 4);

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(topLayer, 0, 0);
  ctx.drawImage(bottomLayer, 0, 0);
  ctx.restore();
  ctx.drawImage(hiLayer, 0, 0);

  // Lower rim highlight: arc for curved mode, straight for flat mode.
  ctx.save();
  ctx.strokeStyle = rgba(cfg.outlineColor, 0.86);
  ctx.lineWidth = cfg.strokeSize * 0.52;
  ctx.shadowColor = rgba(cfg.glowColor, 0.55);
  ctx.shadowBlur = cfg.glowSize * 0.52;
  if (!isFlat) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + size * 0.37, -totalArc * 0.49, totalArc * 0.49);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCurveArcStyledText(ctx, cfg, fontFamily) {
  const safeCurve = Math.max(-100, Math.min(100, Number(cfg.curve) || 0));
  const isBottomOnly = cfg.curveScope === 'bottomOnly';
  const curvePxRaw = (safeCurve / 100) * cfg.size * (isBottomOnly ? 0.28 : 1.4);
  const { sideLayer, baseLayer, fxLayer } = createStyledTextLayers(cfg, fontFamily, { skipGradient: true });
  const glyphBounds = getAlphaBounds(baseLayer);
  const glyphHeight = Math.max(1, glyphBounds.maxY - glyphBounds.minY + 1);
  const maxCurvePx = glyphHeight * 0.72;
  const curvePx = Math.sign(curvePxRaw) * Math.min(Math.abs(curvePxRaw), maxCurvePx);

  const bodyRaw = createCanvas(baseLayer.width, baseLayer.height);
  const bodyCtx = bodyRaw.getContext('2d');
  bodyCtx.drawImage(sideLayer, 0, 0);
  bodyCtx.drawImage(baseLayer, 0, 0);

  let warpedBody = bodyRaw;
  let warpedFx = fxLayer;
  if (Math.abs(curvePx) > 0.001) {
    if (isBottomOnly) {
      const bendPx = Math.sign(curvePx) * Math.min(Math.abs(curvePx), glyphHeight * 0.9);
      warpedBody = warpParabolicBottomOnlyCanvas(bodyRaw, bendPx, baseLayer, 1.1, 0.38);
      warpedFx = warpParabolicBottomOnlyCanvas(fxLayer, bendPx, baseLayer, 1.1, 0.38);
    } else {
      warpedBody = warpParabolicVerticalCanvas(bodyRaw, curvePx, baseLayer);
      warpedFx = warpParabolicVerticalCanvas(fxLayer, curvePx, baseLayer);
    }
  }

  // Re-apply chrome gradient on warped body to keep the highlight band clean.
  const wbounds = getAlphaBounds(warpedBody);
  const gradCanvas = createCanvas(warpedBody.width, warpedBody.height);
  const gc = gradCanvas.getContext('2d');
  const chromGrad = gc.createLinearGradient(0, wbounds.minY, 0, wbounds.maxY);
  addChromeStops(chromGrad, cfg);
  gc.fillStyle = chromGrad;
  gc.fillRect(0, 0, warpedBody.width, warpedBody.height);
  gc.globalCompositeOperation = 'destination-in';
  gc.drawImage(warpedBody, 0, 0);

  const bCtx = warpedBody.getContext('2d');
  bCtx.globalAlpha = cfg.gradientOpacity;
  bCtx.drawImage(gradCanvas, 0, 0);
  bCtx.globalAlpha = 1;
  bCtx.drawImage(warpedFx, 0, 0);

  const bounds = getAlphaBounds(warpedBody);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const targetX = cfg.width / 2 - centerX;
  const targetY = cfg.height * cfg.apexYRatio - centerY + cfg.verticalOffset;
  ctx.drawImage(warpedBody, targetX, targetY);
}

function drawArcStyledText(ctx, cfg, fontFamily) {
  if (cfg.curveMode === 'arcCurve') {
    drawCurveArcStyledText(ctx, cfg, fontFamily);
    return;
  }
  drawClassicArcStyledText(ctx, cfg, fontFamily);
}

function render(inputCfg = {}, options = {}) {
  const cfg = normalizeConfig(inputCfg);
  const quiet = Boolean(options.quiet);
  const fontInfo = pickFont(cfg.fontFile);
  const scale = Math.max(1, cfg.renderScale || 1);
  const hiCanvas = createCanvas(Math.round(cfg.width * scale), Math.round(cfg.height * scale));
  const hiCtx = hiCanvas.getContext('2d');
  const hiCfg = {
    ...cfg,
    width: Math.round(cfg.width * scale),
    height: Math.round(cfg.height * scale),
    size: cfg.size * scale,
    glowSize: cfg.glowSize * scale,
    strokeSize: cfg.strokeSize * scale,
    bevelSize: cfg.bevelSize * scale,
    verticalOffset: cfg.verticalOffset * scale,
  };

  hiCtx.patternQuality = 'best';
  hiCtx.quality = 'best';
  hiCtx.antialias = 'subpixel';
  hiCtx.textDrawingMode = 'path';
  drawBackground(hiCtx, hiCfg.width, hiCfg.height);
  if (hiCfg.curveMode === 'bottomWarp') drawWarpedStyledText(hiCtx, hiCfg, fontInfo.family);
  else drawArcStyledText(hiCtx, hiCfg, fontInfo.family);

  let finalCanvas = hiCanvas;
  if (scale > 1) {
    finalCanvas = createCanvas(cfg.width, cfg.height);
    const finalCtx = finalCanvas.getContext('2d');
    finalCtx.patternQuality = 'best';
    finalCtx.quality = 'best';
    finalCtx.antialias = 'subpixel';
    finalCtx.imageSmoothingEnabled = true;
    finalCtx.imageSmoothingQuality = 'high';
    finalCtx.drawImage(hiCanvas, 0, 0, cfg.width, cfg.height);
  }

  const outDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const pngPath = path.join(outDir, `${cfg.out}.png`);
  fs.writeFileSync(pngPath, finalCanvas.toBuffer('image/png'));

  if (!quiet) {
    console.log(`✅ output/${cfg.out}.png`);
    console.log(`   font: ${fontInfo.family} (${fontInfo.source})`);
    if (fontInfo.source !== 'clarendon') {
      console.log(`   note: Clarendon Blk BT bulunamadı, "${fontInfo.family}" fallback kullanıldı.`);
    }
  }

  return { pngPath, fontInfo, cfg };
}

if (require.main === module) {
  render(parseArgs());
}

module.exports = {
  DEFAULT_CONFIG,
  normalizeConfig,
  parseArgs,
  render,
};
