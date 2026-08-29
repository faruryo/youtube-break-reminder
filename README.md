# YouTube Break Reminder

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-YouTube_Break_Reminder-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/youtube-break-reminder/odogkecjchpdpamjlaodbhmjifiphcog)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

YouTubeのダラダラ視聴や「面白い動画がないか」と探し回る探索時間をコントロールするための、Google Chrome拡張機能（Manifest V3）です。

👉 **[Chrome Web Store からワンクリックでインストール](https://chromewebstore.google.com/detail/youtube-break-reminder/odogkecjchpdpamjlaodbhmjifiphcog)**

---

## 🌟 主な機能

1.  **曜日・祝日別のデイリー制限 (Daily Limiter)**
    *   平日（月〜金）や土日・祝日ごとに異なる1日の視聴上限時間を設定可能。上限に達すると自動的に動画を停止し、ブロック画面を表示します。
2.  **インターバル・ブレイカー (Interval Breaker)**
    *   連続利用時間が設定値（例: 30分）に達すると、動画を一時停止し、強制的に20秒間の休憩を促すポップアップを表示します（席外しやストレッチの推奨）。
3.  **時間帯別の視聴振り返りレポート (Usage Reports)**
    *   何時にYouTubeを見ているかを24時間バーチャートで可視化。
    *   日別、週別（曜日推移）、月別の利用傾向やピーク時間帯を客観的に確認・振り返りができます。
4.  **スマートなアクティブ時間追跡**
    *   単にタブを開いている時間ではなく、YouTubeタブが表示（フォアグラウンド）されており、かつ「動画再生中」または「最近1分以内にスクロールやクリック等の操作がある（探索中）」時間だけを正確に測定します。
    *   YouTube以外のタブを見ている時間や、ブラウザが最小化されている時間は測定されません。
5.  **リセット時刻のカスタマイズ**
    *   1日の利用時間の自動リセット時刻（デフォルト: 朝4時）を設定できます。夜更かしして深夜2〜3時まで利用した場合でも、朝4時までは同一日としてカウントされます。
6.  **ミニマルなダークUI & 完全ローカル保存**
    *   YouTube公式のダークモードやコーヒーテイストに調和する、ソリッドで清潔感のあるポップアップUI。
    *   すべてのデータはお使いのブラウザ内（ローカルストレージ）にのみ保存され、外部送信は一切行いません。

---

## 📦 インストール方法

### 1. Chrome Web Store からインストール（推奨）
[Chrome Web Store の商品ページ](https://chromewebstore.google.com/detail/youtube-break-reminder/odogkecjchpdpamjlaodbhmjifiphcog) を開き、**「Chromeに追加」** をクリックするだけでインストール完了＆自動アップデートされます。

### 2. ローカル開発者モードでの読み込み（開発・ソースコードから動かす場合）
1.  このリポジトリを `git clone` するか、ZIPファイルとしてダウンロードして解凍します。
2.  Google Chromeを開き、アドレスバーに `chrome://extensions/` と入力して移動します。
3.  画面右上にある **「デベロッパー モード」** のトグルを **ON** にします。
4.  画面左上の **「パッケージ化されていない拡張機能を読み込む」** ボタンをクリックします。
5.  解凍した `youtube-break-reminder` フォルダを選択してロードします。

## 🧪 テストの実行方法

本プロジェクトには、リセット時刻の計算ロジックやタイムアウト判定を検証するためのJestによるユニットテストが用意されています。

```bash
# 依存関係（Jestなど）のインストール
npm install

# テストの実行
npm test
```

## 📄 ライセンス

このプロジェクトは [MIT License](LICENSE) のもとで公開されています。
