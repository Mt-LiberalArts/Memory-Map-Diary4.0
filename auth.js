/* ═══════════════════════════════════════════
   auth.js — Google認証・トークン管理
   ─ gapiLoaded  : Drive APIクライアント初期化
   ─ gisLoaded   : OAuthトークンクライアント初期化
   ─ ログイン成功後にデータを読み込む
   ─ 55分ごとにサイレントリフレッシュ
═══════════════════════════════════════════ */

/* GAPI（Drive APIクライアント）の初期化 */
function gapiLoaded() {
  gapi.load('client', async () => {
    await gapi.client.init({});
    await gapi.client.load('drive', 'v3');
    STATE.gapiReady = true;
    _maybeEnableLogin();
  });
}

/* GIS（OAuthトークンクライアント）の初期化 */
function gisLoaded() {
  STATE.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope:     CONFIG.SCOPE,
    callback:  _onFirstLogin,
  });
  STATE.gisReady = true;
  _maybeEnableLogin();
}

/* 両方の準備が整ったらログインボタンを有効化 */
function _maybeEnableLogin() {
  if (STATE.gapiReady && STATE.gisReady) {
    document.getElementById('loginBtn').disabled = false;
  }
}

/* ─ 初回ログイン成功コールバック ─ */
async function _onFirstLogin(resp) {
  if (resp.error) return;
  STATE.accessToken = resp.access_token;
  gapi.client.setToken({ access_token: STATE.accessToken });
  updateLoginUI(true);
  // 以降のリフレッシュは別コールバックへ切り替え
  STATE.tokenClient.callback = _onTokenRefreshed;
  _scheduleTokenRefresh();
  await loadMemories();
}

/* ─ トークンリフレッシュ成功コールバック ─ */
async function _onTokenRefreshed(resp) {
  if (resp.error) return;
  STATE.accessToken = resp.access_token;
  gapi.client.setToken({ access_token: STATE.accessToken });
  // キャッシュリセット（リフレッシュ後は再取得を保証）
  STATE.dataFileId    = null;
  STATE.photosFolderId = null;
  _scheduleTokenRefresh();
  await loadMemories();
}

/* ─ 55分後に自動リフレッシュを予約 ─ */
function _scheduleTokenRefresh() {
  setTimeout(() => {
    STATE.tokenClient.requestAccessToken({ prompt: '' }); // UIなしでサイレント更新
  }, CONFIG.TOKEN_REFRESH_MS);
}

/* ─ ログインボタン ─ */
document.getElementById('loginBtn').onclick = () => {
  STATE.tokenClient.requestAccessToken({ prompt: 'consent' });
};

/* ─ ログアウトボタン ─ */
document.getElementById('logoutBtn').onclick = () => {
  if (!STATE.accessToken) return;
  google.accounts.oauth2.revoke(STATE.accessToken, () => {
    // Blob URLを全て解放してメモリリーク防止
    Object.values(STATE.photoBlobCache).forEach(url => URL.revokeObjectURL(url));

    // 状態リセット
    STATE.accessToken     = null;
    STATE.memories        = [];
    STATE.dataFileId      = null;
    STATE.photosFolderId  = null;
    STATE.photoBlobCache  = {};

    markerLayer.clearLayers();
    updateLoginUI(false);
  });
};
