/**
 * ぴよログ分析ライブラリのエントリポイント
 */
export { customQuery, getStats, getDailyData, getPeriods } from "./analysis";
export type { Period, Stats, PeriodOption } from "./analysis";
export { initDB } from "./db";

import { parseLogs } from "./parser";
import { createTables, insertEvents, insertSummaries } from "./db";
import { readTexts } from "./loader";
import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";

/**
 * src/data/ 配下のぴよログテキストを読み込み、パース -> テーブル作成 -> INSERT を行う
 */
export async function loadData(conn: AsyncDuckDBConnection): Promise<void> {
  const texts = await readTexts();
  const files = parseLogs(texts);

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
