const { createCanvas, registerFont } = require('canvas');
const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────
//  FONTS
// ─────────────────────────────────────────────────────────────
registerFont(path.join(__dirname, 'fonts/Anton-Regular.ttf'),    { family: 'Anton' });
registerFont(path.join(__dirname, 'fonts/BebasNeue-Regular.ttf'),{ family: 'BebasNeue' });

// ─────────────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────────────
const TEXT      = 'CUSTOM';
const WIDTH     = 900;
const HEIGHT    = 260;
const FONT_SIZE = 180;
const OUT_DIR   = path.join(__dirname, 'output');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────

/** Draw dark textured background */
function drawBackground(ctx, w, h, bgColor = '#111') {
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.4, 20, w * 0.5, h * 0.5, w * 0.8);
  bg.addColorStop(0, '#2e2e2e');
  bg.addColorStop(1, '#080808');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // subtle noise texture
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const a = Math.random() * 0.07;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

/** 3-D extrude: draw many offset copies going down-right */
function drawExtrude(ctx, text, cx, cy, font, depth, color) {
  ctx.font      = font;
  ctx.textAlign = 'center';
  for (let i = depth; i >= 1; i--) {
    const ratio  = i / depth;
    const alpha  = 0.25 + 0.35 * (1 - ratio);
    ctx.fillStyle = shadeColor(color, -40 * ratio);
    ctx.globalAlpha = alpha;
    ctx.fillText(text, cx + i * 0.9, cy + i * 0.9);
  }
  ctx.globalAlpha = 1;
}

/** Shade a hex color darker (negative amount) */
function shadeColor(hex, amt) {
  const num = parseInt(hex.replace('#',''), 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0xff) + amt;
  let b = (num & 0xff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}

/** Hard stroke outline (multiple passes for thick clean edge) */
function drawOutline(ctx, text, cx, cy, color, width) {
  ctx.font        = ctx.font; // keep current
  ctx.textAlign   = 'center';
  ctx.strokeStyle = color;
  ctx.lineWidth   = width;
  ctx.lineJoin    = 'round';
  ctx.miterLimit  = 2;
  ctx.strokeText(text, cx, cy);
}

/** Outer glow pass */
function drawGlow(ctx, text, cx, cy, color, blur, passes = 3) {
  ctx.shadowColor = color;
  ctx.shadowBlur  = blur;
  for (let i = 0; i < passes; i++) ctx.fillText(text, cx, cy);
  ctx.shadowBlur  = 0;
  ctx.shadowColor = 'transparent';
}

/** Top highlight stripe (lens flare feel) */
function drawHighlight(ctx, text, cx, cy, fontSz) {
  const hi = ctx.createLinearGradient(0, cy - fontSz, 0, cy - fontSz * 0.35);
  hi.addColorStop(0,   'rgba(255,255,255,0.65)');
  hi.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  hi.addColorStop(1,   'rgba(255,255,255,0.00)');
  ctx.fillStyle = hi;
  ctx.fillText(text, cx, cy);
}

/** Sparkle dots scattered around */
function drawSparkles(ctx, cx, cy, fontSz, color = '#fff', count = 18) {
  for (let i = 0; i < count; i++) {
    const angle  = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const radius = fontSz * 0.45 + Math.random() * fontSz * 0.5;
    const x      = cx + Math.cos(angle) * radius * 1.8;
    const y      = cy - fontSz * 0.45 + Math.sin(angle) * radius * 0.5;
    const size   = 1.5 + Math.random() * 3;
    const alpha  = 0.3 + Math.random() * 0.7;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);

    // 4-point star
    ctx.beginPath();
    ctx.fillStyle = color;
    const s = size;
    ctx.moveTo(0, -s * 2.5);
    ctx.lineTo(s * 0.4, -s * 0.4);
    ctx.lineTo(s * 2.5, 0);
    ctx.lineTo(s * 0.4,  s * 0.4);
    ctx.lineTo(0,  s * 2.5);
    ctx.lineTo(-s * 0.4,  s * 0.4);
    ctx.lineTo(-s * 2.5, 0);
    ctx.lineTo(-s * 0.4, -s * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────
//  VARIANT 1: CHROME (Anton font)
// ─────────────────────────────────────────────────────────────
function generateChrome(text, outName) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx    = canvas.getContext('2d');
  drawBackground(ctx, WIDTH, HEIGHT);

  const cx   = WIDTH  / 2;
  const cy   = HEIGHT / 2 + FONT_SIZE * 0.36;
  const font = `${FONT_SIZE}px "Anton"`;
  ctx.font      = font;
  ctx.textAlign = 'center';

  // 1. Extrude shadow (3D depth)
  drawExtrude(ctx, text, cx, cy, font, 12, '#1a2040');

  // 2. Outer glow
  ctx.font = font;
  drawGlow(ctx, text, cx, cy, 'rgba(160,180,255,0.8)', 40, 4);

  // 3. Hard outline (white outer edge like in reference)
  ctx.font = font;
  drawOutline(ctx, text, cx, cy, 'rgba(255,255,255,0.9)', 8);

  // 4. Main chrome gradient fill
  const grad = ctx.createLinearGradient(0, cy - FONT_SIZE, 0, cy + 15);
  grad.addColorStop(0.00, '#ffffff');
  grad.addColorStop(0.08, '#e8eeff');
  grad.addColorStop(0.18, '#9daad8');
  grad.addColorStop(0.30, '#ffffff');
  grad.addColorStop(0.42, '#c8d0f0');
  grad.addColorStop(0.52, '#7080b8');
  grad.addColorStop(0.62, '#d8e0ff');
  grad.addColorStop(0.75, '#a0aad0');
  grad.addColorStop(0.88, '#e0e8ff');
  grad.addColorStop(1.00, '#8890b8');
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, cy);

  // 5. Inner highlight
  drawHighlight(ctx, text, cx, cy, FONT_SIZE);

  // 6. Thin silver inner stroke
  ctx.font = font;
  drawOutline(ctx, text, cx, cy, 'rgba(200,210,255,0.6)', 2);

  // 7. Sparkles
  drawSparkles(ctx, cx, cy, FONT_SIZE, '#c8d8ff', 22);

  save(canvas, outName);
}

// ─────────────────────────────────────────────────────────────
//  VARIANT 2: GOLD (Bebas Neue font)
// ─────────────────────────────────────────────────────────────
function generateGold(text, outName) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx    = canvas.getContext('2d');
  drawBackground(ctx, WIDTH, HEIGHT);

  const cx   = WIDTH  / 2;
  const cy   = HEIGHT / 2 + FONT_SIZE * 0.36;
  const font = `${FONT_SIZE}px "BebasNeue"`;
  ctx.font      = font;
  ctx.textAlign = 'center';

  // 1. Deep extrude (dark bronze)
  drawExtrude(ctx, text, cx, cy, font, 14, '#3a2000');

  // 2. Outer glow (warm amber)
  ctx.font = font;
  drawGlow(ctx, text, cx, cy, 'rgba(255,160,20,0.75)', 45, 4);

  // 3. Hard outline (gold edge)
  ctx.font = font;
  drawOutline(ctx, text, cx, cy, 'rgba(255,230,100,0.95)', 8);

  // 4. Main gold gradient
  const grad = ctx.createLinearGradient(0, cy - FONT_SIZE, 0, cy + 15);
  grad.addColorStop(0.00, '#fff8d0');
  grad.addColorStop(0.10, '#ffd040');
  grad.addColorStop(0.22, '#fff0a0');
  grad.addColorStop(0.35, '#e09000');
  grad.addColorStop(0.48, '#ffd840');
  grad.addColorStop(0.60, '#b06800');
  grad.addColorStop(0.72, '#ffc030');
  grad.addColorStop(0.85, '#804000');
  grad.addColorStop(1.00, '#d09020');
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, cy);

  // 5. Highlight
  drawHighlight(ctx, text, cx, cy, FONT_SIZE);

  // 6. Fine inner edge
  ctx.font = font;
  drawOutline(ctx, text, cx, cy, 'rgba(255,240,150,0.5)', 2);

  // 7. Gold sparkles
  drawSparkles(ctx, cx, cy, FONT_SIZE, '#ffe080', 20);

  save(canvas, outName);
}

// ─────────────────────────────────────────────────────────────
//  VARIANT 3: HOLOGRAPHIC / Y2K (Anton font)
// ─────────────────────────────────────────────────────────────
function generateHolo(text, outName) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx    = canvas.getContext('2d');
  drawBackground(ctx, WIDTH, HEIGHT);

  const cx   = WIDTH  / 2;
  const cy   = HEIGHT / 2 + FONT_SIZE * 0.36;
  const font = `${FONT_SIZE}px "Anton"`;
  ctx.font      = font;
  ctx.textAlign = 'center';

  // 1. Extrude (purple-dark)
  drawExtrude(ctx, text, cx, cy, font, 12, '#200040');

  // 2. Multi-color outer glow
  ctx.font = font;
  ctx.shadowColor = 'rgba(180,80,255,0.9)';
  ctx.shadowBlur  = 50;
  ctx.fillStyle   = 'rgba(255,255,255,0.3)';
  for (let i = 0; i < 3; i++) ctx.fillText(text, cx, cy);
  ctx.shadowBlur  = 0;

  // 3. Hard outline (white/violet)
  ctx.font = font;
  drawOutline(ctx, text, cx, cy, 'rgba(220,180,255,0.95)', 8);

  // 4. Vertical rainbow gradient
  const vGrad = ctx.createLinearGradient(0, cy - FONT_SIZE, 0, cy + 15);
  vGrad.addColorStop(0.00, '#ff80ff');
  vGrad.addColorStop(0.16, '#8080ff');
  vGrad.addColorStop(0.33, '#80ffff');
  vGrad.addColorStop(0.50, '#80ff80');
  vGrad.addColorStop(0.66, '#ffff80');
  vGrad.addColorStop(0.83, '#ff8080');
  vGrad.addColorStop(1.00, '#ff80ff');
  ctx.fillStyle = vGrad;
  ctx.fillText(text, cx, cy);

  // 5. Horizontal rainbow overlay
  const hGrad = ctx.createLinearGradient(cx - 400, 0, cx + 400, 0);
  hGrad.addColorStop(0.00, 'rgba(255,100,200,0.40)');
  hGrad.addColorStop(0.20, 'rgba(100,150,255,0.40)');
  hGrad.addColorStop(0.40, 'rgba(100,255,220,0.40)');
  hGrad.addColorStop(0.60, 'rgba(200,255,100,0.40)');
  hGrad.addColorStop(0.80, 'rgba(255,200,80,0.40)');
  hGrad.addColorStop(1.00, 'rgba(255,100,200,0.40)');
  ctx.fillStyle = hGrad;
  ctx.fillText(text, cx, cy);

  // 6. Highlight
  drawHighlight(ctx, text, cx, cy, FONT_SIZE);

  // 7. Thin inner edge
  ctx.font = font;
  drawOutline(ctx, text, cx, cy, 'rgba(255,220,255,0.5)', 2);

  // 8. Colorful sparkles
  const sparkColors = ['#ff80ff','#80ffff','#ffff80','#80ff80','#ffffff'];
  drawSparkles(ctx, cx, cy, FONT_SIZE, '#ffffff', 0); // clear first call
  for (let i = 0; i < 24; i++) {
    const color  = sparkColors[i % sparkColors.length];
    const angle  = (Math.PI * 2 * i) / 24 + Math.random() * 0.3;
    const radius = FONT_SIZE * 0.45 + Math.random() * FONT_SIZE * 0.55;
    const x      = cx + Math.cos(angle) * radius * 1.9;
    const y      = cy - FONT_SIZE * 0.45 + Math.sin(angle) * radius * 0.5;
    const size   = 1.5 + Math.random() * 3;
    const alpha  = 0.4 + Math.random() * 0.6;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.fillStyle = color;
    const s = size;
    ctx.moveTo(0, -s*2.5); ctx.lineTo(s*0.4,-s*0.4);
    ctx.lineTo(s*2.5,0);   ctx.lineTo(s*0.4, s*0.4);
    ctx.lineTo(0, s*2.5);  ctx.lineTo(-s*0.4, s*0.4);
    ctx.lineTo(-s*2.5,0);  ctx.lineTo(-s*0.4,-s*0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  save(canvas, outName);
}

// ─────────────────────────────────────────────────────────────
//  VARIANT 4: SILVER + DEEP EXTRUDE (referans görsel tarzı)
// ─────────────────────────────────────────────────────────────
function generateSilverExtrude(text, outName) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx    = canvas.getContext('2d');
  drawBackground(ctx, WIDTH, HEIGHT);

  const cx   = WIDTH  / 2;
  const cy   = HEIGHT / 2 + FONT_SIZE * 0.36;
  const font = `${FONT_SIZE}px "Anton"`;
  ctx.font      = font;
  ctx.textAlign = 'center';

  // 1. Very deep extrude — exact reference look
  for (let i = 20; i >= 1; i--) {
    ctx.font      = font;
    ctx.fillStyle = `rgba(${30 + i*3}, ${30 + i*3}, ${40 + i*4}, ${0.4 + 0.03*i})`;
    ctx.fillText(text, cx + i, cy + i);
  }

  // 2. Soft blue-white glow
  ctx.font = font;
  drawGlow(ctx, text, cx, cy, 'rgba(200,220,255,0.9)', 50, 5);

  // 3. Thick white outer outline
  ctx.font = font;
  drawOutline(ctx, text, cx, cy, 'rgba(255,255,255,1.0)', 10);

  // 4. Dark outline just inside
  drawOutline(ctx, text, cx, cy, 'rgba(60,80,140,0.7)', 7);

  // 5. Main silver-chrome gradient (more contrast bands)
  const grad = ctx.createLinearGradient(0, cy - FONT_SIZE, 0, cy + 15);
  grad.addColorStop(0.00, '#ffffff');
  grad.addColorStop(0.06, '#f0f4ff');
  grad.addColorStop(0.14, '#7888cc');
  grad.addColorStop(0.22, '#ffffff');
  grad.addColorStop(0.30, '#d0d8ff');
  grad.addColorStop(0.40, '#5868a8');
  grad.addColorStop(0.50, '#e8eeff');
  grad.addColorStop(0.60, '#9098c8');
  grad.addColorStop(0.70, '#ffffff');
  grad.addColorStop(0.80, '#7080b8');
  grad.addColorStop(0.90, '#c8d0f0');
  grad.addColorStop(1.00, '#404870');
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, cy);

  // 6. Top bright highlight
  drawHighlight(ctx, text, cx, cy, FONT_SIZE);

  // 7. Sparkles — white/silver
  drawSparkles(ctx, cx, cy, FONT_SIZE, '#e0e8ff', 26);

  save(canvas, outName);
}

// ─────────────────────────────────────────────────────────────
//  SAVE PNG
// ─────────────────────────────────────────────────────────────
function save(canvas, name) {
  const p = path.join(OUT_DIR, name + '.png');
  fs.writeFileSync(p, canvas.toBuffer('image/png'));

  // Also write a basic inline-SVG wrapper
  const dataUri = 'data:image/png;base64,' + canvas.toBuffer('image/png').toString('base64');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
  <image href="${dataUri}" width="${canvas.width}" height="${canvas.height}"/>
</svg>`;
  fs.writeFileSync(path.join(OUT_DIR, name + '.svg'), svg);

  console.log(`  ✅  ${name}.png + .svg`);
}

// ─────────────────────────────────────────────────────────────
//  RUN
// ─────────────────────────────────────────────────────────────
console.log('\n🎨  Metallic Text Generator – Full Gas Edition\n');
generateChrome        (TEXT, 'v1_chrome');
generateGold          (TEXT, 'v2_gold');
generateHolo          (TEXT, 'v3_holographic');
generateSilverExtrude (TEXT, 'v4_silver_extrude');
console.log('\n✨  Done! output/ klasörünü kontrol et.\n');
