/* ═══════════════════════════════════════════
   おもいでマップ — app.js
   ─ 設定・状態管理
   ─ オンライン/オフライン監視
   ─ 地図初期化
   ─ Google認証（GAPI / GIS）
   ─ トースト通知
   ─ モード切り替え
   ─ シート（入力フォーム）開閉
   ─ 写真処理（EXIFDate取得・リサイズ）
   ─ ローディング表示
   ─ Google Drive操作
   ─ 思い出の保存・読み込み・描画・削除
═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════
   § 設定・状態管理
   ─ CLIENT_ID : Google OAuthクライアントID
   ─ SCOPE     : drive.file（自分で作ったファイルのみ）
   ─ 各種状態変数（認証・モード・マーカー等）
═══════════════════════════════════════════ */
const CLIENT_ID     = '258493345784-tecrt34v0mqpq8rkmoajjhgi9lpvmfp5.apps.googleusercontent.com';
const SCOPE         = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';
const DATA_FILENAME = 'memory_map_data.json';
const PHOTOS_FOLDER = 'MemoryMapPhotos';

let accessToken    = null;
let tokenClient    = null;
let gapiReady      = false;
let gisReady       = false;
let currentMode    = 'add';
let tempMarker     = null;
let tempPhotoBlob  = null;
let dataFileId     = null;
let photosFolderId = null;
let memories       = [];

/* ═══════════════════════════════════════════
   § オンライン／オフライン監視
   ─ アプリ起動時から常時監視
   ─ 切断時・復帰時にトーストで通知
═══════════════════════════════════════════ */
window.addEventListener('offline', () => {
  showToast('You are offline. Please check your connection', 'error', 5000);
});
window.addEventListener('online', () => {
  showToast('Connection restored ✓', 'info', 2000);
});

/* ═══════════════════════════════════════════
   § 地図初期化
   ─ Leafletで地図を表示
   ─ 現在地を取得して中心にセット
   ─ タップ時に追加モードならシートを開く
═══════════════════════════════════════════ */
const map = L.map('map', {
  zoomControl: false,
  maxBoundsViscosity: 1.0   // 境界で完全に止まる
}).setView([40.7128, -74.0060], 15); // NYC default
map.setMaxBounds([[-90, -180], [90, 180]]); // 経度±180を絶対に越えない
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap',
  noWrap: true
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(pos => {
    map.setView([pos.coords.latitude, pos.coords.longitude], 15);
  });
}

map.on('click', e => {
  if (currentMode !== 'add' || !accessToken) return;
  if (tempMarker) map.removeLayer(tempMarker);
  tempMarker = L.marker(e.latlng).addTo(map);
  openSheet();
});

/* ═══════════════════════════════════════════
   § Google認証（GAPI / GIS）
   ─ gapiLoaded : Drive APIクライアントを初期化
   ─ gisLoaded  : OAuthトークンクライアントを初期化
   ─ ログイン成功後にデータを読み込む
═══════════════════════════════════════════ */
function gapiLoaded() {
  gapi.load('client', async () => {
    await gapi.client.init({});
    await gapi.client.load('drive', 'v3');
    gapiReady = true;
    maybeEnableLogin();
  });
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: async resp => {
      if (resp.error) return;
      accessToken = resp.access_token;
      gapi.client.setToken({ access_token: accessToken });
      updateLoginUI(true);
      // リフレッシュ用にコールバックを切り替え
      tokenClient.callback = onTokenRefreshed;
      scheduleTokenRefresh();
      await loadMemories();
    }
  });
  gisReady = true;
  maybeEnableLogin();
}

function maybeEnableLogin() {
  if (gapiReady && gisReady) document.getElementById('loginBtn').disabled = false;
}

document.getElementById('loginBtn').onclick = () => {
  tokenClient.requestAccessToken({ prompt: 'consent' });
};

/* ─ サイレントリフレッシュ：55分ごとにトークンを自動更新 ─ */
function scheduleTokenRefresh() {
  setTimeout(() => {
    tokenClient.requestAccessToken({ prompt: '' }); // promptなし＝画面を出さずに更新
  }, 55 * 60 * 1000); // 55分
}

// トークンリフレッシュ成功時のコールバック（キャッシュをリセットして再取得）
async function onTokenRefreshed(resp) {
  if (resp.error) return;
  accessToken = resp.access_token;
  gapi.client.setToken({ access_token: accessToken });
  dataFileId = null;        // ← キャッシュをリセット
  photosFolderId = null;    // ← フォルダIDもリセット
  scheduleTokenRefresh();
  await loadMemories();     // ← 最新データを再取得
}

/* ─ トースト通知 ─
   type: 'info' | 'error' | 'relogin'
   reloginの場合はタップで再ログイン発動
─ */
let toastTimer = null;
function showToast(message, type = 'info', duration = 3000) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast ${type} visible`;
  if (toastTimer) clearTimeout(toastTimer);
  if (type === 'relogin') {
    el.onclick = () => {
      tokenClient.requestAccessToken({ prompt: 'consent' });
      el.classList.remove('visible');
    };
  } else {
    el.onclick = null;
    toastTimer = setTimeout(() => el.classList.remove('visible'), duration);
  }
}

/* ─ Drive操作のエラーを判定して適切なメッセージを出す ─ */
function handleDriveError(e) {
  const status = e?.status || e?.result?.error?.code;
  if (status === 401) {
    accessToken = null;
    updateLoginUI(false);
    showToast('Session expired. Tap to sign in again', 'relogin', 0);
  } else if (status === 404) {
    showToast('File not found (may have been deleted from Drive)', 'error');
  } else {
    showToast('An error occurred: ' + (e?.message || status), 'error');
  }
}

document.getElementById('logoutBtn').onclick = () => {
  if (!accessToken) return;
  google.accounts.oauth2.revoke(accessToken, () => {
    accessToken = null;
    memories = [];
    dataFileId = null;
    photosFolderId = null;
    // BlobURLを解放してメモリリーク防止
    Object.values(photoBlobCache).forEach(url => URL.revokeObjectURL(url));
    Object.keys(photoBlobCache).forEach(k => delete photoBlobCache[k]);
    markerLayer.clearLayers();
    updateLoginUI(false);
  });
};

function updateLoginUI(loggedIn) {
  const status = document.getElementById('loginStatus');
  status.textContent = loggedIn ? 'Signed in ✓' : 'Not signed in';
  status.className = 'login-status' + (loggedIn ? ' logged-in' : '');
  document.getElementById('loginBtn').style.display  = loggedIn ? 'none'  : 'block';
  document.getElementById('logoutBtn').style.display = loggedIn ? 'block' : 'none';
}

/* ═══════════════════════════════════════════
   § モード切り替え
   ─ add    : 地図タップで記録
   ─ view   : マーカータップで表示
   ─ delete : マーカータップで削除
═══════════════════════════════════════════ */
const hints = {
  add:    'Tap the map to add a memory',
  view:   'Tap a marker to view',
  delete: 'Tap a marker to edit or delete'
};

function switchMode(mode) {
  currentMode = mode;
  ['add', 'view', 'delete'].forEach(m => {
    document.getElementById('nav' + m[0].toUpperCase() + m.slice(1))
      .classList.toggle('active', m === mode);
  });
  closeSheet();

  const hint = document.getElementById('modeHint');
  hint.textContent = hints[mode];
  hint.classList.add('visible');
  setTimeout(() => hint.classList.remove('visible'), 2200);

  renderMarkers();
}

/* ═══════════════════════════════════════════
   § シート（入力フォーム）開閉
   ─ openSheet  : Dateを今日にリセットして開く
   ─ closeSheet : シートを閉じて仮マーカーを除去
═══════════════════════════════════════════ */
function openSheet() {
  document.getElementById('dateInput').valueAsDate = new Date();
  document.getElementById('commentInput').value    = '';
  document.getElementById('photoInput').value      = '';
  document.getElementById('photoPicker').className = 'photo-picker';
  document.getElementById('pickerText').textContent = 'Tap to select';
  document.getElementById('photoPreview').style.display = 'none';
  tempPhotoBlob = null;

  document.getElementById('sheetOverlay').classList.add('open');
  document.getElementById('sheet').classList.add('open');
}

function closeSheet() {
  document.getElementById('sheetOverlay').classList.remove('open');
  document.getElementById('sheet').classList.remove('open');
  if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }
  tempPhotoBlob = null;
  // 写真プレビューをリセット
  const preview = document.getElementById('photoPreview');
  preview.src = '';
  preview.style.display = 'none';
  document.getElementById('photoPicker').style.display = '';
  document.getElementById('photoInput').value = '';
}

/* ═══════════════════════════════════════════
   § 写真処理
   ─ 選択した画像を最大900pxにリサイズして
     JPEG（品質75%）に変換・プレビュー表示
   ─ EXIFから撮影日を取得してDate欄に自動入力
     （取得できなければ今日のDateを維持）
═══════════════════════════════════════════ */

// EXIFの撮影日を取得する（DataView使用）
function getExifDate(buffer) {
  try {
    const view = new DataView(buffer);
    // JPEGのSOIマーカー確認
    if (view.getUint16(0) !== 0xFFD8) return null;
    let offset = 2;
    while (offset < view.byteLength) {
      const marker = view.getUint16(offset);
      if (marker === 0xFFE1) { // APP1 (EXIF)
        const exifOffset = offset + 10; // 'Exif\0\0' をスキップ
        const little = view.getUint16(exifOffset) === 0x4949;
        const ifdOffset = view.getUint32(exifOffset + 4, little);
        const ifdStart = exifOffset + ifdOffset;
        const entries = view.getUint16(ifdStart, little);
        for (let i = 0; i < entries; i++) {
          const tag = view.getUint16(ifdStart + 2 + i * 12, little);
          if (tag === 0x9003 || tag === 0x0132) { // DateTimeOriginal or DateTime
            const valOffset = ifdStart + 2 + i * 12 + 8;
            const strOffset = exifOffset + view.getUint32(valOffset, little);
            let str = '';
            for (let j = 0; j < 19; j++) {
              str += String.fromCharCode(view.getUint8(strOffset + j));
            }
            // Format: "YYYY:MM:DD HH:MM:SS" → "YYYY-MM-DD"
            const match = str.match(/^(\d{4}):(\d{2}):(\d{2})/);
            if (match) return `${match[1]}-${match[2]}-${match[3]}`;
          }
        }
        return null;
      }
      const segLen = view.getUint16(offset + 2);
      offset += 2 + segLen;
    }
  } catch (e) {}
  return null;
}

document.getElementById('photoInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    // EXIFからDate取得を試みる
    const exifDate = getExifDate(ev.target.result);
    if (exifDate) {
      document.getElementById('dateInput').value = exifDate;
    }
    // 画像リサイズ
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const max = 900;
      let w = img.width, h = img.height;
      if (w > h && w > max) { h = h * max / w; w = max; }
      else if (h > max)     { w = w * max / h; h = max; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        tempPhotoBlob = blob;
        const url = URL.createObjectURL(blob);
        const preview = document.getElementById('photoPreview');
        preview.src = url;
        preview.style.display = 'block';
        document.getElementById('photoPicker').style.display = 'none';
        // ピッカーにも選択済みスタイル
        document.getElementById('photoPicker').className = 'photo-picker has-photo';
        document.getElementById('pickerText').textContent = 'Change photo';
      }, 'image/jpeg', 0.75);
    };
    // ArrayBufferからURLを作ってimgに渡す
    const blob = new Blob([ev.target.result]);
    img.src = URL.createObjectURL(blob);
  };
  reader.readAsArrayBuffer(file);
});

/* ═══════════════════════════════════════════
   § ローディング表示
   ─ setLoading(true/false, テキスト) で制御
═══════════════════════════════════════════ */
function setLoading(on, text = 'Processing...') {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loadingOverlay').classList.toggle('visible', on);
}

/* ═══════════════════════════════════════════
   § Google Drive操作
   ─ ensureFolder  : 写真保存フォルダを取得 or 作成
   ─ loadDataFile  : JSONデータファイルを読み込む
   ─ saveDataFile  : JSONデータファイルを保存 or 更新
   ─ uploadPhoto   : 写真をDriveにアップロード
   ─ photoUrl      : ファイルIDから表示用URLを生成
═══════════════════════════════════════════ */
async function ensureFolder() {
  if (photosFolderId) return photosFolderId;
  const res = await gapi.client.drive.files.list({
    q: `name='${PHOTOS_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)'
  });
  if (res.result.files.length > 0) {
    photosFolderId = res.result.files[0].id;
  } else {
    const created = await gapi.client.drive.files.create({
      resource: { name: PHOTOS_FOLDER, mimeType: 'application/vnd.google-apps.folder' },
      fields: 'id'
    });
    photosFolderId = created.result.id;
  }
  return photosFolderId;
}

async function loadDataFile() {
  if (dataFileId) return;
  const res = await gapi.client.drive.files.list({
    q: `name='${DATA_FILENAME}' and trashed=false`,
    fields: 'files(id)'
  });
  if (res.result.files.length > 0) {
    dataFileId = res.result.files[0].id;
    const content = await fetch(
      `https://www.googleapis.com/drive/v3/files/${dataFileId}?alt=media`,
      { headers: { Authorization: 'Bearer ' + accessToken } }
    );
    memories = await content.json();
  } else {
    memories = [];
  }
}

async function saveDataFile() {
  const json = JSON.stringify(memories);
  if (!dataFileId) {
    const meta = { name: DATA_FILENAME, mimeType: 'application/json' };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
    form.append('file',     new Blob([json],                 { type: 'application/json' }));
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      { method: 'POST', headers: { Authorization: 'Bearer ' + accessToken }, body: form }
    );
    const data = await res.json();
    dataFileId = data.id;
  } else {
    await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${dataFileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: json
      }
    );
  }
}

async function uploadPhoto(blob, id) {
  const folderId = await ensureFolder();
  const meta = { name: id + '.jpg', parents: [folderId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', blob);
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    { method: 'POST', headers: { Authorization: 'Bearer ' + accessToken }, body: form }
  );
  const data = await res.json();
  await gapi.client.drive.permissions.create({
    fileId: data.id,
    resource: { role: 'reader', type: 'anyone' }
  });
  return data.id;
}

// 写真のBlobURLキャッシュ（fileId → objectURL）
const photoBlobCache = {};

async function loadPhotoBlob(fileId) {
  if (photoBlobCache[fileId]) return photoBlobCache[fileId];
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: 'Bearer ' + accessToken } }
    );
    if (!res.ok) return null;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    photoBlobCache[fileId] = url;
    return url;
  } catch (e) {
    console.warn('Photo load failed', fileId, e);
    return null;
  }
}

/* ═══════════════════════════════════════════
   § 思い出の保存
   ─ 1. 写真があればDriveにアップロード
   ─ 2. 緯度経度・Date・CommentをJSONに追加
   ─ 3. DriveのJSONファイルを更新
   ─ 4. マーカーを再描画
═══════════════════════════════════════════ */
async function saveMarker() {
  if (!accessToken || !tempMarker) return;
  setLoading(true, 'Saving...');
  try {
    await loadDataFile();

    const id = String(Date.now());
    let photoFileId = null;

    if (tempPhotoBlob) {
      setLoading(true, 'Uploading photo...');
      photoFileId = await uploadPhoto(tempPhotoBlob, id);
    }

    memories.push({
      id,
      lat:         tempMarker.getLatLng().lat,
      lng:         ((tempMarker.getLatLng().lng + 180) % 360 + 360) % 360 - 180, // 正規化（保険）
      date:        document.getElementById('dateInput').value,
      comment:     document.getElementById('commentInput').value,
      photoFileId: photoFileId || '',
      createdAt:   new Date().toISOString()
    });

    setLoading(true, 'データをSaving...');
    await saveDataFile();
    closeSheet();
    renderMarkers();
  } catch (e) {
    console.error(e);
    handleDriveError(e);
  } finally {
    setLoading(false);
  }
}

/* ═══════════════════════════════════════════
   § 思い出の読み込み・描画
   ─ loadMemories  : ログイン後にDriveからデータを取得
   ─ renderMarkers : memoriesをもとに全マーカーを再描画
                     削除モード時は削除ボタンも表示
═══════════════════════════════════════════ */
async function loadMemories() {
  if (!accessToken) return;
  setLoading(true, 'Loading...');
  try {
    await loadDataFile();
    renderMarkers();
  } catch (e) {
    console.error(e);
    handleDriveError(e);
  } finally {
    setLoading(false);
  }
}

function renderMarkers() {
  markerLayer.clearLayers();
  if (currentMode === 'add') return;

  memories.forEach(m => {
    const marker = L.marker([m.lat, m.lng]).addTo(markerLayer);

    // まず写真なしでポップアップを描画
    const buildHtml = (imgSrc) => {
      let html = `<div class="popup-wrap">`;
      if (imgSrc) {
        html += `<img class="popup-img" src="${imgSrc}">`;
      }
      html += `<div class="popup-body">
                 <div class="popup-comment">${m.comment || ''}</div>
                 <div class="popup-date">${m.date || ''}</div>
               </div>`;
      if (currentMode === 'delete') {
        html += `
          <div class="popup-edit-form">
            <div>
              <div class="popup-edit-label">Comment</div>
              <textarea id="edit-comment-${m.id}">${m.comment || ''}</textarea>
            </div>
            <div>
              <div class="popup-edit-label">Date</div>
              <input type="date" id="edit-date-${m.id}" value="${m.date || ''}" />
            </div>
          </div>
          <button class="popup-save" onclick="editMemory('${m.id}')">Save changes</button>
          <button class="popup-delete" onclick="deleteMemory('${m.id}')">🗑 Delete this memory</button>
        `;
      }
      html += `</div>`;
      return html;
    };

    // 初期表示（写真なし or キャッシュあり）
    const cached = m.photoFileId ? photoBlobCache[m.photoFileId] : null;
    marker.bindPopup(buildHtml(cached), { maxWidth: 280 });

    // ポップアップを開いたとき写真を非同期ロード
    if (m.photoFileId) {
      marker.on('popupopen', async () => {
        const url = await loadPhotoBlob(m.photoFileId);
        if (url) {
          const popup = marker.getPopup();
          popup.setContent(buildHtml(url));
        }
      });
    }
  });
}

/* ═══════════════════════════════════════════
   § 思い出の削除
   ─ 1. 確認ダイアログ
   ─ 2. DriveからJPEG写真を削除
   ─ 3. memoriesから除去してJSONを更新
   ─ 4. マーカーを再描画
═══════════════════════════════════════════ */
window.deleteMemory = async (id) => {
  if (!confirm('Delete this memory?')) return;
  setLoading(true, 'Deleting...');
  try {
    const idx = memories.findIndex(m => m.id === id);
    if (idx === -1) return;
    const mem = memories[idx];

    if (mem.photoFileId) {
      try { await gapi.client.drive.files.delete({ fileId: mem.photoFileId }); }
      catch (e) { console.warn('Photo delete failed', e); }
    }

    memories.splice(idx, 1);
    await saveDataFile();
    renderMarkers();
  } catch (e) {
    console.error(e);
    handleDriveError(e);
  } finally {
    setLoading(false);
  }
};

/* ═══════════════════════════════════════════
   § 思い出の編集
   ─ 1. ポップアップ内のフォームから値を取得
   ─ 2. memoriesを更新
   ─ 3. DriveのJSONファイルを保存
   ─ 4. マーカーを再描画
═══════════════════════════════════════════ */
window.editMemory = async (id) => {
  const comment = document.getElementById(`edit-comment-${id}`)?.value ?? '';
  const date    = document.getElementById(`edit-date-${id}`)?.value ?? '';

  setLoading(true, 'Saving...');
  try {
    const idx = memories.findIndex(m => m.id === id);
    if (idx === -1) return;
    memories[idx].comment = comment;
    memories[idx].date    = date;
    await saveDataFile();
    renderMarkers();
    showToast('Changes saved ✓', 'info', 2000);
  } catch (e) {
    console.error(e);
    handleDriveError(e);
  } finally {
    setLoading(false);
  }
};

/* ═══════════════════════════════════════════
   ─ 0.8秒後に「追加モード」のヒントを一瞬表示
═══════════════════════════════════════════ */
setTimeout(() => {
  const hint = document.getElementById('modeHint');
  hint.textContent = hints['add'];
  hint.classList.add('visible');
  setTimeout(() => hint.classList.remove('visible'), 2500);
}, 800);
