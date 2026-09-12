# Chrome Web Store Listing — YouTube Break Reminder

> Last Updated: 2026-09-12

## Store Listing

**Extension Name** [REQUIRED]
YouTube Break Reminder


**Short Description** [REQUIRED]
YouTubeの視聴時間を管理。曜日別の上限設定、連続視聴時の休憩促進、日別・週別・月別の時間帯別振り返りレポートを提供します。


**Detailed Description** [REQUIRED]
YouTubeの使いすぎを防ぎ、健康的な動画視聴習慣をサポートするタイムマネジメント拡張機能です。

【主な機能】
1. 曜日・祝日別の1日利用制限
平日（月〜金）や土日・祝日ごとに異なる1日の視聴上限時間を設定可能。上限に達すると自動でブロック画面が表示され、夜更かしやダラダラ視聴を防止します。

2. 連続視聴時の定期休憩リマインダー
設定した時間（例: 30分）連続して動画を視聴・ブラウジングしていると、20秒間の休憩画面をポップアップ。目を休めたりストレッチするきっかけを作ります。

3. 時間帯別の視聴振り返りレポート（日別・週別・月別）
自分が「何時にYouTubeをよく見ているのか」を24時間グラフで可視化。日別、週別（曜日推移）、月別の利用傾向やピーク時間帯を客観的に確認できます。

4. 柔軟なリセット時刻設定
生活リズムに合わせて、日付の切り替え時刻（例: 深夜4時）をカスタマイズできます。

【プライバシーとセキュリティ】
すべての利用データや設定値はお使いのブラウザ内（ローカルストレージ）にのみ保存されます。外部サーバーへのデータ送信は一切行いません。


**Category** [REQUIRED]
Productivity (生産性)


**Single Purpose** [REQUIRED]
YouTubeの利用時間と時間帯を計測・管理し、長時間の視聴防止や定期的な休憩をサポートする


**Primary Language** [REQUIRED]
日本語 (Japanese)


## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icons/icon-128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ✅ Ready | `store-assets/screenshot-1.png` |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ✅ Ready | `store-assets/screenshot-2.png` |
| Screenshot 3 [RECOMMENDED] | 1280×800 or 640×400 | ✅ Ready | `store-assets/screenshot-3.png` |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | `store-assets/promo-small.png` |
| Marquee Promo Tile | 1400×560 | ⬜ Not created | `store-assets/promo-marquee.png` |

### Screenshot Notes
- **Screenshot 1**: タイマー画面（プログレスサークル、残り時間、曜日別設定）
- **Screenshot 2**: 利用レポート画面（日別・週別の24時間帯別バーチャート、ピーク時間帯サマリー）
- **Screenshot 3**: YouTube視聴中の休憩促進オーバーレイまたは利用制限ブロック画面


## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `storage` | permissions | ユーザーが設定した曜日別制限時間、休憩間隔、リセット時刻、および日別・時間帯別の利用履歴データをブラウザ内に保存・集計するために使用します。 |
| `alarms` | permissions | 定期的なデータ整理や時間更新処理を安全に行うために使用します。 |
| `*://*.youtube.com/*` | host_permissions | YouTubeの動画再生状態や操作アクティビティを検知して利用時間を計測し、制限時間を超過した際に視聴ブロック画面や休憩オーバーレイを表示するために使用します。 |


## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No (外部送信なし。ブラウザ内ローカル保存のみ)

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | No | No | N/A | No |
| Health info | No | No | N/A | No |
| Financial info | No | No | N/A | No |
| Authentication info | No | No | N/A | No |
| Personal communications | No | No | N/A | No |
| Location | No | No | N/A | No |
| Web history | No | No | N/A | No |
| User activity | Yes (YouTube内滞在秒数のみ) | No (ローカル保存のみ) | 利用時間制限および時間帯別グラフ表示 | No |
| Website content | No | No | N/A | No |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes


## Privacy Policy

**Privacy Policy URL** [RECOMMENDED]
https://github.com/faruryo/youtube-break-reminder/blob/main/PRIVACY.md


## Distribution

**Visibility**: Public
**Store URL**: https://chromewebstore.google.com/detail/youtube-break-reminder/odogkecjchpdpamjlaodbhmjifiphcog
**Regions**: All regions (すべての地域)
**Pricing**: Free (無料)


## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.1 | 2026-09-12 | 休憩オーバーレイの再開ボタンをSpace/Enter操作に対応、操作性向上と誤操作防止 | Published |
| 1.0.0 | 2026-08-27 | 初回リリース（タイマー、曜日別制限、休憩促進、日別/週別/月別の時間帯別レポート） | Published |
