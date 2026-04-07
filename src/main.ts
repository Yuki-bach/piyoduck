import "./style.css"; // eslint-disable-line import/no-unassigned-import
import { loadAllPiyoTexts } from "./lib/loader";
import { initDB, loadData } from "./lib";
import { getStats, getDailyData, getPeriods } from "./lib/analysis";
import type { Period, Stats } from "./lib/analysis";
import {
  renderSleepChart,
  renderBreastfeedChart,
  renderFormulaChart,
  renderDiaperChart,
} from "./lib/charts";
import type { DailyRow } from "./lib/charts";

// --- Boot ---
async function main() {
  renderShell();

  document.querySelector(".main-area")!.innerHTML = `
    <div class="loading">
      <div class="loading-duck">🐤</div>
      <p>データを読み込み中...</p>
    </div>`;

  const [texts, conn] = await Promise.all([loadAllPiyoTexts(), initDB()]);
  await loadData(conn, texts);
  const { periods, rangeLabel } = await getPeriods(conn);

  let selectedPeriod: Period = "all";
  let viewInitialized = false;

  // --- Build period selector HTML ---
  function periodSelector(): string {
    const options = periods.map(
      (p) =>
        `<button class="period-btn${selectedPeriod === p.value ? " active" : ""}" data-period="${p.value}">${p.label}</button>`,
    );
    return `<div class="period-selector">${options.join("")}</div>`;
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
      <section class="view fade-in">
        <div class="view-header">
          <h2 id="period-label">${periodLabel()}</h2>
          ${periodSelector()}
        </div>

        <div class="stat-grid">
          ${statCard("📅", "記録日数", "days", stats.total_days, "日", "")}
          ${statCard("😴", "睡眠", "sleep", stats.avg_sleep_hours, `時間/日${sleepRangeText(stats)}`, `計 ${stats.total_sleep_hours}時間`)}
          ${statCard("🤱", "授乳", "bf", stats.avg_bf_total_min, `分/日 (左${stats.avg_bf_left_min} / 右${stats.avg_bf_right_min})`, `計 ${stats.total_bf_hours}時間 (${stats.total_bf_min}分)`)}
          ${statCard("🍼", "ミルク", "formula", stats.avg_formula_ml, "ml/日", `計 ${stats.total_formula_liters}L (${stats.total_formula_ml}ml)`)}
          ${statCard("💧", "おしっこ", "pee", stats.avg_pee, "回/日", `計 ${stats.total_pee}回`)}
          ${statCard("💩", "うんち", "poop", stats.avg_poop, "回/日", `計 ${stats.total_poop}回`)}
        </div>

        <div class="chart-grid">
          <div class="chart-card">
            <h3>睡眠時間の推移</h3>
            <div class="chart-wrap"><canvas id="chart-sleep"></canvas></div>
          </div>
          <div class="chart-card">
            <h3>授乳時間の推移（左右内訳）</h3>
            <div class="chart-wrap"><canvas id="chart-bf"></canvas></div>
          </div>
          <div class="chart-card">
            <h3>ミルク量の推移</h3>
            <div class="chart-wrap"><canvas id="chart-formula"></canvas></div>
          </div>
          <div class="chart-card">
            <h3>おむつの推移</h3>
            <div class="chart-wrap"><canvas id="chart-diaper"></canvas></div>
          </div>
        </div>
      </section>`;

    bindPeriodButtons();
    viewInitialized = true;

    const daily = await getDailyData(conn, selectedPeriod);
    updateNotes(daily);

    renderSleepChart(document.querySelector("#chart-sleep") as HTMLCanvasElement, daily);
    renderBreastfeedChart(document.querySelector("#chart-bf") as HTMLCanvasElement, daily);
    renderFormulaChart(document.querySelector("#chart-formula") as HTMLCanvasElement, daily);
    renderDiaperChart(document.querySelector("#chart-diaper") as HTMLCanvasElement, daily);
  }

  // --- 期間切り替え時：DOM を使い回してデータだけ更新 ---
  async function updateView() {
    if (!viewInitialized) {
      await renderView();
      return;
    }

    // ボタンの active 状態を更新
    document.querySelectorAll<HTMLButtonElement>(".period-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.period === selectedPeriod);
    });

    // ヘッダーラベルを更新
    document.querySelector("#period-label")!.textContent = periodLabel();

    // stats を取得してカード内テキストだけ差し替え
    const stats = await getStats(conn, selectedPeriod);
    updateStatCard("days", stats.total_days, "日", "");
    updateStatCard(
      "sleep",
      stats.avg_sleep_hours,
      `時間/日${sleepRangeText(stats)}`,
      `計 ${stats.total_sleep_hours}時間`,
    );
    updateStatCard(
      "bf",
      stats.avg_bf_total_min,
      `分/日 (左${stats.avg_bf_left_min} / 右${stats.avg_bf_right_min})`,
      `計 ${stats.total_bf_hours}時間 (${stats.total_bf_min}分)`,
    );
    updateStatCard(
      "formula",
      stats.avg_formula_ml,
      "ml/日",
      `計 ${stats.total_formula_liters}L (${stats.total_formula_ml}ml)`,
    );
    updateStatCard("pee", stats.avg_pee, "回/日", `計 ${stats.total_pee}回`);
    updateStatCard("poop", stats.avg_poop, "回/日", `計 ${stats.total_poop}回`);

    // daily データ取得 → チャートをアニメーション付きで更新
    const daily = await getDailyData(conn, selectedPeriod);
    updateNotes(daily);

    renderSleepChart(document.querySelector("#chart-sleep") as HTMLCanvasElement, daily);
    renderBreastfeedChart(document.querySelector("#chart-bf") as HTMLCanvasElement, daily);
    renderFormulaChart(document.querySelector("#chart-formula") as HTMLCanvasElement, daily);
    renderDiaperChart(document.querySelector("#chart-diaper") as HTMLCanvasElement, daily);
  }

  await renderView();
}

// --- Shell ---
function renderShell() {
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
    <header class="app-header">
      <div class="header-inner">
        <h1 class="logo"><span class="logo-icon">🐤</span> piyoduck</h1>
      </div>
    </header>
    <main class="main-area"></main>
  `;
}

function sleepRangeText(stats: Stats): string {
  return stats.min_sleep_hours !== stats.max_sleep_hours
    ? ` (${stats.min_sleep_hours}〜${stats.max_sleep_hours})`
    : "";
}

function updateStatCard(key: string, value: string, unit: string, sub: string) {
  const card = document.querySelector(`[data-stat="${key}"]`);
  if (!card) return;
  card.querySelector(".stat-value")!.innerHTML = `${value}<span class="stat-unit">${unit}</span>`;
  const subEl = card.querySelector(".stat-sub");
  if (subEl) subEl.textContent = sub;
}

function updateNotes(daily: DailyRow[]) {
  document.querySelector(".notes-card")?.remove();
  const noteHtml = renderNotesList(daily);
  if (noteHtml) {
    document.querySelector(".view")!.insertAdjacentHTML("beforeend", noteHtml);
  }
}

function renderNotesList(daily: DailyRow[]): string {
  const notes = daily.filter((d) => d.note);
  if (notes.length === 0) return "";

  const items = notes
    .map((d) => {
      const dt = new Date(d.date);
      return `<li><span class="note-date">${dt.getMonth() + 1}/${dt.getDate()}</span><span class="note-text">${String(d.note)}</span></li>`;
    })
    .join("");

  return `
    <div class="notes-card">
      <h3>📝 メモ</h3>
      <ul class="notes-list">${items}</ul>
    </div>`;
}

// --- Helpers ---
function statCard(
  icon: string,
  label: string,
  key: string,
  value: string,
  unit: string,
  sub: string,
): string {
  const subHtml = sub ? `<div class="stat-sub">${sub}</div>` : "";
  return `
    <div class="stat-card" data-stat="${key}">
      <div class="stat-icon">${icon}</div>
      <div class="stat-body">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${value}<span class="stat-unit">${unit}</span></div>
        ${subHtml}
      </div>
    </div>`;
}

void main();
