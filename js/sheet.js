/* ═══════════════════════════════════════════
   sheet.js — 入力フォームシートの開閉
═══════════════════════════════════════════ */
import { STATE } from './config.js';

export function openSheet() {
  document.getElementById('dateInput').valueAsDate = new Date();
  document.getElementById('commentInput').value     = '';
  document.getElementById('photoInput').value       = '';
  document.getElementById('photoPicker').className  = 'photo-picker';
  document.getElementById('pickerText').textContent = 'タップして選択';
  document.getElementById('photoPreview').style.display = 'none';
  STATE.tempPhotoBlob = null;

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

  const preview = document.getElementById('photoPreview');
  preview.src   = '';
  preview.style.display = 'none';

  document.getElementById('photoPicker').style.display = '';
  document.getElementById('photoInput').value = '';
  STATE.tempPhotoBlob = null;
}
