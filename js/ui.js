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

/* ─ 写真拡大モーダル ─ */
export function openPhotoModal(src) {
  const modal   = document.getElementById('photoModal');
  const img     = document.getElementById('photoModalImg');
  const saveBtn = document.getElementById('photoModalSave');
  const closeBtn = document.getElementById('photoModalClose');
  const overlay = document.getElementById('photoModalOverlay');

  img.src = src;
  modal.classList.add('open');

  const onSave = () => {
    const a = document.createElement('a');
    a.href     = src;
    a.download = 'memory_' + Date.now() + '.jpg';
    a.click();
  };

  const close = () => {
    modal.classList.remove('open');
    img.src = '';
    saveBtn.removeEventListener('click', onSave);
    closeBtn.removeEventListener('click', close);
    overlay.removeEventListener('click', close);
  };

  saveBtn.addEventListener('click', onSave);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', close);
}
