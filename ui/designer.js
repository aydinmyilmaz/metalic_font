const form = document.getElementById('configForm');
const statusEl = document.getElementById('status');
const commandEl = document.getElementById('command');
const previewEl = document.getElementById('previewImage');
const renderStampEl = document.getElementById('renderStamp');
const renderBtn = document.getElementById('renderBtn');
const compareBtn = document.getElementById('compareBtn');
const presetBtn = document.getElementById('presetBtn');
const resetBtn = document.getElementById('resetBtn');
const autoRenderEl = document.getElementById('autoRender');
const presetSelectEl = document.getElementById('presetSelect');
const curveModeEl = form.querySelector('[data-key="curveMode"]');
const curveEl = form.querySelector('[data-key="curve"]');
const curveDownBtn = document.getElementById('curveDownBtn');
const curveResetBtn = document.getElementById('curveResetBtn');
const curveUpBtn = document.getElementById('curveUpBtn');
const mainFontSelectEl = document.getElementById('mainFontSelect');
const compareResultsEl = document.getElementById('compareResults');
const compareFontListEl = document.getElementById('compareFontList');
const compareSelectAllBtn = document.getElementById('compareSelectAllBtn');
const compareSelectNoneBtn = document.getElementById('compareSelectNoneBtn');
const compareRefreshBtn = document.getElementById('compareRefreshBtn');
const compareIncludeAutoEl = document.getElementById('compareIncludeAuto');
const compareSelectionInfoEl = document.getElementById('compareSelectionInfo');

const fieldNodes = Array.from(form.querySelectorAll('[data-key]'));
let renderTimer = null;
let stampTimer = null;
let isRendering = false;
let renderCount = 0;
let availableCompareFonts = [];
const MAX_COMPARE_FONTS = 12;
const CURVE_STEP = 8;

const intKeys = new Set(['width', 'height', 'size', 'curve', 'glowSize', 'strokeSize', 'bevelSize', 'extrudeDepth']);
const floatKeys = new Set([
  'bend', 'letterSpacing', 'glowOpacity', 'apexYRatio', 'verticalOffset',
  'gradientOpacity', 'bevelHighlightOpacity', 'bevelShadowOpacity', 'topShadowOpacity',
  'extrudeOpacity', 'renderScale', 'rotateFactor', 'edge3dStrength',
  'warpStartRatio', 'warpPower',
]);
const numericKeys = new Set([...intKeys, ...floatKeys]);

const fieldByKey = {};
fieldNodes.forEach((node) => {
  fieldByKey[node.dataset.key] = node;
});

function setStatus(message) {
  statusEl.textContent = message;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function buildCommandPreview(payload) {
  const parts = ['node generate_clarendon_arc.js'];
  for (const [key, value] of Object.entries(payload)) {
    if (value === '' || value === null || typeof value === 'undefined') continue;
    parts.push(`--${key} ${shellQuote(value)}`);
  }
  return parts.join(' ');
}

function parseLocaleNumber(rawValue) {
  const cleaned = String(rawValue ?? '')
    .trim()
    .replace(',', '.');
  if (cleaned === '') return Number.NaN;
  return Number.parseFloat(cleaned);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
  }
  return String(value);
}

function renderStampRows(config, items) {
  return items.map(([label, key]) => {
    if (typeof config[key] === 'undefined') return '';
    return `<div class="stamp-item"><span class="k">${escapeHtml(label)}</span><span class="v">${escapeHtml(formatValue(config[key]))}</span></div>`;
  }).join('');
}

function showRenderStamp(data) {
  if (!renderStampEl) return;
  renderCount += 1;
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const cfg = data && data.config ? data.config : {};
  const fontFamily = data && data.font ? data.font.family : '-';
  renderStampEl.innerHTML = `
<div class="stamp-head">Render #${renderCount} <span class="stamp-time">${time}</span></div>
<div class="stamp-meta">out: ${escapeHtml(formatValue(cfg.out || '-'))} | font: ${escapeHtml(fontFamily)}</div>
<div class="stamp-grid">
  ${renderStampRows(cfg, [
    ['Curve', 'curveMode'], ['Curve Scope', 'curveScope'], ['Curve Amt', 'curve'], ['Preset', 'preset'], ['Size', 'size'], ['Scale', 'renderScale'],
    ['Top', 'topColor'], ['Mid', 'midColor'], ['Bottom', 'bottomColor'], ['Outline', 'outlineColor'], ['Glow', 'glowColor'],
    ['Gradient', 'gradientOpacity'], ['BevelHi', 'bevelHighlightOpacity'], ['BevelLow', 'bevelShadowOpacity'], ['TopLow', 'topShadowOpacity'],
    ['Glow Op', 'glowOpacity'], ['Glow Size', 'glowSize'], ['Stroke', 'strokeSize'], ['Letter Spacing', 'letterSpacing'],
    ['Extrude D', 'extrudeDepth'], ['Extrude Op', 'extrudeOpacity'], ['Edge3D', 'edge3dStrength'], ['Bend', 'bend'], ['Rotate', 'rotateFactor'],
    ['Warp Start', 'warpStartRatio'], ['Warp Power', 'warpPower'], ['Warp Dir', 'warpDirection'],
  ])}
</div>
`;
  renderStampEl.classList.add('show');
  clearTimeout(stampTimer);
  stampTimer = setTimeout(() => {
    renderStampEl.classList.remove('show');
  }, 30000);
}

function clearCompareResults() {
  if (!compareResultsEl) return;
  compareResultsEl.innerHTML = '';
}

function sanitizeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 42);
}

function appendCompareCard(data, index) {
  if (!compareResultsEl) return;
  const card = document.createElement('article');
  card.className = 'compare-card';
  const title = data.requestFont || '(auto fallback)';
  const sub = `${data.font.family} (${data.font.source})`;
  card.innerHTML = `
<img src="${escapeHtml(data.imageUrl)}" alt="font compare ${index + 1}">
<div class="compare-meta">
  <div class="compare-title">${escapeHtml(title)}</div>
  <div class="compare-sub">${escapeHtml(sub)}</div>
</div>
`;
  compareResultsEl.append(card);
}

function appendCompareErrorCard(fontFile, error) {
  if (!compareResultsEl) return;
  const card = document.createElement('article');
  card.className = 'compare-card';
  card.innerHTML = `
<div class="compare-meta">
  <div class="compare-title">${escapeHtml(fontFile || '(auto fallback)')}</div>
  <div class="compare-sub">Render hatasi: ${escapeHtml(error || 'Bilinmeyen hata')}</div>
</div>
`;
  compareResultsEl.append(card);
}

function getSelectedCompareFonts() {
  if (!compareFontListEl) return [];
  return Array.from(compareFontListEl.querySelectorAll('input[type="checkbox"][data-font]'))
    .filter((node) => node.checked)
    .map((node) => String(node.dataset.font || '').trim())
    .filter(Boolean);
}

function updateCompareSelectionInfo() {
  if (!compareSelectionInfoEl) return;
  const count = getSelectedCompareFonts().length;
  const autoTxt = compareIncludeAutoEl && compareIncludeAutoEl.checked ? ' + auto' : '';
  compareSelectionInfoEl.textContent = `${count} secili${autoTxt}`;
}

function renderCompareFontPicker(fonts = [], selected = []) {
  if (!compareFontListEl) return;
  const selectedSet = new Set(selected.map((f) => String(f).toLowerCase()));
  if (fonts.length === 0) {
    compareFontListEl.innerHTML = '<div class="compare-selection-info">fonts/ altinda uygun dosya yok.</div>';
    updateCompareSelectionInfo();
    return;
  }

  const html = fonts.map((font) => {
    const checked = selectedSet.has(String(font).toLowerCase()) ? ' checked' : '';
    return `
<label class="compare-font-item">
  <input type="checkbox" data-font="${escapeHtml(font)}"${checked}>
  <span>${escapeHtml(font)}</span>
</label>`;
  }).join('');
  compareFontListEl.innerHTML = html;
  compareFontListEl.querySelectorAll('input[type="checkbox"][data-font]').forEach((node) => {
    node.addEventListener('change', updateCompareSelectionInfo);
  });
  updateCompareSelectionInfo();
}

function renderMainFontSelect(fonts = [], selected = '') {
  if (!mainFontSelectEl) return;
  const wanted = String(selected || '').trim();
  const options = ['<option value="">(auto fallback)</option>'];
  for (const font of fonts) {
    const sel = wanted === font ? ' selected' : '';
    options.push(`<option value="${escapeHtml(font)}"${sel}>${escapeHtml(font)}</option>`);
  }
  if (wanted && !fonts.includes(wanted)) {
    options.push(`<option value="${escapeHtml(wanted)}" selected>${escapeHtml(wanted)} (bulunamadi)</option>`);
  }
  mainFontSelectEl.innerHTML = options.join('');
}

function setNodeInvalid(node, invalid, message = '') {
  if (!node) return;
  node.classList.toggle('is-invalid', invalid);
  if (invalid && message) node.title = message;
  else node.removeAttribute('title');
}

function validateNumericNode(node) {
  if (!node || !node.dataset || !node.dataset.key) return true;
  const key = node.dataset.key;
  if (!numericKeys.has(key)) return true;
  if (node.disabled) {
    setNodeInvalid(node, false);
    return true;
  }

  const value = parseLocaleNumber(node.value);
  if (!Number.isFinite(value)) {
    setNodeInvalid(node, true, 'Gecerli bir sayi girin.');
    return false;
  }

  if (node.min !== '' && Number.isFinite(parseLocaleNumber(node.min)) && value < parseLocaleNumber(node.min)) {
    setNodeInvalid(node, true, `Min: ${node.min}`);
    return false;
  }
  if (node.max !== '' && Number.isFinite(parseLocaleNumber(node.max)) && value > parseLocaleNumber(node.max)) {
    setNodeInvalid(node, true, `Max: ${node.max}`);
    return false;
  }

  setNodeInvalid(node, false);
  return true;
}

function validateAllFields(silent = false) {
  let ok = true;
  fieldNodes.forEach((node) => {
    if (!validateNumericNode(node)) ok = false;
  });
  if (!ok && !silent) setStatus('Hata: Kirmizi alanlarda gecersiz deger var.');
  return ok;
}

function getPayloadFromForm() {
  const payload = {};
  for (const node of fieldNodes) {
    const key = node.dataset.key;
    if (!key) continue;
    const value = node.value;
    if (intKeys.has(key)) {
      const num = parseLocaleNumber(value);
      if (Number.isFinite(num)) payload[key] = Math.round(num);
      continue;
    }
    if (floatKeys.has(key)) {
      const num = parseLocaleNumber(value);
      if (Number.isFinite(num)) payload[key] = num;
      continue;
    }
    payload[key] = value;
  }
  return payload;
}

function setFormFromConfig(config) {
  for (const node of fieldNodes) {
    const key = node.dataset.key;
    if (!key) continue;
    if (typeof config[key] !== 'undefined' && config[key] !== null) {
      node.value = config[key];
    }
  }
  updateCurveFieldState();
  validateAllFields(true);
}

function setFieldDisabled(key, disabled) {
  const node = fieldByKey[key];
  if (!node) return;
  node.disabled = disabled;
}

function updateCurveFieldState() {
  const mode = curveModeEl ? curveModeEl.value : 'flat';
  const isClassicArc = mode === 'arc';
  const isCurveArc = mode === 'arcCurve';
  const isWarp = mode === 'bottomWarp';

  setFieldDisabled('warpStartRatio', !isWarp);
  setFieldDisabled('warpPower', !isWarp);
  setFieldDisabled('warpDirection', !isWarp);
  setFieldDisabled('bend', !isWarp);
  setFieldDisabled('curve', !isCurveArc);
  setFieldDisabled('curveScope', !isCurveArc);
  setFieldDisabled('rotateFactor', !isClassicArc);
  if (curveDownBtn) curveDownBtn.disabled = !isCurveArc;
  if (curveResetBtn) curveResetBtn.disabled = !isCurveArc;
  if (curveUpBtn) curveUpBtn.disabled = !isCurveArc;
  validateAllFields(true);
}

function readCurveValue() {
  if (!curveEl) return 0;
  const value = parseLocaleNumber(curveEl.value);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

function setCurveValue(nextValue) {
  if (!curveEl) return;
  curveEl.value = String(clamp(Math.round(nextValue), -100, 100));
  validateNumericNode(curveEl);
  queueAutoRender();
}

async function loadDefaults(presetName = '') {
  const qs = presetName ? `?preset=${encodeURIComponent(presetName)}` : '';
  const res = await fetch(`/api/defaults${qs}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Default config okunamadi');
  setFormFromConfig(data.config);
}

async function requestRender(payload) {
  const res = await fetch('/api/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function fetchAvailableFonts() {
  const res = await fetch('/api/fonts');
  const data = await res.json();
  if (!res.ok || !data.ok || !Array.isArray(data.fonts)) {
    throw new Error(data.error || 'Font listesi alinamadi');
  }
  return data.fonts;
}

async function refreshCompareFontsPicker(keepSelection = true) {
  const prev = keepSelection ? getSelectedCompareFonts() : [];
  const prevMain = mainFontSelectEl ? mainFontSelectEl.value : '';
  const fonts = await fetchAvailableFonts();
  availableCompareFonts = fonts;
  renderMainFontSelect(fonts, prevMain);

  let selected = prev.filter((f) => fonts.some((x) => x.toLowerCase() === f.toLowerCase()));
  if (selected.length === 0) {
    selected = chooseCompareFonts(fonts, Math.min(8, fonts.length));
  }
  renderCompareFontPicker(fonts, selected);
}

async function renderNow() {
  if (isRendering) return;
  if (!validateAllFields(false)) return;
  isRendering = true;

  const payload = getPayloadFromForm();
  commandEl.textContent = buildCommandPreview(payload);
  setStatus('Render aliniyor...');

  try {
    const data = await requestRender(payload);

    previewEl.src = data.imageUrl;
    if (data.config) {
      commandEl.textContent = buildCommandPreview(data.config);
    }
    clearCompareResults();
    showRenderStamp(data);
    setStatus(`Tamam: ${data.font.family} (${data.font.source})`);
  } catch (error) {
    setStatus(`Hata: ${error.message}`);
  } finally {
    isRendering = false;
  }
}

function chooseCompareFonts(fonts, maxCount = 8) {
  const score = (name) => {
    const n = name.toLowerCase();
    if (n.includes('clarendon')) return 1;
    if (n.includes('playfair')) return 2;
    if (n.includes('abril')) return 3;
    if (n.includes('ultra')) return 4;
    if (n.includes('anton')) return 5;
    if (n.includes('bebas')) return 6;
    return 7;
  };
  return [...fonts]
    .sort((a, b) => score(a) - score(b) || a.localeCompare(b, 'tr'))
    .slice(0, maxCount);
}

async function compareFontsNow() {
  if (isRendering) return;
  if (!validateAllFields(false)) return;
  isRendering = true;

  const payload = getPayloadFromForm();
  const originalOut = payload.out || 'ui_preview';
  const includeAuto = Boolean(compareIncludeAutoEl && compareIncludeAutoEl.checked);
  commandEl.textContent = buildCommandPreview(payload);
  clearCompareResults();

  try {
    if (availableCompareFonts.length === 0) {
      await refreshCompareFontsPicker(true);
    }
    const selectedFonts = getSelectedCompareFonts();
    if (selectedFonts.length === 0 && !includeAuto) {
      throw new Error('Karsilastirma icin en az bir font sec veya auto fallback acik olsun.');
    }

    let finalList = [
      ...(includeAuto ? [''] : []),
      ...selectedFonts,
    ];
    const limit = MAX_COMPARE_FONTS + (includeAuto ? 1 : 0);
    if (finalList.length > limit) {
      finalList = finalList.slice(0, limit);
    }

    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < finalList.length; i++) {
      const fontFile = finalList[i];
      const fontSlug = sanitizeSlug(fontFile || 'auto');
      const out = `${sanitizeSlug(originalOut)}_cmp_${String(i + 1).padStart(2, '0')}_${fontSlug}`;
      setStatus(`Font karsilastirma: ${i + 1}/${finalList.length} render aliniyor...`);
      try {
        const data = await requestRender({ ...payload, out, fontFile });
        data.requestFont = fontFile;
        appendCompareCard(data, i);
        successCount += 1;
        if (successCount === 1) {
          previewEl.src = data.imageUrl;
          showRenderStamp(data);
        }
      } catch (error) {
        failCount += 1;
        appendCompareErrorCard(fontFile, error.message);
      }
    }

    setStatus(`Tamam: ${successCount}/${finalList.length} basarili, ${failCount} hatali.`);
  } catch (error) {
    setStatus(`Hata: ${error.message}`);
  } finally {
    isRendering = false;
  }
}

function queueAutoRender() {
  if (!autoRenderEl.checked) return;
  if (!validateAllFields(true)) return;
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    renderNow();
  }, 280);
}

async function applySelectedPreset() {
  const keepText = form.querySelector('[data-key="text"]').value;
  const keepOut = form.querySelector('[data-key="out"]').value;
  const keepFont = form.querySelector('[data-key="fontFile"]').value;
  await loadDefaults(presetSelectEl.value);
  form.querySelector('[data-key="text"]').value = keepText;
  form.querySelector('[data-key="out"]').value = keepOut;
  form.querySelector('[data-key="fontFile"]').value = keepFont;
  queueAutoRender();
}

fieldNodes.forEach((node) => {
  node.addEventListener('input', () => {
    validateNumericNode(node);
    queueAutoRender();
  });
  node.addEventListener('blur', () => {
    validateNumericNode(node);
  });
});

if (curveModeEl) {
  curveModeEl.addEventListener('change', () => {
    updateCurveFieldState();
    queueAutoRender();
  });
}

if (curveDownBtn) {
  curveDownBtn.addEventListener('click', () => {
    setCurveValue(readCurveValue() - CURVE_STEP);
  });
}

if (curveResetBtn) {
  curveResetBtn.addEventListener('click', () => {
    setCurveValue(0);
  });
}

if (curveUpBtn) {
  curveUpBtn.addEventListener('click', () => {
    setCurveValue(readCurveValue() + CURVE_STEP);
  });
}

renderBtn.addEventListener('click', () => {
  renderNow();
});

if (compareBtn) {
  compareBtn.addEventListener('click', () => {
    compareFontsNow();
  });
}

if (compareSelectAllBtn) {
  compareSelectAllBtn.addEventListener('click', () => {
    if (!compareFontListEl) return;
    compareFontListEl.querySelectorAll('input[type="checkbox"][data-font]').forEach((node) => {
      node.checked = true;
    });
    updateCompareSelectionInfo();
  });
}

if (compareSelectNoneBtn) {
  compareSelectNoneBtn.addEventListener('click', () => {
    if (!compareFontListEl) return;
    compareFontListEl.querySelectorAll('input[type="checkbox"][data-font]').forEach((node) => {
      node.checked = false;
    });
    updateCompareSelectionInfo();
  });
}

if (compareRefreshBtn) {
  compareRefreshBtn.addEventListener('click', async () => {
    try {
      await refreshCompareFontsPicker(true);
      setStatus(`Font listesi yenilendi: ${availableCompareFonts.length} bulundu.`);
    } catch (error) {
      setStatus(`Hata: ${error.message}`);
    }
  });
}

if (compareIncludeAutoEl) {
  compareIncludeAutoEl.addEventListener('change', () => {
    updateCompareSelectionInfo();
  });
}

presetBtn.addEventListener('click', async () => {
  try {
    await applySelectedPreset();
  } catch (error) {
    setStatus(`Hata: ${error.message}`);
  }
});

resetBtn.addEventListener('click', async () => {
  try {
    await loadDefaults('');
    queueAutoRender();
  } catch (error) {
    setStatus(`Hata: ${error.message}`);
  }
});

autoRenderEl.addEventListener('change', () => {
  if (autoRenderEl.checked) queueAutoRender();
});

window.addEventListener('DOMContentLoaded', async () => {
  try {
    await Promise.all([
      loadDefaults(''),
      refreshCompareFontsPicker(false),
    ]);
    updateCurveFieldState();
    updateCompareSelectionInfo();
    await renderNow();
  } catch (error) {
    setStatus(`Hata: ${error.message}`);
  }
});
