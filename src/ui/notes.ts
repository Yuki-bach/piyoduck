/**
 * メモ一覧の描画
 */
import type { DailyRow } from "../lib/charts";

/** 既存のメモカードを差し替える（ノートが無い日が選択されたら削除のみ） */
export function updateNotes(daily: DailyRow[]): void {
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
