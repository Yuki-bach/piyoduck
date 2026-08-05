import "./style.css"; // eslint-disable-line import/no-unassigned-import
import { initDB, loadData } from "./lib";
import {
  getStats,
  getDailyData,
  getPeriods,
  getFeedingIntervals,
  getLongestSleepDurations,
  getChartAverages,
} from "./lib/analysis";
import type { Period } from "./lib/analysis";
import { renderStatCards, updateStatCards } from "./ui/stat-cards";
import { renderChartPanels, drawCharts } from "./ui/chart-panels";
import { updateNotes } from "./ui/notes";

// --- Boot ---
async function main() {
  renderShell();

  document.querySelector(".main-area")!.innerHTML = `
    <div class="loading" role="status" aria-live="polite">
      <div class="loading-duck" aria-hidden="true">🐤</div>
      <p>データを読み込み中...</p>
    </div>`;

  const conn = await initDB();
  await loadData(conn);
  const { periods, rangeLabel } = await getPeriods(conn);

  let selectedPeriod: Period = "all";

  function periodSelector(): string {
    const options = periods.map(
      (p) =>
        `<button type="button" class="period-btn${selectedPeriod === p.value ? " active" : ""}" data-period="${p.value}" aria-pressed="${selectedPeriod === p.value}">${p.label}</button>`,
    );
    return `<div class="period-selector" role="group" aria-label="表示期間">${options.join("")}</div>`;
  }

  function bindPeriodButtons() {
    document.querySelectorAll<HTMLButtonElement>(".period-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const period = btn.dataset.period! as Period;
        if (period === selectedPeriod) return;
        selectedPeriod = period;
        void updateView();
      });
    });
  }

  function periodLabel(): string {
    if (selectedPeriod === "all") return rangeLabel;
    const [year, month] = selectedPeriod.split("-");
    return `${year}年${Number.parseInt(month)}月`;
  }

  // --- 初回描画：DOM 骨格を構築 ---
  async function renderView() {
    const area = document.querySelector(".main-area")!;
    const stats = await getStats(conn, selectedPeriod);

    area.innerHTML = `
      <section class="view fade-in" aria-labelledby="period-label">
        <div class="view-header">
          <h2 id="period-label">${periodLabel()}</h2>
          ${periodSelector()}
        </div>
        <dl class="stat-grid">${renderStatCards(stats)}</dl>
        <div class="chart-grid">${renderChartPanels()}</div>
      </section>`;

    bindPeriodButtons();

    const [daily, feedingIntervals, longestSleep, averages] = await Promise.all([
      getDailyData(conn, selectedPeriod),
      getFeedingIntervals(conn, selectedPeriod),
      getLongestSleepDurations(conn, selectedPeriod),
      getChartAverages(conn, selectedPeriod),
    ]);
    updateNotes(daily);
    drawCharts({ daily, feedingIntervals, longestSleep, averages });
  }

  // --- 期間切り替え時：DOM を使い回してデータだけ更新 ---
  async function updateView() {
    document.querySelectorAll<HTMLButtonElement>(".period-btn").forEach((btn) => {
      const isSelected = btn.dataset.period === selectedPeriod;
      btn.classList.toggle("active", isSelected);
      btn.setAttribute("aria-pressed", String(isSelected));
    });
    document.querySelector("#period-label")!.textContent = periodLabel();

    const stats = await getStats(conn, selectedPeriod);
    updateStatCards(stats);

    const [daily, feedingIntervals, longestSleep, averages] = await Promise.all([
      getDailyData(conn, selectedPeriod),
      getFeedingIntervals(conn, selectedPeriod),
      getLongestSleepDurations(conn, selectedPeriod),
      getChartAverages(conn, selectedPeriod),
    ]);
    updateNotes(daily);
    drawCharts({ daily, feedingIntervals, longestSleep, averages });
    document.querySelector("#view-status")!.textContent = `${periodLabel()}のデータを表示しました`;
  }

  await renderView();
}

// --- Shell ---
function renderShell() {
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
    <header class="app-header">
      <div class="header-inner">
        <h1 class="logo"><span class="logo-icon" aria-hidden="true">🐤</span> piyoduck</h1>
      </div>
    </header>
    <main class="main-area"></main>
    <p id="view-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p>
  `;
}

void main();
