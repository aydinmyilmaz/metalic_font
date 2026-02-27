/**
 * METALLIC TEXT GENERATOR — Fully Customizable
 *
 * Usage:
 *   node generate_custom.js [options]
 *
 * Options:
 *   --text        "YOUR TEXT"          (default: CUSTOM)
 *   --style       chrome|gold|holo     (default: chrome)
 *   --font        abril|anton|bebas|ultra|playfair|righteous  (default: abril)
 *   --size        number               (default: 175)
 *   --width       number               (default: 900)
 *   --height      number               (default: 260)
 *   --glow        true|false           (default: true)
 *   --sparkles    true|false           (default: true)
 *   --extrude     number (0-30)        (default: 16)
 *   --out         filename (no ext)    (default: output)
 *
 * Examples:
 *   node generate_custom.js --text "AYDIN" --style gold --font abril
 *   node generate_custom.js --text "SALE" --style holo --font bebas --extrude 0
 *   node generate_custom.js --text "VIP" --style chrome --sparkles false --size 200
 */

const { createCanvas, registerFont } = require('canvas');
const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────
//  PARSE CLI ARGS
// ─────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    text:     'CUSTOM',
    style:    'chrome',
    font:     'abril',
    size:     175,
    width:    900,
    height:   260,
    glow:     true,
    sparkles: true,
    extrude:  16,
    out:      'output',
  };
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const val = args[i + 1];
    if (key === 'glow'     || key === 'sparkles') opts[key] = val !== 'false';
    else if (key === 'size' || key === 'width' || key === 'height' || key === 'extrude') opts[key] = parseInt(val);
    else opts[key] = val;
  }
  return opts;
}

const cfg = parseArgs();

// ─────────────────────────────────────────────────────────────
//  FONT REGISTRY
// ─────────────────────────────────────────────────────────────
const FONT_MAP = {
  abril:    { file: 'AbrilFatface.ttf',      family: 'AbrilFatface' },
  anton:    { file: 'Anton-Regular.ttf',     family: 'Anton' },
  bebas:    { file: 'BebasNeue-Regular.ttf', family: 'BebasNeue' },
  ultra:    { file: 'Ultra.ttf',             family: 'Ultra' },
  playfair: { file: 'PlayfairDisplay.ttf',   family: 'PlayfairDisp' },
  righteous:{ file: 'Righteous.ttf',         family: 'Righteous' },
};

const selectedFont = FONT_MAP[cfg.font] || FONT_MAP['abril'];
const fontPath = path.join(__dirname, 'fonts', selectedFont.file);
if (!fs.existsSync(fontPath)) {
  console.error(`❌  Font file not found: ${fontPath}`);
  process.exit(1);
}
registerFont(fontPath, { family: selectedFont.family });

// ─────────────────────────────────────────────────────────────
//  STYLE PALETTES
// ─────────────────────────────────────────────────────────────
const STYLES = {
  chrome: {
    extrudeColor:   [20, 25, 45],
    glowColor:      'rgba(180,200,255,0.9)',
    outlineColor:   'rgba(255,255,255,0.98)',
    innerOutline:   'rgba(40,60,130,0.7)',
    sparkleColor:   '#c8d8ff',
    gradientStops: [
      [0.00, '#ffffff'], [0.08, '#e8eeff'], [0.18, '#7888cc'],
      [0.30, '#ffffff'], [0.42, '#c0c8f0'], [0.55, '#5060a8'],
      [0.65, '#d8e0ff'], [0.78, '#9098c8'], [0.90, '#ffffff'], [1.00, '#6070a0'],
    ],
  },
  gold: {
    extrudeColor:   [35, 18, 0],
    glowColor:      'rgba(255,165,20,0.85)',
    outlineColor:   'rgba(255,235,100,0.98)',
    innerOutline:   'rgba(120,60,0,0.7)',
    sparkleColor:   '#ffe080',
    gradientStops: [
      [0.00, '#fff8d0'], [0.10, '#ffd040'], [0.22, '#fff0a0'],
      [0.35, '#e09000'], [0.48, '#ffd840'], [0.60, '#b06800'],
      [0.72, '#ffc030'], [0.85, '#804000'], [1.00, '#d09020'],
    ],
  },
  holo: {
    extrudeColor:   [20, 0, 40],
    glowColor:      'rgba(200,100,255,0.9)',
    outlineColor:   'rgba(230,200,255,0.98)',
    innerOutline:   'rgba(80,20,120,0.7)',
    sparkleColor:   '#ffffff',
    gradientStops: [
      [0.00, '#ff80ff'], [0.16, '#8080ff'], [0.33, '#80ffff'],
      [0.50, '#80ff80'], [0.66, '#ffff80'], [0.83, '#ff8080'], [1.00, '#ff80ff'],
    ],
    extraGradient: true, // horizontal rainbow overlay
  },
};

// ─────────────────────────────────────────────────────────────
//  DRAW HELPERS
// ─────────────────────────────────────────────────────────────
function drawBackground(ctx, w, h) {
  const bg = ctx.createRadialGradient(w*.5, h*.4, 20, w*.5, h*.5, w*.8);
  bg.addColorStop(0, '#2e2e2e');
  bg.addColorStop(1, '#080808');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 3500; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random()*.05})`;
    ctx.fillRect(Math.random()*w, Math.random()*h, 1, 1);
  }
}

function drawExtrude(ctx, text, cx, cy, depth, rgb) {
  for (let i = depth; i >= 1; i--) {
    const ratio = i / depth;
    const alpha = 0.28 + 0.35 * (1 - ratio);
    const [r, g, b] = rgb;
    ctx.fillStyle = `rgba(${Math.min(255,r+i*2)},${Math.min(255,g+i*2)},${Math.min(255,b+i*3)},${alpha})`;
    ctx.fillText(text, cx + i * 0.8, cy + i * 0.8);
  }
}

function drawSparkles(ctx, cx, cy, size, color, count = 20) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI*2*i)/count + Math.random()*.4;
    const r     = size * .45 + Math.random() * size * .55;
    const x     = cx + Math.cos(angle) * r * 1.95;
    const y     = cy - size * .5 + Math.sin(angle) * r * .45;
    const s     = 1.5 + Math.random() * 2.5;
    ctx.save();
    ctx.globalAlpha = .35 + Math.random() * .65;
    ctx.translate(x, y);
    ctx.rotate(Math.PI/4);
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.moveTo(0,-s*2.5); ctx.lineTo(s*.4,-s*.4);
    ctx.lineTo(s*2.5,0);  ctx.lineTo(s*.4,s*.4);
    ctx.lineTo(0,s*2.5);  ctx.lineTo(-s*.4,s*.4);
    ctx.lineTo(-s*2.5,0); ctx.lineTo(-s*.4,-s*.4);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────
//  MAIN RENDER
// ─────────────────────────────────────────────────────────────
function generate(cfg) {
  const { text, style, size, width, height, glow, sparkles, extrude } = cfg;
  const palette = STYLES[style] || STYLES.chrome;

  const canvas = createCanvas(width, height);
  const ctx    = canvas.getContext('2d');
  const fontStr = `${size}px "${selectedFont.family}"`;

  drawBackground(ctx, width, height);

  const cx = width  / 2;
  const cy = height / 2 + size * 0.38;

  ctx.font      = fontStr;
  ctx.textAlign = 'center';

  // 1. 3D Extrude
  if (extrude > 0) {
    drawExtrude(ctx, text, cx, cy, extrude, palette.extrudeColor);
  }

  // 2. Outer glow
  if (glow) {
    ctx.font = fontStr;
    ctx.shadowColor = palette.glowColor;
    ctx.shadowBlur  = 48;
    ctx.fillStyle   = 'rgba(255,255,255,0.15)';
    for (let i = 0; i < 4; i++) ctx.fillText(text, cx, cy);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }

  // 3. Thick white outline
  ctx.font = fontStr;
  ctx.strokeStyle = palette.outlineColor;
  ctx.lineWidth   = 9;
  ctx.lineJoin    = 'round';
  ctx.strokeText(text, cx, cy);

  // 4. Inner dark outline
  ctx.strokeStyle = palette.innerOutline;
  ctx.lineWidth   = 5;
  ctx.strokeText(text, cx, cy);

  // 5. Main gradient fill
  const grad = ctx.createLinearGradient(0, cy - size, 0, cy + size * 0.1);
  palette.gradientStops.forEach(([stop, color]) => grad.addColorStop(stop, color));
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, cy);

  // 5b. Extra horizontal gradient for holo
  if (palette.extraGradient) {
    const hGrad = ctx.createLinearGradient(cx - width*.45, 0, cx + width*.45, 0);
    hGrad.addColorStop(0.00, 'rgba(255,100,200,0.38)');
    hGrad.addColorStop(0.25, 'rgba(100,160,255,0.38)');
    hGrad.addColorStop(0.50, 'rgba(100,255,220,0.38)');
    hGrad.addColorStop(0.75, 'rgba(255,200,80,0.38)');
    hGrad.addColorStop(1.00, 'rgba(255,100,200,0.38)');
    ctx.fillStyle = hGrad;
    ctx.fillText(text, cx, cy);
  }

  // 6. Top highlight
  const hi = ctx.createLinearGradient(0, cy - size, 0, cy - size * .35);
  hi.addColorStop(0,   'rgba(255,255,255,0.65)');
  hi.addColorStop(0.6, 'rgba(255,255,255,0.08)');
  hi.addColorStop(1,   'rgba(255,255,255,0.00)');
  ctx.fillStyle = hi;
  ctx.fillText(text, cx, cy);

  // 7. Sparkles
  if (sparkles) {
    drawSparkles(ctx, cx, cy, size, palette.sparkleColor, 22);
  }

  return canvas;
}

// ─────────────────────────────────────────────────────────────
//  SAVE OUTPUT
// ─────────────────────────────────────────────────────────────
const OUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const canvas = generate(cfg);

// PNG
const pngPath = path.join(OUT_DIR, `${cfg.out}.png`);
fs.writeFileSync(pngPath, canvas.toBuffer('image/png'));

// SVG (inline base64 PNG — transparent-bg compatible)
const b64 = canvas.toBuffer('image/png').toString('base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cfg.width}" height="${cfg.height}">
  <image href="data:image/png;base64,${b64}" width="${cfg.width}" height="${cfg.height}"/>
</svg>`;
fs.writeFileSync(path.join(OUT_DIR, `${cfg.out}.svg`), svg);

console.log(`
✅  Generated: output/${cfg.out}.png + .svg
    text:    ${cfg.text}
    style:   ${cfg.style}
    font:    ${cfg.font} (${selectedFont.family})
    size:    ${cfg.size}px
    canvas:  ${cfg.width}x${cfg.height}
    glow:    ${cfg.glow}
    sparkles:${cfg.sparkles}
    extrude: ${cfg.extrude}
`);
