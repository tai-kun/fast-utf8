import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 計測する環境の一覧です。
 */
const ENVIRONMENTS = ["node", "chromium", "firefox", "webkit"] as const;

/**
 * 計測する環境です。
 */
type Environment = (typeof ENVIRONMENTS)[number];

/**
 * パッケージのルートディレクトリーです。
 */
const packageRoot = resolve(import.meta.dirname, "..");

/**
 * コマンドライン引数から計測する環境を求めます。
 *
 * 引数が無い場合はすべての環境を対象にします。
 *
 * @param args 受け取った引数の一覧です。
 * @returns 計測する環境の一覧です。
 */
function parseArgs(args: string[]): Environment[] {
  if (args.length === 0) {
    return [...ENVIRONMENTS];
  }

  const environments: Environment[] = [];

  for (const arg of args) {
    if (!isEnvironment(arg)) {
      throw new Error(`不明な環境です: ${arg}（指定できる値: ${ENVIRONMENTS.join(", ")}）`);
    }

    if (!environments.includes(arg)) {
      environments.push(arg);
    }
  }

  return environments;
}

/**
 * 文字列が計測対象の環境かどうかを判定します。
 *
 * @param value 判定する値です。
 * @returns 環境の場合は true を返します。
 */
function isEnvironment(value: string): value is Environment {
  return (ENVIRONMENTS as readonly string[]).includes(value);
}

/**
 * 日時から出力先の名前を作ります。
 *
 * @param date 基準にする日時です。
 * @returns `YYYYMMDD-HHmmss` 形式の名前です。
 */
function formatTimestamp(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * 指定した環境でベンチマークを計測します。
 *
 * 結果は JSON 形式で出力先に保存します。
 *
 * @param environment 計測する環境です。
 * @param outputDir 結果の出力先ディレクトリーです。
 * @returns 成功した場合は true を返します。
 */
function runBenchmark(environment: Environment, outputDir: string): boolean {
  const config =
    environment === "node" ? "./.config/vitest.server.ts" : "./.config/vitest.client.ts";
  const outputJson = resolve(outputDir, `${environment}.json`);
  const vitestCli = resolve(packageRoot, "node_modules", "vitest", "vitest.mjs");

  const result = spawnSync(
    process.execPath,
    [vitestCli, "bench", "--run", "--config", config, "--outputJson", outputJson],
    {
      cwd: packageRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        // ブラウザー環境では 1 つに絞って計測します。
        ...(environment === "node" ? {} : { BENCH_BROWSER: environment }),
      },
    },
  );

  if (result.error !== undefined) {
    console.error(`[${environment}] ベンチマークの起動に失敗しました:`, result.error.message);
    return false;
  }

  if (result.status !== 0) {
    console.error(
      `[${environment}] ベンチマークが異常終了しました（終了コード: ${result.status}）`,
    );
    return false;
  }

  console.log(`[${environment}] 結果を保存しました: ${outputJson}`);
  return true;
}

/**
 * すべての環境でベンチマークを計測します。
 *
 * 正確に測るために逐次実行します。
 *
 * @param environments 計測する環境の一覧です。
 * @returns 終了コードです。
 */
function main(environments: Environment[]): number {
  const outputDir = resolve(packageRoot, ".tmp", "benchmarks", formatTimestamp(new Date()));
  mkdirSync(outputDir, { recursive: true });
  console.log(`結果の出力先: ${outputDir}`);

  const failed: Environment[] = [];

  for (const environment of environments) {
    console.log(`--- ${environment} の計測を開始します ---`);

    if (!runBenchmark(environment, outputDir)) {
      failed.push(environment);
    }
  }

  if (failed.length > 0) {
    console.error(`失敗した環境があります: ${failed.join(", ")}`);
    return 1;
  }

  console.log(`すべての計測が完了しました: ${outputDir}`);
  return 0;
}

let exitCode = 0;
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`使い方: node ./.config/bench.ts [${ENVIRONMENTS.join("] [")}]`);
  console.log("引数を省略した場合はすべての環境で計測します。");
} else {
  try {
    exitCode = main(parseArgs(args));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    exitCode = 2;
  }
}

process.exitCode = exitCode;
