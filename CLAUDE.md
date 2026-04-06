# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

ぴよログ (PiyoLog) text exports → DuckDB WASM → Chart.js dashboard. Vanilla TypeScript, no framework.

## Commands

- `vp install` — install deps
- `vp dev` — dev server
- `vp build` — production build
- `vp check` — format + lint + type-check
- `vp test` — run tests

## Architecture

`loader.ts` が `import.meta.glob("/src/data/*.txt")` で `.txt` ファイルを自動検出 → `parser.ts` がイベント/サマリーを抽出 → `db.ts` が DuckDB へロード (`events` + `daily_summaries` テーブル) → `analysis.ts` が SQL 実行 → `charts.ts` が Chart.js で描画。`main.ts` が UI を統合。
