/* ═══════════════════════════════════════════
   map.js — 地図初期化・マーカー描画・モード切り替え
   ─ Leaflet地図のセットアップ
   ─ 現在地への自動移動
   ─ タップでシートを開く（addモード）
   ─ renderMarkers : memoriesを地図に描画
   ─ switchMode    : add / view / delete の切り替え
═══════════════════════════════════════════ */

/* ─ 地図・レイヤーの初期化（グローバルに公開） ─ */
const map = L.map('map', {
  zoomControl:         false,
  maxBoundsViscosity:  1.0,
  minZoom:             3,
}).setView(CONFIG.MAP_DEFAULT_VIEW, CONFIG.MAP_DEFAULT_ZOOM);

map.setMaxBounds([[-60, -180], [75, 180]]);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap',
  noWrap:      true,
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);

/* ─ 現在地を取得して中心へ ─ */
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(pos => {
    map.setView([pos.coords.latitude, pos.coords.longitude], CONFIG.MAP_DEFAULT_ZOOM);
  });
}

/* ─ 地図タップ：addモードならシートを開く ─ */
map.on('click', e => {
  if (STATE.currentMode !== 'add' || !STATE.accessToken) return;
  if (STATE.tempMarker) map.removeLayer(STATE.tempMarker);
  STATE.tempMarker = L.marker(e.latlng).addTo(map);
  openSheet();
});

/* ─ モード切り替え ─ */
function switchMode(mode) {
  STATE.currentMode = mode;

  // ナビボタンのアクティブ状態を更新
  ['add', 'view', 'delete'].forEach(m => {
    document.getElementById('nav' + m[0].toUpperCase() + m.slice(1))
      .classList.toggle('active', m === mode);
  });

  closeSheet();
  showModeHint(mode);
  renderMarkers();
}

/* ─ マーカー描画 ─
   addモードでは描画しない（タップ用マーカーのみ表示）
── */
function renderMarkers() {
  markerLayer.clearLayers();
  if (STATE.currentMode === 'add') return;

  STATE.memories.forEach(m => {
    const marker = L.marker([m.lat, m.lng]).addTo(markerLayer);

    /* ── ポップアップHTMLビルダー ── */
    const buildHtml = (imgSrc) => {
      let html = `<div class="popup-wrap">`;

      if (imgSrc) {
        html += `<img class="popup-img" src="${imgSrc}">`;
      }

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
          <button class="popup-save"   onclick="editMemory('${m.id}')">変更を保存</button>
          <button class="popup-delete" onclick="deleteMemory('${m.id}')">🗑 この思い出を削除</button>`;
      }

      html += `</div>`;
      return html;
    };

    // キャッシュ済みの写真があれば即表示、なければテキストのみで表示
    const cached = m.photoFileId ? STATE.photoBlobCache[m.photoFileId] : null;
    marker.bindPopup(buildHtml(cached), { maxWidth: 280 });

    // ポップアップを開いたとき写真を非同期ロードして差し替え
    if (m.photoFileId) {
      marker.on('popupopen', async () => {
        const url = await loadPhotoBlob(m.photoFileId);
        if (url) {
          marker.getPopup().setContent(buildHtml(url));
        }
      });
    }
  });
}

/* ─ XSS対策：HTMLエスケープ ─
   【バグ修正】元コードは comment / date を escapeせずに innerHTML に展開していた。
   悪意あるコメント（例: <img src=x onerror=alert(1)>）でスクリプトが実行される危険があった。
── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ─ 起動時：0.8秒後に addモードのヒントを一瞬表示 ─ */
setTimeout(() => showModeHint('add'), 800);
