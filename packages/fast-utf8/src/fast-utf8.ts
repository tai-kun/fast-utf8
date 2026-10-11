import LatestOneCacheMap from "./latest-one-cache-map.js";

const DEFAULT_ALLOCATE_SIZE = 1024;

/**
 * [API Reference](https://tai-kun.github.io/fast-utf8/api#types)
 */
export type DecodeInput = NonNullable<Parameters<TextDecoder["decode"]>[0]>;

/**
 * [API Reference](https://tai-kun.github.io/fast-utf8/api#types)
 */
export type EncodeIntoResult = ReturnType<TextEncoder["encodeInto"]>;

/**
 * [API Reference](https://tai-kun.github.io/fast-utf8/api#icache-map)
 */
export interface ICacheMap {
  readonly maxCacheSize?: number;

  get(text: string): Uint8Array<ArrayBuffer> | null | undefined;

  set(text: string, data: Uint8Array<ArrayBuffer>): void;

  clear(): void;
}

/**
 * [API Reference](https://tai-kun.github.io/fast-utf8/api#options)
 */
export type FastUtf8Options = {
  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#options)
   */
  readonly strict?: boolean | undefined;

  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#options)
   */
  readonly ignoreBOM?: boolean | undefined;

  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#options)
   */
  readonly caching?: boolean | undefined;

  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#options)
   */
  readonly cacheMap?: ICacheMap | undefined;

  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#options)
   */
  readonly allocateSize?: number | undefined;

  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#options)
   */
  readonly unsafeBuffer?: Uint8Array<ArrayBuffer> | undefined;
};

/**
 * [API Reference](https://tai-kun.github.io/fast-utf8/api#clone-options)
 */
export type FastUtf8CloneOptions = {
  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#clone-options)
   */
  readonly strict?: boolean | undefined;

  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#clone-options)
   */
  readonly ignoreBOM?: boolean | undefined;

  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#clone-options)
   */
  readonly caching?: boolean | undefined;

  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#clone-options)
   */
  readonly cacheMap?: ICacheMap | undefined;

  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#clone-options)
   */
  readonly allocateSize?: number | undefined;

  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#clone-options)
   */
  readonly unsafeBuffer?: Uint8Array<ArrayBuffer> | undefined;
};

/**
 * [API Reference](https://tai-kun.github.io/fast-utf8/api#fast-utf8)
 */
export default class FastUtf8 {
  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#properties)
   */
  public readonly strict: boolean;

  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#properties)
   */
  public caching: boolean;

  /**
   * エンコード結果の保存先です。
   */
  private readonly cacheMap: ICacheMap;

  /**
   * `TextDecoder` の BOM に関する設定です。
   */
  private readonly ignoreBOM: boolean;

  /**
   * 外部から渡されたバッファーです。
   *
   * `unsafeBuffer` で初期化した場合だけ値を持ちます。
   */
  private readonly externalBuffer: Uint8Array<ArrayBuffer> | undefined;

  /**
   * 使い回すための内部バッファーです。
   */
  private reusableBuffer: Uint8Array<ArrayBuffer> | undefined;

  /**
   * 内部バッファーの大きさです。
   *
   * 単位はバイトです。
   */
  private readonly allocateSize: number;

  /**
   * 内部バッファーに収まることが保証される文字数です。
   */
  private readonly safeLength: number;

  /**
   * 遅延生成したデコーダーです。
   */
  private decoder: TextDecoder | undefined;

  /**
   * 検証専用のデコーダーです。
   *
   * 常に `fatal` を有効にして使います。
   */
  private assertDecoder: TextDecoder | undefined;

  /**
   * 遅延生成したエンコーダーです。
   */
  private encoder: TextEncoder | undefined;

  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#constructor)
   */
  public constructor(options: FastUtf8Options = {}) {
    const {
      strict = false,
      caching = true,
      cacheMap = new LatestOneCacheMap(),
      ignoreBOM = false,
      allocateSize = DEFAULT_ALLOCATE_SIZE,
      unsafeBuffer,
    } = options;

    this.strict = strict;
    this.caching = caching;
    this.cacheMap = cacheMap;
    this.ignoreBOM = ignoreBOM;

    if (unsafeBuffer) {
      this.allocateSize = unsafeBuffer.byteLength;
      this.externalBuffer = unsafeBuffer;
      this.reusableBuffer = unsafeBuffer;
    } else {
      this.allocateSize = allocateSize;
      this.externalBuffer = undefined;
      this.reusableBuffer = undefined;
    }

    // UTF-8 では 1 文字が最大で 3 バイトになります。
    // 参考: https://developer.mozilla.org/docs/Web/API/TextEncoder/encodeInto
    this.safeLength = Math.floor(this.allocateSize / 3);
  }

  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#clone)
   */
  public clone(overrides: FastUtf8CloneOptions = {}): FastUtf8 {
    const {
      strict = this.strict,
      caching = this.caching,
      cacheMap = this.cacheMap,
      ignoreBOM = this.ignoreBOM,
      allocateSize = this.allocateSize,
      unsafeBuffer = this.externalBuffer,
    } = overrides;

    return new FastUtf8({
      strict,
      caching,
      cacheMap,
      ignoreBOM,
      allocateSize,
      unsafeBuffer,
    });
  }

  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#decode)
   */
  public decode(input: DecodeInput, options?: TextDecodeOptions): string {
    return this.getDecoder().decode(input, options);
  }

  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#encode)
   */
  public encode(input: string): Uint8Array<ArrayBuffer> {
    const cached = this.readCache(input);
    if (cached !== undefined) {
      // 呼び出し側での変更から保存内容を守るために複製を返します。
      return cached.slice();
    }

    const encoded = this.encodeUncached(input);

    if (this.strict) {
      this.assertValid(encoded);
    }

    this.writeCache(input, encoded);

    return encoded;
  }

  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#encode-into)
   */
  public encodeInto(source: string, destination: Uint8Array): EncodeIntoResult {
    const result = this.getEncoder().encodeInto(source, destination as Uint8Array<ArrayBufferLike>);

    if (result.read !== source.length) {
      return result;
    }

    // destination を変更しないため、書き込んだ範囲の参照を作ります。
    const encoded = destination.subarray(0, result.written);

    if (this.strict) {
      this.assertValid(encoded);
    }

    if (this.caching) {
      this.writeCache(source, encoded);
    }

    return result;
  }

  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#count-bytes)
   */
  public countBytes(input: string): number {
    const cached = this.readCache(input);
    if (cached !== undefined) {
      return cached.length;
    }

    let length: number;
    let encodedForCache: Uint8Array | undefined;

    if (input.length <= this.safeLength) {
      // 内部バッファーを使い回して割り当てを抑えます。
      const buffer = this.getReusableBuffer();
      const result = this.getEncoder().encodeInto(input, buffer as Uint8Array<ArrayBufferLike>);
      length = result.written;
      // buffer を変更しないため、書き込んだ範囲の参照を作ります。
      encodedForCache = buffer.subarray(0, result.written);
    } else {
      const encoded = this.getEncoder().encode(input);
      length = encoded.length;
      encodedForCache = encoded;
    }

    if (this.strict) {
      this.assertValid(encodedForCache);
    }

    if (encodedForCache !== undefined) {
      this.writeCache(input, encodedForCache);
    }

    return length;
  }

  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#is-valid-utf8)
   */
  public isValidUtf8(input: string | DecodeInput): boolean {
    if (typeof input === "string") {
      return true;
    }

    if (input.byteLength <= 0) {
      return true;
    }

    try {
      this.getAssertDecoder().decode(input);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#clear-cache)
   */
  public clearCache(): void {
    this.cacheMap.clear();
  }

  /**
   * 使い回すための内部バッファーを返します。
   *
   * @returns 内部バッファーです。
   */
  private getReusableBuffer(): Uint8Array<ArrayBuffer> {
    if (this.reusableBuffer === undefined) {
      this.reusableBuffer = new Uint8Array(this.allocateSize);
    }

    return this.reusableBuffer;
  }

  /**
   * デコーダーを返します。
   *
   * @returns デコーダーです。
   */
  private getDecoder(): TextDecoder {
    if (this.decoder === undefined) {
      this.decoder = new TextDecoder("utf-8", {
        fatal: this.strict,
        ignoreBOM: this.ignoreBOM,
      });
    }

    return this.decoder;
  }

  /**
   * 検証専用のデコーダーを返します。
   *
   * @returns 常にエラーを投げる設定のデコーダーです。
   */
  private getAssertDecoder(): TextDecoder {
    if (this.assertDecoder === undefined) {
      this.assertDecoder = new TextDecoder("utf-8", {
        fatal: true,
        ignoreBOM: this.ignoreBOM,
      });
    }

    return this.assertDecoder;
  }

  /**
   * エンコーダーを返します。
   *
   * @returns エンコーダーです。
   */
  private getEncoder(): TextEncoder {
    if (this.encoder === undefined) {
      this.encoder = new TextEncoder();
    }

    return this.encoder;
  }

  /**
   * キャッシュから値を読み取ります。
   *
   * @param text 検索するキーです。
   * @returns 一致した値の参照です。一致しない場合や読み取りに失敗した場合は undefined を返します。
   */
  private readCache(text: string): Uint8Array<ArrayBuffer> | undefined {
    if (!this.caching) {
      return undefined;
    }

    try {
      const cached = this.cacheMap.get(text);
      return cached ?? undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * 値をキャッシュに保存します。
   *
   * 呼び出し側や内部バッファーの変更から保存内容を守るために、内部で複製を作ります。
   *
   * @param text 保存するキーです。
   * @param data 保存する値です。
   */
  private writeCache(text: string, data: Uint8Array): void {
    if (!this.caching) {
      return;
    }

    if (!this.isCacheable(data.length)) {
      return;
    }

    // 複製を作り、外部からの変更から保存内容を守ります。
    const copy = data.slice() as Uint8Array<ArrayBuffer>;

    try {
      this.cacheMap.set(text, copy);
    } catch {
      // 独自実装が投げても本処理には影響させません。
    }
  }

  /**
   * 指定した大きさがキャッシュできるかどうかを判定します。
   *
   * @param byteLength 判定するバイト数です。
   * @returns 保存できる場合は true を返します。
   */
  private isCacheable(byteLength: number): boolean {
    return this.cacheMap.maxCacheSize === undefined || this.cacheMap.maxCacheSize >= byteLength;
  }

  /**
   * キャッシュを使わずに文字列を符号化します。
   *
   * @param input 変換する文字列です。
   * @returns 所有権を持つ変換結果です。
   */
  private encodeUncached(input: string): Uint8Array<ArrayBuffer> {
    if (input.length <= this.safeLength) {
      // 内部バッファーを使い回して割り当てを抑えます。
      const buffer = this.getReusableBuffer();
      const result = this.getEncoder().encodeInto(input, buffer as Uint8Array<ArrayBufferLike>);
      return buffer.slice(0, result.written);
    }

    return this.getEncoder().encode(input);
  }

  /**
   * バイト列が正しいことを検証します。
   *
   * @param input 検証するバイト列です。
   */
  private assertValid(input: Uint8Array): void {
    this.getAssertDecoder().decode(input as Uint8Array<ArrayBufferLike>);
  }
}
