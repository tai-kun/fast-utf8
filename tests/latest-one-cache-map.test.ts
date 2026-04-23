import { describe, test } from "vitest";

import LatestOneCacheMap from "../src/latest-one-cache-map.js";

describe("データの保存と取得", () => {
  test("有効なサイズのデータを保存したとき、そのデータを取得できる", ({ expect }) => {
    // Arrange
    const cache = new LatestOneCacheMap(1024);
    const key = "k1";
    const value = new Uint8Array(100).fill(1);

    // Act
    cache.set(key, value);
    const result = cache.get(key);

    // Assert
    expect(result).toStrictEqual(value);
  });

  test("未登録のキーを指定して取得を試みたとき、null が返される", ({ expect }) => {
    // Arrange
    const cache = new LatestOneCacheMap();

    // Act
    const result = cache.get("non_existent");

    // Assert
    expect(result).toBeNull();
  });

  test("別のキーで新しいデータが保存されたとき、以前のキャッシュは破棄される", ({ expect }) => {
    // Arrange
    const cache = new LatestOneCacheMap();
    const firstData = new Uint8Array([1, 2, 3]);
    const secondData = new Uint8Array([4, 5, 6]);

    // Act
    cache.set("k1", firstData);
    cache.set("k2", secondData);

    // Assert
    expect(cache.get("k1")).toBeNull();
    expect(cache.get("k2")).toStrictEqual(secondData);
  });

  test("同一のキーで新しいデータが保存されたとき、最新のデータで上書きされる", ({ expect }) => {
    // Arrange
    const cache = new LatestOneCacheMap();
    const oldData = new Uint8Array([0]);
    const newData = new Uint8Array([1]);

    // Act
    cache.set("k1", oldData);
    cache.set("k1", newData);

    // Assert
    expect(cache.get("k1")).toStrictEqual(newData);
  });
});

describe("キャッシュのクリア", () => {
  test("クリアを実行したとき、保存されていたデータが削除され、null が返されるようになる", ({
    expect,
  }) => {
    // Arrange
    const cache = new LatestOneCacheMap();
    cache.set("k1", new Uint8Array([1]));

    // Act
    cache.clear();

    // Assert
    expect(cache.get("k1")).toBeNull();
  });
});

describe("境界値と容量制限", () => {
  test("データサイズが最大サイズと等しいとき、正常に保存できる", ({ expect }) => {
    // Arrange
    const size = 1024;
    const cache = new LatestOneCacheMap(size);
    const data = new Uint8Array(size).fill(1);

    // Act
    cache.set("boundary_key", data);

    // Assert
    expect(cache.get("boundary_key")).toStrictEqual(data);
  });

  test("データサイズが最大サイズを 1 バイトでも超過したとき、保存処理が無視される", ({
    expect,
  }) => {
    // Arrange
    const limit = 1024;
    const cache = new LatestOneCacheMap(limit);
    const oversizedData = new Uint8Array(limit + 1).fill(1);

    // Act
    cache.set("oversized", oversizedData);

    // Assert
    expect(cache.get("oversized")).toBeNull();
  });

  test("既存のキャッシュがある状態で超過データを保存しようとしたとき、既存のキャッシュが維持される", ({
    expect,
  }) => {
    // Arrange
    const limit = 1024;
    const cache = new LatestOneCacheMap(limit);
    const validData = new Uint8Array(100).fill(1);
    const oversizedData = new Uint8Array(limit + 1).fill(2);

    // Act
    cache.set("k1", validData);
    cache.set("k2", oversizedData);

    // Assert
    // 仕様書 BT-04 に基づき、更新がスキップされるため以前のキャッシュが残ることを確認する。
    expect(cache.get("k1")).toStrictEqual(validData);
    expect(cache.get("k2")).toBeNull();
  });

  test("サイズが 0 のデータを保存したとき、空の Uint8Array として正常に取得できる", ({
    expect,
  }) => {
    // Arrange
    const cache = new LatestOneCacheMap();
    const emptyData = new Uint8Array(0);

    // Act
    cache.set("empty", emptyData);

    // Assert
    expect(cache.get("empty")).toStrictEqual(emptyData);
  });

  test("最大サイズを 0 に設定したとき、いかなるデータも保存が拒否される", ({ expect }) => {
    // Arrange
    const cache = new LatestOneCacheMap(0);
    const data = new Uint8Array(1).fill(1);

    // Act
    cache.set("any", data);

    // Assert
    expect(cache.get("any")).toBeNull();
  });
});
