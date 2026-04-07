/**
 * チャートパネル（睡眠・授乳・ミルク・おむつ）の描画
 */
import {
  renderSleepChart,
  renderBreastfeedChart,
  renderFormulaChart,
  renderDiaperChart,
} from "../lib/charts";
import type { DailyRow } from "../lib/charts";

interface ChartDef {
  id: string;
  title: string;
  render: (canvas: HTMLCanvasElement, data: DailyRow[]) => void;
}

const chartDefs: ChartDef[] = [
  { id: "chart-sleep", title: "睡眠時間の推移", render: renderSleepChart },
  { id: "chart-bf", title: "授乳時間の推移（左右内訳）", render: renderBreastfeedChart },
  { id: "chart-formula", title: "ミルク量の推移", render: renderFormulaChart },
  { id: "chart-diaper", title: "おむつの推移", render: renderDiaperChart },
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
export function drawCharts(daily: DailyRow[]): void {
  for (const c of chartDefs) {
    c.render(document.querySelector(`#${c.id}`) as HTMLCanvasElement, daily);
  }
}
