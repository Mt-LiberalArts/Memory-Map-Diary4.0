/* ═══════════════════════════════════════════
   ui.js — UI共通ユーティリティ
   ─ トースト通知
   ─ ローディングオーバーレイ
   ─ モードヒント表示
   ─ ログイン状態の表示更新
═══════════════════════════════════════════ */

/* ─ トースト通知 ─
   type: 'info' | 'error' | 'relogin'
   reloginの場合はタップで再ログイン発動
── */
let _toastTimer = null;

function showToast(message, type = 'info', duration = 3000) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast ${type} visible`;
  if (_toastTimer) clearTimeout(_toastTimer);

  if (type === 'relogin') {
    el.onclick = () => {
      // auth.js の requestLogin() を呼ぶ
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

/* ─ ローディングオーバーレイ ─ */
function setLoading(on, text = '処理中...') {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loadingOverlay').classList.toggle('visible', on);
}

/* ─ モードヒント（一瞬表示して消える帯） ─ */
function showModeHint(mode) {
  const hint = document.getElementById('modeHint');
  hint.textContent = MODE_HINTS[mode] ?? '';
  hint.classList.add('visible');
  setTimeout(() => hint.classList.remove('visible'), 2200);
}

/* ─ ログイン状態UIの更新 ─ */
function updateLoginUI(loggedIn) {
  const status = document.getElementById('loginStatus');
  status.textContent = loggedIn ? 'ログイン済み ✓' : '未ログイン';
  status.className = 'login-status' + (loggedIn ? ' logged-in' : '');
  document.getElementById('loginBtn').style.display  = loggedIn ? 'none'  : 'block';
  document.getElementById('logoutBtn').style.display = loggedIn ? 'block' : 'none';
}

/* ─ Drive操作エラーを判定して適切なメッセージ表示 ─ */
function handleDriveError(e) {
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

/* ─ オンライン／オフライン監視 ─ */
window.addEventListener('offline', () => {
  showToast('オフラインです。接続を確認してください', 'error', 5000);
});
window.addEventListener('online', () => {
  showToast('接続が回復しました ✓', 'info', 2000);
});
