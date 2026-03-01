/* ═══════════════════════════════════════════
   ui.js — UI共通ユーティリティ
═══════════════════════════════════════════ */
import { STATE, MODE_HINTS } from './config.js';

let _toastTimer = null;

export function showToast(message, type = 'info', duration = 3000) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast ${type} visible`;
  if (_toastTimer) clearTimeout(_toastTimer);

  if (type === 'relogin') {
    el.onclick = () => {
      if (STATE.tokenClient) {
        STATE.tokenClient.requestAccessToken({ prompt: 'consent' });
      }
      el.classList.remove('visible');
    };
  } else {
    el.onclick = null;
    _toastTimer = setTimeout(() => el.classList.remove('visible'), duration);
  }
}

export function setLoading(on, text = '処理中...') {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loadingOverlay').classList.toggle('visible', on);
}

export function showModeHint(mode) {
  const hint = document.getElementById('modeHint');
  hint.textContent = MODE_HINTS[mode] ?? '';
  hint.classList.add('visible');
  setTimeout(() => hint.classList.remove('visible'), 2200);
}

export function updateLoginUI(loggedIn) {
  const status = document.getElementById('loginStatus');
  status.textContent = loggedIn ? 'ログイン済み ✓' : '未ログイン';
  status.className = 'login-status' + (loggedIn ? ' logged-in' : '');
  document.getElementById('loginBtn').style.display  = loggedIn ? 'none'  : 'block';
  document.getElementById('logoutBtn').style.display = loggedIn ? 'block' : 'none';
}

export function handleDriveError(e) {
  const status = e?.status || e?.result?.error?.code;
  if (status === 401) {
    STATE.accessToken = null;
    updateLoginUI(false);
    showToast('セッションが切れました。タップして再ログイン', 'relogin', 0);
  } else if (status === 404) {
    showToast('ファイルが見つかりません（Driveで削除された可能性があります）', 'error');
  } else {
    showToast('エラーが発生しました: ' + (e?.message || status), 'error');
  }
}

window.addEventListener('offline', () => {
  showToast('オフラインです。接続を確認してください', 'error', 5000);
});
window.addEventListener('online', () => {
  showToast('接続が回復しました ✓', 'info', 2000);
});

/* ─ 思い出詳細モーダル ─ */
export function openMemoryModal({ memory, imgUrl, mode, onEdit, onDelete }) {
  const modal        = document.getElementById('memoryModal');
  const overlay      = document.getElementById('memoryModalOverlay');
  const closeBtn     = document.getElementById('memoryModalClose');
  const img          = document.getElementById('memoryModalImg');
  const comment      = document.getElementById('memoryModalComment');
  const date         = document.getElementById('memoryModalDate');
  const editArea     = document.getElementById('memoryModalEdit');
  const commentInput = document.getElementById('memoryModalCommentInput');
  const dateInput    = document.getElementById('memoryModalDateInput');
  const saveBtn      = document.getElementById('memoryModalSaveBtn');
  const deleteBtn    = document.getElementById('memoryModalDeleteBtn');

  // 写真
  if (imgUrl) {
    img.src = imgUrl;
    img.style.display = 'block';
  } else {
    img.src = '';
    img.style.display = 'none';
  }

  // 閲覧表示
  comment.textContent = memory.comment || '';
  date.textContent    = memory.date    || '';

  // 編集モード
  if (mode === 'delete') {
    commentInput.value = memory.comment || '';
    dateInput.value    = memory.date    || '';
    editArea.classList.add('visible');
  } else {
    editArea.classList.remove('visible');
  }

  modal.classList.add('open');

  const close = () => {
    modal.classList.remove('open');
    img.src = '';
    saveBtn.onclick   = null;
    deleteBtn.onclick = null;
    closeBtn.removeEventListener('click', close);
    overlay.removeEventListener('click', close);
  };

  saveBtn.onclick   = () => { close(); onEdit?.(); };
  deleteBtn.onclick = () => { close(); onDelete?.(); };
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', close);
}
