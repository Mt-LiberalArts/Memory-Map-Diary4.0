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

/* ─ データ層：トランザクション風addMemory ─
   順序：写真アップ → メモリオブジェクト作成 → 配列追加 → JSON保存 → STATE確定
   失敗時はSTATEをバックアップから復元（ロールバック）
── */
async function addMemory({ lat, lng, date, comment, blob }) {
  const backup = [...STATE.memories];

  try {
    // ① 写真アップロード（先にfileId取得）
    const id = crypto.randomUUID();
    let photoFileId = '';
    if (blob) {
      photoFileId = await uploadPhoto(blob, id);
    }

    // ② 一時オブジェクト作成（まだSTATEに入れない）
    const memory = {
      id,
      lat,
      lng,
      date,
      comment,
      photoFileId,
      createdAt:   new Date().toISOString(),
    };

    // ③ 新配列を作ってsaveDataFileに渡す（STATE未確定）
    const newMemories = [...STATE.memories, memory];
    await saveDataFile(newMemories);

    // ④ 保存成功後にSTATEを確定
    STATE.memories = newMemories;

  } catch (e) {
    // 失敗時ロールバック
    console.error('addMemory失敗、ロールバック:', e);
    STATE.memories = backup;
    throw e;
  }
}

/* ─ UI層：saveMarker（DOM・ローディング担当）─ */
export async function saveMarker(map) {
  if (!STATE.accessToken || !STATE.tempMarker) return;

  const comment = document.getElementById('commentInput').value;
  if (comment.length > 72) {
    showToast('コメントは72文字以内で入力してください', 'error');
    return;
  }

  setLoading(true, '保存中...');
  try {
    await loadDataFile();

    if (STATE.tempPhotoBlob) setLoading(true, '写真をアップロード中...');

    await addMemory({
      lat:     STATE.tempMarker.getLatLng().lat,
      lng:     STATE.tempMarker.getLatLng().lng,
      date:    document.getElementById('dateInput').value,
      comment,
      blob:    STATE.tempPhotoBlob,
    });

    setLoading(true, 'データを保存中...');
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

  if (commentEl.value.length > 72) {
    showToast('コメントは72文字以内で入力してください', 'error');
    return;
  }

  setLoading(true, '保存中...');
  try {
    const idx = STATE.memories.findIndex(m => m.id === id);
    if (idx === -1) return;

    STATE.memories[idx].comment = commentEl.value ?? '';
    STATE.memories[idx].date    = dateEl.value    ?? '';

    await saveDataFile(STATE.memories);
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

    // ① JSON保存を先に確定（写真削除より優先）
    const newMemories = STATE.memories.filter(m => m.id !== id);
    await saveDataFile(newMemories);
    STATE.memories = newMemories;

    // ② JSON保存成功後に写真削除（失敗しても記録は消えている）
    if (mem.photoFileId) {
      try {
        await gapi.client.drive.files.delete({ fileId: mem.photoFileId });
        if (STATE.photoBlobCache[mem.photoFileId]) {
          URL.revokeObjectURL(STATE.photoBlobCache[mem.photoFileId]);
          delete STATE.photoBlobCache[mem.photoFileId];
        }
      } catch (e) {
        console.warn('写真削除失敗（記録は正常に削除済み）:', e);
      }
    }

    _renderMarkers();
    showToast('削除しました', 'info', 2000);
  } catch (e) {
    console.error(e);
    handleDriveError(e);
  } finally {
    setLoading(false);
  }
}
