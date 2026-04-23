import { bench, describe } from "vitest";

import FastUtf8 from "../src/fast-utf8.js"; // パスは適宜調整してください

// テキストデータの準備
const shortText = "こんにちは、世界！"; // 内部バッファーに収まるサイズ
const longText = "FastUtf8のパフォーマンステスト用文字列".repeat(100); // バッファーを超えるサイズ
const encodedBytes = new TextEncoder().encode(shortText);

// インスタンスの準備
const nativeEncoder = new TextEncoder();
const nativeDecoder = new TextDecoder();
const fastUtf8 = new FastUtf8({ bufferSize: 1024, caching: false });
const fastUtf8Cached = new FastUtf8({ bufferSize: 1024, caching: true });

// バッファーを再利用するエンコード
describe("1. encode: Buffer reuse", () => {
  bench("Native", () => {
    nativeEncoder.encode(shortText);
  });

  bench("FastUtf8", () => {
    fastUtf8.encode(shortText);
  });
});

// キャッシュが見つかるときのエンコード
describe("2. encode: Cache Hit", () => {
  bench("Native", () => {
    nativeEncoder.encode(shortText);
  });

  bench("FastUtf8", () => {
    fastUtf8Cached.encode(shortText);
  });
});

// バッファーを再利用できないエンコード
describe("3. encode: No Buffer", () => {
  bench("Native", () => {
    nativeEncoder.encode(longText);
  });

  bench("FastUtf8", () => {
    fastUtf8.encode(longText);
  });
});

// デコード
describe("4. decode", () => {
  bench("Native", () => {
    nativeDecoder.decode(encodedBytes);
  });

  bench("FastUtf8", () => {
    fastUtf8.decode(encodedBytes);
  });
});

// 検証
describe("5. isValidUtf8", () => {
  bench("String", () => {
    fastUtf8.isValidUtf8(shortText);
  });

  bench("Bytes", () => {
    fastUtf8.isValidUtf8(encodedBytes);
  });
});
