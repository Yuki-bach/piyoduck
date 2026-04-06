/**
 * ぴよログ分析ライブラリのエントリポイント
 */
export type { PiyoLogFile } from "./parser";
export { customQuery, getStats, getDailyData } from "./analysis";
export type { Period, Stats } from "./analysis";

import { parseMultiplePiyoLogs } from "./parser";
import { initDB, createTables, insertEvents, insertSummaries } from "./db";
import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import type { PiyoLogFile } from "./parser";

/**
 * 複数のぴよログテキストを受け取り、パース -> DB初期化 -> テーブル作成 -> INSERT を一括実行する
 * 単一ファイルの場合は文字列を直接渡してもOK
 */
export async function initPiyoAnalysis(rawTexts: string | string[]): Promise<{
  conn: AsyncDuckDBConnection;
  files: PiyoLogFile[];
}> {
  const texts = Array.isArray(rawTexts) ? rawTexts : [rawTexts];

  // パースと DB 初期化を並列実行
  const [files, conn] = await Promise.all([
    Promise.resolve(parseMultiplePiyoLogs(texts)),
    initDB().then(async (c) => {
      await createTables(c);
      return c;
    }),
  ]);

  // 日付順にソートして全ファイルのイベント・サマリーを結合
  files.sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month));

  await insertEvents(
    conn,
    files.flatMap((f) => f.events),
  );
  await insertSummaries(
    conn,
    files.flatMap((f) => f.summaries),
  );
  return { conn, files };
}
