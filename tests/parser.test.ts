import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseMultiplePiyoLogs, parsePiyoLog } from "../src/lib/parser";
import type { PiyoEvent } from "../src/lib/parser";

/** 最小限の日ブロックを生成するヘルパー */
function dayBlock(date: string, age: string, lines: string[]): string {
  return `${date}\n${age}\n\n${lines.join("\n")}`;
}

function wrapLog(year: number, month: number, blocks: string[]): string {
  const header = `【ぴよログ】${year}年${month}月`;
  return `${header}\n\n${blocks.map((b) => `----------\n${b}\n`).join("\n")}`;
}

function singleDayLog(eventLines: string[]): string {
  return wrapLog(2026, 3, [dayBlock("2026/3/1(日)", "月綺 (0か月24日)", eventLines)]);
}

describe(parsePiyoLog, () => {
  describe("ヘッダー・メタデータ", () => {
    it("ヘッダーから年月を取得する", () => {
      const result = parsePiyoLog("【ぴよログ】2026年3月\n");
      expect(result.label).toBe("2026年3月");
      expect(result.year).toBe(2026);
      expect(result.month).toBe(3);
    });

    it("ヘッダーなしの場合は不明を返す", () => {
      const result = parsePiyoLog("");
      expect(result.label).toBe("不明");
      expect(result.year).toBe(0);
      expect(result.month).toBe(0);
      expect(result.events).toHaveLength(0);
      expect(result.summaries).toHaveLength(0);
    });

    it("日付をゼロパディングする", () => {
      const text = singleDayLog(["00:50   寝る"]);
      const result = parsePiyoLog(text);
      expect(result.events[0].date).toBe("2026-03-01");
    });

    it("月齢を取得する", () => {
      const text = singleDayLog(["00:50   寝る"]);
      const result = parsePiyoLog(text);
      expect(result.events[0].babyAgeMonths).toBe(0);
      expect(result.events[0].babyAgeDays).toBe(24);
    });
  });

  describe("イベントパース", () => {
    it.each([
      { line: "00:50   寝る", type: "sleep", check: {} },
      {
        line: "02:40   起きる (1時間50分)",
        type: "wake",
        check: { durationMinutes: 110 },
      },
      {
        line: "02:40   起きる (0時間50分)",
        type: "wake",
        check: { durationMinutes: 50 },
      },
      {
        line: "03:30   ミルク 80ml",
        type: "formula",
        check: { amountMl: 80 },
      },
      { line: "03:20   うんち", type: "poop", check: {} },
      { line: "03:20   おしっこ", type: "pee", check: {} },
      { line: "17:05   お風呂", type: "bath", check: {} },
      {
        line: "10:00   体重 3.5kg",
        type: "weight",
        check: { weightKg: 3.5 },
      },
    ] as const)(
      "$line → $type",
      ({ line, type, check }: { line: string; type: string; check: Partial<PiyoEvent> }) => {
        const result = parsePiyoLog(singleDayLog([line]));
        expect(result.events).toHaveLength(1);
        expect(result.events[0].eventType).toBe(type);
        for (const [key, value] of Object.entries(check)) {
          expect(result.events[0][key as keyof PiyoEvent]).toBe(value);
        }
      },
    );

    it("認識できないイベントはスキップする", () => {
      const result = parsePiyoLog(singleDayLog(["10:00   散歩"]));
      expect(result.events).toHaveLength(0);
    });

    it("時刻をパースする", () => {
      const result = parsePiyoLog(singleDayLog(["02:40   寝る"]));
      expect(result.events[0].time).toBe("02:40");
    });
  });

  describe("母乳パース", () => {
    it.each([
      {
        name: "片方のみ",
        line: "02:55   母乳 左 12分",
        check: { side: "左", feedMinutes: 12, amountMl: null },
      },
      {
        name: "片方+ml",
        line: "09:55   母乳 左 10分 (30ml)",
        check: { side: "左", feedMinutes: 10, amountMl: 30 },
      },
      {
        name: "両方←",
        line: "09:25   母乳 左 15分 ← 右 9分 (60ml)",
        check: { side: "左←右", feedMinutes: 24, amountMl: 60 },
      },
      {
        name: "両方→",
        line: "03:45   母乳 左 6分 → 右 2分",
        check: { side: "左→右", feedMinutes: 8, amountMl: null },
      },
      {
        name: "搾乳",
        line: "10:00   母乳 母乳 (60ml)",
        check: { side: "搾乳", amountMl: 60, feedMinutes: null },
      },
    ])(
      "$name: $line",
      ({ line, check }: { name: string; line: string; check: Partial<PiyoEvent> }) => {
        const result = parsePiyoLog(singleDayLog([line]));
        expect(result.events).toHaveLength(1);
        expect(result.events[0].eventType).toBe("breastfeed");
        for (const [key, value] of Object.entries(check)) {
          expect(result.events[0][key as keyof PiyoEvent]).toBe(value);
        }
      },
    );
  });

  describe("日次サマリー", () => {
    it("全項目をパースする", () => {
      const text = singleDayLog([
        "00:50   寝る",
        "",
        "母乳合計　　   左 98分 / 右 79分",
        "ミルク合計　   3回 170ml",
        "睡眠合計　　   11時間40分",
        "おしっこ合計   7回",
        "うんち合計　   5回",
      ]);
      const result = parsePiyoLog(text);
      expect(result.summaries).toHaveLength(1);
      const s = result.summaries[0];
      expect(s.date).toBe("2026-03-01");
      expect(s.breastfeedLeftMin).toBe(98);
      expect(s.breastfeedRightMin).toBe(79);
      expect(s.formulaCount).toBe(3);
      expect(s.formulaMl).toBe(170);
      expect(s.sleepHours).toBe(11);
      expect(s.sleepMinutes).toBe(40);
      expect(s.peeCount).toBe(7);
      expect(s.poopCount).toBe(5);
    });

    it("サマリー後のテキストをメモとして取得する", () => {
      const text = singleDayLog([
        "00:50   寝る",
        "",
        "母乳合計　　   左 98分 / 右 79分",
        "ミルク合計　   3回 170ml",
        "睡眠合計　　   11時間40分",
        "おしっこ合計   7回",
        "うんち合計　   5回",
        "",
        "今日のコーデはギャル",
      ]);
      const result = parsePiyoLog(text);
      expect(result.summaries[0].note).toBe("今日のコーデはギャル");
    });

    it("サマリーがない日はsummariesに含まれない", () => {
      const text = singleDayLog(["00:50   寝る"]);
      const result = parsePiyoLog(text);
      expect(result.summaries).toHaveLength(0);
    });
  });

  describe("ノート", () => {
    it("寝るイベントのノートを取得する", () => {
      const text = singleDayLog(["01:15   寝る   少し前からうとうとはしてた"]);
      const result = parsePiyoLog(text);
      expect(result.events[0].note).toBe("少し前からうとうとはしてた");
    });

    it("ノートなしの場合はnull", () => {
      const text = singleDayLog(["00:50   寝る"]);
      const result = parsePiyoLog(text);
      expect(result.events[0].note).toBeNull();
    });

    it("うんちのノートを取得する", () => {
      const text = singleDayLog(["03:20   うんち 少量"]);
      const result = parsePiyoLog(text);
      expect(result.events[0].note).toBe("少量");
    });
  });

  describe("エッジケース", () => {
    it("セパレータのみ", () => {
      const result = parsePiyoLog("----------\n----------\n");
      expect(result.events).toHaveLength(0);
    });

    it("ヘッダーのみ", () => {
      const result = parsePiyoLog("【ぴよログ】2026年3月\n");
      expect(result.events).toHaveLength(0);
      expect(result.label).toBe("2026年3月");
    });

    it("複数日をパースする", () => {
      const text = wrapLog(2026, 3, [
        dayBlock("2026/3/1(日)", "月綺 (0か月24日)", ["00:50   寝る"]),
        dayBlock("2026/3/2(月)", "月綺 (0か月25日)", ["01:00   寝る"]),
      ]);
      const result = parsePiyoLog(text);
      expect(result.events).toHaveLength(2);
      expect(result.events[0].date).toBe("2026-03-01");
      expect(result.events[1].date).toBe("2026-03-02");
    });
  });
});

describe(parseMultiplePiyoLogs, () => {
  it("複数テキストをパースする", () => {
    const text1 = singleDayLog(["00:50   寝る"]);
    const text2 = wrapLog(2026, 2, [
      dayBlock("2026/2/10(月)", "月綺 (0か月5日)", ["10:00   お風呂"]),
    ]);
    const results = parseMultiplePiyoLogs([text1, text2]);
    expect(results).toHaveLength(2);
    expect(results[0].month).toBe(3);
    expect(results[1].month).toBe(2);
  });
});

describe("実データ統合テスト", () => {
  it("3月データを正しくパースする", () => {
    const filePath = resolve(import.meta.dirname, "../src/data/テキスト-4A25-9D37-A7-0.txt");
    const text = readFileSync(filePath, "utf-8");
    const result = parsePiyoLog(text);

    expect(result.year).toBe(2026);
    expect(result.month).toBe(3);
    expect(result.events.length).toBeGreaterThan(100);
    expect(result.summaries.length).toBeGreaterThan(20);

    // 全イベントが有効な日付と時刻を持つ
    for (const event of result.events) {
      expect(event.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(event.time).toMatch(/^\d{2}:\d{2}$/);
    }

    // 全サマリーが有効な日付を持つ
    for (const summary of result.summaries) {
      expect(summary.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
