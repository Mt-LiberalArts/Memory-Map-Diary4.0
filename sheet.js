/* ═══════════════════════════════════════════
   sheet.js — 入力フォームシートの開閉
   ─ openSheet  : 日付・コメント・写真をリセットして開く
   ─ closeSheet : シートを閉じて仮マーカーを除去
═══════════════════════════════════════════ */

function openSheet() {
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

function closeSheet() {
  document.getElementById('sheetOverlay').classList.remove('open');
  document.getElementById('sheet').classList.remove('open');

  // 仮マーカーを除去
  if (STATE.tempMarker) {
    map.removeLayer(STATE.tempMarker);
    STATE.tempMarker = null;
  }

  // 写真プレビューをリセット
  const preview = document.getElementById('photoPreview');
  preview.src   = '';
  preview.style.display = 'none';

  document.getElementById('photoPicker').style.display = '';
  document.getElementById('photoInput').value = '';

  STATE.tempPhotoBlob = null;
}
