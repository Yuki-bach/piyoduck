/**
 * Chart.js を使ったチャート描画ユーティリティ
 */
import {
  Chart,
  LineController,
  BarController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import type { ChartOptions } from "chart.js";

Chart.register(
  LineController,
  BarController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
);

const activeCharts = new Map<string, Chart>();

/** 全チャートを破棄する */
export function destroyCharts() {
  for (const c of activeCharts.values()) c.destroy();
  activeCharts.clear();
}

function track(id: string, chart: Chart): Chart {
  activeCharts.set(id, chart);
  return chart;
}

/** 既存チャートがあればデータだけ差し替えて update()、なければ新規作成 */
function getChart(id: string): Chart | undefined {
  return activeCharts.get(id);
}

const COLORS = {
  sleep: "#6b7fde",
  sleepBg: "rgba(107, 127, 222, 0.15)",
  bfLeft: "#e8a87c",
  bfLeftBg: "rgba(232, 168, 124, 0.15)",
  bfRight: "#d4726a",
  bfRightBg: "rgba(212, 114, 106, 0.15)",
  formula: "#85c7b3",
  formulaBg: "rgba(133, 199, 179, 0.15)",
  pee: "#f6c957",
  peeBg: "rgba(246, 201, 87, 0.15)",
  poop: "#c49a6c",
  poopBg: "rgba(196, 154, 108, 0.15)",
};

const FONT = "'Zen Maru Gothic', sans-serif";

function scaleX(stacked = false) {
  return {
    ticks: { font: { family: FONT, size: 11 }, color: "#b0aab8", maxRotation: 45 },
    grid: { color: "rgba(0,0,0,0.04)" },
    title: { display: false },
    stacked,
  };
}

function scaleY(title: string, stacked = false) {
  return {
    ticks: { font: { family: FONT, size: 11 }, color: "#b0aab8" },
    grid: { color: "rgba(0,0,0,0.04)" },
    title: { display: true, text: title, font: { family: FONT, size: 12 }, color: "#8a8494" },
    stacked,
  };
}

function baseOptions(yTitle: string, stacked = false): ChartOptions {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          font: { family: FONT, size: 12 },
          color: "#8a8494",
          usePointStyle: true,
          pointStyleWidth: 8,
          boxHeight: 6,
        },
      },
      tooltip: {
        titleFont: { family: FONT },
        bodyFont: { family: FONT },
        backgroundColor: "rgba(40, 35, 50, 0.9)",
        cornerRadius: 8,
        padding: 10,
      },
    },
    scales: {
      x: scaleX(stacked),
      y: scaleY(yTitle, stacked),
    },
  };
}

export interface DailyRow {
  date: string;
  [key: string]: unknown;
}

export function renderSleepChart(canvas: HTMLCanvasElement, data: DailyRow[]) {
  const labels = data.map((d) => formatDateLabel(d.date));
  const values = data.map((d) => Number(d.sleep_hours));
  const existing = getChart("sleep");
  if (existing) {
    existing.data.labels = labels;
    existing.data.datasets[0].data = values;
    existing.update();
    return existing;
  }
  return track(
    "sleep",
    new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "睡眠 (時間)",
            data: values,
            borderColor: COLORS.sleep,
            backgroundColor: COLORS.sleepBg,
            fill: true,
            tension: 0.35,
            pointRadius: 2.5,
            pointHoverRadius: 5,
            borderWidth: 2,
          },
        ],
      },
      options: baseOptions("時間"),
    }),
  );
}

export function renderBreastfeedChart(canvas: HTMLCanvasElement, data: DailyRow[]) {
  const labels = data.map((d) => formatDateLabel(d.date));
  const left = data.map((d) => Number(d.breastfeed_left_min));
  const right = data.map((d) => Number(d.breastfeed_right_min));
  const existing = getChart("bf");
  if (existing) {
    existing.data.labels = labels;
    existing.data.datasets[0].data = left;
    existing.data.datasets[1].data = right;
    existing.update();
    return existing;
  }
  return track(
    "bf",
    new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "左 (分)",
            data: left,
            backgroundColor: COLORS.bfLeft,
            borderColor: COLORS.bfLeft,
            borderWidth: 1,
            borderRadius: 3,
          },
          {
            label: "右 (分)",
            data: right,
            backgroundColor: COLORS.bfRight,
            borderColor: COLORS.bfRight,
            borderWidth: 1,
            borderRadius: 3,
          },
        ],
      },
      options: baseOptions("分", true),
    }),
  );
}

export function renderFormulaChart(canvas: HTMLCanvasElement, data: DailyRow[]) {
  const labels = data.map((d) => formatDateLabel(d.date));
  const values = data.map((d) => Number(d.formula_ml));
  const existing = getChart("formula");
  if (existing) {
    existing.data.labels = labels;
    existing.data.datasets[0].data = values;
    existing.update();
    return existing;
  }
  return track(
    "formula",
    new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "ミルク (ml)",
            data: values,
            borderColor: COLORS.formula,
            backgroundColor: COLORS.formulaBg,
            fill: true,
            tension: 0.35,
            pointRadius: 2.5,
            pointHoverRadius: 5,
            borderWidth: 2,
          },
        ],
      },
      options: baseOptions("ml"),
    }),
  );
}

export function renderDiaperChart(canvas: HTMLCanvasElement, data: DailyRow[]) {
  const labels = data.map((d) => formatDateLabel(d.date));
  const pee = data.map((d) => Number(d.pee_count));
  const poop = data.map((d) => Number(d.poop_count));
  const existing = getChart("diaper");
  if (existing) {
    existing.data.labels = labels;
    existing.data.datasets[0].data = pee;
    existing.data.datasets[1].data = poop;
    existing.update();
    return existing;
  }
  return track(
    "diaper",
    new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "おしっこ",
            data: pee,
            backgroundColor: COLORS.pee,
            borderColor: COLORS.pee,
            borderWidth: 1,
            borderRadius: 3,
          },
          {
            label: "うんち",
            data: poop,
            backgroundColor: COLORS.poop,
            borderColor: COLORS.poop,
            borderWidth: 1,
            borderRadius: 3,
          },
        ],
      },
      options: baseOptions("回", true),
    }),
  );
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
