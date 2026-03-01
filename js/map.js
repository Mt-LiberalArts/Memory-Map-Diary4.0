/* ═══════════════════════════════════════════
   map.js — 地図初期化・マーカー描画・モード切り替え
═══════════════════════════════════════════ */
import { CONFIG, STATE } from './config.js';
import { showModeHint, openMemoryModal } from './ui.js';
import { openSheet, closeSheet } from './sheet.js';
import { loadPhotoBlob } from './drive.js';

/* ─ 地図初期化 ─ */
export const map = L.map('map', {
  zoomControl:        false,
  maxBoundsViscosity: 1.0,
  minZoom:            3,
}).setView(CONFIG.MAP_DEFAULT_VIEW, CONFIG.MAP_DEFAULT_ZOOM);

map.setMaxBounds([[-60, -180], [75, 180]]);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap',
  noWrap:      true,
}).addTo(map);

export const markerLayer = L.markerClusterGroup().addTo(map);

/* ─ 現在地へ移動 ─ */
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(pos => {
    map.setView([pos.coords.latitude, pos.coords.longitude], CONFIG.MAP_DEFAULT_ZOOM);
  });
}

/* ─ 地図タップでシートを開く ─ */
map.on('click', e => {
  if (STATE.currentMode !== 'add' || !STATE.accessToken) return;
  if (STATE.tempMarker) map.removeLayer(STATE.tempMarker);
  STATE.tempMarker = L.marker(e.latlng).addTo(map);
  openSheet();
});

/* ─ モード切り替え ─ */
export function switchMode(mode) {
  STATE.currentMode = mode;
  ['add', 'view', 'delete'].forEach(m => {
    document.getElementById('nav' + m[0].toUpperCase() + m.slice(1))
      .classList.toggle('active', m === mode);
  });
  closeSheet(map);
  showModeHint(mode);
  renderMarkers();
}

/* ─ editMemory / deleteMemory のコールバック（memories.jsから注入）─ */
let _editMemory   = () => {};
let _deleteMemory = () => {};
export function initMapCallbacks(editFn, deleteFn) {
  _editMemory   = editFn;
  _deleteMemory = deleteFn;
}

/* ─ マーカー描画 ─ */
export function renderMarkers() {
  markerLayer.clearLayers();
  if (STATE.currentMode === 'add') return;

  STATE.memories.forEach(m => {
    const marker = L.marker([m.lat, m.lng]).addTo(markerLayer);

    marker.on('click', async () => {
      const cached = m.photoFileId ? STATE.photoBlobCache[m.photoFileId] : null;
      const imgUrl = cached ?? (m.photoFileId ? await loadPhotoBlob(m.photoFileId) : null);

      openMemoryModal({
        memory: m,
        imgUrl,
        mode: STATE.currentMode,
        onEdit:   () => _editMemory(m.id),
        onDelete: () => _deleteMemory(m.id),
      });
    });
  });
}

/* ─ 起動時ヒント ─ */
setTimeout(() => showModeHint('add'), 800);
