/* ═══════════════════════════════════════════
   main.js — エントリーポイント
   ─ 全モジュールをimportして初期化
   ─ HTMLのボタンイベントをここで一括登録
   ─ Google APIのコールバックをポーリングで待機
═══════════════════════════════════════════ */
import { map, switchMode, renderMarkers, initMapCallbacks } from './map.js';
import { closeSheet } from './sheet.js';
import { saveMarker, editMemory, deleteMemory, initMemories } from './memories.js';
import { initPhotoInput } from './photo.js';
import { gapiLoaded, gisLoaded, initAuth } from './auth.js';

/* ─ 循環import解消：コールバックを相互注入 ─ */
initMemories(renderMarkers);
initMapCallbacks(editMemory, deleteMemory);

/* ─ ボタンイベントを一括登録 ─ */
document.getElementById('navAdd')   .addEventListener('click', () => switchMode('add'));
document.getElementById('navView')  .addEventListener('click', () => switchMode('view'));
document.getElementById('navDelete').addEventListener('click', () => switchMode('delete'));

document.getElementById('sheetOverlay').addEventListener('click', () => closeSheet(map));
document.querySelector('.btn-cancel')  .addEventListener('click', () => closeSheet(map));
document.querySelector('.btn-save')    .addEventListener('click', () => saveMarker(map));

document.getElementById('photoPicker') .addEventListener('click', () => document.getElementById('photoInput').click());
document.getElementById('photoPreview').addEventListener('click', () => document.getElementById('photoInput').click());

/* ─ 写真入力・認証の初期化 ─ */
initPhotoInput();
initAuth();

/* ─ Google APIのロード待機 ─
   type="module" は非同期読み込みのため
   onload より先に window.xxx が公開できない。
   ポーリングで Google API の準備完了を待つ。
── */
const waitForGapi = setInterval(() => {
  if (window.gapi) {
    clearInterval(waitForGapi);
    gapiLoaded();
  }
}, 100);

const waitForGis = setInterval(() => {
  if (window.google?.accounts) {
    clearInterval(waitForGis);
    gisLoaded();
  }
}, 100);
