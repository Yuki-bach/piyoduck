---
name: vp-usage
description: Vite+ (vp) CLI コマンドリファレンス。Vite+ プロジェクトでは package.json scripts を介さず vp コマンドを直接実行する。dev サーバ起動・ビルド・型チェック・テスト・lint・format・preview・依存関係インストールなど、Vite+ プロジェクトで開発タスクを実行する際は必ずこのスキルを参照して vp サブコマンドを使うこと。
---

# vp (Vite+) コマンドリファレンス

[Vite+](https://viteplus.dev/) を採用しているプロジェクト向けの `vp` CLI コマンドリファレンス。

## 実行前の確認

最初に `vp --version` を実行してグローバル `vp` が利用可能か確認する。

- **使える場合** (ローカル開発環境など、curl でグローバルインストール済み): そのまま `vp <cmd>` を直接叩く
- **`command not found` の場合** (Claude Code on the web、CI、Codespaces などクラウド環境): グローバル `vp` は無いが、`vite-plus` パッケージが devDependencies に入っているので `node_modules/.bin/vp` は存在する。以下のいずれかで実行する:
  - `pnpm exec vp <cmd>` (pnpm プロジェクト)
  - `npx vp <cmd>` (npm プロジェクト)
  - `yarn vp <cmd>` (yarn プロジェクト)

以降この文書では `vp <cmd>` と表記するが、グローバル `vp` が無い環境ではプロジェクトのパッケージマネージャ経由 (`pnpm exec vp <cmd>` 等) に読み替えること。

## コマンド一覧

### 日常的に使うもの

| コマンド | 用途 | 備考 |
|---|---|---|
| `vp install` | 依存関係インストール | `pnpm install` / `npm install` 相当 |
| `vp dev` | 開発サーバ起動 | Vite dev server |
| `vp build` | 本番ビルド | 型チェックは別途 `vp check` |
| `vp preview` | ビルド成果物のローカルプレビュー | `vp build` の後に実行 |
| `vp check` | format + lint + type-check を一括実行 | Oxfmt + Oxlint + tsgolint |
| `vp check --fix` | 上記を自動修正付きで実行 | フォーマット & 修正可能な lint を自動適用 |
| `vp test` | テスト実行 | Vitest |

### 個別実行

| コマンド | 用途 |
|---|---|
| `vp fmt` | フォーマットのみ (Oxfmt) |
| `vp lint` | lint のみ (Oxlint) |
| `vp staged` | staged ファイルに対して check 実行 (pre-commit hook 用) |

### セットアップ・メンテナンス

| コマンド | 用途 |
|---|---|
| `vp config` | git hooks (`.vite-hooks/`) を `.git/hooks` にインストール |
| `vp create` | 新規プロジェクト作成 |
| `vp migrate` | 既存プロジェクトを Vite+ に移行 |
| `vp upgrade` | vp 自体を更新 |
| `vp cache clean` | タスクキャッシュをクリア |
| `vp env` | Node.js バージョン管理 |

### その他

| コマンド | 用途 |
|---|---|
| `vp run <cmd>` | `package.json` の scripts を実行 (scripts を持たない構成では不要) |
| `vp exec <bin>` / `vpx <bin>` | プロジェクトローカルにインストール済みのバイナリを実行 |
| `vp dlx <pkg>` | グローバル install せずパッケージを実行 (`npx` 相当) |
| `vp pack` | ライブラリ/スタンドアロン成果物のビルド |
