# バグレポート & 修正内容

部品化作業中に発見・修正したバグをまとめています。

---

## 🔴 HIGH — セキュリティ

### XSS脆弱性（`map.js` / 元 `renderMarkers`）
**問題:** `m.comment` と `m.date` をエスケープせずそのまま `innerHTML` に展開していた。
悪意あるコメント（例: `<img src=x onerror=alert(1)>`）を保存されると、
他ユーザーの画面でスクリプトが実行される可能性があった。

**修正:** `escapeHtml()` 関数を追加し、すべての動的文字列を HTML エスケープしてから展開。

```js
// Before
html += `<div class="popup-comment">${m.comment || ''}</div>`;

// After
html += `<div class="popup-comment">${escapeHtml(m.comment || '')}</div>`;
```

---

## 🟠 MEDIUM — クラッシュ・データ損失リスク

### EXIFパーサーの無限ループ（`photo.js` / 元 `getExifDate`）
**問題:** JPEGセグメントを走査する while ループで `segLen` が 0 の場合（不正データ / EOI マーカー）に無限ループになりうる。

**修正:** `segLen < 2` のとき break する安全チェックを追加。

```js
// After
const segLen = view.getUint16(offset + 2);
if (segLen < 2) break; // 不正データで無限ループ防止
offset += 2 + segLen;
```

---

### Drive APIレスポンスが undefined のときクラッシュ（`drive.js` / 元 `loadDataFile`）
**問題:** `res.result.files` が APIエラー時に `undefined` を返す場合、
`res.result.files.length` でクラッシュしていた。

**修正:** Optional chaining + nullish coalescing でフォールバック。

```js
// Before
if (res.result.files.length > 0) { ... }

// After
const files = res.result.files ?? [];
if (files.length > 0) { ... }
```

---

### 写真アップロード失敗時に `photoFileId` として `undefined` が保存される（`drive.js` / 元 `uploadPhoto`）
**問題:** `fetch` が成功してもレスポンスボディに `id` がない場合（クォータ超過など）、
`data.id` が `undefined` のまま返り、memories に不正な `photoFileId` が保存されていた。

**修正:** `if (!data.id)` チェックを追加してエラーを投げる。

---

### ポップアップ再描画後に編集フォーム要素が取れない（`memories.js` / 元 `editMemory`）
**問題:** `renderMarkers()` 後にポップアップが閉じると `edit-comment-${id}` 要素が
DOMから消えるが、`??` でのフォールバックが効かず `null.value` でクラッシュしていた。

**修正:** 要素の存在チェックとエラートーストを追加。

---

## 🟡 LOW — UX・メモリリーク

### 写真削除時に BlobURL が解放されない（`memories.js` / 元 `deleteMemory`）
**問題:** `deleteMemory` で `photoBlobCache` から削除していたが、
`URL.revokeObjectURL()` の呼び出しが抜けており、ブラウザのメモリが解放されなかった。

**修正:** `revokeObjectURL` を呼んでからキャッシュから削除するよう修正。

---

### `saveMarker` 成功時のトースト通知が無かった
**問題:** 保存成功しても視覚的なフィードバックがなかった。

**修正:** `memories.js` の `saveMarker` 成功時に `showToast('思い出を保存しました ✓')` を追加。

---

### 画像読み込み用の一時 BlobURL が解放されない（`photo.js`）
**問題:** リサイズ処理のために作った一時 `objectURL` が `img.onload` 後も解放されず
メモリリークになっていた。

**修正:** `img.onload` 内で `URL.revokeObjectURL(tempUrl)` を呼ぶよう修正。

---

## ファイル構成

```
├── index.html          HTMLのみ（ロジックなし）
├── style.css           変更なし
└── js/
    ├── config.js       定数・STATE・MODE_HINTS
    ├── ui.js           showToast / setLoading / handleDriveError / updateLoginUI
    ├── map.js          Leaflet初期化 / renderMarkers / switchMode / escapeHtml
    ├── sheet.js        openSheet / closeSheet
    ├── photo.js        getExifDate / resizeToBlob / photoInputイベント
    ├── drive.js        ensureFolder / loadDataFile / saveDataFile / uploadPhoto / loadPhotoBlob
    ├── memories.js     saveMarker / loadMemories / editMemory / deleteMemory
    └── auth.js         gapiLoaded / gisLoaded / ログイン・ログアウト
```

### 読み込み順の依存関係
```
config.js → ui.js → map.js → sheet.js → photo.js → drive.js → memories.js → auth.js
```
`auth.js` を最後にする理由: `loadMemories()` を呼ぶため、それより前にすべての関数が定義されている必要がある。
