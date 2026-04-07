/**
 * ぴよログのテキストデータをパースするモジュール
 */

export interface LogEvent {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  eventType: EventType;
  durationMinutes: number | null;
  side: string | null; // 左, 右, 左→右, 左←右 etc.
  amountMl: number | null;
  feedMinutes: number | null;
  weightKg: number | null;
  note: string | null;
  babyAgeMonths: number | null;
  babyAgeDays: number | null;
}

export type EventType =
  | "sleep"
  | "wake"
  | "breastfeed"
  | "formula"
  | "poop"
  | "pee"
  | "bath"
  | "weight";

export interface DailySummary {
  date: string;
  breastfeedLeftMin: number;
  breastfeedRightMin: number;
  formulaCount: number;
  formulaMl: number;
  sleepHours: number;
  sleepMinutes: number;
  peeCount: number;
  poopCount: number;
  note: string | null;
}

export interface LogFile {
  /** ファイル内のヘッダーから取得した年月 (例: "2026年3月") */
  label: string;
  year: number;
  month: number;
  events: LogEvent[];
  summaries: DailySummary[];
}

/**
 * 複数ファイルのテキストをまとめてパースする
 */
export function parseLogs(texts: string[]): LogFile[] {
  return texts.map((t) => parseLog(t));
}

/**
 * ぴよログのテキスト全体をパースしてイベントと日次サマリーを返す
 */
export function parseLog(text: string): LogFile {
  const events: LogEvent[] = [];
  const summaries: DailySummary[] = [];

  // ヘッダーから年月を取得: 【ぴよログ】2026年3月
  const headerMatch = text.match(/【ぴよログ】(\d{4})年(\d{1,2})月/);
  const headerYear = headerMatch ? Number.parseInt(headerMatch[1]) : 0;
  const headerMonth = headerMatch ? Number.parseInt(headerMatch[2]) : 0;
  const label = headerMatch ? `${headerYear}年${headerMonth}月` : "不明";

  const dayBlocks = text.split(/^----------$/m);

  for (const block of dayBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const dateMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\(.\)/m);
    if (!dateMatch) continue;

    const year = dateMatch[1];
    const month = dateMatch[2].padStart(2, "0");
    const day = dateMatch[3].padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    const ageMatch = trimmed.match(/(\d+)か月(\d+)日/);
    const ageMonths = ageMatch ? Number.parseInt(ageMatch[1]) : null;
    const ageDays = ageMatch ? Number.parseInt(ageMatch[2]) : null;

    const lines = trimmed.split("\n");

    // 日次サマリーをパース
    const summary = parseDailySummary(dateStr, lines);
    if (summary) summaries.push(summary);

    // イベント行をパース
    for (const line of lines) {
      const eventMatch = line.match(/^(\d{2}:\d{2})\s+(.+)/);
      if (!eventMatch) continue;

      const time = eventMatch[1];
      const content = eventMatch[2].trim();

      const parsed = parseEventContent(content);
      if (!parsed) continue;

      events.push({
        date: dateStr,
        time,
        babyAgeMonths: ageMonths,
        babyAgeDays: ageDays,
        ...parsed,
      });
    }
  }

  return { label, year: headerYear, month: headerMonth, events, summaries };
}

function parseEventContent(
  content: string,
): Omit<LogEvent, "date" | "time" | "babyAgeMonths" | "babyAgeDays"> | null {
  // 寝る
  if (content.startsWith("寝る")) {
    return {
      eventType: "sleep",
      durationMinutes: null,
      side: null,
      amountMl: null,
      feedMinutes: null,
      weightKg: null,
      note: extractNote(content, "寝る"),
    };
  }

  // 起きる
  if (content.startsWith("起きる")) {
    const durMatch = content.match(/\((\d+)時間(\d+)分\)/);
    const duration = durMatch
      ? Number.parseInt(durMatch[1]) * 60 + Number.parseInt(durMatch[2])
      : null;
    return {
      eventType: "wake",
      durationMinutes: duration,
      side: null,
      amountMl: null,
      feedMinutes: null,
      weightKg: null,
      note: extractNote(content, /起きる\s*\(\d+時間\d+分\)\s*/),
    };
  }

  // 母乳
  if (content.startsWith("母乳")) {
    return parseBreastfeed(content);
  }

  // ミルク
  if (content.startsWith("ミルク")) {
    const mlMatch = content.match(/(\d+)ml/);
    return {
      eventType: "formula",
      durationMinutes: null,
      side: null,
      amountMl: mlMatch ? Number.parseInt(mlMatch[1]) : null,
      feedMinutes: null,
      weightKg: null,
      note: extractNote(content, /ミルク\s*\d+ml\s*/),
    };
  }

  // うんち
  if (content.startsWith("うんち")) {
    const noteMatch = content.match(/うんち\s*(.*)/);
    const note = noteMatch?.[1]?.trim() || null;
    return {
      eventType: "poop",
      durationMinutes: null,
      side: null,
      amountMl: null,
      feedMinutes: null,
      weightKg: null,
      note: note || null,
    };
  }

  // おしっこ
  if (content.startsWith("おしっこ")) {
    return {
      eventType: "pee",
      durationMinutes: null,
      side: null,
      amountMl: null,
      feedMinutes: null,
      weightKg: null,
      note: null,
    };
  }

  // お風呂
  if (content.startsWith("お風呂")) {
    return {
      eventType: "bath",
      durationMinutes: null,
      side: null,
      amountMl: null,
      feedMinutes: null,
      weightKg: null,
      note: null,
    };
  }

  // 体重
  if (content.startsWith("体重")) {
    const weightMatch = content.match(/([\d.]+)kg/);
    return {
      eventType: "weight",
      durationMinutes: null,
      side: null,
      amountMl: null,
      feedMinutes: null,
      weightKg: weightMatch ? Number.parseFloat(weightMatch[1]) : null,
      note: null,
    };
  }

  return null;
}

function parseBreastfeed(
  content: string,
): Omit<LogEvent, "date" | "time" | "babyAgeMonths" | "babyAgeDays"> {
  // 「母乳 母乳 (60ml)」のような搾乳パターン
  const expressedMatch = content.match(/^母乳\s+母乳\s*\((\d+)ml\)/);
  if (expressedMatch) {
    return {
      eventType: "breastfeed",
      durationMinutes: null,
      side: "搾乳",
      amountMl: Number.parseInt(expressedMatch[1]),
      feedMinutes: null,
      weightKg: null,
      note: extractNote(content, /母乳\s+母乳\s*\(\d+ml\)\s*/),
    };
  }

  // 両方のパターン: 「左 15分 ← 右 9分 (60ml)」「左 6分 → 右 2分」
  const bothMatch = content.match(/母乳\s+(左|右)\s*(\d+)分\s*[←→]\s*(左|右)\s*(\d+)分/);
  if (bothMatch) {
    const firstSide = bothMatch[1];
    const firstMin = Number.parseInt(bothMatch[2]);
    const secondSide = bothMatch[3];
    const secondMin = Number.parseInt(bothMatch[4]);
    const totalMin = firstMin + secondMin;
    const mlMatch = content.match(/\((\d+)ml\)/);
    const side = `${firstSide}${content.includes("→") ? "→" : "←"}${secondSide}`;

    return {
      eventType: "breastfeed",
      durationMinutes: null,
      side,
      amountMl: mlMatch ? Number.parseInt(mlMatch[1]) : null,
      feedMinutes: totalMin,
      weightKg: null,
      note: extractNote(
        content,
        /母乳\s+(左|右)\s*\d+分\s*[←→]\s*(左|右)\s*\d+分\s*(\(\d+ml\))?\s*\d*\s*/,
      ),
    };
  }

  // 片方のみ: 「左 12分」「右 11分」
  const singleMatch = content.match(/母乳\s+(左|右)\s*(\d+)分/);
  if (singleMatch) {
    const mlMatch = content.match(/\((\d+)ml\)/);
    return {
      eventType: "breastfeed",
      durationMinutes: null,
      side: singleMatch[1],
      amountMl: mlMatch ? Number.parseInt(mlMatch[1]) : null,
      feedMinutes: Number.parseInt(singleMatch[2]),
      weightKg: null,
      note: extractNote(content, /母乳\s+(左|右)\s*\d+分\s*(\(\d+ml\))?\s*\d*\s*/),
    };
  }

  // フォールバック
  return {
    eventType: "breastfeed",
    durationMinutes: null,
    side: null,
    amountMl: null,
    feedMinutes: null,
    weightKg: null,
    note: content,
  };
}

function extractNote(content: string, prefix: string | RegExp): string | null {
  const rest =
    typeof prefix === "string"
      ? content.slice(prefix.length).trim()
      : content.replace(prefix, "").trim();
  return rest || null;
}

function parseDailySummary(date: string, lines: string[]): DailySummary | null {
  let breastfeedLeftMin = 0;
  let breastfeedRightMin = 0;
  let formulaCount = 0;
  let formulaMl = 0;
  let sleepHours = 0;
  let sleepMinutes = 0;
  let peeCount = 0;
  let poopCount = 0;
  let hasSummary = false;
  const noteLines: string[] = [];
  let afterSummary = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // 母乳合計
    const bfMatch = trimmed.match(/母乳合計\s+左\s*(\d+)分\s*\/\s*右\s*(\d+)分/);
    if (bfMatch) {
      breastfeedLeftMin = Number.parseInt(bfMatch[1]);
      breastfeedRightMin = Number.parseInt(bfMatch[2]);
      hasSummary = true;
      afterSummary = true;
      continue;
    }

    // ミルク合計
    const fmMatch = trimmed.match(/ミルク合計\s+(\d+)回\s*(\d+)ml/);
    if (fmMatch) {
      formulaCount = Number.parseInt(fmMatch[1]);
      formulaMl = Number.parseInt(fmMatch[2]);
      afterSummary = true;
      continue;
    }

    // 睡眠合計
    const slMatch = trimmed.match(/睡眠合計\s+(\d+)時間(\d+)分/);
    if (slMatch) {
      sleepHours = Number.parseInt(slMatch[1]);
      sleepMinutes = Number.parseInt(slMatch[2]);
      afterSummary = true;
      continue;
    }

    // おしっこ合計
    const peeMatch = trimmed.match(/おしっこ合計\s+(\d+)回/);
    if (peeMatch) {
      peeCount = Number.parseInt(peeMatch[1]);
      afterSummary = true;
      continue;
    }

    // うんち合計
    const poopMatch = trimmed.match(/うんち合計\s+(\d+)回/);
    if (poopMatch) {
      poopCount = Number.parseInt(poopMatch[1]);
      afterSummary = true;
      continue;
    }

    // サマリーの後の行はメモとして扱う
    if (afterSummary && trimmed && !trimmed.startsWith("---")) {
      noteLines.push(trimmed);
    }
  }

  if (!hasSummary) return null;

  return {
    date,
    breastfeedLeftMin,
    breastfeedRightMin,
    formulaCount,
    formulaMl,
    sleepHours,
    sleepMinutes,
    peeCount,
    poopCount,
    note: noteLines.length > 0 ? noteLines.join("\n") : null,
  };
}
