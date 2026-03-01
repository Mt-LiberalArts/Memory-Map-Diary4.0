/* ═══════════════════════════════════════════
   memories.js — 思い出の保存・読み込み・編集・削除
   ─ renderMarkers は循環import回避のため
     initMemories() でコールバックとして受け取る
═══════════════════════════════════════════ */
import { STATE } from './config.js';
import { setLoading, showToast, handleDriveError } from './ui.js';
import { loadDataFile, saveDataFile, uploadPhoto, deletePhoto } from './drive.js';
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
    console.error('addMemory failed, rolling back:', e);
    STATE.memories = backup;
    throw e;
  }
}

/* ─ UI層：saveMarker（DOM・ローディング担当）─ */
let _isSaving = false;  // ← 多重送信防止フラグ

export async function saveMarker(map) {
  if (!STATE.accessToken || !STATE.tempMarker) return;
  if (_isSaving) return;  // ← 連打ガード

  const comment = document.getElementById('commentInput').value;
  if (comment.length > 72) {
    showToast('Comment must be 72 characters or less', 'error');
    return;
  }

  _isSaving = true;
  const saveBtn = document.querySelector('.btn-save');
  if (saveBtn) saveBtn.disabled = true;

  setLoading(true, 'Saving...');
  try {
    await loadDataFile();

    if (STATE.tempPhotoBlob) setLoading(true, 'Uploading photo...');

    await addMemory({
      lat:     STATE.tempMarker.getLatLng().lat,
      lng:     STATE.tempMarker.getLatLng().lng,
      date:    document.getElementById('dateInput').value,
      comment,
      blob:    STATE.tempPhotoBlob,
    });

    setLoading(true, 'Saving data...');
    closeSheet(map);
    _renderMarkers();
    showToast('Memory saved ✓', 'info', 2000);
  } catch (e) {
    console.error(e);
    handleDriveError(e);
  } finally {
    setLoading(false);
    _isSaving = false;
    if (saveBtn) saveBtn.disabled = false;
  }
}

export async function loadMemories() {
  if (!STATE.accessToken) return;
  setLoading(true, 'Loading...');
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
  const commentEl = document.getElementById('memoryModalCommentInput');
  const dateEl    = document.getElementById('memoryModalDateInput');

  if (!commentEl || !dateEl) {
    showToast('Failed to get form', 'error');
    return;
  }

  if (commentEl.value.length > 72) {
    showToast('Comment must be 72 characters or less', 'error');
    return;
  }

  setLoading(true, 'Saving...');
  try {
    const idx = STATE.memories.findIndex(m => m.id === id);
    if (idx === -1) return;

    // ① 新配列を作ってSTATEには入れずにsave（addMemoryと同様の設計）
    const newMemories = STATE.memories.map(m =>
      m.id === id
        ? { ...m, comment: commentEl.value ?? '', date: dateEl.value ?? '' }
        : m
    );

    await saveDataFile(newMemories);

    // ② 保存成功後にSTATEを確定
    STATE.memories = newMemories;

    _renderMarkers();
    showToast('Changes saved ✓', 'info', 2000);
  } catch (e) {
    console.error(e);
    handleDriveError(e);
  } finally {
    setLoading(false);
  }
}

export async function deleteMemory(id) {
  if (!confirm('Delete this memory?')) return;

  setLoading(true, 'Deleting...');
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
        await deletePhoto(mem.photoFileId);
        if (STATE.photoBlobCache[mem.photoFileId]) {
          URL.revokeObjectURL(STATE.photoBlobCache[mem.photoFileId]);
          delete STATE.photoBlobCache[mem.photoFileId];
        }
      } catch (e) {
        console.warn('Photo deletion failed (memory record already deleted):', e);
      }
    }

    _renderMarkers();
    showToast('Memory deleted', 'info', 2000);
  } catch (e) {
    console.error(e);
    handleDriveError(e);
  } finally {
    setLoading(false);
  }
}
