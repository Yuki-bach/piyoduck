import "./style.css"; // eslint-disable-line import/no-unassigned-import
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

// --- Stat / Chart 定義（renderView と updateView で共有） ---
interface StatDef {
  key: string;
  icon: string;
  label: string;
  format: (s: Stats) => readonly [value: string, unit: string, sub: string];
}

const statDefs: StatDef[] = [
  {
    key: "days",
    icon: "📅",
    label: "記録日数",
    format: (s) => [s.total_days, "日", ""],
  },
  {
    key: "sleep",
    icon: "😴",
    label: "睡眠",
    format: (s) => [
      s.avg_sleep_hours,
      `時間/日${sleepRangeText(s)}`,
      `計 ${s.total_sleep_hours}時間`,
    ],
  },
  {
    key: "bf",
    icon: "🤱",
    label: "授乳",
    format: (s) => [
      s.avg_bf_total_min,
      `分/日 (左${s.avg_bf_left_min} / 右${s.avg_bf_right_min})`,
      `計 ${s.total_bf_hours}時間 (${s.total_bf_min}分)`,
    ],
  },
  {
    key: "formula",
    icon: "🍼",
    label: "ミルク",
    format: (s) => [
      s.avg_formula_ml,
      "ml/日",
      `計 ${s.total_formula_liters}L (${s.total_formula_ml}ml)`,
    ],
  },
  {
    key: "pee",
    icon: "💧",
    label: "おしっこ",
    format: (s) => [s.avg_pee, "回/日", `計 ${s.total_pee}回`],
  },
  {
    key: "poop",
    icon: "💩",
    label: "うんち",
    format: (s) => [s.avg_poop, "回/日", `計 ${s.total_poop}回`],
  },
];

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

// --- Boot ---
async function main() {
  renderShell();

  document.querySelector(".main-area")!.innerHTML = `
    <div class="loading">
      <div class="loading-duck">🐤</div>
      <p>データを読み込み中...</p>
    </div>`;

  const conn = await initDB();
  await loadData(conn);
  const { periods, rangeLabel } = await getPeriods(conn);

  let selectedPeriod: Period = "all";

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

  function drawCharts(daily: DailyRow[]) {
    for (const c of chartDefs) {
      c.render(document.querySelector(`#${c.id}`) as HTMLCanvasElement, daily);
    }
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
          ${statDefs.map((d) => statCard(d.icon, d.label, d.key, ...d.format(stats))).join("")}
        </div>

        <div class="chart-grid">
          ${chartDefs
            .map(
              (c) => `
            <div class="chart-card">
              <h3>${c.title}</h3>
              <div class="chart-wrap"><canvas id="${c.id}"></canvas></div>
            </div>`,
            )
            .join("")}
        </div>
      </section>`;

    bindPeriodButtons();

    const daily = await getDailyData(conn, selectedPeriod);
    updateNotes(daily);
    drawCharts(daily);
  }

  // --- 期間切り替え時：DOM を使い回してデータだけ更新 ---
  async function updateView() {
    // ボタンの active 状態を更新
    document.querySelectorAll<HTMLButtonElement>(".period-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.period === selectedPeriod);
    });

    // ヘッダーラベルを更新
    document.querySelector("#period-label")!.textContent = periodLabel();

    // stats を取得してカード内テキストだけ差し替え
    const stats = await getStats(conn, selectedPeriod);
    for (const d of statDefs) {
      updateStatCard(d.key, ...d.format(stats));
    }

    // daily データ取得 → チャートをアニメーション付きで更新
    const daily = await getDailyData(conn, selectedPeriod);
    updateNotes(daily);
    drawCharts(daily);
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
