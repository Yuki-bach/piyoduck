/**
 * daily_summaries テーブルへのクエリを提供する
 */
import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import { query } from "./db";
import type { DailyRow } from "./charts";

/** "all" or "YYYY-MM" */
export type Period = "all" | `${number}-${string}`;

export interface Stats {
  total_days: string;
  avg_sleep_hours: string;
  min_sleep_hours: string;
  max_sleep_hours: string;
  total_sleep_hours: string;
  avg_bf_total_min: string;
  avg_bf_left_min: string;
  avg_bf_right_min: string;
  total_bf_min: string;
  total_bf_hours: string;
  avg_formula_ml: string;
  total_formula_ml: string;
  total_formula_liters: string;
  avg_pee: string;
  avg_poop: string;
  total_pee: string;
  total_poop: string;
}

function periodWhere(period: Period): string {
  if (period === "all") return "1=1";
  const [year, month] = period.split("-");
  return `EXTRACT(YEAR FROM date) = ${year} AND EXTRACT(MONTH FROM date) = ${month}`;
}

/** 集計統計を取得 */
export async function getStats(conn: AsyncDuckDBConnection, period: Period): Promise<Stats> {
  const where = periodWhere(period);
  const rows = await query(
    conn,
    `SELECT
      COUNT(*) AS total_days,
      ROUND(AVG(sleep_total_minutes) / 60.0, 1) AS avg_sleep_hours,
      ROUND(MIN(sleep_total_minutes) / 60.0, 1) AS min_sleep_hours,
      ROUND(MAX(sleep_total_minutes) / 60.0, 1) AS max_sleep_hours,
      ROUND(SUM(sleep_total_minutes) / 60.0, 0) AS total_sleep_hours,
      ROUND(AVG(breastfeed_left_min + breastfeed_right_min), 0) AS avg_bf_total_min,
      ROUND(AVG(breastfeed_left_min), 0) AS avg_bf_left_min,
      ROUND(AVG(breastfeed_right_min), 0) AS avg_bf_right_min,
      SUM(breastfeed_left_min + breastfeed_right_min) AS total_bf_min,
      ROUND(SUM(breastfeed_left_min + breastfeed_right_min) / 60.0, 1) AS total_bf_hours,
      ROUND(AVG(formula_ml), 0) AS avg_formula_ml,
      ROUND(SUM(formula_ml), 0) AS total_formula_ml,
      ROUND(SUM(formula_ml) / 1000.0, 1) AS total_formula_liters,
      ROUND(AVG(pee_count), 1) AS avg_pee,
      ROUND(AVG(poop_count), 1) AS avg_poop,
      SUM(pee_count) AS total_pee,
      SUM(poop_count) AS total_poop
    FROM daily_summaries
    WHERE ${where}`,
  );
  return toStringRecord(rows[0]) as unknown as Stats;
}

/** 日別データを取得 */
export async function getDailyData(
  conn: AsyncDuckDBConnection,
  period: Period,
): Promise<DailyRow[]> {
  const where = periodWhere(period);
  return (await query(
    conn,
    `SELECT date, sleep_total_minutes / 60.0 AS sleep_hours,
            breastfeed_left_min, breastfeed_right_min,
            formula_ml, pee_count, poop_count, note
     FROM daily_summaries
     WHERE ${where}
     ORDER BY date`,
  )) as DailyRow[];
}

/** カスタムSQLを実行 */
export async function customQuery(conn: AsyncDuckDBConnection, sql: string) {
  return query(conn, sql);
}

/** Record の各値を安全に文字列化 */
function toStringRecord(row: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(row)) {
    if (val === undefined || val === null) result[key] = "";
    else result[key] = typeof val === "object" ? String(val.valueOf()) : String(val);
  }
  return result;
}
