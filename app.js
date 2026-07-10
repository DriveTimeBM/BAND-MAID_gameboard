/* Board Skin Viewer
 * Renders a perimeter-style game board purely from a JSON config.
 * No game logic lives here — this only visualizes a skin.
 *
 * ---- JSON schema (see configs/*.json for full examples) ----
 * {
 *   "id": "unique-id",
 *   "name": "Display Name",
 *   "gridSize": 11,                 // NxN CSS grid the board sits in
 *   "theme": {
 *     "boardBg": "#c8e6c9",         // color behind the whole board (gaps/border)
 *     "cellBg": "#f5f5f0",          // default cell background
 *     "borderColor": "#000000",
 *     "textColor": "#1a1a1a",
 *     "accentColor": "#c0392b",     // used for the selected-cell outline
 *     "fontDisplay": "'Space Grotesk', sans-serif",  // optional
 *     "fontBody": "'DM Sans', sans-serif"             // optional
 *   },
 *   "center": {
 *     "title": "GAME NAME",
 *     "subtitle": "optional tagline",
 *     "image": "https://... (optional)",
 *     "bg": "#d7ecd9"               // optional center-panel background
 *   },
 *   "autoRotate": true,             // optional, default true — see rotation note below
 *   "spaces": [
 *     {
 *       "index": 0,                 // used only as a stable key/label
 *       "row": 11, "col": 11,       // 1-indexed grid position (any layout, not just perimeter)
 *       "name": "GO",
 *       "type": "corner",           // free-form string, only used as a CSS class hook
 *       "colorGroup": null,         // hex color for the top bar, or null/omitted
 *       "image": "",                // image URL — fills the ENTIRE square as a cover
 *                                    //   background (behind everything else), or "" to skip
 *       "icon": "",                 // emoji/text fallback shown if no image (or image fails to load)
 *       "subtext": "Collect 200",   // small secondary line
 *       "textBg": "",               // optional CSS color (hex/rgba) behind name+subtext+icon,
 *                                    //   so text stays readable over a busy image. "" / omitted = transparent
 *       "rotate": 90                // optional, degrees clockwise. Overrides the auto default below.
 *     }
 *   ]
 * }
 *
 * ---- Images ----
 * "image" is rendered as a full-bleed cover background for the whole square
 * (like CSS background-size: cover), with the color bar, name, subtext, and
 * icon layered on top. It rotates together with the rest of the cell's
 * content. Use "textBg" (e.g. "rgba(0,0,0,0.55)") to keep the name/subtext
 * legible over a photo — it's applied as a background on the label chip that
 * wraps them.
 *
 * ---- Rotation ----
 * Classic Monopoly boards rotate each side's content to face the center.
 * That's the default here (autoRotate: true, or simply omitted):
 *   bottom edge -> 0deg, left edge -> 90deg, top edge -> 180deg, right edge -> 270deg
 *   corners default to 0deg (their art is usually asymmetric/custom anyway)
 * Set a per-space "rotate" (any degree value) to override the default for that
 * one space, or set top-level "autoRotate": false to turn off auto-rotation
 * entirely (every space then defaults to 0deg unless it sets its own "rotate").
 */

const state = {
  manifest: null,
  currentConfig: null,
  selectedCell: null
};

const els = {
  select: document.getElementById('skin-select'),
  fileInput: document.getElementById('file-input'),
  board: document.getElementById('board'),
  inspector: document.getElementById('inspector'),
  status: document.getElementById('status-text')
};

init();

async function init() {
  els.select.addEventListener('change', onSelectSkin);
  els.fileInput.addEventListener('change', onFileUpload);

  try {
    const res = await fetch('configs/manifest.json');
    if (!res.ok) throw new Error(`manifest.json responded ${res.status}`);
    state.manifest = await res.json();
    populateSelect(state.manifest.skins);
    if (state.manifest.skins.length) {
      await loadSkinByFile(state.manifest.skins[0].file);
    }
  } catch (err) {
    setStatus(`Could not load configs/manifest.json (${err.message}). Use "Custom JSON" to load a skin directly.`, true);
  }
}

function populateSelect(skins) {
  els.select.innerHTML = '';
  skins.forEach(skin => {
    const opt = document.createElement('option');
    opt.value = skin.file;
    opt.textContent = skin.name;
    els.select.appendChild(opt);
  });
}

async function onSelectSkin(e) {
  await loadSkinByFile(e.target.value);
}

async function loadSkinByFile(file) {
  setStatus(`Loading ${file}\u2026`);
  try {
    const res = await fetch(file);
    if (!res.ok) throw new Error(`${file} responded ${res.status}`);
    const config = await res.json();
    renderBoard(config);
  } catch (err) {
    setStatus(`Failed to load ${file}: ${err.message}`, true);
  }
}

function onFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const config = JSON.parse(reader.result);
      renderBoard(config);
      setStatus(`Loaded custom skin from ${file.name}`);
    } catch (err) {
      setStatus(`Could not parse ${file.name}: ${err.message}`, true);
    }
  };
  reader.onerror = () => setStatus(`Could not read ${file.name}`, true);
  reader.readAsText(file);
}

function renderBoard(config) {
  if (!Array.isArray(config.spaces) || !config.spaces.length) {
    setStatus('Config has no "spaces" array \u2014 nothing to render.', true);
    return;
  }

  state.currentConfig = config;
  state.selectedCell = null;
  clearInspector();

  const gridSize = config.gridSize || inferGridSize(config.spaces);
  const theme = config.theme || {};

  els.board.innerHTML = '';
  els.board.style.background = theme.boardBg || '#e8e8e0';
  els.board.style.borderColor = theme.borderColor || '#000';

  els.board.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
  els.board.style.gridTemplateRows = `repeat(${gridSize}, 1fr)`;

  config.spaces.forEach(space => {
    const cell = buildCell(space, theme, config, gridSize);
    els.board.appendChild(cell);
  });

  els.board.appendChild(buildCenter(config.center || {}, theme));

  setStatus(`Showing "${config.name || config.id || 'untitled skin'}" \u2014 ${config.spaces.length} spaces, ${gridSize}\u00d7${gridSize} grid`);
}

function inferGridSize(spaces) {
  const max = spaces.reduce((m, s) => Math.max(m, s.row || 0, s.col || 0), 0);
  return max || 11;
}

function buildCell(space, theme, config, gridSize) {
  const cell = document.createElement('div');
  cell.className = 'cell' + (space.type ? ` type-${slug(space.type)}` : '');
  const isCorner = isCornerPos(space.row, space.col, gridSize);
  if (isCorner) cell.classList.add('corner');
  cell.style.gridRow = space.row;
  cell.style.gridColumn = space.col;
  cell.style.setProperty('--cell-bg', theme.cellBg || '#faf8f2');
  cell.style.setProperty('--text-color', theme.textColor || '#1a1a1a');
  cell.tabIndex = 0;
  cell.setAttribute('role', 'gridcell');
  cell.setAttribute('aria-label', space.name || `space ${space.index}`);

  const badge = document.createElement('span');
  badge.className = 'cell-index-badge';
  badge.textContent = space.index != null ? `#${space.index} \u00b7 ${space.row},${space.col}` : `${space.row},${space.col}`;
  cell.appendChild(badge);

  // Everything visual lives in a rotator wrapper so the cell itself stays
  // put in the grid track while its contents face the board's center.
  const rotator = document.createElement('div');
  rotator.className = 'cell-rotator';
  const rotation = computeRotation(space, config, gridSize, isCorner);
  rotator.style.transform = `rotate(${rotation}deg)`;

  if (space.colorGroup) {
    const bar = document.createElement('div');
    bar.className = 'cell-color-bar';
    bar.style.background = space.colorGroup;
    rotator.appendChild(bar);
  }

  if (space.image) {
    const bgImg = document.createElement('img');
    bgImg.className = 'cell-bg-image';
    bgImg.src = space.image;
    bgImg.alt = '';
    bgImg.loading = 'lazy';
    rotator.appendChild(bgImg);
  }

  const body = document.createElement('div');
  body.className = 'cell-body';
  body.style.paddingTop = space.colorGroup ? '25%' : '3%';

  const label = document.createElement('div');
  label.className = 'cell-label';
  if (space.textBg) label.style.background = space.textBg;

  if (space.image) {
    // If the image 404s, fall back to the icon inside the label.
    const bgImg = rotator.querySelector('.cell-bg-image');
    bgImg.onerror = () => { bgImg.remove(); maybeAddIcon(label, space); };
  } else {
    maybeAddIcon(label, space);
  }

  if (space.name) {
    const name = document.createElement('div');
    name.className = 'cell-name';
    name.textContent = space.name;
    label.appendChild(name);
  }

  if (space.subtext) {
    const sub = document.createElement('div');
    sub.className = 'cell-subtext';
    sub.textContent = space.subtext;
    label.appendChild(sub);
  }

  body.appendChild(label);
  rotator.appendChild(body);
  cell.appendChild(rotator);

  cell.addEventListener('click', () => selectCell(cell, space, theme, rotation));
  cell.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectCell(cell, space, theme, rotation);
    }
  });

  return cell;
}

function isCornerPos(row, col, gridSize) {
  const atEdgeRow = row === 1 || row === gridSize;
  const atEdgeCol = col === 1 || col === gridSize;
  return atEdgeRow && atEdgeCol;
}

function computeRotation(space, config, gridSize, isCorner) {
  if (space.rotate !== undefined && space.rotate !== null && space.rotate !== '') {
    return Number(space.rotate);
  }
  const autoRotate = config.autoRotate !== false; // default true
  if (!autoRotate || isCorner) return 0;

  if (space.row === gridSize) return 0;   // bottom edge
  if (space.col === 1) return 90;         // left edge
  if (space.row === 1) return 180;        // top edge
  if (space.col === gridSize) return 270; // right edge
  return 0;
}

function maybeAddIcon(body, space) {
  if (!space.icon) return;
  const icon = document.createElement('div');
  icon.className = 'cell-icon';
  icon.textContent = space.icon;
  body.appendChild(icon);
}

function buildCenter(center, theme) {
  const wrap = document.createElement('div');
  wrap.className = 'board-center';
  wrap.style.background = center.bg || 'transparent';
  wrap.style.color = theme.textColor || '#1a1a1a';

  if (center.image) {
    const img = document.createElement('img');
    img.src = center.image;
    img.alt = '';
    img.onerror = () => img.remove();
    wrap.appendChild(img);
  }
  if (center.title) {
    const h2 = document.createElement('h2');
    h2.textContent = center.title;
    wrap.appendChild(h2);
  }
  if (center.subtitle) {
    const p = document.createElement('p');
    p.textContent = center.subtitle;
    wrap.appendChild(p);
  }
  return wrap;
}

function selectCell(cellEl, space, theme, rotation) {
  if (state.selectedCell) state.selectedCell.classList.remove('selected');
  cellEl.classList.add('selected');
  cellEl.style.setProperty('--accent-outline', theme.accentColor || '#e8b34c');
  state.selectedCell = cellEl;
  renderInspector(space, rotation);
}

function renderInspector(space, rotation) {
  const rows = Object.entries(space)
    .filter(([k, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => {
      const isColor = k === 'colorGroup' || k === 'textBg';
      const swatch = isColor ? `<span class="inspector-swatch" style="background:${v}"></span>` : '';
      return `<div class="inspector-row"><span class="inspector-key">${escapeHtml(k)}</span><span class="inspector-val">${escapeHtml(String(v))}${swatch}</span></div>`;
    })
    .join('');

  const rotateNote = space.rotate === undefined || space.rotate === null || space.rotate === ''
    ? ` <span class="inspector-auto">(auto)</span>`
    : '';

  els.inspector.innerHTML = `
    <p class="inspector-title">Space Inspector</p>
    <h3 class="inspector-name">${escapeHtml(space.name || 'Untitled')}</h3>
    <div class="inspector-row"><span class="inspector-key">effective rotate</span><span class="inspector-val">${rotation}deg${rotateNote}</span></div>
    ${rows}
  `;
}

function clearInspector() {
  els.inspector.innerHTML = `
    <div class="inspector-empty">
      <p class="inspector-hint">Click any space</p>
      <p class="inspector-sub">to inspect its config data</p>
    </div>
  `;
}

function setStatus(msg, isError = false) {
  els.status.textContent = msg;
  els.status.style.color = isError ? '#ff6b6b' : '';
}

function slug(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
