/* ═══════════════════════════════════════════
   config.js — 設定・定数・グローバル状態
   ─ ここだけ変えれば全体に反映される
═══════════════════════════════════════════ */

/* ── アプリ設定 ── */
const CONFIG = {
  CLIENT_ID:      '258493345784-tecrt34v0mqpq8rkmoajjhgi9lpvmfp5.apps.googleusercontent.com',
  SCOPE:          'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
  DATA_FILENAME:  'memory_map_data.json',
  PHOTOS_FOLDER:  'MemoryMapPhotos',
  TOKEN_REFRESH_MS: 55 * 60 * 1000,  // 55分
  PHOTO_MAX_PX:   900,                // リサイズ上限
  PHOTO_QUALITY:  0.75,               // JPEG品質
  MAP_DEFAULT_VIEW: [40.7128, -74.0060],
  MAP_DEFAULT_ZOOM: 15,
};

/* ── グローバル状態（シングルトン） ──
   直接書き換えず、必ず setter/getter 経由で操作すること。
   ただし移行コスト削減のため v1 では参照で公開している。
── */
const STATE = {
  accessToken:    null,
  tokenClient:    null,
  gapiReady:      false,
  gisReady:       false,
  currentMode:    'add',
  tempMarker:     null,
  tempPhotoBlob:  null,
  dataFileId:     null,
  photosFolderId: null,
  memories:       [],
  photoBlobCache: {},  // fileId → objectURL
};

/* ── モードごとのヒント文 ── */
const MODE_HINTS = {
  add:    '地図をタップして思い出を追加',
  view:   'マーカーをタップして表示',
  delete: 'マーカーをタップして編集・削除',
};
