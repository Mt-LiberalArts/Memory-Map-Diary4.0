/* ═══════════════════════════════════════════
   photo.js — 写真処理
   ─ getExifDate    : ArrayBufferからEXIF撮影日を取得
   ─ resizeToBlob   : Canvas経由でリサイズ・JPEG変換
   ─ photoInputに変更イベントを登録
═══════════════════════════════════════════ */

/* ─ EXIFから撮影日を取得（DataView使用）─
   戻り値: 'YYYY-MM-DD' or null
── */
function getExifDate(buffer) {
  try {
    const view = new DataView(buffer);

    // JPEGのSOIマーカーチェック
    if (view.getUint16(0) !== 0xFFD8) return null;

    let offset = 2;
    while (offset < view.byteLength) {
      const marker = view.getUint16(offset);

      if (marker === 0xFFE1) { // APP1 (EXIF)
        const exifOffset = offset + 10; // 'Exif\0\0' をスキップ
        const little     = view.getUint16(exifOffset) === 0x4949; // リトルエンディアン判定
        const ifdOffset  = view.getUint32(exifOffset + 4, little);
        const ifdStart   = exifOffset + ifdOffset;
        const entries    = view.getUint16(ifdStart, little);

        for (let i = 0; i < entries; i++) {
          const tag = view.getUint16(ifdStart + 2 + i * 12, little);
          if (tag === 0x9003 || tag === 0x0132) { // DateTimeOriginal / DateTime
            const valOffset = ifdStart + 2 + i * 12 + 8;
            const strOffset = exifOffset + view.getUint32(valOffset, little);
            let str = '';
            for (let j = 0; j < 19; j++) {
              str += String.fromCharCode(view.getUint8(strOffset + j));
            }
            // "YYYY:MM:DD HH:MM:SS" → "YYYY-MM-DD"
            const match = str.match(/^(\d{4}):(\d{2}):(\d{2})/);
            if (match) return `${match[1]}-${match[2]}-${match[3]}`;
          }
        }
        return null;
      }

      // 【バグ修正】元コードは marker === 0xFFD9（EOI）やパディングで
      // segLen が 0 になり無限ループになりうる。安全な進み方に修正。
      if (offset + 2 >= view.byteLength) break;
      const segLen = view.getUint16(offset + 2);
      if (segLen < 2) break; // 不正データで無限ループ防止
      offset += 2 + segLen;
    }
  } catch (e) {
    console.warn('EXIF読み取り失敗:', e);
  }
  return null;
}

/* ─ 画像をリサイズしてBlobを返す ─ */
function resizeToBlob(imgElement, maxPx, quality) {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas');
    let w = imgElement.width;
    let h = imgElement.height;

    if (w > h && w > maxPx)      { h = Math.round(h * maxPx / w); w = maxPx; }
    else if (h > maxPx)          { w = Math.round(w * maxPx / h); h = maxPx; }

    canvas.width  = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(imgElement, 0, 0, w, h);
    canvas.toBlob(resolve, 'image/jpeg', quality);
  });
}

/* ─ ファイル選択イベント ─ */
document.getElementById('photoInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;

  const buffer = await file.arrayBuffer();

  // EXIFから日付取得
  const exifDate = getExifDate(buffer);
  if (exifDate) {
    document.getElementById('dateInput').value = exifDate;
  }

  // 画像リサイズ
  const img = new Image();
  const tempUrl = URL.createObjectURL(new Blob([buffer]));

  img.onload = async () => {
    URL.revokeObjectURL(tempUrl); // 使い終わったURLを解放

    const blob = await resizeToBlob(img, CONFIG.PHOTO_MAX_PX, CONFIG.PHOTO_QUALITY);
    STATE.tempPhotoBlob = blob;

    const previewUrl = URL.createObjectURL(blob);
    const preview    = document.getElementById('photoPreview');
    preview.src      = previewUrl;
    preview.style.display = 'block';

    document.getElementById('photoPicker').style.display   = 'none';
    document.getElementById('photoPicker').className       = 'photo-picker has-photo';
    document.getElementById('pickerText').textContent      = '写真を変更';
  };

  img.onerror = () => {
    URL.revokeObjectURL(tempUrl);
    showToast('画像の読み込みに失敗しました', 'error');
  };

  img.src = tempUrl;
});
