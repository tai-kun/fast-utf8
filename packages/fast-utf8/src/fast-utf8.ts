import LatestOneCacheMap from "./latest-one-cache-map.js";

const DEFAULT_ALLOCATE_SIZE = 1024;

/**
 * デコードへ渡せる入力の型です。
 *
 * `TextDecoder.prototype.decode` が受け入れる最初の引数の型に基づいています。
 */
export type DecodeInput = NonNullable<Parameters<TextDecoder["decode"]>[0]>;

/**
 * `encodeInto` の実行結果の型です。
 *
 * 読み取った文字数と書き込んだバイト数を含みます。
 */
export type EncodeIntoResult = ReturnType<TextEncoder["encodeInto"]>;

/**
 * エンコード結果を保持するキャッシュの契約です。
 */
export interface ICacheMap {
  /**
   * 保持できる最大のバイト数です。
   */
  readonly maxCacheSize?: number;

  /**
   * 指定したキーと一致する値を返します。
   *
   * @param text 検索するキーです。
   * @returns 一致した値です。一致しない場合は null または undefined を返します。
   */
  get(text: string): Uint8Array<ArrayBuffer> | null | undefined;

  /**
   * 値を保存します。
   *
   * @param text 保存するキーです。
   * @param data 保存する値です。
   */
  set(text: string, data: Uint8Array<ArrayBuffer>): void;

  /**
   * 保持している値をすべて破棄します。
   */
  clear(): void;
}

/**
 * {@link FastUtf8} のコンストラクターに渡すオプションです。
 */
export type FastUtf8Options = {
  /**
   * 厳格モードを使うかどうかです。
   *
   * 有効にすると、不正な入力に対してエラーを投げます。
   *
   * @default false
   */
  readonly strict?: boolean | undefined;

  /**
   * BOM を無視するかどうかです。
   *
   * `TextDecoder` の同名オプションにそのまま渡します。
   *
   * @default false
   */
  readonly ignoreBOM?: boolean | undefined;

  /**
   * エンコード結果のキャッシュを使うかどうかです。
   *
   * @default true
   */
  readonly caching?: boolean | undefined;

  /**
   * 独自のキャッシュ実装です。
   *
   * 省略した場合は直近の 1 件だけを保持する実装を使います。
   */
  readonly cacheMap?: ICacheMap | undefined;
} & (
  | {
      /**
       * 内部で使い回すバッファーの大きさです。
       *
       * 単位はバイトです。
       *
       * @default 1024
       */
      readonly allocateSize?: number | undefined;
    }
  | {
      /**
       * 内部で使い回すバッファーです。
       *
       * このバッファーをインスタンスの外側から変更しないでください。
       */
      readonly unsafeBuffer: Uint8Array<ArrayBuffer>;
    }
);

/**
 * 高速な UTF-8 のエンコードとデコードを提供するクラスです。
 *
 * 内部バッファーの使い回しによって割り当てを抑え、任意で結果のキャッシュを使います。
 */
export default class FastUtf8 {
  /**
   * 厳格モードを使うかどうかです。
   */
  public readonly strict: boolean;

  /**
   * キャッシュを使うかどうかです。
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
   * インスタンスを初期化します。
   *
   * @param options 動作を指定するオプションです。
   */
  public constructor(options: FastUtf8Options = {}) {
    const {
      strict = false,
      caching = true,
      cacheMap = new LatestOneCacheMap(),
      ignoreBOM = false,
    } = options;

    this.strict = strict;
    this.caching = caching;
    this.cacheMap = cacheMap;
    this.ignoreBOM = ignoreBOM;

    if ("unsafeBuffer" in options) {
      this.allocateSize = options.unsafeBuffer.byteLength;
      this.reusableBuffer = options.unsafeBuffer;
    } else {
      this.allocateSize = options.allocateSize ?? DEFAULT_ALLOCATE_SIZE;
      this.reusableBuffer = undefined;
    }

    // UTF-8 では 1 文字が最大で 3 バイトになります。
    // 参考: https://developer.mozilla.org/docs/Web/API/TextEncoder/encodeInto
    this.safeLength = Math.floor(this.allocateSize / 3);
  }

  /**
   * バイト列を文字列に変換します。
   *
   * @param input 変換するバイト列です。
   * @param options `TextDecoder` に渡すオプションです。
   * @returns 変換した文字列です。
   */
  public decode(input: DecodeInput, options?: TextDecodeOptions): string {
    return this.getDecoder().decode(input, options);
  }

  /**
   * 文字列を UTF-8 のバイト列に変換します。
   *
   * 短い文字列では内部バッファーを使い回し、長い文字列では新しく割り当てます。
   *
   * @param input 変換する文字列です。
   * @returns 変換したバイト列です。
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
   * 文字列を指定したバッファーへ直接書き込みます。
   *
   * すべて書き切った場合にだけ結果をキャッシュします。途中で打ち切った内容は保存しません。
   *
   * @param source 変換する文字列です。
   * @param destination 書き込む先のバッファーです。
   * @returns 読み取った文字数と書き込んだバイト数です。
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
   * 文字列を UTF-8 に変換したときのバイト数を数えます。
   *
   * @param input 数える対象の文字列です。
   * @returns バイト数です。
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
   * 入力が正しい UTF-8 かどうかを判定します。
   *
   * 文字列は常に符号化できるため、文字列を渡した場合は常に true を返します。
   *
   * @param input 判定する文字列またはバイト列です。
   * @returns 正しい場合は true を返します。そうでない場合は false を返します。
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
   * 保持しているキャッシュをすべて破棄します。
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
