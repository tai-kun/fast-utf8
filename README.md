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

総評としては、Node.js（Bun、Deno は未測定）と Chromium、WebKit 環境で高速化が見込めます。Firefox ではむしろパフォーマンスが悪化します。

### Node.js

```
 ✓ benchmarks/fast-utf8.bench.ts > 1. encode: Buffer reuse 3232ms
     name                 hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native     3,042,214.20  0.0002  4.1961  0.0003  0.0003  0.0018  0.0023  0.0035  ±1.81%  1521108
   · FastUtf8  10,692,189.91  0.0001  2.3182  0.0001  0.0001  0.0001  0.0002  0.0003  ±0.92%  5346095

 ✓ benchmarks/fast-utf8.bench.ts > 2. encode: Cache Hit 4459ms
     name                 hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native     2,999,371.82  0.0002  4.4821  0.0003  0.0003  0.0019  0.0024  0.0037  ±2.49%  1499686
   · FastUtf8  18,278,867.16  0.0000  4.6552  0.0001  0.0001  0.0001  0.0001  0.0002  ±1.83%  9139434

 ✓ benchmarks/fast-utf8.bench.ts > 3. encode: No Buffer 1299ms
     name              hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native    274,621.42  0.0032  0.5873  0.0036  0.0035  0.0073  0.0084  0.0150  ±0.56%   137311
   · FastUtf8  274,851.16  0.0032  0.5382  0.0036  0.0035  0.0075  0.0085  0.0154  ±0.56%   137426

 ✓ benchmarks/fast-utf8.bench.ts > 4. decode 3188ms
     name                hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native    6,824,418.03  0.0001  0.0257  0.0001  0.0001  0.0002  0.0002  0.0003  ±0.06%  3412210
   · FastUtf8  6,812,584.95  0.0001  0.0843  0.0001  0.0001  0.0002  0.0002  0.0003  ±0.07%  3406293

 BENCH  Summary

  FastUtf8 - benchmarks/fast-utf8.bench.ts > 1. encode: Buffer reuse
    3.51x faster than Native

  FastUtf8 - benchmarks/fast-utf8.bench.ts > 2. encode: Cache Hit
    6.09x faster than Native

  FastUtf8 - benchmarks/fast-utf8.bench.ts > 3. encode: No Buffer
    1.00x faster than Native

  Native - benchmarks/fast-utf8.bench.ts > 4. decode
    1.00x faster than FastUtf8
```

### chromium

```
 ✓  chromium  benchmarks/fast-utf8.bench.ts > 1. encode: Buffer reuse 1739ms
     name                hz     min      max    mean     p75     p99    p995    p999      rme  samples
   · Native    1,088,450.00  0.0000  49.5000  0.0009  0.0000  0.0000  0.1000  0.1000  ±23.77%   544225
   · FastUtf8  3,353,977.20  0.0000   1.2000  0.0003  0.0000  0.0000  0.0000  0.1000   ±2.88%  1677324

 ✓  chromium  benchmarks/fast-utf8.bench.ts > 2. encode: Cache Hit 2379ms
     name                hz     min      max    mean     p75     p99    p995    p999      rme  samples
   · Native    1,115,090.00  0.0000  36.2000  0.0009  0.0000  0.0000  0.1000  0.1000  ±27.01%   557545
   · FastUtf8  8,845,964.00  0.0000   0.2000  0.0001  0.0000  0.0000  0.0000  0.1000   ±2.78%  4422982

 ✓  chromium  benchmarks/fast-utf8.bench.ts > 3. encode: No Buffer 1296ms
     name              hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native    159,378.00  0.0000  3.6000  0.0063  0.0000  0.1000  0.1000  0.1000  ±3.69%    79689
   · FastUtf8  155,782.84  0.0000  1.4000  0.0064  0.0000  0.1000  0.1000  0.1000  ±3.59%    77907

 ✓  chromium  benchmarks/fast-utf8.bench.ts > 4. decode 1985ms
     name                hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native    3,805,728.00  0.0000  0.1000  0.0003  0.0000  0.0000  0.0000  0.1000  ±2.77%  1902864
   · FastUtf8  3,688,018.00  0.0000  0.1000  0.0003  0.0000  0.0000  0.0000  0.1000  ±2.77%  1844009

 BENCH  Summary

   chromium  FastUtf8 - benchmarks/fast-utf8.bench.ts > 1. encode: Buffer reuse
    3.08x faster than Native

   chromium  FastUtf8 - benchmarks/fast-utf8.bench.ts > 2. encode: Cache Hit
    7.93x faster than Native

   chromium  Native - benchmarks/fast-utf8.bench.ts > 3. encode: No Buffer
    1.02x faster than FastUtf8

   chromium  Native - benchmarks/fast-utf8.bench.ts > 4. decode
    1.03x faster than FastUtf8
```

### firefox

```
 ✓  firefox  benchmarks/fast-utf8.bench.ts > 1. encode: Buffer reuse 12058ms
     name                hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native    7,806,776.00  0.0000  1.0000  0.0001  0.0000  0.0000  0.0000  0.0000  ±8.76%  3903388
   · FastUtf8  3,699,354.00  0.0000  1.0000  0.0003  0.0000  0.0000  0.0000  0.0000  ±8.76%  1849677

 ✓  firefox  benchmarks/fast-utf8.bench.ts > 2. encode: Cache Hit 19304ms
     name                 hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native     8,634,904.00  0.0000  1.0000  0.0001  0.0000  0.0000  0.0000  0.0000  ±8.76%  4317452
   · FastUtf8  11,743,090.00  0.0000  1.0000  0.0001  0.0000  0.0000  0.0000  0.0000  ±8.77%  5871545

 ✓  firefox  benchmarks/fast-utf8.bench.ts > 3. encode: No Buffer 1792ms
     name              hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native    263,674.00  0.0000  1.0000  0.0038  0.0000  0.0000  0.0000  1.0000  ±8.75%   131837
   · FastUtf8  271,170.00  0.0000  1.0000  0.0037  0.0000  0.0000  0.0000  1.0000  ±8.75%   135585

 ✓  firefox  benchmarks/fast-utf8.bench.ts > 4. decode 10280ms
     name                hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native    5,449,948.00  0.0000  1.0000  0.0002  0.0000  0.0000  0.0000  0.0000  ±8.76%  2724974
   · FastUtf8  4,317,404.00  0.0000  1.0000  0.0002  0.0000  0.0000  0.0000  0.0000  ±8.76%  2158702

 BENCH  Summary

   firefox  Native - benchmarks/fast-utf8.bench.ts > 1. encode: Buffer reuse
    2.11x faster than FastUtf8

   firefox  FastUtf8 - benchmarks/fast-utf8.bench.ts > 2. encode: Cache Hit
    1.36x faster than Native

   firefox  FastUtf8 - benchmarks/fast-utf8.bench.ts > 3. encode: No Buffer
    1.03x faster than Native

   firefox  Native - benchmarks/fast-utf8.bench.ts > 4. decode
    1.26x faster than FastUtf8
```

### webkit

```
 ✓  webkit  benchmarks/fast-utf8.bench.ts > 1. encode: Buffer reuse 2075ms
     name                hz     min      max    mean     p75     p99    p995    p999      rme  samples
   · Native    4,473,826.00  0.0000  20.0000  0.0002  0.0000  0.0000  0.0000  0.0000  ±11.63%  2236913
   · FastUtf8  4,980,916.00  0.0000   1.0000  0.0002  0.0000  0.0000  0.0000  0.0000   ±8.76%  2490458

 ✓  webkit  benchmarks/fast-utf8.bench.ts > 2. encode: Cache Hit 3141ms
     name                 hz     min      max    mean     p75     p99    p995    p999      rme   samples
   · Native     4,451,532.00  0.0000  21.0000  0.0002  0.0000  0.0000  0.0000  0.0000  ±13.72%   2225766
   · FastUtf8  20,678,704.00  0.0000   1.0000  0.0000  0.0000  0.0000  0.0000  0.0000   ±8.77%  10339352

 ✓  webkit  benchmarks/fast-utf8.bench.ts > 3. encode: No Buffer 1286ms
     name              hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native    351,401.20  0.0000  3.0000  0.0028  0.0000  0.0000  0.0000  1.0000  ±8.81%   176052
   · FastUtf8  367,252.00  0.0000  3.0000  0.0027  0.0000  0.0000  0.0000  1.0000  ±8.89%   183626

 ✓  webkit  benchmarks/fast-utf8.bench.ts > 4. decode 2073ms
     name                hz     min     max    mean     p75     p99    p995    p999     rme  samples
   · Native    5,223,062.00  0.0000  1.0000  0.0002  0.0000  0.0000  0.0000  0.0000  ±8.76%  2611531
   · FastUtf8  5,541,778.44  0.0000  1.0000  0.0002  0.0000  0.0000  0.0000  0.0000  ±8.76%  2776431

 BENCH  Summary

   webkit  FastUtf8 - benchmarks/fast-utf8.bench.ts > 1. encode: Buffer reuse
    1.11x faster than Native

   webkit  FastUtf8 - benchmarks/fast-utf8.bench.ts > 2. encode: Cache Hit
    4.65x faster than Native

   webkit  FastUtf8 - benchmarks/fast-utf8.bench.ts > 3. encode: No Buffer
    1.05x faster than Native

   webkit  FastUtf8 - benchmarks/fast-utf8.bench.ts > 4. decode
    1.06x faster than Native
```

## ライセンス

MIT
