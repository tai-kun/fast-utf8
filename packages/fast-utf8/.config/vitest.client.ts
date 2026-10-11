import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

import isDebugMode from "./_is-debug-mode.js";

/**
 * 計測対象のブラウザーです。
 *
 * `BENCH_BROWSER` 環境変数で 1 つに絞れます。未指定の場合はすべてを対象にします。
 */
const targetBrowsers: TargetBrowser[] = resolveTargetBrowsers();

/**
 * 対象にできるブラウザーです。
 */
type TargetBrowser = "chromium" | "firefox" | "webkit";

/**
 * 計測対象のブラウザーを求めます。
 *
 * @returns 対象にするブラウザーの一覧です。
 */
function resolveTargetBrowsers(): TargetBrowser[] {
  const benchBrowser = process.env["BENCH_BROWSER"];

  if (benchBrowser === "chromium" || benchBrowser === "firefox" || benchBrowser === "webkit") {
    return [benchBrowser];
  }

  return ["chromium", "firefox", "webkit"];
}

export default defineConfig({
  oxc: {
    target: "es2020",
  },
  define: {
    __DEBUG__: `${isDebugMode}`,
    __CLIENT__: "true",
    __SERVER__: "false",
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/**/*.server.test.ts"],
    browser: {
      provider: playwright(),
      enabled: true,
      headless: true,
      instances: targetBrowsers.map((browser) => ({ browser, name: browser })),
    },
    benchmark: {
      include: ["benchmarks/**/*.bench.ts"],
    },
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.ts"],
      reportsDirectory: "./coverage/client",
    },
    setupFiles: [".config/_debugging.ts"],
  },
});
