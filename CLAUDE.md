# CLAUDE.md

## リリース手順

- 機能は PR でマージする。PR では README の機能一覧と CHROMEWEBSTORE.md（機能説明、【アップデート履歴】、末尾の表に `Pending Release` の行）も更新する。
- マージ後、main に直接 `chore: bump version to X.Y.Z` をコミットする。変えるのは manifest.json と package.json の version、CHROMEWEBSTORE.md の `Last Updated`。package-lock.json のルートの version は上げない（1.0.0 のまま）。前の版の表の状態は、公開済みなら `Published` に直す。
- `vX.Y.Z` タグを push すると `.github/workflows/publish.yml` が動き、ストアへの申請と GitHub Release の作成まで進む。

## YouTube のページ構造の落とし穴（content.js）

- ライブ判定に使う `.ytp-time-display.ytp-live` は、再生が始まってから付く。`#movie_player` がまだない間、`unstarted-mode` の間、`ad-showing`（広告中は印が消える）の間は判定できない。この間に全画面で一時停止すると、ライブでも再生が始まらずに固まる。
- /watch を離れても、隠れたプレイヤーは DOM に残り、ライブの印も残ることがある。ライブとみなすのは /watch のときだけにする。
- YouTube 内の画面遷移では content script が初期化し直されない。表示中の画面とページの状態のずれは、毎秒の heartbeat で合わせ直している（`syncOverlayWithLive`）。
- `preventPlayListener` は一度登録すると外れない。止めるかどうかの条件には、今どの画面を出しているかを含める。

## テスト

- `document.querySelector` のモックを、どのセレクタにも動画を返す形にしない。content.js が新しいセレクタを見るたびに、既存テストが巻き込まれて落ちる。`sel.startsWith('video')` のように絞る。
- テストの既定の `window.location.pathname` は `'/'`。/watch でだけ起きる動きは、そのテストの中で切り替えて確かめる。

## 実機での確認

- ファイルを変えても、読み込み済みの拡張機能は更新されない。`chrome://extensions` の更新ボタン（↻）を押してから、YouTube のタブを再読み込みする。manifest を変えたときは必須。
- YouTube のページの DevTools コンソールからは `chrome.storage` に届かない（content script は別の実行環境で動く）。コンソール上部の実行先を拡張機能に切り替えるか、拡張機能の Service Worker のコンソールで実行する。
- 休憩画面をすぐ出すには `breakIntervalSeconds` を秒単位で小さくする（ポップアップでは5分未満にできない）。上限のブロックは `limitSeconds` で出せる。確認したら元の値に戻す。
- `chrome://` のページはブラウザの自動操作ツールから開けない。拡張機能の読み込みと再読み込みだけを人に頼み、ほかの準備と確認は自分で済ませる。
- `web_accessible_resources` の `use_dynamic_url: true` は、`chrome.runtime.getURL` の URL で画像が読めなくなるおそれがあるので付けていない。固定の id の要素をページに差し込んでいて、拡張機能が入っていることはもともとページから見分けられるので、付ける利点もない。
