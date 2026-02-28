/* ═══════════════════════════════════════════
   memories.js — 思い出の保存・読み込み・編集・削除
   ─ renderMarkers は循環import回避のため
     initMemories() でコールバックとして受け取る
═══════════════════════════════════════════ */
import { STATE } from './config.js';
import { setLoading, showToast, handleDriveError } from './ui.js';
import { loadDataFile, saveDataFile, uploadPhoto } from './drive.js';
import { closeSheet } from './sheet.js';

/* ─ renderMarkers のコールバック（map.jsから注入）─ */
let _renderMarkers = () => {};
export function initMemories(renderMarkersFn) {
  _renderMarkers = renderMarkersFn;
}

export async function saveMarker(map) {
  if (!STATE.accessToken || !STATE.tempMarker) return;
  setLoading(true, '保存中...');
  try {
    await loadDataFile();

    const id = String(Date.now());
    let photoFileId = null;

    if (STATE.tempPhotoBlob) {
      setLoading(true, '写真をアップロード中...');
      photoFileId = await uploadPhoto(STATE.tempPhotoBlob, id);
    }

    STATE.memories.push({
      id,
      lat:         STATE.tempMarker.getLatLng().lat,
      lng:         STATE.tempMarker.getLatLng().lng,
      date:        document.getElementById('dateInput').value,
      comment:     document.getElementById('commentInput').value,
      photoFileId: photoFileId || '',
      createdAt:   new Date().toISOString(),
    });

    setLoading(true, 'データを保存中...');
    await saveDataFile();
    closeSheet(map);
    _renderMarkers();
    showToast('思い出を保存しました ✓', 'info', 2000);
  } catch (e) {
    console.error(e);
    handleDriveError(e);
  } finally {
    setLoading(false);
  }
}

export async function loadMemories() {
  if (!STATE.accessToken) return;
  setLoading(true, '読み込み中...');
  try {
    await loadDataFile();
    _renderMarkers();
  } catch (e) {
    console.error(e);
    handleDriveError(e);
  } finally {
    setLoading(false);
  }
}

export async function editMemory(id) {
  const commentEl = document.getElementById(`edit-comment-${id}`);
  const dateEl    = document.getElementById(`edit-date-${id}`);

  if (!commentEl || !dateEl) {
    showToast('フォームの取得に失敗しました。マーカーを開き直してください', 'error');
    return;
  }

  setLoading(true, '保存中...');
  try {
    const idx = STATE.memories.findIndex(m => m.id === id);
    if (idx === -1) return;

    STATE.memories[idx].comment = commentEl.value ?? '';
    STATE.memories[idx].date    = dateEl.value    ?? '';

    await saveDataFile();
    _renderMarkers();
    showToast('変更を保存しました ✓', 'info', 2000);
  } catch (e) {
    console.error(e);
    handleDriveError(e);
  } finally {
    setLoading(false);
  }
}

export async function deleteMemory(id) {
  if (!confirm('この思い出を削除しますか？')) return;

  setLoading(true, '削除中...');
  try {
    const idx = STATE.memories.findIndex(m => m.id === id);
    if (idx === -1) return;

    const mem = STATE.memories[idx];

    if (mem.photoFileId) {
      try {
        await gapi.client.drive.files.delete({ fileId: mem.photoFileId });
        if (STATE.photoBlobCache[mem.photoFileId]) {
          URL.revokeObjectURL(STATE.photoBlobCache[mem.photoFileId]);
          delete STATE.photoBlobCache[mem.photoFileId];
        }
      } catch (e) {
        console.warn('写真削除失敗（JSON削除は続行）:', e);
      }
    }

    STATE.memories.splice(idx, 1);
    await saveDataFile();
    _renderMarkers();
    showToast('削除しました', 'info', 2000);
  } catch (e) {
    console.error(e);
    handleDriveError(e);
  } finally {
    setLoading(false);
  }
}
