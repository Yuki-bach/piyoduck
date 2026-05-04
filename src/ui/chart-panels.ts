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
}

const chartDefs: ChartDef[] = [
  {
    id: "chart-sleep",
    title: "睡眠時間の推移",
    render: (c, d) => renderSleepChart(c, d.daily, d.averages.sleep_hours),
  },
  {
    id: "chart-longest-sleep",
    title: "最長連続睡眠の推移",
    render: (c, d) => renderLongestSleepChart(c, d.longestSleep, d.averages.longest_sleep_hours),
  },
  {
    id: "chart-bf",
    title: "授乳時間の推移（左右内訳）",
    render: (c, d) => renderBreastfeedChart(c, d.daily, d.averages.bf_total_min),
  },
  {
    id: "chart-formula",
    title: "ミルク量の推移",
    render: (c, d) => renderFormulaChart(c, d.daily, d.averages.formula_ml),
  },
  {
    id: "chart-feed-interval",
    title: "授乳間隔の推移",
    render: (c, d) =>
      renderFeedingIntervalChart(c, d.feedingIntervals, d.averages.feed_interval_hours),
  },
  {
    id: "chart-diaper",
    title: "おむつの推移",
    render: (c, d) => renderDiaperChart(c, d.daily, d.averages.diaper_total_count),
  },
];

/** 空の canvas を含むチャートパネル群の HTML を組み立てる */
export function renderChartPanels(): string {
  return chartDefs
    .map(
      (c) => `
      <div class="chart-card">
        <h3>${c.title}</h3>
        <div class="chart-wrap"><canvas id="${c.id}"></canvas></div>
      </div>`,
    )
    .join("");
}

/** 各 canvas にデータを描画する */
export function drawCharts(data: ChartData): void {
  for (const c of chartDefs) {
    c.render(document.querySelector(`#${c.id}`) as HTMLCanvasElement, data);
  }
}
