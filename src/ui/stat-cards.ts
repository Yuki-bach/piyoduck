/**
 * 統計カード（記録日数・睡眠・授乳・ミルク・おしっこ・うんち）の描画
 */
import type { Stats } from "../lib/analysis";

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

function sleepRangeText(stats: Stats): string {
  return stats.min_sleep_hours !== stats.max_sleep_hours
    ? ` (${stats.min_sleep_hours}〜${stats.max_sleep_hours})`
    : "";
}

function statCard(
  icon: string,
  label: string,
  key: string,
  value: string,
  unit: string,
  sub: string,
): string {
  const subHtml = sub ? `<dd class="stat-sub">${sub}</dd>` : "";
  return `
    <div class="stat-card" data-stat="${key}">
      <dt class="stat-label">${label}</dt>
      <dd class="stat-main">
        <span class="stat-icon" aria-hidden="true">${icon}</span>
        <span class="stat-value">${value}<span class="stat-unit">${unit}</span></span>
      </dd>
      ${subHtml}
    </div>`;
}

/** stat カード群の HTML を組み立てる */
export function renderStatCards(stats: Stats): string {
  return statDefs.map((d) => statCard(d.icon, d.label, d.key, ...d.format(stats))).join("");
}

/** 既存 DOM の stat カード群のテキストだけ差し替える */
export function updateStatCards(stats: Stats): void {
  for (const d of statDefs) {
    updateStatCard(d.key, ...d.format(stats));
  }
}

function updateStatCard(key: string, value: string, unit: string, sub: string) {
  const card = document.querySelector(`[data-stat="${key}"]`);
  if (!card) return;
  card.querySelector(".stat-value")!.innerHTML = `${value}<span class="stat-unit">${unit}</span>`;
  const subEl = card.querySelector(".stat-sub");
  if (subEl) subEl.textContent = sub;
}
