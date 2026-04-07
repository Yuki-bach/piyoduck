/**
 * src/data/ からぴよログファイルを読み込む
 * manifest.json 不要 — .txt を自動検出
 */

const modules = import.meta.glob("/src/data/*.txt", { query: "?raw", import: "default" });

export async function readTexts(): Promise<string[]> {
  const entries = Object.values(modules);
  const texts = await Promise.all(entries.map((load) => load() as Promise<string>));
  return texts;
}
