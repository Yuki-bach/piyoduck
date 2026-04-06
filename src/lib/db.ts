/**
 * DuckDB WASM の初期化とテーブル作成
 */
import * as duckdb from "@duckdb/duckdb-wasm";
import type { PiyoEvent, DailySummary } from "./parser";

let db: duckdb.AsyncDuckDB | null = null;

function sqlStr(v: string | null | undefined): string {
  return v === null || v === undefined ? "NULL" : `'${v.replaceAll("'", "''")}'`;
}

function sqlNum(v: number | null | undefined): string {
  return v === null || v === undefined ? "NULL" : String(v);
}

/**
 * DuckDB WASM を初期化してコネクションを返す
 */
export async function initDB(): Promise<duckdb.AsyncDuckDBConnection> {
  if (!db) {
    const DUCKDB_BUNDLES = await duckdb.selectBundle({
      mvp: {
        mainModule: new URL("@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm", import.meta.url).href,
        mainWorker: new URL(
          "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js",
          import.meta.url,
        ).href,
      },
      eh: {
        mainModule: new URL("@duckdb/duckdb-wasm/dist/duckdb-eh.wasm", import.meta.url).href,
        mainWorker: new URL("@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js", import.meta.url)
          .href,
      },
    });

    const logger = new duckdb.ConsoleLogger();
    const worker = new Worker(DUCKDB_BUNDLES.mainWorker!);
    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(DUCKDB_BUNDLES.mainModule);
  }

  return db.connect();
}

/**
 * テーブルを作成する
 */
export async function createTables(connection: duckdb.AsyncDuckDBConnection): Promise<void> {
  await connection.query(`CREATE SEQUENCE IF NOT EXISTS events_id_seq START 1`);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY DEFAULT nextval('events_id_seq'),
      date DATE NOT NULL,
      time TIME NOT NULL,
      event_type VARCHAR NOT NULL,
      duration_minutes INTEGER,
      side VARCHAR,
      amount_ml INTEGER,
      feed_minutes INTEGER,
      weight_kg DOUBLE,
      note VARCHAR,
      baby_age_months INTEGER,
      baby_age_days INTEGER
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS daily_summaries (
      date DATE PRIMARY KEY,
      breastfeed_left_min INTEGER NOT NULL,
      breastfeed_right_min INTEGER NOT NULL,
      formula_count INTEGER NOT NULL,
      formula_ml INTEGER NOT NULL,
      sleep_hours INTEGER NOT NULL,
      sleep_minutes INTEGER NOT NULL,
      sleep_total_minutes INTEGER NOT NULL,
      pee_count INTEGER NOT NULL,
      poop_count INTEGER NOT NULL,
      note VARCHAR
    )
  `);
}

/**
 * パース済みイベントをテーブルにINSERTする（バッチ）
 */
export async function insertEvents(
  connection: duckdb.AsyncDuckDBConnection,
  events: PiyoEvent[],
): Promise<void> {
  if (events.length === 0) return;

  const cols = `(date, time, event_type, duration_minutes, side, amount_ml, feed_minutes, weight_kg, note, baby_age_months, baby_age_days)`;
  const rows = events
    .map(
      (e) =>
        `(${sqlStr(e.date)},${sqlStr(e.time)},${sqlStr(e.eventType)},${sqlNum(e.durationMinutes)},${sqlStr(e.side)},${sqlNum(e.amountMl)},${sqlNum(e.feedMinutes)},${sqlNum(e.weightKg)},${sqlStr(e.note)},${sqlNum(e.babyAgeMonths)},${sqlNum(e.babyAgeDays)})`,
    )
    .join(",\n");
  await connection.query(`INSERT INTO events ${cols} VALUES ${rows}`);
}

/**
 * パース済みサマリーをテーブルにINSERTする（バッチ）
 */
export async function insertSummaries(
  connection: duckdb.AsyncDuckDBConnection,
  summaries: DailySummary[],
): Promise<void> {
  if (summaries.length === 0) return;

  const rows = summaries
    .map((s) => {
      const totalMin = s.sleepHours * 60 + s.sleepMinutes;
      return `(${sqlStr(s.date)},${sqlNum(s.breastfeedLeftMin)},${sqlNum(s.breastfeedRightMin)},${sqlNum(s.formulaCount)},${sqlNum(s.formulaMl)},${sqlNum(s.sleepHours)},${sqlNum(s.sleepMinutes)},${sqlNum(totalMin)},${sqlNum(s.peeCount)},${sqlNum(s.poopCount)},${sqlStr(s.note)})`;
    })
    .join(",\n");
  await connection.query(`INSERT INTO daily_summaries VALUES ${rows}`);
}

/**
 * クエリを実行して結果を返す
 */
export async function query(
  connection: duckdb.AsyncDuckDBConnection,
  sql: string,
): Promise<Record<string, unknown>[]> {
  const result = await connection.query(sql);
  return result.toArray().map((row) => {
    const obj: Record<string, unknown> = {};
    for (const field of result.schema.fields) {
      obj[field.name] = row[field.name];
    }
    return obj;
  });
}

/**
 * DB接続を閉じる。必要であれば DB 自体も終了する。
 */
export async function closeDB(
  connection: duckdb.AsyncDuckDBConnection,
  terminate = false,
): Promise<void> {
  await connection.close();
  if (terminate && db) {
    await db.terminate();
    db = null;
  }
}
