/**
 * ぴよログ分析ライブラリのエントリポイント
 */
export { customQuery, getStats, getDailyData, getPeriods } from "./analysis";
export type { Period, Stats, PeriodOption } from "./analysis";
export { initDB } from "./db";

import { parseMultiplePiyoLogs } from "./parser";
import { createTables, insertEvents, insertSummaries } from "./db";
import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";

/**
 * テキストをパースしてテーブル作成 + INSERT を行う
 * 単一ファイルの場合は文字列を直接渡してもOK
 */
export async function loadData(
  conn: AsyncDuckDBConnection,
  rawTexts: string | string[],
): Promise<void> {
  const texts = Array.isArray(rawTexts) ? rawTexts : [rawTexts];
  const files = parseMultiplePiyoLogs(texts);

  await createTables(conn);
  await insertEvents(
    conn,
    files.flatMap((f) => f.events),
  );
  await insertSummaries(
    conn,
    files.flatMap((f) => f.summaries),
  );
}
