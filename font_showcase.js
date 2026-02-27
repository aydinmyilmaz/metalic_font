/**
 * FONT SHOWCASE — referans görsele en yakın fontu bulmak için
 * Her font ile aynı chrome efekti uygulanır
 */
const { createCanvas, registerFont } = require('canvas');
const fs   = require('fs');
const path = require('path');

const FONTS_DIR = path.join(__dirname, 'fonts');
const OUT_DIR   = path.join(__dirname, 'output/showcase');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Register fonts ──────────────────────────────────────────
const fonts = [
  { file: 'Anton-Regular.ttf',    family: 'Anton',        label: 'Anton (sans condensed)' },
  { file: 'BebasNeue-Regular.ttf',family: 'BebasNeue',    label: 'Bebas Neue (condensed sans)' },
  { file: 'AbrilFatface.ttf',     family: 'AbrilFatface', label: 'Abril Fatface (fat serif)' },
  { file: 'PlayfairDisplay.ttf',  family: 'PlayfairDisp', label: 'Playfair Display (elegant serif)' },
  { file: 'Ultra.ttf',            family: 'Ultra',        label: 'Ultra (heavy serif)' },
  { file: 'Righteous.ttf',        family: 'Righteous',    label: 'Righteous (retro display)' },
];

fonts.forEach(f => {
  const fp = path.join(FONTS_DIR, f.file);
  if (fs.existsSync(fp)) {
    registerFont(fp, { family: f.family });
    console.log(`  ✅ Loaded: ${f.family}`);
  } else {
    console.log(`  ❌ Missing: ${f.file}`);
  }
});

// ── Core drawing helpers ─────────────────────────────────────
function drawBg(ctx, w, h) {
  const bg = ctx.createRadialGradient(w*.5, h*.4, 20, w*.5, h*.5, w*.8);
  bg.addColorStop(0, '#2e2e2e');
  bg.addColorStop(1, '#080808');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  // subtle grain
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random()*w, Math.random()*h, 1, 1);
  }
}

function drawChromeText(ctx, text, cx, cy, fontStr, size) {
  ctx.font      = fontStr;
  ctx.textAlign = 'center';

  // 1. 3D extrude
  for (let i = 18; i >= 1; i--) {
    ctx.fillStyle = `rgba(${20+i*2},${25+i*2},${40+i*3},${0.3+0.03*i})`;
    ctx.fillText(text, cx + i*0.8, cy + i*0.8);
  }

  // 2. outer glow
  ctx.shadowColor = 'rgba(180,200,255,0.9)';
  ctx.shadowBlur  = 45;
  ctx.fillStyle   = 'rgba(255,255,255,0.2)';
  for (let i = 0; i < 4; i++) ctx.fillText(text, cx, cy);
  ctx.shadowBlur = 0;

  // 3. white outline (key for reference look)
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth   = 9;
  ctx.lineJoin    = 'round';
  ctx.strokeText(text, cx, cy);

  // 4. dark inner outline
  ctx.strokeStyle = 'rgba(40,60,120,0.7)';
  ctx.lineWidth   = 5;
  ctx.strokeText(text, cx, cy);

  // 5. main chrome gradient
  const grad = ctx.createLinearGradient(0, cy - size, 0, cy + size * 0.1);
  grad.addColorStop(0.00, '#ffffff');
  grad.addColorStop(0.08, '#e8eeff');
  grad.addColorStop(0.18, '#7888cc');
  grad.addColorStop(0.30, '#ffffff');
  grad.addColorStop(0.42, '#c0c8f0');
  grad.addColorStop(0.55, '#5060a8');
  grad.addColorStop(0.65, '#d8e0ff');
  grad.addColorStop(0.78, '#9098c8');
  grad.addColorStop(0.90, '#ffffff');
  grad.addColorStop(1.00, '#6070a0');
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, cy);

  // 6. top highlight
  const hi = ctx.createLinearGradient(0, cy - size, 0, cy - size * 0.35);
  hi.addColorStop(0,   'rgba(255,255,255,0.65)');
  hi.addColorStop(0.6, 'rgba(255,255,255,0.10)');
  hi.addColorStop(1,   'rgba(255,255,255,0.00)');
  ctx.fillStyle = hi;
  ctx.fillText(text, cx, cy);

  // 7. sparkles
  for (let i = 0; i < 20; i++) {
    const angle  = (Math.PI*2*i)/20 + Math.random()*0.4;
    const r      = size * 0.45 + Math.random() * size * 0.55;
    const x      = cx + Math.cos(angle) * r * 2;
    const y      = cy - size * 0.5 + Math.sin(angle) * r * 0.45;
    const s      = 1.5 + Math.random() * 2.5;
    const alpha  = 0.35 + Math.random() * 0.65;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(Math.PI/4);
    ctx.beginPath();
    ctx.fillStyle = '#d0dcff';
    ctx.moveTo(0,-s*2.5); ctx.lineTo(s*.4,-s*.4);
    ctx.lineTo(s*2.5,0);  ctx.lineTo(s*.4,s*.4);
    ctx.lineTo(0,s*2.5);  ctx.lineTo(-s*.4,s*.4);
    ctx.lineTo(-s*2.5,0); ctx.lineTo(-s*.4,-s*.4);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// ── Generate per-font card ───────────────────────────────────
const W = 900, H = 260, TEXT = 'CUSTOM', SIZE = 175;

fonts.forEach(f => {
  const fp = path.join(FONTS_DIR, f.file);
  if (!fs.existsSync(fp)) return;

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  drawBg(ctx, W, H);

  const cx = W / 2;
  const cy = H / 2 + SIZE * 0.38;
  const fontStr = `${SIZE}px "${f.family}"`;

  drawChromeText(ctx, TEXT, cx, cy, fontStr, SIZE);

  // label bottom-right
  ctx.font      = '13px Arial';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(180,180,200,0.7)';
  ctx.shadowBlur = 0;
  ctx.fillText(f.label, W - 12, H - 10);

  const outName = f.family.toLowerCase().replace(/[^a-z0-9]/g,'_');
  const p = path.join(OUT_DIR, `${outName}.png`);
  fs.writeFileSync(p, canvas.toBuffer('image/png'));
  console.log(`  🖼   output/showcase/${outName}.png`);
});

console.log('\n✨  Font showcase complete!\n');
