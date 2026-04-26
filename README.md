# fast-utf8

`FastUtf8` は、標準の `TextEncoder` と `TextDecoder` をラップし、頻繁なメモリアロケーションを抑制することで UTF-8 のエンコードを高速化する TypeScript ライブラリです。

## 特徴

- 🚀 **低アロケーション**: 小さな文字列のエンコードに内部バッファを再利用し、ガベージコレクション（GC）の負荷を軽減します。
- 🛡️ **厳格モード対応**: 不正な形式の文字列やバイト列に対して厳密なチェック（`well-formed` チェック）を行うことができます。
- 💾 **キャッシュ機能**: エンコード結果をキャッシュすることで、同一文字列の繰り返しエンコードを高速化します。
- ⚙️ **カスタマイズ可能**: バッファサイズやキャッシュ戦略（LruCache 等への差し替え）を柔軟に設定可能です。

## インストール

```bash
npm install fast-utf8
```

## 基本的な使い方

```typescript
import { FastUtf8 } from "fast-utf8";

const utf8 = new FastUtf8();

// エンコード
const encoded = utf8.encode("こんにちは、世界！");

// デコード
const decoded = utf8.decode(encoded);

console.log(decoded); // "こんにちは、世界！"
```

## オプション

コンストラクターに `FastUtf8Options` を渡すことで、動作を微調整できます。

```typescript
const utf8 = new FastUtf8({
  strict: false,
  ignoreBOM: false,
  caching: true,
  // cacheMap: new LruCacheMap(),
  bufferSize: 1024,
});
```

### オプション一覧

| オプション   | 型          | デフォルト          | 説明                                                            |
| :----------- | :---------- | :------------------ | :-------------------------------------------------------------- |
| `strict`     | `boolean`   | `false`             | `true` の場合、不正な形式の入力に対して例外を投げます。         |
| `ignoreBOM`  | `boolean`   | `false`             | `true` の場合、デコード時にBOM（Byte Order Mark）を無視します。 |
| `caching`    | `boolean`   | `true`              | エンコード結果のキャッシュをするかどうかです。                  |
| `cacheMap`   | `ICacheMap` | `LatestOneCacheMap` | キャッシュの保存先。デフォルトは直近1件のみ保持します。         |
| `bufferSize` | `number`    | `1024`              | 内部で再利用するバッファのサイズ（バイト）です。                |

## 仕組み

このライブラリーは、文字列の長さが `bufferSize / 3` 以下である場合に、事前に確保した `Uint8Array<ArrayBuffer>` に対して `TextEncoder.encodeInto` を実行し、そのスライスを返します。これにより、頻繁なエンコード処理における小さな `Uint8Array<ArrayBuffer>` オブジェクトの新規生成を最小限に抑えています。

## API リファレンス

### `encode(input: string): Uint8Array<ArrayBuffer>`

文字列を UTF-8 バイト列に変換します。

- 設定された `bufferSize` より短い文字列の場合、内部バッファを使用してアロケーションを最適化します。
- キャッシュが有効な場合、同一文字列の結果を再利用します。

### `decode(input: DecodeInput, options?: TextDecodeOptions): string`

バイト列を文字列に変換します。標準の `TextDecoder.decode` を効率的に呼び出します。

### `encodeInto(source: string, destination: Uint8Array<ArrayBuffer>): EncodeIntoResult`

既存のバッファに直接エンコード結果を書き込みます。

### `isValidUtf8(input: string | DecodeInput): boolean`

入力が正当な UTF-8（または UTF-16 文字列）であるかを判定します。

### `clearCache() / enableCache() / disableCache()`

キャッシュのクリア、および実行時のキャッシュ有効・無効の切り替えが可能です。

## カスタムキャッシュの実装

デフォルトでは「直近の1件」のみをキャッシュする `LatestOneCacheMap` が使用されます。これを LRU キャッシュなどに差し替える場合は、`ICacheMap` インターフェースを実装してください。

```typescript
import { ICacheMap, FastUtf8 } from "fast-utf8";

class MyCustomCacheMap implements ICacheMap {
  private cache = new Map<string, Uint8Array<ArrayBuffer>>();

  get(text: string) {
    return this.cache.get(text);
  }

  set(text: string, data: Uint8Array<ArrayBuffer>) {
    this.cache.set(text, data);
  }

  clear() {
    this.cache.clear();
  }
}

const utf8 = new FastUtf8({ cacheMap: new MyCustomCacheMap() });
```

## ベンチマーク

総評としては、Node.js（Bun、Deno は未測定）と Chromium、WebKit 環境でエンコードの高速化が見込めます。Firefox ではむしろパフォーマンスが悪化します。

### Node.js (v22)

```
 ✓ benchmarks/fast-utf8.bench.ts > 1. encode: Buffer reuse 3196ms
     name                 hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native     2,827,285.90  0.0002  4.7548  0.0004  0.0003  0.0033  0.0048  0.0077  ±1.92%  1413643
   · FastUtf8  10,469,352.47  0.0001  0.0893  0.0001  0.0001  0.0001  0.0001  0.0002  ±0.14%  5234677

 ✓ benchmarks/fast-utf8.bench.ts > 2. encode: Cache Hit 4883ms
     name                 hz     min     max    mean     p75     p99    p995    p999     rme   samples
   · Native     2,979,871.98  0.0002  4.5679  0.0003  0.0003  0.0030  0.0042  0.0069  ±2.38%   1489936
   · FastUtf8  20,052,034.52  0.0000  0.2366  0.0000  0.0000  0.0001  0.0001  0.0002  ±0.18%  10026018

 ✓ benchmarks/fast-utf8.bench.ts > 3. encode: No Buffer 1300ms
     name              hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native    277,197.88  0.0032  0.4804  0.0036  0.0034  0.0075  0.0085  0.0159  ±0.55%   138599
   · FastUtf8  274,618.96  0.0032  0.6108  0.0036  0.0035  0.0077  0.0087  0.0152  ±0.59%   137310

 ✓ benchmarks/fast-utf8.bench.ts > 4. decode 3236ms
     name                hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native    7,006,630.33  0.0001  0.0249  0.0001  0.0001  0.0002  0.0002  0.0003  ±0.08%  3503316
   · FastUtf8  7,023,627.73  0.0001  0.0359  0.0001  0.0001  0.0002  0.0002  0.0003  ±0.07%  3511814

 BENCH  Summary

  FastUtf8 - benchmarks/fast-utf8.bench.ts > 1. encode: Buffer reuse
    3.70x faster than Native

  FastUtf8 - benchmarks/fast-utf8.bench.ts > 2. encode: Cache Hit
    6.73x faster than Native

  Native - benchmarks/fast-utf8.bench.ts > 3. encode: No Buffer
    1.01x faster than FastUtf8

  FastUtf8 - benchmarks/fast-utf8.bench.ts > 4. decode
    1.00x faster than Native
```

### chromium

```
 ✓  chromium  benchmarks/fast-utf8.bench.ts > 1. encode: Buffer reuse 1777ms
     name                hz     min      max    mean     p75     p99    p995    p999      rme  samples
   · Native    1,169,058.00  0.0000  46.6000  0.0009  0.0000  0.0000  0.1000  0.1000  ±23.67%   584529
   · FastUtf8  3,173,444.00  0.0000   1.5000  0.0003  0.0000  0.0000  0.0000  0.1000   ±2.91%  1586722

 ✓  chromium  benchmarks/fast-utf8.bench.ts > 2. encode: Cache Hit 2416ms
     name                hz     min      max    mean     p75     p99    p995    p999      rme  samples
   · Native    1,134,639.07  0.0000  42.3000  0.0009  0.0000  0.0000  0.1000  0.1000  ±27.04%   567433
   · FastUtf8  8,745,035.00  0.0000   0.2000  0.0001  0.0000  0.0000  0.0000  0.1000   ±2.77%  4373392

 ✓  chromium  benchmarks/fast-utf8.bench.ts > 3. encode: No Buffer 1245ms
     name              hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native    155,518.90  0.0000  1.6000  0.0064  0.0000  0.1000  0.1000  0.1000  ±3.71%    77775
   · FastUtf8  155,260.00  0.0000  1.5000  0.0064  0.0000  0.1000  0.1000  0.1000  ±3.58%    77630

 ✓  chromium  benchmarks/fast-utf8.bench.ts > 4. decode 2045ms
     name                hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native    3,833,242.00  0.0000  0.1000  0.0003  0.0000  0.0000  0.0000  0.1000  ±2.77%  1916621
   · FastUtf8  3,741,657.67  0.0000  0.1000  0.0003  0.0000  0.0000  0.0000  0.1000  ±2.77%  1871203

 BENCH  Summary

   chromium  FastUtf8 - benchmarks/fast-utf8.bench.ts > 1. encode: Buffer reuse
    2.71x faster than Native

   chromium  FastUtf8 - benchmarks/fast-utf8.bench.ts > 2. encode: Cache Hit
    7.71x faster than Native

   chromium  Native - benchmarks/fast-utf8.bench.ts > 3. encode: No Buffer
    1.00x faster than FastUtf8

   chromium  Native - benchmarks/fast-utf8.bench.ts > 4. decode
    1.02x faster than FastUtf8
```

### firefox

```
 ✓  firefox  benchmarks/fast-utf8.bench.ts > 1. encode: Buffer reuse 12684ms
     name                hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native    8,961,818.00  0.0000  1.0000  0.0001  0.0000  0.0000  0.0000  0.0000  ±8.76%  4480909
   · FastUtf8  3,486,252.00  0.0000  1.0000  0.0003  0.0000  0.0000  0.0000  0.0000  ±8.76%  1743126

 ✓  firefox  benchmarks/fast-utf8.bench.ts > 2. encode: Cache Hit 18890ms
     name                 hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native     8,488,288.00  0.0000  1.0000  0.0001  0.0000  0.0000  0.0000  0.0000  ±8.76%  4244144
   · FastUtf8  11,123,990.00  0.0000  1.0000  0.0001  0.0000  0.0000  0.0000  0.0000  ±8.76%  5561995

 ✓  firefox  benchmarks/fast-utf8.bench.ts > 3. encode: No Buffer 1779ms
     name              hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native    272,886.00  0.0000  1.0000  0.0037  0.0000  0.0000  0.0000  1.0000  ±8.75%   136443
   · FastUtf8  258,580.00  0.0000  1.0000  0.0039  0.0000  0.0000  0.0000  1.0000  ±8.75%   129290

 ✓  firefox  benchmarks/fast-utf8.bench.ts > 4. decode 9804ms
     name                hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native    5,318,698.00  0.0000  1.0000  0.0002  0.0000  0.0000  0.0000  0.0000  ±8.76%  2659349
   · FastUtf8  4,135,978.00  0.0000  1.0000  0.0002  0.0000  0.0000  0.0000  0.0000  ±8.76%  2067989

 BENCH  Summary

   firefox  Native - benchmarks/fast-utf8.bench.ts > 1. encode: Buffer reuse
    2.57x faster than FastUtf8

   firefox  FastUtf8 - benchmarks/fast-utf8.bench.ts > 2. encode: Cache Hit
    1.31x faster than Native

   firefox  Native - benchmarks/fast-utf8.bench.ts > 3. encode: No Buffer
    1.06x faster than FastUtf8

   firefox  Native - benchmarks/fast-utf8.bench.ts > 4. decode
    1.29x faster than FastUtf8
```

### webkit

```
 ✓  webkit  benchmarks/fast-utf8.bench.ts > 1. encode: Buffer reuse 2021ms
     name                hz     min      max    mean     p75     p99    p995    p999      rme  samples
   · Native    4,318,548.00  0.0000  25.0000  0.0002  0.0000  0.0000  0.0000  0.0000  ±15.49%  2159274
   · FastUtf8  4,886,157.68  0.0000   1.0000  0.0002  0.0000  0.0000  0.0000  0.0000   ±8.76%  2447965

 ✓  webkit  benchmarks/fast-utf8.bench.ts > 2. encode: Cache Hit 2955ms
     name                 hz     min      max    mean     p75     p99    p995    p999      rme  samples
   · Native     4,165,126.00  0.0000  19.0000  0.0002  0.0000  0.0000  0.0000  0.0000  ±14.77%  2082563
   · FastUtf8  19,344,170.00  0.0000   1.0000  0.0001  0.0000  0.0000  0.0000  0.0000   ±8.77%  9672085

 ✓  webkit  benchmarks/fast-utf8.bench.ts > 3. encode: No Buffer 1271ms
     name              hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native    339,810.00  0.0000  3.0000  0.0029  0.0000  0.0000  0.0000  1.0000  ±8.96%   169905
   · FastUtf8  366,202.00  0.0000  3.0000  0.0027  0.0000  0.0000  0.0000  1.0000  ±8.91%   183101

 ✓  webkit  benchmarks/fast-utf8.bench.ts > 4. decode 2056ms
     name                hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native    5,373,988.02  0.0000  1.0000  0.0002  0.0000  0.0000  0.0000  0.0000  ±8.76%  2692368
   · FastUtf8  5,349,056.00  0.0000  1.0000  0.0002  0.0000  0.0000  0.0000  0.0000  ±8.76%  2674528

 BENCH  Summary

   webkit  FastUtf8 - benchmarks/fast-utf8.bench.ts > 1. encode: Buffer reuse
    1.13x faster than Native

   webkit  FastUtf8 - benchmarks/fast-utf8.bench.ts > 2. encode: Cache Hit
    4.64x faster than Native

   webkit  FastUtf8 - benchmarks/fast-utf8.bench.ts > 3. encode: No Buffer
    1.08x faster than Native

   webkit  Native - benchmarks/fast-utf8.bench.ts > 4. decode
    1.00x faster than FastUtf8
```

## ライセンス

MIT
