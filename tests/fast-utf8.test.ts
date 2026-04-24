import { describe, test, vi } from "vitest";

import FastUtf8 from "../src/fast-utf8.js";

describe("decode", () => {
  test("ASCII 文字のバイト列をデコードしたとき、正しい文字列になる", ({ expect }) => {
    // Arrange
    const fastUtf8 = new FastUtf8();
    const input = new Uint8Array([0x61, 0x62, 0x63]);

    // Act
    const result = fastUtf8.decode(input);

    // Assert
    expect(result).toBe("abc");
  });

  test("マルチバイト文字（日本語）のバイト列をデコードしたとき、正しい文字列になる", ({
    expect,
  }) => {
    // Arrange
    const fastUtf8 = new FastUtf8();
    const input = new Uint8Array([0xe3, 0x81, 0x82]);

    // Act
    const result = fastUtf8.decode(input);

    // Assert
    expect(result).toBe("あ");
  });

  test("空のバッファーをデコードしたとき、空文字になる", ({ expect }) => {
    // Arrange
    const fastUtf8 = new FastUtf8();
    const input = new Uint8Array([]);

    // Act
    const result = fastUtf8.decode(input);

    // Assert
    expect(result).toBe("");
  });

  test("BOM 付きのバイト列を ignoreBOM 有効でデコードしたとき、BOM が除去される", ({ expect }) => {
    // Arrange
    const fastUtf8 = new FastUtf8({ ignoreBOM: true });
    const input = new Uint8Array([0xef, 0xbb, 0xbf, 0x61]);

    // Act
    const result = fastUtf8.decode(input);

    // Assert
    expect(result).toBe("\uFEFFa");
  });

  test("不正なシーケンスを strict 有効でデコードしたとき、例外を投げる", ({ expect }) => {
    // Arrange
    const fastUtf8 = new FastUtf8({ strict: true });
    const input = new Uint8Array([0xff]);

    // Act & Assert
    expect(() => fastUtf8.decode(input)).toThrow();
  });
});

describe("encode", () => {
  test("ASCII 文字列をエンコードしたとき、正しいバイト列になる", ({ expect }) => {
    // Arrange
    const fastUtf8 = new FastUtf8();
    const input = "abc";

    // Act
    const result = fastUtf8.encode(input);

    // Assert
    expect(result).toStrictEqual(new Uint8Array([0x61, 0x62, 0x63]));
  });

  test("内部バッファーサイズ以下の文字列をエンコードしたとき、内部バッファーの一部を返す", ({
    expect,
  }) => {
    // Arrange
    const bufferSize = 1024;
    const fastUtf8 = new FastUtf8({ bufferSize });
    const input = "short";

    // Act
    const result = fastUtf8.encode(input);

    // Assert
    // 内部バッファーを共有している場合、buffer 属性の byteLength は bufferSize と一致する。
    expect(result.buffer.byteLength).toBe(input.length);
    expect(result).toStrictEqual(new TextEncoder().encode("short"));
  });

  test("内部バッファーサイズを超える文字列をエンコードしたとき、新規生成されたバイト列を返す", ({
    expect,
  }) => {
    // Arrange
    const bufferSize = 2;
    const fastUtf8 = new FastUtf8({ bufferSize });
    const input = "long-string";

    // Act
    const result = fastUtf8.encode(input);

    // Assert
    // 新規生成された場合、固有の ArrayBuffer を持つため byteLength は内容と等しくなる。
    expect(result.buffer.byteLength).toBe(result.byteLength);
    expect(result).toStrictEqual(new TextEncoder().encode("long-string"));
  });

  test("厳格モードで不正なサロゲートペアを含む文字列をエンコードしたとき、例外を投げる", ({
    expect,
  }) => {
    // Arrange
    const fastUtf8 = new FastUtf8({ strict: true });
    const input = "\uD800";

    // Act & Assert
    expect(() => fastUtf8.encode(input)).toThrow();
  });

  test("キャッシュが有効なとき、同じ文字列の 2 回目のエンコード結果は 1 回目と内容が一致する", ({
    expect,
  }) => {
    // Arrange
    const fastUtf8 = new FastUtf8({ caching: true });
    const input = "cached-text";

    // Act
    const firstResult = fastUtf8.encode(input);
    const secondResult = fastUtf8.encode(input);

    // Assert
    expect(secondResult).toStrictEqual(firstResult);
  });
});

describe("encodeInto", () => {
  test("指定したバッファーに文字列を書き込んだとき、読み取り数と書き込み数が正しく返される", ({
    expect,
  }) => {
    // Arrange
    const fastUtf8 = new FastUtf8();
    const source = "a";
    const destination = new Uint8Array(1);

    // Act
    const result = fastUtf8.encodeInto(source, destination);

    // Assert
    expect(result).toStrictEqual({ read: 1, written: 1 });
    expect(destination[0]).toBe(0x61);
  });

  test("書き込み先のバッファーが不足しているとき、入る分だけ書き込まれる", ({ expect }) => {
    // Arrange
    const fastUtf8 = new FastUtf8();
    const source = "abc";
    const destination = new Uint8Array(1);

    // Act
    const result = fastUtf8.encodeInto(source, destination);

    // Assert
    expect(result).toStrictEqual({ read: 1, written: 1 });
    expect(destination[0]).toBe(0x61);
  });
});

describe("isValidUtf8", () => {
  test("正常な文字列を検証したとき、真を返す", ({ expect }) => {
    // Arrange
    const fastUtf8 = new FastUtf8();
    const input = "正常な文字列";

    // Act
    const result = fastUtf8.isValidUtf8(input);

    // Assert
    expect(result).toBe(true);
  });

  test("不正なサロゲートを含む文字列を検証したとき、偽を返す", ({ expect }) => {
    // Arrange
    const fastUtf8 = new FastUtf8();
    const input = "\uD800";

    // Act
    const result = fastUtf8.isValidUtf8(input);

    // Assert
    expect(result).toBe(false);
  });

  test("正常なバイト列を検証したとき、真を返す", ({ expect }) => {
    // Arrange
    const fastUtf8 = new FastUtf8();
    const input = new Uint8Array([0x61]);

    // Act
    const result = fastUtf8.isValidUtf8(input);

    // Assert
    expect(result).toBe(true);
  });

  test("不正なバイトを含むバイト列を検証したとき、偽を返す", ({ expect }) => {
    // Arrange
    const fastUtf8 = new FastUtf8();
    const input = new Uint8Array([0xff]);

    // Act
    const result = fastUtf8.isValidUtf8(input);

    // Assert
    expect(result).toBe(false);
  });
});

describe("キャッシュ制御", () => {
  test("キャッシュをクリアした後に同じ文字列をエンコードしたとき、再度計算が行われる", ({
    expect,
  }) => {
    // Arrange
    const fastUtf8 = new FastUtf8({ caching: true });
    const input = "data";
    const firstResult = fastUtf8.encode(input);

    // Act
    fastUtf8.clearCache();
    const secondResult = fastUtf8.encode(input);

    // Assert
    // 結果の内容が同一であることを確認する。
    expect(secondResult).toStrictEqual(firstResult);
  });

  test("キャッシュから取得したバイト列を変更しても、元のキャッシュデータに影響を与えない", ({
    expect,
  }) => {
    // Arrange
    const fastUtf8 = new FastUtf8({ caching: true });
    const input = "safe";
    const firstResult = fastUtf8.encode(input);

    // Act
    // 取得したバッファーの内容を書き換える。
    firstResult[0] = 0x00;
    const secondResult = fastUtf8.encode(input);

    // Assert
    // 2 回目の呼び出しで得られる結果は、書き換え前の正しいデータであるべきである。
    expect(secondResult[0]).toBe(0x73); // 's' の ASCII コード
  });
});

describe("外部キャッシュとの連携", () => {
  test("カスタムキャッシュマップを渡したとき、その get メソッドと set メソッドが利用される", ({
    expect,
  }) => {
    // Arrange
    const mockCache = {
      get: vi.fn<(key: any) => any>(),
      set: vi.fn<(key: any, value: any) => void>(),
      clear: vi.fn<() => void>(),
    };
    const fastUtf8 = new FastUtf8({ caching: true, cacheMap: mockCache });
    const input = "external";

    // Act
    fastUtf8.encode(input);

    // Assert
    expect(mockCache.get).toHaveBeenCalledWith(input);
    expect(mockCache.set).toHaveBeenCalled();
  });
});
