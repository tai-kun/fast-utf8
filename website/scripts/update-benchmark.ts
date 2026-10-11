import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 計測環境の一覧です。
 */
const ENVIRONMENTS = ["node", "chromium", "firefox", "webkit"] as const;

/**
 * 計測環境です。
 */
type Environment = (typeof ENVIRONMENTS)[number];

/**
 * 環境ごとの見出し情報です。
 */
const ENVIRONMENT_HEADINGS: Record<Environment, { anchor: string; label: string }> = {
  node: { anchor: "nodejs", label: "Node.js" },
  chromium: { anchor: "chromium", label: "Chromium" },
  firefox: { anchor: "firefox", label: "Firefox" },
  webkit: { anchor: "webkit", label: "WebKit" },
};

/**
 * ベンチマーク 1 件分の結果です。
 */
interface BenchmarkEntry {
  readonly name: string;
  readonly hz: number;
  readonly mean: number;
}

/**
 * 同じ `describe` でまとめられた結果です。
 */
interface BenchmarkGroup {
  readonly title: string;
  readonly entries: BenchmarkEntry[];
}

/**
 * 1 環境分の計測結果です。
 */
interface BenchmarkReport {
  readonly groups: BenchmarkGroup[];
}

/**
 * サイトのルートディレクトリーです。
 */
const websiteRoot = resolve(import.meta.dirname, "..");

/**
 * 値がレコードかどうかを判定します。
 *
 * @param value 判定する値です。
 * @returns レコードの場合は true を返します。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * 未知の値を文字列として読み取ります。
 *
 * @param value 読み取る値です。
 * @returns 文字列です。
 */
function asString(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("文字列ではありません。");
  }

  return value;
}

/**
 * 未知の値を数値として読み取ります。
 *
 * @param value 読み取る値です。
 * @returns 数値です。
 */
function asNumber(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error("数値ではありません。");
  }

  return value;
}

/**
 * 計測結果の JSON を結果の一覧に変換します。
 *
 * @param raw JSON を解釈した値です。
 * @returns 結果の一覧です。
 */
function parseReport(raw: unknown): BenchmarkReport {
  if (!isRecord(raw) || !Array.isArray(raw["files"])) {
    throw new Error("ベンチマーク結果の形式が正しくありません。");
  }

  const groups: BenchmarkGroup[] = [];

  for (const file of raw["files"]) {
    if (!isRecord(file) || !Array.isArray(file["groups"])) {
      throw new Error("ベンチマーク結果の形式が正しくありません。");
    }

    for (const group of file["groups"]) {
      if (!isRecord(group) || !Array.isArray(group["benchmarks"])) {
        throw new Error("ベンチマーク結果の形式が正しくありません。");
      }

      const entries: BenchmarkEntry[] = [];

      for (const benchmark of group["benchmarks"]) {
        if (!isRecord(benchmark)) {
          throw new Error("ベンチマーク結果の形式が正しくありません。");
        }

        entries.push({
          name: asString(benchmark["name"]),
          hz: asNumber(benchmark["hz"]),
          mean: asNumber(benchmark["mean"]),
        });
      }

      // `fullName` は `ファイル名 > 見出し` の形式です。見出しだけを使います。
      const fullName = asString(group["fullName"]);
      const title = fullName.split(">").at(-1)?.trim() ?? fullName;

      groups.push({ title, entries });
    }
  }

  return { groups };
}

/**
 * 最新の計測結果が入ったディレクトリーを求めます。
 *
 * @param benchmarksDir 計測結果の保存先です。
 * @returns 最新のディレクトリーの名前です。
 */
function findLatestRun(benchmarksDir: string): string {
  let runs: string[] = [];

  try {
    runs = readdirSync(benchmarksDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d{8}-\d{6}$/.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const latest = runs.at(-1);

  if (latest === undefined) {
    throw new Error(
      "計測結果がありません。先に packages/fast-utf8 で `mise run bench` を実行してください。",
    );
  }

  return latest;
}

/**
 * 計測日時の表示名を作ります。
 *
 * @param runName `YYYYMMDD-HHmmss` 形式の名前です。
 * @returns `YYYY-MM-DD HH:mm:ss` 形式の名前です。
 */
function formatRunName(runName: string): string {
  const matched = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(runName);

  if (matched === null) {
    return runName;
  }

  return `${matched[1]}-${matched[2]}-${matched[3]} ${matched[4]}:${matched[5]}:${matched[6]}`;
}

/**
 * 処理回数の表示名を作ります。
 *
 * @param hz 1 秒あたりの処理回数です。
 * @param unit 単位の表示名です。
 * @returns 表示名です。
 */
function formatHz(hz: number, unit: string): string {
  return `${Math.round(hz).toLocaleString("en-US")} ${unit}`;
}

/**
 * 言語ごとの表示文言です。
 */
interface LocaleText {
  readonly title: string;
  readonly description: string;
  readonly generated: string;
  readonly intro: (version: string, measured: string) => string;
  readonly note: string;
  readonly empty: string;
  readonly implementation: string;
  readonly throughput: string;
  readonly mean: string;
  readonly comparison: string;
  readonly hzUnit: string;
  readonly faster: (ratio: string) => string;
  readonly tie: string;
}

/**
 * 日本語の表示文言です。
 */
const JAPANESE_TEXT: LocaleText = {
  title: "ベンチマーク",
  description: "各実行環境での最新の計測結果です。",
  generated:
    "{/* このファイルは自動生成です。直接編集せず scripts/update-benchmark.ts を実行してください。 */}",
  intro: (version, measured) =>
    `fast-utf8 v${version} の \`benchmarks/fast-utf8.bench.ts\` を計測した結果です（計測日時: ${measured}）。`,
  note: "結果は計測したマシンやブラウザーの版数に左右されます。同じ条件で比べるときの目安にしてください。",
  empty: "計測結果がありません。",
  implementation: "実装",
  throughput: "処理数/秒",
  mean: "平均",
  comparison: "比較",
  hzUnit: "回/秒",
  faster: (ratio) => `${ratio} 倍速い`,
  tie: "同等",
};

/**
 * 英語の表示文言です。
 */
const ENGLISH_TEXT: LocaleText = {
  title: "Benchmark",
  description: "The latest measurements for each runtime.",
  generated:
    "{/* This file is auto-generated. Run scripts/update-benchmark.ts instead of editing it directly. */}",
  intro: (version, measured) =>
    `Results for \`benchmarks/fast-utf8.bench.ts\` at fast-utf8 v${version} (measured: ${measured}).`,
  note: "Results depend on the machine and browser versions. Use them as a rough guide for comparisons under the same conditions.",
  empty: "No measurements.",
  implementation: "Implementation",
  throughput: "Throughput",
  mean: "Mean",
  comparison: "Comparison",
  hzUnit: "ops/sec",
  faster: (ratio) => `${ratio}x faster`,
  tie: "Tie",
};

/**
 * 見出しからアンカー用の識別子を作ります。
 *
 * @param value 見出しの文字列です。
 * @returns 識別子です。
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * ページの本文を作ります。
 *
 * @param text 言語ごとの表示文言です。
 * @param packageVersion 計測した版数です。
 * @param runName 計測日時の名前です。
 * @param reports 環境ごとの結果です。
 * @returns ページの本文です。
 */
function renderPage(
  text: LocaleText,
  packageVersion: string,
  runName: string,
  reports: Record<Environment, BenchmarkReport>,
): string {
  const lines = [
    "---",
    `title: ${text.title}`,
    `description: ${text.description}`,
    "---",
    "",
    text.generated,
    "",
    text.intro(packageVersion, formatRunName(runName)),
    "",
    ":::note",
    text.note,
    ":::",
    "",
  ];

  for (const environment of ENVIRONMENTS) {
    const heading = ENVIRONMENT_HEADINGS[environment];
    lines.push(`## ${heading.label} [#${heading.anchor}]`, "");

    const groups = reports[environment].groups;

    if (groups.length === 0) {
      lines.push(text.empty, "");
      continue;
    }

    for (const group of groups) {
      if (group.entries.length === 0) {
        continue;
      }

      lines.push(
        `### ${group.title} [#${heading.anchor}-${slugify(group.title)}]`,
        "",
        `| ${text.implementation} | ${text.throughput} | ${text.mean} | ${text.comparison} |`,
        "| --- | --- | --- | --- |",
      );

      const winner = group.entries.reduce((a, b) => (b.hz > a.hz ? b : a));
      const slowest = group.entries.reduce((a, b) => (b.hz < a.hz ? b : a));
      const ratio = winner.hz / slowest.hz;

      for (const entry of group.entries) {
        let comparison = "—";

        if (group.entries.length >= 2) {
          if (ratio < 1.005) {
            comparison = text.tie;
          } else if (entry.name === winner.name) {
            comparison = text.faster(ratio.toFixed(2));
          }
        }

        lines.push(
          `| ${entry.name} | ${formatHz(entry.hz, text.hzUnit)} | ${entry.mean.toPrecision(4)} ms | ${comparison} |`,
        );
      }

      lines.push("");
    }
  }

  return `${lines.join("\n")}\n`;
}

/**
 * 最新の計測結果をサイトに書き込みます。
 *
 * @returns 終了コードです。
 */
function main(): number {
  const benchmarksDir = resolve(websiteRoot, "..", "packages", "fast-utf8", ".tmp", "benchmarks");
  const runName = findLatestRun(benchmarksDir);
  const runDir = resolve(benchmarksDir, runName);

  const packageJson = JSON.parse(
    readFileSync(resolve(websiteRoot, "..", "packages", "fast-utf8", "package.json"), "utf8"),
  ) as unknown;

  if (!isRecord(packageJson)) {
    throw new Error("package.json の形式が正しくありません。");
  }

  const packageVersion = asString(packageJson["version"]);

  const reports = {} as Record<Environment, BenchmarkReport>;

  for (const environment of ENVIRONMENTS) {
    const raw = JSON.parse(readFileSync(resolve(runDir, `${environment}.json`), "utf8")) as unknown;
    reports[environment] = parseReport(raw);
  }

  for (const [locale, text] of [
    ["ja", JAPANESE_TEXT],
    ["en", ENGLISH_TEXT],
  ] as const) {
    const filePath = resolve(websiteRoot, "content", locale, "benchmark", "index.mdx");
    mkdirSync(resolve(websiteRoot, "content", locale, "benchmark"), { recursive: true });
    writeFileSync(filePath, renderPage(text, packageVersion, runName, reports));
    console.log(`結果を書き込みました: ${filePath}`);
  }

  return 0;
}

let exitCode = 0;

try {
  exitCode = main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  exitCode = 1;
}

process.exitCode = exitCode;
