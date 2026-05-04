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

/** 授乳間隔（日別平均） */
export interface FeedingIntervalRow {
  date: string;
  avg_interval_hours: number;
  feed_count: number;
}

export async function getFeedingIntervals(
  conn: AsyncDuckDBConnection,
  period: Period,
): Promise<FeedingIntervalRow[]> {
  const where = periodWhere(period);
  return (await query(
    conn,
    `WITH feeds AS (
       SELECT date,
         EXTRACT(HOUR FROM time) * 60 + EXTRACT(MINUTE FROM time) AS mins,
         LAG(EXTRACT(HOUR FROM time) * 60 + EXTRACT(MINUTE FROM time))
           OVER (PARTITION BY date ORDER BY time) AS prev_mins
       FROM events
       WHERE event_type IN ('breastfeed', 'formula')
         AND ${where}
     )
     SELECT date,
       ROUND(AVG((mins - prev_mins) / 60.0), 2) AS avg_interval_hours,
       COUNT(*) + 1 AS feed_count
     FROM feeds
     WHERE prev_mins IS NOT NULL
     GROUP BY date
     ORDER BY date`,
  )) as unknown as FeedingIntervalRow[];
}

/** 日別の最長連続睡眠 */
export interface LongestSleepRow {
  date: string;
  longest_sleep_hours: number | null;
}

/**
 * sleep/wake イベント列から「最長連続睡眠 (per-day)」を導出する共通 CTE。
 * - 連続する sleep が来た場合は前の sleep を破棄 (= 後続の sleep が wake でないなら NULL)
 * - 末尾の sleep に対応する wake が無い場合は「24時 - 開始時刻」をその日の duration とみなす
 *   (元の JS 実装と同じ挙動)
 * 結果: per_day(date DATE, longest_sleep_hours DOUBLE)
 */
const LONGEST_SLEEP_CTE = `
  ordered_sleep_events AS (
    SELECT
      date AS event_date,
      EXTRACT(HOUR FROM time) + EXTRACT(MINUTE FROM time) / 60.0 AS hour,
      event_type,
      ROW_NUMBER() OVER (ORDER BY date, time) AS rn
    FROM events
    WHERE event_type IN ('sleep', 'wake')
  ),
  with_next_event AS (
    SELECT
      event_date,
      hour,
      event_type,
      LEAD(event_type) OVER (ORDER BY rn) AS next_type,
      LEAD(event_date) OVER (ORDER BY rn) AS next_date,
      LEAD(hour) OVER (ORDER BY rn) AS next_hour
    FROM ordered_sleep_events
  ),
  sleep_sessions AS (
    SELECT
      event_date AS date,
      CASE
        WHEN next_type = 'wake' THEN
          DATE_DIFF('day', event_date, next_date) * 24 + (next_hour - hour)
        WHEN next_type IS NULL THEN
          24 - hour
        ELSE NULL
      END AS duration_hours
    FROM with_next_event
    WHERE event_type = 'sleep'
  ),
  per_day AS (
    SELECT date, MAX(duration_hours) AS longest_sleep_hours
    FROM sleep_sessions
    WHERE duration_hours > 0
    GROUP BY date
  )`;

export async function getLongestSleepDurations(
  conn: AsyncDuckDBConnection,
  period: Period,
): Promise<LongestSleepRow[]> {
  return (await query(
    conn,
    `WITH ${LONGEST_SLEEP_CTE}
     SELECT
       strftime(d.date, '%Y-%m-%d') AS date,
       ROUND(p.longest_sleep_hours, 2) AS longest_sleep_hours
     FROM (SELECT date FROM daily_summaries WHERE ${periodWhere(period)}) d
     LEFT JOIN per_day p ON d.date = p.date
     ORDER BY d.date`,
  )) as unknown as LongestSleepRow[];
}

/** 各チャートの平均線に使う集計値 (全て SQL 側で計算) */
export interface ChartAverages {
  sleep_hours: number;
  bf_total_min: number;
  formula_ml: number;
  diaper_total_count: number;
  feed_interval_hours: number;
  longest_sleep_hours: number;
}

export async function getChartAverages(
  conn: AsyncDuckDBConnection,
  period: Period,
): Promise<ChartAverages> {
  const where = periodWhere(period);

  const [dailyAvg] = (await query(
    conn,
    `SELECT
       AVG(sleep_total_minutes) / 60.0 AS sleep_hours,
       AVG(breastfeed_left_min + breastfeed_right_min) AS bf_total_min,
       AVG(formula_ml) AS formula_ml,
       AVG(pee_count + poop_count) AS diaper_total_count
     FROM daily_summaries
     WHERE ${where}`,
  )) as Record<string, number | null>[];

  const [feedAvg] = (await query(
    conn,
    `WITH feeds AS (
       SELECT date,
         EXTRACT(HOUR FROM time) * 60 + EXTRACT(MINUTE FROM time) AS mins,
         LAG(EXTRACT(HOUR FROM time) * 60 + EXTRACT(MINUTE FROM time))
           OVER (PARTITION BY date ORDER BY time) AS prev_mins
       FROM events
       WHERE event_type IN ('breastfeed', 'formula') AND ${where}
     ),
     per_day AS (
       SELECT date, AVG((mins - prev_mins) / 60.0) AS day_avg
       FROM feeds
       WHERE prev_mins IS NOT NULL
       GROUP BY date
     )
     SELECT AVG(day_avg) AS feed_interval_hours FROM per_day`,
  )) as Record<string, number | null>[];

  const [longestAvg] = (await query(
    conn,
    `WITH ${LONGEST_SLEEP_CTE}
     SELECT AVG(longest_sleep_hours) AS longest_sleep_hours
     FROM per_day
     WHERE date IN (SELECT date FROM daily_summaries WHERE ${where})`,
  )) as Record<string, number | null>[];

  return {
    sleep_hours: Number(dailyAvg?.sleep_hours ?? 0),
    bf_total_min: Number(dailyAvg?.bf_total_min ?? 0),
    formula_ml: Number(dailyAvg?.formula_ml ?? 0),
    diaper_total_count: Number(dailyAvg?.diaper_total_count ?? 0),
    feed_interval_hours: Number(feedAvg?.feed_interval_hours ?? 0),
    longest_sleep_hours: Number(longestAvg?.longest_sleep_hours ?? 0),
  };
}

/** カスタムSQLを実行 */
export async function customQuery(conn: AsyncDuckDBConnection, sql: string) {
  return query(conn, sql);
}

/** Record の各値を安全に文字列化 (DuckDB-WASM の HUGEINT などは toString() で数値文字列を返す) */
function toStringRecord(row: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(row)) {
    result[key] = stringify(val);
  }
  return result;
}

function stringify(val: unknown): string {
  if (val === undefined || val === null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean" || typeof val === "bigint")
    return val.toString();
  return (val as { toString(): string }).toString();
}
