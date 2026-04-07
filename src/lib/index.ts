/**
 * ぴよログ分析ライブラリのエントリポイント
 */
export { customQuery, getStats, getDailyData, getPeriods } from "./analysis";
export type { Period, Stats, PeriodOption } from "./analysis";

import { parseMultiplePiyoLogs } from "./parser";
import { initDB, createTables, insertEvents, insertSummaries } from "./db";
import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";

/**
 * 複数のぴよログテキストを受け取り、パース -> DB初期化 -> テーブル作成 -> INSERT を一括実行する
 * 単一ファイルの場合は文字列を直接渡してもOK
 */
export async function initPiyoAnalysis(
  rawTexts: string | string[],
): Promise<AsyncDuckDBConnection> {
  const texts = Array.isArray(rawTexts) ? rawTexts : [rawTexts];

  // パースと DB 初期化を並列実行
  const [files, conn] = await Promise.all([
    Promise.resolve(parseMultiplePiyoLogs(texts)),
    initDB().then(async (c) => {
      await createTables(c);
      return c;
    }),
  ]);

  await insertEvents(
    conn,
    files.flatMap((f) => f.events),
  );
  await insertSummaries(
    conn,
    files.flatMap((f) => f.summaries),
  );

  return conn;
}
