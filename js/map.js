/* ═══════════════════════════════════════════
   map.js — 地図初期化・マーカー描画・モード切り替え
═══════════════════════════════════════════ */
import { CONFIG, STATE } from './config.js';
import { showModeHint } from './ui.js';
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

    const buildHtml = (imgSrc) => {
      let html = `<div class="popup-wrap">`;
      if (imgSrc) html += `<img class="popup-img" src="${imgSrc}">`;

      html += `
        <div class="popup-body">
          <div class="popup-comment">${escapeHtml(m.comment || '')}</div>
          <div class="popup-date">${escapeHtml(m.date || '')}</div>
        </div>`;

      if (STATE.currentMode === 'delete') {
        html += `
          <div class="popup-edit-form">
            <div>
              <div class="popup-edit-label">コメント</div>
              <textarea id="edit-comment-${m.id}">${escapeHtml(m.comment || '')}</textarea>
            </div>
            <div>
              <div class="popup-edit-label">日付</div>
              <input type="date" id="edit-date-${m.id}" value="${escapeHtml(m.date || '')}" />
            </div>
          </div>
          <button class="popup-save"   data-edit="${m.id}">変更を保存</button>
          <button class="popup-delete" data-delete="${m.id}">🗑 この思い出を削除</button>`;
      }

      html += `</div>`;
      return html;
    };

    const cached = m.photoFileId ? STATE.photoBlobCache[m.photoFileId] : null;
    marker.bindPopup(buildHtml(cached), { maxWidth: 280 });

    marker.on('popupopen', async () => {
      // 写真を非同期ロード → setContent直後に最新DOMへイベント登録
      if (m.photoFileId) {
        const url = await loadPhotoBlob(m.photoFileId);
        if (url) marker.getPopup().setContent(buildHtml(url));
      }

      const popupEl = marker.getPopup().getElement();

      popupEl?.querySelector('[data-edit]')?.addEventListener('click', e => {
        _editMemory(e.currentTarget.dataset.edit);
      });
      popupEl?.querySelector('[data-delete]')?.addEventListener('click', e => {
        _deleteMemory(e.currentTarget.dataset.delete);
      });
      popupEl?.querySelector('.popup-img')?.addEventListener('click', e => {
        openPhotoModal(e.currentTarget.src);
      });
    });
  });
}

/* ─ XSS対策：HTMLエスケープ ─ */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ─ 起動時ヒント ─ */
setTimeout(() => showModeHint('add'), 800);

/* ─ 写真拡大モーダル ─ */
function openPhotoModal(src) {
  const modal   = document.getElementById('photoModal');
  const img     = document.getElementById('photoModalImg');
  const saveBtn = document.getElementById('photoModalSave');
  const closeBtn= document.getElementById('photoModalClose');
  const overlay = document.getElementById('photoModalOverlay');

  img.src = src;
  modal.classList.add('open');

  // 保存ボタン
  const onSave = () => {
    const a = document.createElement('a');
    a.href     = src;
    a.download = 'memory_' + Date.now() + '.jpg';
    a.click();
  };

  // 閉じる
  const close = () => {
    modal.classList.remove('open');
    img.src = '';
    saveBtn.removeEventListener('click', onSave);
    closeBtn.removeEventListener('click', close);
    overlay.removeEventListener('click', close);
  };

  saveBtn.addEventListener('click', onSave);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', close);
}
