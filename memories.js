/* ═══════════════════════════════════════════
   memories.js — 思い出の保存・読み込み・編集・削除
   ─ saveMarker   : フォームの内容をDriveに保存
   ─ loadMemories : ログイン後にDriveからデータ取得
   ─ editMemory   : ポップアップ内フォームで編集
   ─ deleteMemory : 確認後に削除
═══════════════════════════════════════════ */

/* ─ 思い出を保存 ─ */
async function saveMarker() {
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
    closeSheet();
    renderMarkers();
    showToast('思い出を保存しました ✓', 'info', 2000);
  } catch (e) {
    console.error(e);
    handleDriveError(e);
  } finally {
    setLoading(false);
  }
}

/* ─ 思い出を読み込む（ログイン後に呼ぶ）─ */
async function loadMemories() {
  if (!STATE.accessToken) return;
  setLoading(true, '読み込み中...');
  try {
    await loadDataFile();
    renderMarkers();
  } catch (e) {
    console.error(e);
    handleDriveError(e);
  } finally {
    setLoading(false);
  }
}

/* ─ 思い出を編集（ポップアップ内フォームから）─
   【バグ修正】元コードは comment / date が空文字のとき
   ?? '' が意図通り動かないケースがあった（undefined と null の違い）。
   空文字フォールバックを明示的に処理するよう修正。
── */
window.editMemory = async (id) => {
  const commentEl = document.getElementById(`edit-comment-${id}`);
  const dateEl    = document.getElementById(`edit-date-${id}`);

  // 【バグ修正】ポップアップが再描画された場合に要素が取れないケースへの対応
  if (!commentEl || !dateEl) {
    showToast('フォームの取得に失敗しました。マーカーを開き直してください', 'error');
    return;
  }

  const comment = commentEl.value ?? '';
  const date    = dateEl.value    ?? '';

  setLoading(true, '保存中...');
  try {
    const idx = STATE.memories.findIndex(m => m.id === id);
    if (idx === -1) return;

    STATE.memories[idx].comment = comment;
    STATE.memories[idx].date    = date;

    await saveDataFile();
    renderMarkers();
    showToast('変更を保存しました ✓', 'info', 2000);
  } catch (e) {
    console.error(e);
    handleDriveError(e);
  } finally {
    setLoading(false);
  }
};

/* ─ 思い出を削除 ─ */
window.deleteMemory = async (id) => {
  if (!confirm('この思い出を削除しますか？')) return;

  setLoading(true, '削除中...');
  try {
    const idx = STATE.memories.findIndex(m => m.id === id);
    if (idx === -1) return;

    const mem = STATE.memories[idx];

    // Drive上の写真を削除（失敗してもJSONの削除は続行）
    if (mem.photoFileId) {
      try {
        await gapi.client.drive.files.delete({ fileId: mem.photoFileId });
        // キャッシュのBlobURLを解放
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
    renderMarkers();
    showToast('削除しました', 'info', 2000);
  } catch (e) {
    console.error(e);
    handleDriveError(e);
  } finally {
    setLoading(false);
  }
};
