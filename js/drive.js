/* ═══════════════════════════════════════════
   drive.js — Google Drive操作
═══════════════════════════════════════════ */
import { CONFIG, STATE } from './config.js';

export async function ensureFolder() {
  if (STATE.photosFolderId) return STATE.photosFolderId;

  const res = await gapi.client.drive.files.list({
    q:      `name='${CONFIG.PHOTOS_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });

  if (res.result.files.length > 0) {
    STATE.photosFolderId = res.result.files[0].id;
  } else {
    const created = await gapi.client.drive.files.create({
      resource: { name: CONFIG.PHOTOS_FOLDER, mimeType: 'application/vnd.google-apps.folder' },
      fields:   'id',
    });
    STATE.photosFolderId = created.result.id;
  }
  return STATE.photosFolderId;
}

export async function loadDataFile() {
  if (STATE.dataFileId) return;

  const res = await gapi.client.drive.files.list({
    q:      `name='${CONFIG.DATA_FILENAME}' and trashed=false`,
    fields: 'files(id)',
  });

  const files = res.result.files ?? [];

  if (files.length > 0) {
    STATE.dataFileId = files[0].id;
    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${STATE.dataFileId}?alt=media`,
      { headers: { Authorization: 'Bearer ' + STATE.accessToken } }
    );
    if (!resp.ok) throw { status: resp.status, message: 'データ読み込み失敗' };
    STATE.memories = await resp.json();
  } else {
    STATE.memories = [];
  }
}

export async function saveDataFile() {
  const json = JSON.stringify(STATE.memories);

  if (!STATE.dataFileId) {
    const meta = { name: CONFIG.DATA_FILENAME, mimeType: 'application/json' };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
    form.append('file',     new Blob([json],                 { type: 'application/json' }));

    const res  = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      { method: 'POST', headers: { Authorization: 'Bearer ' + STATE.accessToken }, body: form }
    );
    const data = await res.json();
    if (!data.id) throw { message: 'ファイル作成失敗', status: res.status };
    STATE.dataFileId = data.id;

  } else {
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
    if (!res.ok) throw { status: res.status, message: '保存失敗' };
  }
}

export async function uploadPhoto(blob, id) {
  const folderId = await ensureFolder();
  const meta     = { name: id + '.jpg', parents: [folderId] };
  const form     = new FormData();
  form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  form.append('file', blob);

  const res  = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    { method: 'POST', headers: { Authorization: 'Bearer ' + STATE.accessToken }, body: form }
  );
  const data = await res.json();
  if (!data.id) throw { message: '写真アップロード失敗', status: res.status };

  await gapi.client.drive.permissions.create({
    fileId:   data.id,
    resource: { role: 'reader', type: 'anyone' },
  });
  return data.id;
}

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
    console.warn('写真取得失敗:', fileId, e);
    return null;
  }
}
