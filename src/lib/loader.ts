/**
 * src/data/ からぴよログファイルを読み込む
 * manifest.json 不要 — .txt を自動検出
 */

const urls = import.meta.glob("/src/data/*.txt", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;

export async function readTexts(): Promise<string[]> {
  return Promise.all(
    Object.values(urls).map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
      return res.text();
    }),
  );
}
