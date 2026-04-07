/**
 * daily_summaries テーブルへのクエリを提供する
 */
import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import { query } from "./db";
import type { DailyRow } from "./charts";

/** "all" or "YYYY-MM" */
export type Period = "all" | `${number}-${string}`;

/** UI が期間セレクタを描画するための選択肢 */
export interface PeriodOption {
  value: Period;
  label: string;
}

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

/** daily_summaries に存在する年月から期間セレクタの選択肢と全期間ラベルを組み立てる */
export async function getPeriods(
  conn: AsyncDuckDBConnection,
): Promise<{ periods: PeriodOption[]; rangeLabel: string }> {
  const rows = (await query(
    conn,
    `SELECT DISTINCT
       EXTRACT(YEAR FROM date)::INTEGER AS year,
       EXTRACT(MONTH FROM date)::INTEGER AS month
     FROM daily_summaries
     ORDER BY year, month`,
  )) as { year: number; month: number }[];

  const months = rows.map((r) => ({
    value: `${r.year}-${String(r.month).padStart(2, "0")}` as Period,
    label: `${r.month}月`,
    headerLabel: `${r.year}年${r.month}月`,
  }));

  const periods: PeriodOption[] = [
    { value: "all", label: "全期間" },
    ...months.map(({ value, label }) => ({ value, label })),
  ];

  const first = months[0]?.headerLabel;
  const last = months[months.length - 1]?.headerLabel;
  const rangeLabel = !first ? "" : first === last ? first : `${first}-${last}`;

  return { periods, rangeLabel };
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
    else if (typeof val === "bigint") result[key] = val.toString();
    else if (typeof val === "number" || typeof val === "string" || typeof val === "boolean")
      result[key] = String(val);
    else result[key] = JSON.stringify(val);
  }
  return result;
}
