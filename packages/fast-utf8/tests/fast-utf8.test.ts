import { describe, test } from "vitest";

import FastUtf8, { type ICacheMap } from "../src/fast-utf8.js";
import LatestOneCacheMap from "../src/latest-one-cache-map.js";

/**
 * `get` と `set` の呼び出しを記録するキャッシュの二重化です。
 * 外部実装との連携を検証するために使用します。
 */
class RecordingCacheMap implements ICacheMap {
  public readonly calls: { get: string[]; set: [string, Uint8Array][] } = {
    get: [],
    set: [],
  };

  private store = new Map<string, Uint8Array<ArrayBuffer>>();

  public get(text: string): Uint8Array<ArrayBuffer> | null {
    this.calls.get.push(text);
    return this.store.get(text) ?? null;
  }

  public set(text: string, data: Uint8Array<ArrayBuffer>): void {
    this.calls.set.push([text, data]);
    this.store.set(text, data);
  }

  public clear(): void {
    this.store.clear();
  }
}

describe("decode", () => {
  test.for<[string, number[]]>([
    ["abc", [0x61, 0x62, 0x63]],
    ["あ", [0xe3, 0x81, 0x82]],
    ["", []],
    ["�", [0xef, 0xbf, 0xbd]],
  ])("%s に変換する", ([expected, bytes], { expect }) => {
    // 準備
    const sut = new FastUtf8();
    const input = new Uint8Array(bytes);

    // 実行
    const result = sut.decode(input);

    // 検証
    expect(result).toBe(expected);
  });

  test("BOM 付き入力を既定で変換すると BOM を除去する", ({ expect }) => {
    // 準備
    const sut = new FastUtf8();
    const input = new Uint8Array([0xef, 0xbb, 0xbf, 0x61]);

    // 実行
    const result = sut.decode(input);

    // 検証
    expect(result).toBe("a");
  });

  test("BOM 付き入力を ignoreBOM 有効で変換すると BOM を保持する", ({ expect }) => {
    // 準備
    const sut = new FastUtf8({ ignoreBOM: true });
    const input = new Uint8Array([0xef, 0xbb, 0xbf, 0x61]);

    // 実行
    const result = sut.decode(input);

    // 検証
    expect(result).toBe("\uFEFFa");
  });

  test.for<[string, number[]]>([
    ["空の継続バイト", [0x80]],
    ["不完全な 3 バイト列", [0xe3, 0x81]],
    ["不正な継続バイト", [0xe3, 0x28, 0xa1]],
    ["過長符号化", [0xc0, 0xaf]],
    ["サロゲート領域", [0xed, 0xa0, 0x80]],
    ["範囲外の符号位置", [0xf4, 0x90, 0x80, 0x80]],
    ["不正な先頭バイト", [0xff]],
    ["5 バイト列", [0xf8, 0x88, 0x80, 0x80, 0x80]],
  ])("厳格モードで %s を変換すると例外を投げる", ([_label, bytes], { expect }) => {
    // 準備
    const sut = new FastUtf8({ strict: true });
    const input = new Uint8Array(bytes);

    // 実行と検証
    expect(() => sut.decode(input)).toThrow();
  });
});

describe("encode", () => {
  test.for<[string, number[]]>([
    ["abc", [0x61, 0x62, 0x63]],
    ["あ", [0xe3, 0x81, 0x82]],
    ["", []],
  ])("%s を符号化する", ([input, bytes], { expect }) => {
    // 準備
    const sut = new FastUtf8({ caching: false });

    // 実行
    const result = sut.encode(input);

    // 検証
    expect(result).toStrictEqual(new Uint8Array(bytes));
  });

  test("長い文字列も正しく符号化する", ({ expect }) => {
    // 準備
    const sut = new FastUtf8({ allocateSize: 8, caching: false });
    const input = "a".repeat(500);

    // 実行
    const result = sut.encode(input);

    // 検証
    expect(result).toStrictEqual(new TextEncoder().encode(input));
  });

  test("孤立サロゲートは置換文字として符号化する", ({ expect }) => {
    // 準備
    const sut = new FastUtf8({ strict: true });
    const input = "\uD800";

    // 実行
    const result = sut.encode(input);

    // 検証
    expect(input.isWellFormed()).toBe(false);
    expect(result).toStrictEqual(new Uint8Array([0xef, 0xbf, 0xbd]));
  });

  test("2 回目の結果は内容が等しく参照が異なる", ({ expect }) => {
    // 準備
    const sut = new FastUtf8({ caching: true });
    const input = "cached-text";

    // 実行
    const first = sut.encode(input);
    const second = sut.encode(input);

    // 検証
    expect(second).toStrictEqual(first);
    expect(second).not.toBe(first);
  });
});

describe("encodeInto", () => {
  test("十分な大きさの書き込み先に書き込む", ({ expect }) => {
    // 準備
    const sut = new FastUtf8();
    const destination = new Uint8Array(1);

    // 実行
    const result = sut.encodeInto("a", destination);

    // 検証
    expect(result).toStrictEqual({ read: 1, written: 1 });
    expect(destination[0]).toBe(0x61);
  });

  test("不足する書き込み先には入る分だけ書き込む", ({ expect }) => {
    // 準備
    const sut = new FastUtf8();
    const destination = new Uint8Array(1);

    // 実行
    const result = sut.encodeInto("abc", destination);

    // 検証
    expect(result).toStrictEqual({ read: 1, written: 1 });
    expect(destination[0]).toBe(0x61);
  });

  test("打ち切った書き込みは後の encode に影響しない", ({ expect }) => {
    // 準備
    const sut = new FastUtf8({ caching: true });
    const destination = new Uint8Array(1);

    // 実行
    sut.encodeInto("abc", destination);
    const result = sut.encode("abc");

    // 検証
    expect(result).toStrictEqual(new TextEncoder().encode("abc"));
  });
});

describe("countBytes", () => {
  test.for<[string, number]>([
    ["", 0],
    ["abc", 3],
    ["αβγ", 6],
    ["こんにちは", 15],
    ["𠮷野家", 10],
  ])("%s は %i バイトである", ([input, expected], { expect }) => {
    // 準備
    const sut = new FastUtf8({ caching: false });

    // 実行
    const result = sut.countBytes(input);

    // 検証
    expect(result).toBe(expected);
  });

  test("安全な文字数を超えても正しく数える", ({ expect }) => {
    // 準備
    const sut = new FastUtf8({ allocateSize: 1024 });
    const input = "a".repeat(Math.floor(1024 / 3) + 1);

    // 実行
    const result = sut.countBytes(input);

    // 検証
    expect(result).toBe(input.length);
  });

  test("孤立サロゲートは置換文字の 3 バイトとして数える", ({ expect }) => {
    // 準備
    const sut = new FastUtf8({ strict: true });

    // 実行
    const result = sut.countBytes("\uD800");

    // 検証
    expect(result).toBe(3);
  });
});

describe("isValidUtf8", () => {
  test.for<[string, Uint8Array, boolean]>([
    ["空のバイト列", new Uint8Array([]), true],
    ["ASCII", new Uint8Array([0x61]), true],
    ["不正なバイト", new Uint8Array([0xff]), false],
    ["不完全な列", new Uint8Array([0xe3, 0x81]), false],
  ])("%s を判定する", ([_label, input, expected], { expect }) => {
    // 準備
    const sut = new FastUtf8();

    // 実行
    const result = sut.isValidUtf8(input);

    // 検証
    expect(result).toBe(expected);
  });

  test.for<[string]>([[""], ["正常な文字列"], ["\uD800"]])(
    "文字列 %s は常に正しいと判定する",
    ([input], { expect }) => {
      // 準備
      const sut = new FastUtf8();

      // 実行
      const result = sut.isValidUtf8(input);

      // 検証
      expect(result).toBe(true);
    },
  );
});

describe("キャッシュ", () => {
  test("クリア後は再度計算した結果を返す", ({ expect }) => {
    // 準備
    const sut = new FastUtf8({ caching: true });
    const first = sut.encode("data");

    // 実行
    sut.clearCache();
    const second = sut.encode("data");

    // 検証
    expect(second).toStrictEqual(first);
    expect(second).not.toBe(first);
  });

  test("返した値の変更は保存内容に影響しない", ({ expect }) => {
    // 準備
    const sut = new FastUtf8({ caching: true });

    // 実行
    const first = sut.encode("A");
    first[0] = 0x42;
    const second = sut.encode("A");

    // 検証
    expect(second[0]).toBe(0x41);
  });

  test("書き込み先の変更は保存内容に影響しない", ({ expect }) => {
    // 準備
    const sut = new FastUtf8({ caching: true });
    const destination = new Uint8Array(10);

    // 実行
    sut.encodeInto("A", destination);
    destination[0] = 0x42;
    const result = sut.encode("A");

    // 検証
    expect(result[0]).toBe(0x41);
  });

  test("異なる入力の結果は互いに影響しない", ({ expect }) => {
    // 準備
    const sut = new FastUtf8({ caching: true });

    // 実行
    const first = sut.encode("A");
    const second = sut.encode("B");
    first[0] = 0x43;

    // 検証
    expect(second[0]).toBe(0x42);
    expect(first.buffer).not.toBe(second.buffer);
  });

  test("境界の長さでも正しく符号化する", ({ expect }) => {
    // 準備
    const sut = new FastUtf8({ allocateSize: 1024, caching: true });
    const input = "A".repeat(Math.floor(1024 / 3));

    // 実行
    const result = sut.encode(input);

    // 検証
    expect(result.length).toBe(input.length);
    expect(result.every((byte) => byte === 0x41)).toBe(true);
  });

  test("空文字の結果は参照が異なる", ({ expect }) => {
    // 準備
    const sut = new FastUtf8({ caching: true });

    // 実行
    const first = sut.encode("");
    const second = sut.encode("");

    // 検証
    expect(first).toStrictEqual(new Uint8Array([]));
    expect(second).toStrictEqual(new Uint8Array([]));
    expect(first).not.toBe(second);
  });

  test("独自実装の get と set を使う", ({ expect }) => {
    // 準備
    const cache = new RecordingCacheMap();
    const sut = new FastUtf8({ caching: true, cacheMap: cache });

    // 実行
    sut.encode("external");
    sut.encode("external");

    // 検証
    expect(cache.calls.get).toStrictEqual(["external", "external"]);
    expect(cache.calls.set.length).toBe(1);
  });

  test("保存できない大きさでも正しく符号化する", ({ expect }) => {
    // 準備
    const sut = new FastUtf8({
      caching: true,
      cacheMap: new LatestOneCacheMap(1),
    });
    const input = "abc";

    // 実行
    const result = sut.encode(input);

    // 検証
    expect(result).toStrictEqual(new TextEncoder().encode(input));
  });
});

describe("clone", () => {
  test("厳格さと BOM の扱いを引き継ぐ", ({ expect }) => {
    // 準備
    const sut = new FastUtf8({ strict: true, ignoreBOM: true });

    // 実行
    const cloned = sut.clone();

    // 検証
    expect(cloned.strict).toBe(true);
    expect(cloned.encode("あ")).toStrictEqual(sut.encode("あ"));
    expect(() => cloned.decode(new Uint8Array([0xff]))).toThrow();
    expect(cloned.decode(new Uint8Array([0xef, 0xbb, 0xbf, 0x61]))).toBe("\uFEFFa");
  });

  test("そのときの caching を引き継ぐ", ({ expect }) => {
    // 準備
    const sut = new FastUtf8({ caching: true });
    sut.caching = false;

    // 実行
    const cloned = sut.clone();

    // 検証
    expect(cloned.caching).toBe(false);
  });

  test("省略した場合は保存先を共有する", ({ expect }) => {
    // 準備
    const cache = new RecordingCacheMap();
    const sut = new FastUtf8({ caching: true, cacheMap: cache });
    sut.encode("shared");

    // 実行
    const cloned = sut.clone();
    cloned.encode("shared");

    // 検証
    expect(cache.calls.set.length).toBe(1);
    expect(cache.calls.get).toStrictEqual(["shared", "shared"]);
  });

  test("上書きした項目だけが変わる", ({ expect }) => {
    // 準備
    const sut = new FastUtf8({ strict: false, caching: true });

    // 実行
    const cloned = sut.clone({ strict: true, caching: false });

    // 検証
    expect(cloned.strict).toBe(true);
    expect(cloned.caching).toBe(false);
    expect(sut.strict).toBe(false);
    expect(sut.caching).toBe(true);
    expect(() => cloned.decode(new Uint8Array([0xff]))).toThrow();
  });

  test("大きさの上書きでも正しく符号化する", ({ expect }) => {
    // 準備
    const sut = new FastUtf8({ allocateSize: 16 });

    // 実行
    const cloned = sut.clone({ allocateSize: 8 });
    const input = "a".repeat(500);

    // 検証
    expect(cloned.encode(input)).toStrictEqual(new TextEncoder().encode(input));
    expect(sut.encode(input)).toStrictEqual(new TextEncoder().encode(input));
  });

  test("複製後の変更は元に影響しない", ({ expect }) => {
    // 準備
    const sut = new FastUtf8({ caching: true });

    // 実行
    const cloned = sut.clone();
    cloned.caching = false;

    // 検証
    expect(sut.caching).toBe(true);
    expect(cloned.caching).toBe(false);
  });
});
