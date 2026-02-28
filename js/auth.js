/* ═══════════════════════════════════════════
   auth.js — Google認証・トークン管理
═══════════════════════════════════════════ */
import { CONFIG, STATE } from './config.js';
import { updateLoginUI } from './ui.js';
import { markerLayer } from './map.js';
import { loadMemories } from './memories.js';

export function gapiLoaded() {
  gapi.load('client', async () => {
    await gapi.client.init({});
    await gapi.client.load('drive', 'v3');
    STATE.gapiReady = true;
    _maybeEnableLogin();
  });
}

export function gisLoaded() {
  STATE.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope:     CONFIG.SCOPE,
    callback:  _onFirstLogin,
  });
  STATE.gisReady = true;
  _maybeEnableLogin();
}

function _maybeEnableLogin() {
  if (STATE.gapiReady && STATE.gisReady) {
    document.getElementById('loginBtn').disabled = false;
  }
}

async function _onFirstLogin(resp) {
  if (resp.error) return;
  STATE.accessToken = resp.access_token;
  gapi.client.setToken({ access_token: STATE.accessToken });
  updateLoginUI(true);
  STATE.tokenClient.callback = _onTokenRefreshed;
  _scheduleTokenRefresh();
  await loadMemories();
}

async function _onTokenRefreshed(resp) {
  if (resp.error) return;
  STATE.accessToken    = resp.access_token;
  gapi.client.setToken({ access_token: STATE.accessToken });
  STATE.dataFileId     = null;
  STATE.photosFolderId = null;
  _scheduleTokenRefresh();
  await loadMemories();
}

function _scheduleTokenRefresh() {
  setTimeout(() => {
    STATE.tokenClient.requestAccessToken({ prompt: '' });
  }, CONFIG.TOKEN_REFRESH_MS);
}

export function initAuth() {
  document.getElementById('loginBtn').addEventListener('click', () => {
    STATE.tokenClient.requestAccessToken({ prompt: 'consent' });
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (!STATE.accessToken) return;
    google.accounts.oauth2.revoke(STATE.accessToken, () => {
      Object.values(STATE.photoBlobCache).forEach(url => URL.revokeObjectURL(url));
      STATE.accessToken    = null;
      STATE.memories       = [];
      STATE.dataFileId     = null;
      STATE.photosFolderId = null;
      STATE.photoBlobCache = {};
      markerLayer.clearLayers();
      updateLoginUI(false);
    });
  });
}
