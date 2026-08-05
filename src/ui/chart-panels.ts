/**
 * チャートパネル（睡眠・授乳・ミルク・おむつ・授乳間隔・最長連続睡眠）の描画
 */
import {
  renderSleepChart,
  renderBreastfeedChart,
  renderFormulaChart,
  renderDiaperChart,
  renderFeedingIntervalChart,
  renderLongestSleepChart,
} from "../lib/charts";
import type { DailyRow } from "../lib/charts";
import type { ChartAverages, FeedingIntervalRow, LongestSleepRow } from "../lib/analysis";

export interface ChartData {
  daily: DailyRow[];
  feedingIntervals: FeedingIntervalRow[];
  longestSleep: LongestSleepRow[];
  averages: ChartAverages;
}

interface ChartDef {
  id: string;
  title: string;
  render: (canvas: HTMLCanvasElement, data: ChartData) => void;
  summary: (data: ChartData) => string;
}

const chartDefs: ChartDef[] = [
  {
    id: "chart-sleep",
    title: "睡眠時間の推移",
    render: (c, d) => renderSleepChart(c, d.daily, d.averages.sleep_hours),
    summary: (d) =>
      `${d.daily.length}日分の睡眠時間。平均${d.averages.sleep_hours.toFixed(1)}時間です。`,
  },
  {
    id: "chart-longest-sleep",
    title: "最長連続睡眠の推移",
    render: (c, d) => renderLongestSleepChart(c, d.longestSleep, d.averages.longest_sleep_hours),
    summary: (d) =>
      `${d.longestSleep.length}日分の最長連続睡眠。平均${d.averages.longest_sleep_hours.toFixed(1)}時間です。`,
  },
  {
    id: "chart-bf",
    title: "授乳時間の推移（左右内訳）",
    render: (c, d) => renderBreastfeedChart(c, d.daily, d.averages.bf_total_min),
    summary: (d) =>
      `${d.daily.length}日分の授乳時間。左右合計の平均は${Math.round(d.averages.bf_total_min)}分です。`,
  },
  {
    id: "chart-formula",
    title: "ミルク量の推移",
    render: (c, d) => renderFormulaChart(c, d.daily, d.averages.formula_ml),
    summary: (d) =>
      `${d.daily.length}日分のミルク量。平均${Math.round(d.averages.formula_ml)}mlです。`,
  },
  {
    id: "chart-feed-interval",
    title: "授乳間隔の推移",
    render: (c, d) =>
      renderFeedingIntervalChart(c, d.feedingIntervals, d.averages.feed_interval_hours),
    summary: (d) =>
      `${d.feedingIntervals.length}日分の授乳間隔。平均${d.averages.feed_interval_hours.toFixed(1)}時間です。`,
  },
  {
    id: "chart-diaper",
    title: "おむつの推移",
    render: (c, d) => renderDiaperChart(c, d.daily, d.averages.diaper_total_count),
    summary: (d) =>
      `${d.daily.length}日分のおむつ記録。おしっことうんちの合計は1日平均${d.averages.diaper_total_count.toFixed(1)}回です。`,
  },
];

/** 空の canvas を含むチャートパネル群の HTML を組み立てる */
export function renderChartPanels(): string {
  return chartDefs
    .map(
      (c) => `
      <figure class="chart-card">
        <figcaption><h3 id="${c.id}-title">${c.title}</h3></figcaption>
        <div class="chart-wrap">
          <canvas id="${c.id}" role="img" aria-labelledby="${c.id}-title" aria-describedby="${c.id}-summary"></canvas>
        </div>
        <p id="${c.id}-summary" class="sr-only"></p>
      </figure>`,
    )
    .join("");
}

/** 各 canvas にデータを描画する */
export function drawCharts(data: ChartData): void {
  for (const c of chartDefs) {
    c.render(document.querySelector(`#${c.id}`) as HTMLCanvasElement, data);
    document.querySelector(`#${c.id}-summary`)!.textContent = c.summary(data);
  }
}
