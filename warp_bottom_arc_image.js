/**
 * Warp a flat text PNG so the top stays rigid and the bottom follows an arc.
 *
 * Usage:
 *   node warp_bottom_arc_image.js --in input.png --out output_name
 *   node warp_bottom_arc_image.js --in input.png --bend 0.30 --startRatio 0.78 --power 2.1
 */

const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  in: '',
  out: '',
  bend: 0.30,
  startRatio: 0.78,
  power: 2.1,
  direction: 'down',
  bgTolerance: 14,
  scale: 3.0,
};

function parseArgs(args = process.argv.slice(2)) {
  const raw = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i] ? args[i].replace(/^--/, '') : '';
    const value = args[i + 1];
    if (!key || typeof value === 'undefined') continue;
    raw[key] = value;
  }

  const cfg = { ...DEFAULTS, ...raw };
  cfg.in = String(cfg.in || '').trim();
  cfg.out = String(cfg.out || '').trim();
  cfg.direction = String(cfg.direction || 'down').toLowerCase() === 'up' ? 'up' : 'down';
  cfg.bend = Math.max(0, Math.min(0.95, Number(cfg.bend) || DEFAULTS.bend));
  cfg.startRatio = Math.max(0.2, Math.min(0.9, Number(cfg.startRatio) || DEFAULTS.startRatio));
  cfg.power = Math.max(0.5, Math.min(3.0, Number(cfg.power) || DEFAULTS.power));
  cfg.bgTolerance = Math.max(0, Math.min(80, Number(cfg.bgTolerance) || DEFAULTS.bgTolerance));
  cfg.scale = Math.max(1, Math.min(6, Number(cfg.scale) || DEFAULTS.scale));
  return cfg;
}

function colorDistanceSq(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

function readPixel(data, width, x, y) {
  const idx = (y * width + x) * 4;
  return {
    r: data[idx],
    g: data[idx + 1],
    b: data[idx + 2],
    a: data[idx + 3],
  };
}

function detectBgColor(data, width, height) {
  const p1 = readPixel(data, width, 0, 0);
  const p2 = readPixel(data, width, width - 1, 0);
  const p3 = readPixel(data, width, 0, height - 1);
  const p4 = readPixel(data, width, width - 1, height - 1);
  return {
    r: Math.round((p1.r + p2.r + p3.r + p4.r) / 4),
    g: Math.round((p1.g + p2.g + p3.g + p4.g) / 4),
    b: Math.round((p1.b + p2.b + p3.b + p4.b) / 4),
    a: Math.round((p1.a + p2.a + p3.a + p4.a) / 4),
  };
}

function getContentBounds(canvas, bgTolerance = DEFAULTS.bgTolerance) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const bg = detectBgColor(data, width, height);
  const bgToleranceSq = bgTolerance * bgTolerance;
  const hasOpaqueBg = bg.a > 200;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      if (a <= 2) continue;

      let isContent = true;
      if (hasOpaqueBg) {
        const distSq = colorDistanceSq(data[i], data[i + 1], data[i + 2], bg.r, bg.g, bg.b);
        isContent = distSq > bgToleranceSq;
      }

      if (!isContent) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  // Fallback to alpha-only bounds if background detection became too strict.
  if (maxX < 0) return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 };
  return { minX, minY, maxX, maxY };
}

function warpBottomWeightedCanvas(
  srcCanvas,
  bendPx,
  startRatio = 0.78,
  power = 2.1,
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
  const srcImgData = srcCtx.getImageData(0, 0, w, h);
  const srcData = srcImgData.data;
  const outPixels = outCtx.createImageData(w, outH);
  const outData = outPixels.data;

  // Detect background to fill out-of-range pixels correctly
  const bg = detectBgColor(srcData, w, h);
  const hasOpaqueBg = bg.a > 200;
  if (hasOpaqueBg) {
    for (let i = 0; i < outData.length; i += 4) {
      outData[i]     = bg.r;
      outData[i + 1] = bg.g;
      outData[i + 2] = bg.b;
      outData[i + 3] = bg.a;
    }
  }

  const bounds = getContentBounds(boundsCanvas || srcCanvas);
  const glyphTop = bounds.minY;
  const glyphBottom = Math.max(bounds.minY + 1, bounds.maxY);
  const startWarpY = glyphTop + (glyphBottom - glyphTop) * startRatio;
  const warpRange = Math.max(1, glyphBottom - startWarpY);

  const fwd = new Float32Array(h);

  for (let ox = 0; ox < w; ox++) {
    const t = (ox / Math.max(1, w - 1)) * 2 - 1;
    const curve = 1 - t * t;
    const maxShift = dir * bend * curve;

    for (let sy = 0; sy < h; sy++) {
      let shift = 0;
      if (sy > startWarpY) {
        const n = Math.min(1, (sy - startWarpY) / warpRange);
        shift = maxShift * Math.pow(n, power);
      }
      fwd[sy] = sy + extraTop + shift;
    }

    for (let sy = 1; sy < h; sy++) {
      if (fwd[sy] <= fwd[sy - 1]) fwd[sy] = fwd[sy - 1] + 0.01;
    }

    let sy = 0;
    for (let oy = 0; oy < outH; oy++) {
      const outIdx = (oy * w + ox) * 4;

      while (sy < h - 2 && fwd[sy + 1] <= oy) sy++;

      if (oy < fwd[0] || oy > fwd[h - 1]) {
        // Background already filled; for transparent sources set transparent
        if (!hasOpaqueBg) {
          outData[outIdx] = outData[outIdx + 1] = outData[outIdx + 2] = outData[outIdx + 3] = 0;
        }
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

async function main() {
  const cfg = parseArgs();
  if (!cfg.in) {
    throw new Error('Eksik arguman: --in <input.png>');
  }

  const inputPath = path.resolve(cfg.in);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input bulunamadi: ${inputPath}`);
  }

  const image = await loadImage(inputPath);
  const workW = Math.round(image.width * cfg.scale);
  const workH = Math.round(image.height * cfg.scale);
  const src = createCanvas(workW, workH);
  const sctx = src.getContext('2d');
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(image, 0, 0, workW, workH);

  const bounds = getContentBounds(src, cfg.bgTolerance);
  const glyphHeight = Math.max(1, bounds.maxY - bounds.minY);
  const bendPx = glyphHeight * cfg.bend;
  const warped = warpBottomWeightedCanvas(src, bendPx, cfg.startRatio, cfg.power, src, cfg.direction);

  let finalCanvas = warped;
  if (cfg.scale > 1) {
    finalCanvas = createCanvas(image.width, Math.max(1, Math.round(warped.height / cfg.scale)));
    const fctx = finalCanvas.getContext('2d');
    fctx.imageSmoothingEnabled = true;
    fctx.imageSmoothingQuality = 'high';
    fctx.drawImage(warped, 0, 0, finalCanvas.width, finalCanvas.height);
  }

  const outDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const outName = cfg.out || `${path.parse(inputPath).name}_bottom_arc`;
  const outFile = path.join(outDir, `${outName}.png`);
  fs.writeFileSync(outFile, finalCanvas.toBuffer('image/png'));

  console.log(`✅ output/${outName}.png`);
  console.log(`   input: ${inputPath}`);
  console.log(`   bend(px): ${Math.round(bendPx * 100) / 100}`);
  console.log(`   startRatio: ${cfg.startRatio}, power: ${cfg.power}, direction: ${cfg.direction}, scale: ${cfg.scale}`);
}

main().catch((error) => {
  console.error(`❌ ${String(error.message || error)}`);
  process.exit(1);
});
