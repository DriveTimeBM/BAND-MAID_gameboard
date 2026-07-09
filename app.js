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
 *   "spaces": [
 *     {
 *       "index": 0,                 // used only as a stable key/label
 *       "row": 11, "col": 11,       // 1-indexed grid position (any layout, not just perimeter)
 *       "name": "GO",
 *       "type": "corner",           // free-form string, only used as a CSS class hook
 *       "colorGroup": null,         // hex color for the top bar, or null/omitted
 *       "image": "",                // image URL, or "" to skip
 *       "icon": "",                 // emoji/text fallback shown if no image
 *       "subtext": "Collect 200"    // small secondary line
 *     }
 *   ]
 * }
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

  const edgeTrack = '1fr';
  const cornerTrack = '1.6fr';
  const middleCount = Math.max(gridSize - 2, 0);
  const template = [cornerTrack, `repeat(${middleCount}, ${edgeTrack})`, cornerTrack].join(' ');
  els.board.style.gridTemplateColumns = template;
  els.board.style.gridTemplateRows = template;

  config.spaces.forEach(space => {
    const cell = buildCell(space, theme);
    els.board.appendChild(cell);
  });

  els.board.appendChild(buildCenter(config.center || {}, theme));

  setStatus(`Showing "${config.name || config.id || 'untitled skin'}" \u2014 ${config.spaces.length} spaces, ${gridSize}\u00d7${gridSize} grid`);
}

function inferGridSize(spaces) {
  const max = spaces.reduce((m, s) => Math.max(m, s.row || 0, s.col || 0), 0);
  return max || 11;
}

function buildCell(space, theme) {
  const cell = document.createElement('div');
  cell.className = 'cell' + (space.type ? ` type-${slug(space.type)}` : '');
  if (space.type === 'corner') cell.classList.add('corner');
  cell.style.gridRow = space.row;
  cell.style.gridColumn = space.col;
  cell.style.setProperty('--cell-bg', theme.cellBg || '#faf8f2');
  cell.style.setProperty('--text-color', theme.textColor || '#1a1a1a');
  cell.tabIndex = 0;
  cell.setAttribute('role', 'gridcell');
  cell.setAttribute('aria-label', space.name || `space ${space.index}`);

  if (space.colorGroup) {
    const bar = document.createElement('div');
    bar.className = 'cell-color-bar';
    bar.style.background = space.colorGroup;
    cell.appendChild(bar);
  }

  const badge = document.createElement('span');
  badge.className = 'cell-index-badge';
  badge.textContent = space.index != null ? `#${space.index} \u00b7 ${space.row},${space.col}` : `${space.row},${space.col}`;
  cell.appendChild(badge);

  const body = document.createElement('div');
  body.className = 'cell-body';

  if (space.image) {
    const img = document.createElement('img');
    img.className = 'cell-image';
    img.src = space.image;
    img.alt = '';
    img.loading = 'lazy';
    img.onerror = () => { img.remove(); maybeAddIcon(body, space); };
    body.appendChild(img);
  } else {
    maybeAddIcon(body, space);
  }

  if (space.name) {
    const name = document.createElement('div');
    name.className = 'cell-name';
    name.textContent = space.name;
    body.appendChild(name);
  }

  if (space.subtext) {
    const sub = document.createElement('div');
    sub.className = 'cell-subtext';
    sub.textContent = space.subtext;
    body.appendChild(sub);
  }

  cell.appendChild(body);

  cell.addEventListener('click', () => selectCell(cell, space, theme));
  cell.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectCell(cell, space, theme);
    }
  });

  return cell;
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

function selectCell(cellEl, space, theme) {
  if (state.selectedCell) state.selectedCell.classList.remove('selected');
  cellEl.classList.add('selected');
  cellEl.style.setProperty('--accent-outline', theme.accentColor || '#e8b34c');
  state.selectedCell = cellEl;
  renderInspector(space);
}

function renderInspector(space) {
  const rows = Object.entries(space)
    .filter(([k, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => {
      const isColor = k === 'colorGroup';
      const swatch = isColor ? `<span class="inspector-swatch" style="background:${v}"></span>` : '';
      return `<div class="inspector-row"><span class="inspector-key">${escapeHtml(k)}</span><span class="inspector-val">${escapeHtml(String(v))}${swatch}</span></div>`;
    })
    .join('');

  els.inspector.innerHTML = `
    <p class="inspector-title">Space Inspector</p>
    <h3 class="inspector-name">${escapeHtml(space.name || 'Untitled')}</h3>
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
