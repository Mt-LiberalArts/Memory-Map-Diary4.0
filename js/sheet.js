/* ═══════════════════════════════════════════
   sheet.js — 入力フォームシートの開閉
═══════════════════════════════════════════ */
import { STATE } from './config.js';
import { resetPhotoPreview } from './photo.js';

export function openSheet() {
  document.getElementById('dateInput').valueAsDate = new Date();
  document.getElementById('commentInput').value     = '';
  resetPhotoPreview();

  document.getElementById('sheetOverlay').classList.add('open');
  document.getElementById('sheet').classList.add('open');
}

export function closeSheet(map) {
  document.getElementById('sheetOverlay').classList.remove('open');
  document.getElementById('sheet').classList.remove('open');

  if (STATE.tempMarker) {
    map.removeLayer(STATE.tempMarker);
    STATE.tempMarker = null;
  }

  resetPhotoPreview();
}
