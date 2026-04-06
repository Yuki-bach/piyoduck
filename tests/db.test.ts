import { resolve } from "node:path";
import {
  createDuckDB,
  ConsoleLogger,
  NODE_RUNTIME,
} from "@duckdb/duckdb-wasm/dist/duckdb-node-blocking";
import type { AsyncDuckDBConnection, DuckDBBundles } from "@duckdb/duckdb-wasm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTables, insertEvents, insertSummaries, query, closeDB } from "../src/lib/db";
import type { PiyoEvent, DailySummary } from "../src/lib/parser";

/* ------------------------------------------------------------------ */
/*  DuckDB Node セットアップ                                          */
/* ------------------------------------------------------------------ */

const distDir = resolve(import.meta.dirname, "../node_modules/@duckdb/duckdb-wasm/dist");

const BUNDLES: DuckDBBundles = {
  mvp: {
    mainModule: resolve(distDir, "duckdb-mvp.wasm"),
    mainWorker: resolve(distDir, "duckdb-node-mvp.worker.cjs"),
  },
  eh: {
    mainModule: resolve(distDir, "duckdb-eh.wasm"),
    mainWorker: resolve(distDir, "duckdb-node-eh.worker.cjs"),
  },
};

let conn: AsyncDuckDBConnection;
let dbInstance: Awaited<ReturnType<typeof createDuckDB>>;

beforeAll(async () => {
  dbInstance = await createDuckDB(BUNDLES, new ConsoleLogger(), NODE_RUNTIME);
  await dbInstance.instantiate(BUNDLES.mvp.mainModule);
  conn = dbInstance.connect() as never;
});

afterAll(() => {
  (conn as never as { close(): void }).close();
});

beforeEach(async () => {
  await conn.query("DROP TABLE IF EXISTS events");
  await conn.query("DROP SEQUENCE IF EXISTS events_id_seq");
  await conn.query("DROP TABLE IF EXISTS daily_summaries");
});

/* ------------------------------------------------------------------ */
/*  テストデータ                                                      */
/* ------------------------------------------------------------------ */

function makeEvent(overrides: Partial<PiyoEvent> = {}): PiyoEvent {
  return {
    date: "2026-03-01",
    time: "08:30",
    eventType: "formula",
    durationMinutes: null,
    side: null,
    amountMl: 80,
    feedMinutes: null,
    weightKg: null,
    note: null,
    babyAgeMonths: 0,
    babyAgeDays: 24,
    ...overrides,
  };
}

function makeSummary(overrides: Partial<DailySummary> = {}): DailySummary {
  return {
    date: "2026-03-01",
    breastfeedLeftMin: 11,
    breastfeedRightMin: 22,
    formulaCount: 3,
    formulaMl: 44,
    sleepHours: 5,
    sleepMinutes: 6,
    peeCount: 7,
    poopCount: 8,
    note: null,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  createTables                                                      */
/* ------------------------------------------------------------------ */

describe(createTables, () => {
  it("events テーブルを作成する", async () => {
    await createTables(conn);
    const rows = await query(conn, "DESCRIBE events");
    const cols = rows.map((r) => r["column_name"]);
    expect(cols).toEqual([
      "id",
      "date",
      "time",
      "event_type",
      "duration_minutes",
      "side",
      "amount_ml",
      "feed_minutes",
      "weight_kg",
      "note",
      "baby_age_months",
      "baby_age_days",
    ]);
  });

  it("daily_summaries テーブルを作成する", async () => {
    await createTables(conn);
    const rows = await query(conn, "DESCRIBE daily_summaries");
    const cols = rows.map((r) => r["column_name"]);
    expect(cols).toEqual([
      "date",
      "breastfeed_left_min",
      "breastfeed_right_min",
      "formula_count",
      "formula_ml",
      "sleep_hours",
      "sleep_minutes",
      "sleep_total_minutes",
      "pee_count",
      "poop_count",
      "note",
    ]);
  });

  it("二重実行でエラーにならない", async () => {
    await createTables(conn);
    await expect(createTables(conn)).resolves.toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/*  insertEvents                                                      */
/* ------------------------------------------------------------------ */

describe(insertEvents, () => {
  beforeEach(async () => {
    await createTables(conn);
  });

  it("全フィールドが正しいカラムに入る", async () => {
    const event = makeEvent({
      eventType: "breastfeed",
      durationMinutes: 15,
      side: "左→右",
      amountMl: 60,
      feedMinutes: 24,
      weightKg: 3.5,
      note: "よく飲んだ",
      babyAgeMonths: 1,
      babyAgeDays: 10,
    });
    await insertEvents(conn, [event]);

    const rows = await query(conn, "SELECT * FROM events");
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(new Date(Number(r["date"])).toISOString()).toContain("2026-03-01");
    expect(r["event_type"]).toBe("breastfeed");
    expect(Number(r["duration_minutes"])).toBe(15);
    expect(r["side"]).toBe("左→右");
    expect(Number(r["amount_ml"])).toBe(60);
    expect(Number(r["feed_minutes"])).toBe(24);
    expect(Number(r["weight_kg"])).toBeCloseTo(3.5);
    expect(r["note"]).toBe("よく飲んだ");
    expect(Number(r["baby_age_months"])).toBe(1);
    expect(Number(r["baby_age_days"])).toBe(10);
  });

  it("NULL フィールドが正しく処理される", async () => {
    await insertEvents(conn, [makeEvent()]);
    const rows = await query(conn, "SELECT * FROM events");
    expect(rows[0]["duration_minutes"]).toBeNull();
    expect(rows[0]["side"]).toBeNull();
    expect(rows[0]["feed_minutes"]).toBeNull();
    expect(rows[0]["weight_kg"]).toBeNull();
    expect(rows[0]["note"]).toBeNull();
  });

  it("シングルクォートがエスケープされる", async () => {
    const event = makeEvent({ note: "it's a note" });
    await insertEvents(conn, [event]);
    const rows = await query(conn, "SELECT note FROM events");
    expect(rows[0]["note"]).toBe("it's a note");
  });

  it("空配列の場合は INSERT しない", async () => {
    await insertEvents(conn, []);
    const rows = await query(conn, "SELECT count(*)::INTEGER AS cnt FROM events");
    expect(Number(rows[0]["cnt"])).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  insertSummaries                                                   */
/* ------------------------------------------------------------------ */

describe(insertSummaries, () => {
  beforeEach(async () => {
    await createTables(conn);
  });

  it("全カラムが正しい位置に入る", async () => {
    const s = makeSummary({ note: "元気" });
    await insertSummaries(conn, [s]);

    const rows = await query(conn, "SELECT * FROM daily_summaries");
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(new Date(Number(r["date"])).toISOString()).toContain("2026-03-01");
    expect(Number(r["breastfeed_left_min"])).toBe(11);
    expect(Number(r["breastfeed_right_min"])).toBe(22);
    expect(Number(r["formula_count"])).toBe(3);
    expect(Number(r["formula_ml"])).toBe(44);
    expect(Number(r["sleep_hours"])).toBe(5);
    expect(Number(r["sleep_minutes"])).toBe(6);
    expect(Number(r["pee_count"])).toBe(7);
    expect(Number(r["poop_count"])).toBe(8);
    expect(r["note"]).toBe("元気");
  });

  it("sleep_total_minutes が sleepHours*60 + sleepMinutes になる", async () => {
    await insertSummaries(conn, [makeSummary()]);
    const rows = await query(conn, "SELECT sleep_total_minutes FROM daily_summaries");
    // 5 * 60 + 6 = 306
    expect(Number(rows[0]["sleep_total_minutes"])).toBe(306);
  });

  it("note が NULL のケース", async () => {
    await insertSummaries(conn, [makeSummary({ note: null })]);
    const rows = await query(conn, "SELECT note FROM daily_summaries");
    expect(rows[0]["note"]).toBeNull();
  });

  it("空配列の場合は INSERT しない", async () => {
    await insertSummaries(conn, []);
    const rows = await query(conn, "SELECT count(*)::INTEGER AS cnt FROM daily_summaries");
    expect(Number(rows[0]["cnt"])).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  query                                                             */
/* ------------------------------------------------------------------ */

describe(query, () => {
  beforeEach(async () => {
    await createTables(conn);
  });

  it("Arrow 結果をオブジェクト配列に変換する", async () => {
    await insertEvents(conn, [makeEvent(), makeEvent({ date: "2026-03-02" })]);
    const rows = await query(conn, "SELECT event_type, amount_ml FROM events ORDER BY date");
    expect(rows).toHaveLength(2);
    expect(rows[0]["event_type"]).toBe("formula");
    expect(Number(rows[0]["amount_ml"])).toBe(80);
  });

  it("空結果で空配列を返す", async () => {
    const rows = await query(conn, "SELECT * FROM events");
    expect(rows).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  closeDB                                                           */
/* ------------------------------------------------------------------ */

describe(closeDB, () => {
  it("接続を閉じてもエラーにならない", async () => {
    const tempConn = dbInstance.connect() as never as AsyncDuckDBConnection;
    await expect(closeDB(tempConn)).resolves.toBeUndefined();
  });
});
