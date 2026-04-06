import "./style.css"; // eslint-disable-line import/no-unassigned-import
import { loadAllPiyoTexts } from "./lib/loader";
import { initPiyoAnalysis } from "./lib";
import type { PiyoLogFile } from "./lib";
import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import { getStats, getDailyData } from "./lib/analysis";
import type { Period } from "./lib/analysis";
import {
  renderSleepChart,
  renderBreastfeedChart,
  renderFormulaChart,
  renderDiaperChart,
  destroyCharts,
} from "./lib/charts";
import type { DailyRow } from "./lib/charts";

// --- State ---
let conn: AsyncDuckDBConnection;
let files: PiyoLogFile[] = [];
let selectedPeriod: Period = "all";

// --- Boot ---
async function main() {
  renderShell();

  document.querySelector(".main-area")!.innerHTML = `
    <div class="loading">
      <div class="loading-duck">🐤</div>
      <p>データを読み込み中...</p>
    </div>`;

  const texts = await loadAllPiyoTexts();
  const result = await initPiyoAnalysis(texts);
  conn = result.conn;
  files = result.files;

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

// --- Build period selector HTML ---
function periodSelector(): string {
  const options = [
    `<button class="period-btn${selectedPeriod === "all" ? " active" : ""}" data-period="all">全期間</button>`,
    ...files.map((f) => {
      const val = `${f.year}-${String(f.month).padStart(2, "0")}`;
      return `<button class="period-btn${selectedPeriod === val ? " active" : ""}" data-period="${val}">${f.month}月</button>`;
    }),
  ];
  return `<div class="period-selector">${options.join("")}</div>`;
}

function bindPeriodButtons() {
  document.querySelectorAll<HTMLButtonElement>(".period-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const period = btn.dataset.period! as Period;
      if (period === selectedPeriod) return;
      selectedPeriod = period;
      void renderView();
    });
  });
}

function periodLabel(): string {
  if (selectedPeriod === "all") {
    const first = files[0]?.label;
    const last = files[files.length - 1]?.label;
    return first === last || !last ? (first ?? "") : `${first}-${last}`;
  }
  const [year, month] = selectedPeriod.split("-");
  return `${year}年${Number.parseInt(month)}月`;
}

// --- Render ---
async function renderView() {
  destroyCharts();
  const area = document.querySelector(".main-area")!;

  // 1) stats を先に取得して描画（LCP / Speed Index 改善）
  const stats = await getStats(conn, selectedPeriod);

  const sleepRange =
    stats.min_sleep_hours !== stats.max_sleep_hours
      ? ` (${stats.min_sleep_hours}〜${stats.max_sleep_hours})`
      : "";

  area.innerHTML = `
    <section class="view fade-in">
      <div class="view-header">
        <h2>${periodLabel()}</h2>
        ${periodSelector()}
      </div>

      <div class="stat-grid">
        ${statCard("📅", "記録日数", stats.total_days, "日", "")}
        ${statCard("😴", "睡眠", stats.avg_sleep_hours, `時間/日${sleepRange}`, `計 ${stats.total_sleep_hours}時間`)}
        ${statCard("🤱", "授乳", stats.avg_bf_total_min, `分/日 (左${stats.avg_bf_left_min} / 右${stats.avg_bf_right_min})`, `計 ${stats.total_bf_hours}時間 (${stats.total_bf_min}分)`)}
        ${statCard("🍼", "ミルク", stats.avg_formula_ml, "ml/日", `計 ${stats.total_formula_liters}L (${stats.total_formula_ml}ml)`)}
        ${statCard("💧", "おしっこ", stats.avg_pee, "回/日", `計 ${stats.total_pee}回`)}
        ${statCard("💩", "うんち", stats.avg_poop, "回/日", `計 ${stats.total_poop}回`)}
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

  // 2) daily データ取得 → チャート描画（await の間にブラウザが stat-cards を描画できる）
  const daily = await getDailyData(conn, selectedPeriod);

  // notes をチャートの後に追加
  const noteHtml = renderNotesList(daily);
  if (noteHtml) {
    document.querySelector(".view")!.insertAdjacentHTML("beforeend", noteHtml);
  }

  renderSleepChart(document.querySelector("#chart-sleep") as HTMLCanvasElement, daily);
  renderBreastfeedChart(document.querySelector("#chart-bf") as HTMLCanvasElement, daily);
  renderFormulaChart(document.querySelector("#chart-formula") as HTMLCanvasElement, daily);
  renderDiaperChart(document.querySelector("#chart-diaper") as HTMLCanvasElement, daily);
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
function statCard(icon: string, label: string, value: string, unit: string, sub: string): string {
  const subHtml = sub ? `<div class="stat-sub">${sub}</div>` : "";
  return `
    <div class="stat-card">
      <div class="stat-icon">${icon}</div>
      <div class="stat-body">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${value}<span class="stat-unit">${unit}</span></div>
        ${subHtml}
      </div>
    </div>`;
}

void main();
