/* ═══════════════════════════════════════════
   drive.js — Google Drive操作（App Folder版）
   ─ appDataFolder を使用
   ─ ensureFolder は不要（Googleが自動管理）
   ─ 写真も appDataFolder 内に保存
   ─ ユーザーのDriveには表示されない
═══════════════════════════════════════════ */
import { CONFIG, STATE } from './config.js';

/* ─ JSONデータファイルを読み込む ─ */
export async function loadDataFile() {
  if (STATE.dataFileId) return;

  const res = await gapi.client.drive.files.list({
    q:       `name='${CONFIG.DATA_FILENAME}'`,
    spaces:  'appDataFolder',   // ← appDataFolder内を検索
    fields:  'files(id)',
  });

  const files = res.result.files ?? [];

  if (files.length > 0) {
    STATE.dataFileId = files[0].id;
    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${STATE.dataFileId}?alt=media`,
      { headers: { Authorization: 'Bearer ' + STATE.accessToken } }
    );
    if (!resp.ok) throw { status: resp.status, message: 'Failed to load data' };

    const parsed = await resp.json();
    if (!Array.isArray(parsed)) {
      console.error('Data corruption detected: starting with empty array', parsed);
      STATE.memories = [];
      throw { status: 422, message: 'Data is corrupted. Please contact support.' };
    }
    STATE.memories = parsed;
  } else {
    STATE.memories = [];
  }
}

/* ─ JSONデータファイルを保存 or 更新 ─
   引数 memories を受け取る（STATE依存を排除）
   保存前に配列チェック：壊れたデータの書き込みを防ぐ
── */
export async function saveDataFile(memories) {
  if (!Array.isArray(memories)) {
    throw { message: 'Invalid data structure. Save aborted.' };
  }
  const json = JSON.stringify(memories);

  if (!STATE.dataFileId) {
    // 新規作成：appDataFolder に保存
    const meta = {
      name:    CONFIG.DATA_FILENAME,
      mimeType: 'application/json',
      parents: ['appDataFolder'],  // ← ここがポイント
    };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
    form.append('file',     new Blob([json],                 { type: 'application/json' }));

    const res  = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      { method: 'POST', headers: { Authorization: 'Bearer ' + STATE.accessToken }, body: form }
    );
    const data = await res.json();
    if (!data.id) throw { message: 'Failed to create file', status: res.status };
    STATE.dataFileId = data.id;

  } else {
    // 既存ファイルを更新
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${STATE.dataFileId}?uploadType=media`,
      {
        method:  'PATCH',
        headers: {
          Authorization:  'Bearer ' + STATE.accessToken,
          'Content-Type': 'application/json',
        },
        body: json,
      }
    );
    if (!res.ok) throw { status: res.status, message: 'Save failed' };
  }
}

/* ─ 写真をappDataFolderにアップロード ─
   ensureFolder不要・permissionsも不要（非公開）
   写真はBlobURLでアプリ内表示するので公開不要
── */
export async function uploadPhoto(blob, id) {
  const meta = {
    name:    id + '.jpg',
    parents: ['appDataFolder'],  // ← appDataFolderに直接
  };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', blob);

  const res  = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    { method: 'POST', headers: { Authorization: 'Bearer ' + STATE.accessToken }, body: form }
  );
  const data = await res.json();
  if (!data.id) throw { message: 'Photo upload failed', status: res.status };

  // appDataFolderは非公開なのでpermissions設定不要
  return data.id;
}

/* ─ fileIdから写真BlobURLを取得（キャッシュ付き）─ */
export async function loadPhotoBlob(fileId) {
  if (STATE.photoBlobCache[fileId]) return STATE.photoBlobCache[fileId];

  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: 'Bearer ' + STATE.accessToken } }
    );
    if (!res.ok) return null;

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    STATE.photoBlobCache[fileId] = url;
    return url;
  } catch (e) {
    console.warn('Failed to load photo:', fileId, e);
    return null;
  }
}

/* ─ 写真ファイルを削除 ─ */
export async function deletePhoto(fileId) {
  await gapi.client.drive.files.delete({ fileId });
}
