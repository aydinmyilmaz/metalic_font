/**
 * ARCED METALLIC TEXT — Pink Chrome + Curved Text
 */
const { createCanvas, registerFont } = require('canvas');
const fs   = require('fs');
const path = require('path');

registerFont(path.join(__dirname, 'fonts/AbrilFatface.ttf'), { family: 'AbrilFatface' });

const OUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

// ─────────────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────────────
const TEXT      = 'CUSTOM';
const WIDTH     = 900;
const HEIGHT    = 560;
const FONT_SIZE = 190;

// Arc params — negative radius = curve DOWN (arch up), positive = curve down
const ARC_RADIUS   = 420;   // radius of the circle the text follows
const ARC_CENTER_X = WIDTH / 2;
const ARC_CENTER_Y = HEIGHT * 0.96;  // center of circle (below canvas = arch upward)
const ARC_START    = -Math.PI * 0.62; // start angle (left side)

// ─────────────────────────────────────────────────────────────
//  PINK CHROME PALETTE
// ─────────────────────────────────────────────────────────────
const PALETTE = {
  extrudeRGB:   [40, 0, 20],
  glowColor:    'rgba(255,40,160,0.95)',
  outlineOuter: 'rgba(255,255,255,0.98)',
  outlineInner: 'rgba(140,0,60,0.9)',
  sparkle:      '#ffffff',
  // Referans: üst=koyu pembe, orta-alt=parlak beyaz/gümüş, alt=koyu pembe/mor
  grad: [
    [0.00, '#cc1066'],   // üst — koyu pembe
    [0.12, '#ee40aa'],   // üst pembe
    [0.22, '#ff70cc'],   // açık pembe
    [0.32, '#ffffff'],   // BEYAZ highlight — referanstaki parlak orta
    [0.42, '#ffddee'],   // beyaz-pembe geçiş
    [0.50, '#ff90d8'],   // orta pembe
    [0.58, '#ffffff'],   // ikinci beyaz parlaklık (referansta çift highlight var)
    [0.66, '#dd55bb'],   // pembe
    [0.76, '#990055'],   // koyu pembe
    [0.88, '#660033'],   // çok koyu
    [1.00, '#440022'],   // dip — neredeyse siyah-mor
  ],
};

// ─────────────────────────────────────────────────────────────
//  BACKGROUND — dark + lightning purple vibe
// ─────────────────────────────────────────────────────────────
function drawBackground(ctx, w, h) {
  // deep black base
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  // purple/magenta radial center glow (like lightning bg)
  const glow = ctx.createRadialGradient(w*.5, h*.72, 20, w*.5, h*.68, w*.7);
  glow.addColorStop(0,   'rgba(180,0,120,0.55)');
  glow.addColorStop(0.4, 'rgba(100,0,80,0.35)');
  glow.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // grain noise
  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random()*.04})`;
    ctx.fillRect(Math.random()*w, Math.random()*h, 1, 1);
  }
}

function drawLightning(ctx, w, h) {
  const bolts = [
    // [startX%, startY%, segments]
    [0.38, 0.55, 7],
    [0.52, 0.50, 8],
    [0.62, 0.58, 6],
    [0.30, 0.60, 5],
    [0.70, 0.52, 7],
    [0.45, 0.65, 6],
    [0.58, 0.48, 5],
    [0.25, 0.55, 4],
    [0.78, 0.60, 5],
  ];

  bolts.forEach(([sx, sy, segs]) => {
    ctx.save();
    ctx.strokeStyle = `rgba(${200+Math.random()*55},${100+Math.random()*80},${220+Math.random()*35},${0.5+Math.random()*0.5})`;
    ctx.lineWidth   = 0.8 + Math.random() * 1.2;
    ctx.shadowColor = 'rgba(220,100,255,0.9)';
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    let x = sx * w;
    let y = sy * h;
    ctx.moveTo(x, y);
    for (let i = 0; i < segs; i++) {
      x += (Math.random() - 0.45) * 70;
      y += 20 + Math.random() * 35;
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    // thin inner bright core
    ctx.strokeStyle = 'rgba(255,220,255,0.85)';
    ctx.lineWidth   = 0.4;
    ctx.shadowBlur  = 4;
    ctx.stroke();
    ctx.restore();
  });
}

// ─────────────────────────────────────────────────────────────
//  ARCED TEXT DRAWING
//  Draws each character rotated along a circular arc
// ─────────────────────────────────────────────────────────────
function drawArcedText(ctx, text, opts) {
  const {
    radius, centerX, centerY, fontSize, fontFamily,
    palette, extrude, glowPasses, arcStart,
  } = opts;

  // Scale: narrow X, tall Y — referanstaki condensed+tall look
  const SCALE_X = 0.72;  // harfi yatayda daralt (daha ince)
  const SCALE_Y = 1.22;  // harfi dikeyde uzat (daha uzun)

  const fontStr = `${fontSize}px "${fontFamily}"`;
  ctx.font      = fontStr;
  ctx.textAlign = 'center';

  // Measure total arc span needed (scale edilmiş genişlik ile)
  const charWidths = [];
  let totalArcAngle = 0;
  for (const ch of text) {
    const w = ctx.measureText(ch).width * SCALE_X;
    charWidths.push(w);
    totalArcAngle += w / radius;
  }
  // Add small letter-spacing
  const spacing     = fontSize * 0.02;
  const spaceAngle  = spacing / radius;
  totalArcAngle    += spaceAngle * (text.length - 1);

  // Start angle so text is centered on arc
  let angle = arcStart - totalArcAngle / 2;  // we'll set arcStart so center is at top of arc

  // ── Draw each character ──────────────────────────────────
  for (let ci = 0; ci < text.length; ci++) {
    const ch       = text[ci];
    const halfAngle = (charWidths[ci] / radius) / 2;  // already scaled width
    angle += halfAngle; // move to center of this char

    ctx.save();
    ctx.translate(
      centerX + Math.sin(angle) * radius,
      centerY - Math.cos(angle) * radius,
    );
    ctx.rotate(angle);
    ctx.scale(SCALE_X, SCALE_Y);  // ince + uzun
    ctx.font      = fontStr;
    ctx.textAlign = 'center';

    // 1. Extrude shadow
    if (extrude > 0) {
      for (let i = extrude; i >= 1; i--) {
        const [r,g,b] = palette.extrudeRGB;
        const alpha   = 0.25 + 0.04 * (extrude - i);
        ctx.fillStyle = `rgba(${Math.min(255,r+i*2)},${Math.min(255,g+i)},${Math.min(255,b+i*2)},${alpha})`;
        ctx.fillText(ch, i * 0.7, i * 0.7);
      }
    }

    // 2. Glow
    if (glowPasses > 0) {
      ctx.shadowColor = palette.glowColor;
      ctx.shadowBlur  = 40;
      ctx.fillStyle   = 'rgba(255,255,255,0.1)';
      for (let g = 0; g < glowPasses; g++) ctx.fillText(ch, 0, 0);
      ctx.shadowBlur  = 0;
      ctx.shadowColor = 'transparent';
    }

    // 3. Outer white outline
    ctx.strokeStyle = palette.outlineOuter;
    ctx.lineWidth   = 9;
    ctx.lineJoin    = 'round';
    ctx.strokeText(ch, 0, 0);

    // 4. Inner dark outline
    ctx.strokeStyle = palette.outlineInner;
    ctx.lineWidth   = 5;
    ctx.strokeText(ch, 0, 0);

    // 5. Chrome gradient fill
    //    Gradient is in local char space: top to bottom of char
    const grad = ctx.createLinearGradient(0, -fontSize, 0, fontSize * 0.1);
    palette.grad.forEach(([stop, color]) => grad.addColorStop(stop, color));
    ctx.fillStyle = grad;
    ctx.fillText(ch, 0, 0);

    // 6. Top highlight
    const hi = ctx.createLinearGradient(0, -fontSize, 0, -fontSize * 0.3);
    hi.addColorStop(0,   'rgba(255,255,255,0.7)');
    hi.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    hi.addColorStop(1,   'rgba(255,255,255,0.00)');
    ctx.fillStyle = hi;
    ctx.fillText(ch, 0, 0);

    ctx.restore();

    angle += halfAngle + spaceAngle;
  }
}

// ─────────────────────────────────────────────────────────────
//  SPARKLES scattered around text area
// ─────────────────────────────────────────────────────────────
function drawSparkles(ctx, cx, cy, count, color, spread) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r     = 60 + Math.random() * spread;
    const x     = cx + Math.cos(angle) * r;
    const y     = cy - 80 + Math.sin(angle) * r * 0.55;
    const s     = 2 + Math.random() * 4;
    ctx.save();
    ctx.globalAlpha = 0.4 + Math.random() * 0.6;
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 6;
    ctx.moveTo(0,-s*2.5); ctx.lineTo(s*.4,-s*.4);
    ctx.lineTo(s*2.5,0);  ctx.lineTo(s*.4,s*.4);
    ctx.lineTo(0,s*2.5);  ctx.lineTo(-s*.4,s*.4);
    ctx.lineTo(-s*2.5,0); ctx.lineTo(-s*.4,-s*.4);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────────────────────────
function render(text, outName) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx    = canvas.getContext('2d');

  drawBackground(ctx, WIDTH, HEIGHT);

  // Arc center point — place it so text appears in upper portion
  // text sits ON the arc circle, center of circle below canvas
  const centerY    = HEIGHT * 0.96;
  const arcCenterX = WIDTH / 2;

  drawArcedText(ctx, text, {
    radius:      ARC_RADIUS,
    centerX:     arcCenterX,
    centerY:     centerY,
    fontSize:    FONT_SIZE,
    fontFamily:  'AbrilFatface',
    palette:     PALETTE,
    extrude:     16,
    glowPasses:  4,
    arcStart:    0, // 0 = top of circle (12 o'clock), text fans upward
  });

  // Sparkles around text
  drawSparkles(ctx, WIDTH/2, HEIGHT*0.22, 28, '#ffffff', 420);
  drawSparkles(ctx, WIDTH/2, HEIGHT*0.22, 12, '#ffaaee', 340);

  const pngPath = path.join(OUT_DIR, `${outName}.png`);
  fs.writeFileSync(pngPath, canvas.toBuffer('image/png'));
  console.log(`✅  output/${outName}.png`);
}

console.log('\n🎨  Pink Chrome Arc Generator\n');
render(TEXT, 'pink_chrome_arc');
render('SALE',    'pink_arc_sale');
render('PREMIUM', 'pink_arc_premium');
console.log('\n✨  Done!\n');
