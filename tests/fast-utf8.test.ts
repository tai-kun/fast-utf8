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

  test("U+FFFD は正しい UTF-8 としてデコードできる", ({ expect }) => {
    // Arrange
    const fastUtf8 = new FastUtf8({ strict: true });
    const input = Uint8Array.from([0xef, 0xbf, 0xbd]);

    // Act
    const result = fastUtf8.decode(input);

    // Assert
    expect(result).toBe("�");
  });

  test("不正なシーケンスを strict 有効でデコードしたとき、例外を投げる", ({ expect }) => {
    // Arrange
    const fastUtf8 = new FastUtf8({ strict: true });
    const input = new Uint8Array([0xff]);

    // Act & Assert
    expect(() => fastUtf8.decode(input)).toThrow();
  });

  test("不完全な 3 バイトシーケンスを厳格モードでデコードすると例外を投げる", ({ expect }) => {
    // Arrange
    const fastUtf8 = new FastUtf8({ strict: true });
    const input = new Uint8Array([0xe3, 0x81]);

    expect(() => fastUtf8.decode(input)).toThrow();
  });

  test("不正な継続バイトを厳格モードでデコードすると例外を投げる", ({ expect }) => {
    // Arrange
    const fastUtf8 = new FastUtf8({ strict: true });
    const input = new Uint8Array([0xe3, 0x28, 0xa1]);

    expect(() => fastUtf8.decode(input)).toThrow();
  });

  test("孤立した継続バイトを厳格モードでデコードすると例外を投げる", ({ expect }) => {
    // Arrange
    const fastUtf8 = new FastUtf8({ strict: true });
    const input = new Uint8Array([0x80]);

    expect(() => fastUtf8.decode(input)).toThrow();
  });

  test("過長エンコーディングを厳格モードでデコードすると例外を投げる", ({ expect }) => {
    // Arrange
    const fastUtf8 = new FastUtf8({ strict: true });
    const input = new Uint8Array([0xc0, 0xaf]);

    expect(() => fastUtf8.decode(input)).toThrow();
  });

  test("UTF-16 サロゲート領域のエンコードを厳格モードでデコードすると例外を投げる", ({
    expect,
  }) => {
    // Arrange
    const fastUtf8 = new FastUtf8({ strict: true });
    const input = new Uint8Array([0xed, 0xa0, 0x80]);

    expect(() => fastUtf8.decode(input)).toThrow();
  });

  test("Unicode範囲外コードポイントを厳格モードでデコードすると例外を投げる", ({ expect }) => {
    // Arrange
    const fastUtf8 = new FastUtf8({ strict: true });
    const input = new Uint8Array([0xf4, 0x90, 0x80, 0x80]);

    expect(() => fastUtf8.decode(input)).toThrow();
  });

  test("不正な先頭バイト（0xFF）を厳格モードでデコードすると例外を投げる", ({ expect }) => {
    // Arrange
    const fastUtf8 = new FastUtf8({ strict: true });
    const input = new Uint8Array([0xff]);

    expect(() => fastUtf8.decode(input)).toThrow();
  });

  test("5 バイトシーケンス（非 UTF-8）を厳格モードでデコードすると例外を投げる", ({ expect }) => {
    // Arrange
    const fastUtf8 = new FastUtf8({ strict: true });
    const input = new Uint8Array([0xf8, 0x88, 0x80, 0x80, 0x80]);

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

  test("厳格モードで UTF-16 における不正なサロゲートペアを含む文字列をエンコードできる", ({
    expect,
  }) => {
    // Arrange
    const fastUtf8 = new FastUtf8({ strict: true });
    const input = "\uD800"; // 孤立サロゲート

    // Act & Assert
    expect(input.isWellFormed()).toBe(false); // UTF-16 では無効
    expect(fastUtf8.encode(input)).toStrictEqual(new Uint8Array([0xef, 0xbf, 0xbd]));
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

describe("countBytes", () => {
  test("空文字を指定したとき、バイト数は 0 になる", ({ expect }) => {
    // Arrange
    const sut = new FastUtf8();
    const input = "";

    // Act
    const result = sut.countBytes(input);

    // Assert
    expect(result).toBe(0);
  });

  test("ASCII 文字を指定したとき、正確なバイト数を返す", ({ expect }) => {
    // Arrange
    const sut = new FastUtf8();
    const input = "abc";

    // Act
    const result = sut.countBytes(input);

    // Assert
    expect(result).toBe(3);
  });

  test("2 バイトのマルチバイト文字を含むとき、正確なバイト数を返す", ({ expect }) => {
    // Arrange
    const sut = new FastUtf8();
    const input = "αβγ";

    // Act
    const result = sut.countBytes(input);

    // Assert
    expect(result).toBe(6);
  });

  test("3 バイトのマルチバイト文字（日本語）を含むとき、正確なバイト数を返す", ({ expect }) => {
    // Arrange
    const sut = new FastUtf8();
    const input = "こんにちは";

    // Act
    const result = sut.countBytes(input);

    // Assert
    expect(result).toBe(15);
  });

  test("サロゲートペア（4 バイト文字）を含むとき、正確なバイト数を返す", ({ expect }) => {
    // Arrange
    const sut = new FastUtf8();
    const input = "𠮷野家";

    // Act
    const result = sut.countBytes(input);

    // Assert
    // "𠮷" (4bytes) + "野" (3bytes) + "家" (3bytes) = 10
    expect(result).toBe(10);
  });

  test("文字列長が内部バッファーの安全圏（341 文字）を超過したとき、正常にフォールバックしてカウントできる", ({
    expect,
  }) => {
    // Arrange
    const sut = new FastUtf8({ bufferSize: 1024 });
    const input = "a".repeat(342);

    // Act
    const result = sut.countBytes(input);

    // Assert
    expect(result).toBe(342);
  });

  test("同一文字列に対して複数回実行したとき、キャッシュが利用され同じ結果を返す", ({ expect }) => {
    // Arrange
    const sut = new FastUtf8({ caching: true });
    const input = "cache_test";

    // Act
    const result1 = sut.countBytes(input);
    const result2 = sut.countBytes(input);

    // Assert
    expect(result1).toBe(10);
    expect(result2).toBe(10);
  });

  test("キャッシュが無効化されているとき、キャッシュを利用せずに計算結果を返す", ({ expect }) => {
    // Arrange
    const sut = new FastUtf8({ caching: false });
    const input = "no_cache";

    // Act
    const result1 = sut.countBytes(input);
    const result2 = sut.countBytes(input);

    // Assert
    expect(result1).toBe(8);
    expect(result2).toBe(8);
  });

  test("厳格モードで入力が正常なとき、エラーを出さずにバイト数を返す", ({ expect }) => {
    // Arrange
    const sut = new FastUtf8({ strict: true });
    const input = "Valid UTF-8";

    // Act
    const result = sut.countBytes(input);

    // Assert
    expect(result).toBe(11);
  });

  test("厳格モードで UTF-16 における不正なサロゲートペアが含まれるとき、置換文字としてカウントする", ({
    expect,
  }) => {
    // Arrange
    const sut = new FastUtf8({ strict: true });
    const input = "\uD800";

    // Act
    const result = sut.countBytes(input);

    // Assert
    // 不正な文字は UTF-8 置換文字（U+FFFD: 3bytes）として処理される。
    expect(result).toBe(3);
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
