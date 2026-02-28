/* ═══════════════════════════════════════════
   config.js — 設定・定数・グローバル状態
═══════════════════════════════════════════ */

export const CONFIG = {
  CLIENT_ID:        '258493345784-tecrt34v0mqpq8rkmoajjhgi9lpvmfp5.apps.googleusercontent.com',
  SCOPE:            'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
  DATA_FILENAME:    'memory_map_data.json',
  PHOTOS_FOLDER:    'MemoryMapPhotos',
  TOKEN_REFRESH_MS: 55 * 60 * 1000,
  PHOTO_MAX_PX:     900,
  PHOTO_QUALITY:    0.75,
  MAP_DEFAULT_VIEW: [40.7128, -74.0060],
  MAP_DEFAULT_ZOOM: 15,
};

export const STATE = {
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
  photoBlobCache: {},
};

export const MODE_HINTS = {
  add:    '地図をタップして思い出を追加',
  view:   'マーカーをタップして表示',
  delete: 'マーカーをタップして編集・削除',
};
