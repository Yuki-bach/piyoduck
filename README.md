# 🐤 piyoduck

ぴよログの記録をブラウザ上で分析・可視化するダッシュボード

DuckDB WASM でデータを集計し、Chart.js でグラフを描画する。
フレームワーク不使用の vanilla TypeScript で構築。

## セットアップ

```bash
vp install
vp dev
```

## データの追加

1. ぴよログアプリからテキスト形式でエクスポート
2. `.txt` ファイルを `src/data/` に配置

## 動作確認環境

- ぴよログ v9.1.2
- アプリ内言語設定：日本語
