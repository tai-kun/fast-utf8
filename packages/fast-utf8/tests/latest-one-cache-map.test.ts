import { describe, test } from "vitest";

import LatestOneCacheMap from "../src/latest-one-cache-map.js";

describe("保存と取得", () => {
  test("保存した値を取得できる", ({ expect }) => {
    // 準備
    const cache = new LatestOneCacheMap(1024);
    const value = new Uint8Array(100).fill(1);

    // 実行
    cache.set("k1", value);
    const result = cache.get("k1");

    // 検証
    expect(result).toStrictEqual(value);
  });

  test("未登録のキーは null を返す", ({ expect }) => {
    // 準備
    const cache = new LatestOneCacheMap();

    // 実行
    const result = cache.get("non_existent");

    // 検証
    expect(result).toBeNull();
  });

  test("別のキーで保存すると古い値は消える", ({ expect }) => {
    // 準備
    const cache = new LatestOneCacheMap();

    // 実行
    cache.set("k1", new Uint8Array([1, 2, 3]));
    cache.set("k2", new Uint8Array([4, 5, 6]));

    // 検証
    expect(cache.get("k1")).toBeNull();
    expect(cache.get("k2")).toStrictEqual(new Uint8Array([4, 5, 6]));
  });

  test("同じキーで保存すると上書きする", ({ expect }) => {
    // 準備
    const cache = new LatestOneCacheMap();

    // 実行
    cache.set("k1", new Uint8Array([0]));
    cache.set("k1", new Uint8Array([1]));

    // 検証
    expect(cache.get("k1")).toStrictEqual(new Uint8Array([1]));
  });
});

describe("クリア", () => {
  test("クリア後は null を返す", ({ expect }) => {
    // 準備
    const cache = new LatestOneCacheMap();
    cache.set("k1", new Uint8Array([1]));

    // 実行
    cache.clear();

    // 検証
    expect(cache.get("k1")).toBeNull();
  });
});

describe("容量制限", () => {
  test("上限と等しい大きさは保存できる", ({ expect }) => {
    // 準備
    const cache = new LatestOneCacheMap(1024);
    const data = new Uint8Array(1024).fill(1);

    // 実行
    cache.set("boundary_key", data);

    // 検証
    expect(cache.get("boundary_key")).toStrictEqual(data);
  });

  test("上限を超える大きさは保存しない", ({ expect }) => {
    // 準備
    const cache = new LatestOneCacheMap(1024);

    // 実行
    cache.set("oversized", new Uint8Array(1025).fill(1));

    // 検証
    expect(cache.get("oversized")).toBeNull();
  });

  test("超える大きさの保存では古い値を残す", ({ expect }) => {
    // 準備
    const cache = new LatestOneCacheMap(1024);
    const validData = new Uint8Array(100).fill(1);

    // 実行
    cache.set("k1", validData);
    cache.set("k2", new Uint8Array(1025).fill(2));

    // 検証
    expect(cache.get("k1")).toStrictEqual(validData);
    expect(cache.get("k2")).toBeNull();
  });

  test("空の値は保存できる", ({ expect }) => {
    // 準備
    const cache = new LatestOneCacheMap();

    // 実行
    cache.set("empty", new Uint8Array(0));

    // 検証
    expect(cache.get("empty")).toStrictEqual(new Uint8Array(0));
  });

  test("上限が 0 のときは何も保存しない", ({ expect }) => {
    // 準備
    const cache = new LatestOneCacheMap(0);

    // 実行
    cache.set("any", new Uint8Array(1).fill(1));

    // 検証
    expect(cache.get("any")).toBeNull();
  });
});
