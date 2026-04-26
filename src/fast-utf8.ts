import LatestOneCacheMap from "./latest-one-cache-map.js";

const B = 1;
const KiB = 1024 * B;

const DEFAULT_BUFFER_SIZE = 1 * KiB;

/**
 * デコード処理の入力型定義です。
 *
 * `TextDecoder.prototype.decode` が受け入れる最初の引数の型に基づいています。
 */
export type DecodeInput = NonNullable<Parameters<TextDecoder["decode"]>[0]>;

/**
 * `encodeInto` メソッドの実行結果の型定義です。
 *
 * 書き込まれたバイト数と消費された文字数が含まれます。
 */
export type EncodeIntoResult = ReturnType<TextEncoder["encodeInto"]>;

/**
 * エンコード結果をキャッシュするためのマップインターフェースです。
 */
export interface ICacheMap {
  /**
   * キーに対応するエンコード済みのデータを取得します。
   *
   * @param text 検索キーとなる文字列です。
   * @returns キャッシュされた Uint8Array、または存在しない場合は null/undefined を返します。
   */
  get(text: string): Uint8Array<ArrayBuffer> | null | undefined;

  /**
   * エンコード済みのデータをキャッシュに保存します。
   *
   * @param text キーとなる文字列です。
   * @param data 保存するエンコード済みデータです。
   */
  set(text: string, data: Uint8Array<ArrayBuffer>): void;

  /**
   * すべてのキャッシュを破棄します。
   */
  clear(): void;
}

/**
 * {@link FastUtf8} クラスのコンストラクターに渡すオプションの型定義です。
 */
export type FastUtf8Options = {
  // -----------------------------------------------------------------------------------------------
  //
  // 挙動変更オプション
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * 厳格モードを有効にするかどうかを指定します。
   *
   * 有効な場合、不正な形式の入力に対してエラーを投げます。
   *
   * @default false
   */
  readonly strict?: boolean | undefined;

  /**
   * バイトオーダーマーク（BOM）を無視するかどうかを指定します。
   *
   * @default false
   */
  readonly ignoreBOM?: boolean | undefined;

  // -----------------------------------------------------------------------------------------------
  //
  // 最適化オプション
  //
  // -----------------------------------------------------------------------------------------------

  /**
   * エンコード結果のキャッシュを有効にするかどうかを指定します。
   *
   * @default true
   */
  readonly caching?: boolean | undefined;

  /**
   * カスタムのキャッシュマップ実装を提供する場合に使用します。
   *
   * @default LatestOneCacheMap
   */
  readonly cacheMap?: ICacheMap | undefined;

  /**
   * 内部で使用するバッファーのサイズ（バイト単位）です。
   *
   * @default 1024
   */
  readonly bufferSize?: number | undefined;
};

/**
 * 高速な UTF-8 エンコードおよびデコードを提供するクラスです。
 *
 * 頻繁なメモリーアロケーションを抑えるための内部バッファー管理と、オプションによるキャッシュ機能を備えています。
 */
export default class FastUtf8 {
  /**
   * 厳格モードが有効かどうかを保持するフラグです。
   */
  private readonly strict: boolean;

  /**
   * キャッシュ機能が有効かどうかを保持するフラグです。
   */
  private caching: boolean;

  /**
   * エンコード結果を保持するキャッシュマップです。
   */
  private readonly cacheMap: ICacheMap;

  /**
   * 内部バッファーを遅延初期化して取得する関数です。
   */
  private _buffer: () => Uint8Array<ArrayBuffer>;

  /**
   * TextDecoder の decode メソッドへの参照です。
   */
  private _decode: TextDecoder["decode"];

  /**
   * TextEncoder の encode メソッドへの参照です。
   */
  private _encode: TextEncoder["encode"];

  /**
   * TextEncoder の encodeInto メソッドへの参照です。
   */
  private _encodeInto: TextEncoder["encodeInto"];

  /**
   * 常にエラーを投げる設定（fatal: true）にされたデコード関数です。
   */
  private _assertSequence: (input: Parameters<TextDecoder["decode"]>[0]) => void;

  /**
   * 事前確保したバッファーを安全に使用できる最大文字数です。
   */
  private readonly safeStringLength: number;

  /**
   * インスタンスを初期化します。
   *
   * @param options オプションです。
   */
  public constructor(options: FastUtf8Options = {}) {
    const {
      strict = false,
      caching = true,
      cacheMap = new LatestOneCacheMap(),
      ignoreBOM = false,
      bufferSize = DEFAULT_BUFFER_SIZE,
    } = options;

    this.strict = strict;

    this.caching = caching;
    this.cacheMap = cacheMap;

    this._buffer = () => {
      const buffer = new Uint8Array(bufferSize);
      this._buffer = () => buffer;
      return this._buffer();
    };

    this._decode = (input, options) => {
      const decoder = new TextDecoder("utf-8", { fatal: strict, ignoreBOM });
      this._decode = decoder.decode.bind(decoder);
      return this._decode(input, options);
    };
    this._assertSequence = strict
      ? this._decode
      : (input) => {
          const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM });
          this._assertSequence = decoder.decode.bind(decoder);
          return this._assertSequence(input);
        };

    this._encode = (input) => {
      const encoder = new TextEncoder();
      this._encode = encoder.encode.bind(encoder);
      this._encodeInto = encoder.encodeInto.bind(encoder);
      return this._encode(input);
    };
    this._encodeInto = (source, destination) => {
      const encoder = new TextEncoder();
      this._encode = encoder.encode.bind(encoder);
      this._encodeInto = encoder.encodeInto.bind(encoder);
      return this._encodeInto(source, destination);
    };

    // エンコード後の配列の長さが元の文字列の長さの 3 倍を超えることは理論上ありません。
    // そのため、bufferSize / 3 以下の長さの文字列であれば、必ず bufferSize 内に収まると保証されます。
    // 参考: https://developer.mozilla.org/docs/Web/API/TextEncoder/encodeInto
    this.safeStringLength = Math.floor(bufferSize / 3);
  }

  /**
   * バイト列を文字列にデコードします。
   *
   * @param input デコード対象のバイト列です。
   * @param options デコードオプションです。
   * @returns デコードされた文字列です。
   */
  public decode(input: DecodeInput, options?: TextDecodeOptions): string {
    return this._decode(input, options);
  }

  /**
   * 文字列を UTF-8 バイト列にエンコードします。
   *
   * 文字列の長さに応じて、内部バッファーの利用または新規生成を自動的に選択します。
   *
   * @param input エンコード対象の文字列です。
   * @returns エンコードされたバイト列です。
   */
  public encode(input: string): Uint8Array<ArrayBuffer> {
    if (this.caching) {
      let cache: Uint8Array<ArrayBuffer> | null | undefined;
      try {
        cache = this.cacheMap.get(input);
      } catch {}

      if (cache) {
        // 呼び出し側での変更がキャッシュに影響しないよう、コピーを返します。
        return cache.slice();
      }
    }

    let encoded: Uint8Array<ArrayBuffer>;

    if (input.length <= this.safeStringLength) {
      // 文字列が十分短い場合、再利用可能な内部バッファーを使用してヒープアロケーションを削減します。
      const tmpDst = this._buffer();

      const result = this._encodeInto(input, tmpDst);
      encoded = tmpDst.slice(0, result.written);
    } else {
      // 文字列が長い場合は、標準の encode メソッドを使用して、適切なサイズのバッファーを新規に割り当てます。
      encoded = this._encode(input);
    }

    if (this.strict) {
      this._assertSequence(encoded);
    }

    if (this.caching) {
      // コピーを作成し、外部からの変更からキャッシュを保護します。
      const cache = encoded.slice();

      try {
        this.cacheMap.set(input, cache);
      } catch {}
    }

    return encoded;
  }

  /**
   * 文字列を指定されたバッファーに直接エンコードします。
   *
   * @param source エンコード対象の文字列です。
   * @param destination 書き込み先のバッファーです。
   * @returns エンコードの結果（書き込まれたバイト数など）です。
   */
  public encodeInto(source: string, destination: Uint8Array): EncodeIntoResult {
    const result = this._encodeInto(source, destination);

    if ((this.strict || this.caching) && destination.length <= result.written) {
      // destination を変更しないので参照を作ります。
      const encoded = destination.subarray(0, result.written);

      if (this.strict) {
        this._assertSequence(encoded);
      }

      if (this.caching) {
        // コピーを作成し、外部からの変更からキャッシュを保護します。同時に ArrayBufferLike を ArrayBuffer にします。
        const cache = encoded.slice();

        try {
          this.cacheMap.set(source, cache);
        } catch {}
      }
    }

    return result;
  }

  /**
   * 文字列のバイト数をカウントします。
   *
   * @param input カウント対象の文字列です。
   * @returns バイト数です。
   */
  public countBytes(input: string): number {
    if (this.caching) {
      let cache: Uint8Array<ArrayBuffer> | null | undefined;
      try {
        cache = this.cacheMap.get(input);
      } catch {}

      if (cache) {
        return cache.length;
      }
    }

    let encoded: Uint8Array<ArrayBuffer>;

    if (input.length <= this.safeStringLength) {
      // 文字列が十分短い場合、再利用可能な内部バッファーを使用してヒープアロケーションを削減します。
      const tmpDst = this._buffer();

      const result = this._encodeInto(input, tmpDst);
      encoded = tmpDst.subarray(0, result.written);
    } else {
      // 文字列が長い場合は、標準の encode メソッドを使用して、適切なサイズのバッファーを新規に割り当てます。
      encoded = this._encode(input);
    }

    if (this.strict) {
      this._assertSequence(encoded);
    }

    if (this.caching) {
      // コピーを作成し、外部からの変更からキャッシュを保護します。同時に ArrayBufferLike を ArrayBuffer にします。
      const cache = encoded.slice();

      try {
        this.cacheMap.set(input, cache);
      } catch {}
    }

    return encoded.length;
  }

  /**
   * 指定された入力が正当な UTF-8 シーケンスであるかどうかを判定します。
   *
   * @param input 判定対象の文字列、またはバイト列です。
   * @returns 正当な場合は true、そうでない場合は false を返します。
   */
  public isValidUtf8(input: string | DecodeInput): boolean {
    if (typeof input !== "string") {
      try {
        this._assertSequence(input);

        return true;
      } catch {
        return false;
      }
    }

    let cache: Uint8Array<ArrayBuffer> | null | undefined;
    let encoded: Uint8Array<ArrayBuffer> | undefined;

    if (this.caching) {
      try {
        cache = this.cacheMap.get(input);
      } catch {}

      if (cache) {
        if (this.strict) {
          // 厳格モードにおいてキャッシュされているバイト列は正当な UTF-8 シーケンスです。
          return true;
        }

        // 変更しないので参照します。
        encoded = cache;
      }
    }

    let isView: boolean;

    if (!encoded) {
      if (input.length <= this.safeStringLength) {
        // 文字列が十分短い場合、再利用可能な内部バッファーを使用してヒープアロケーションを削減します。
        const tmpDst = this._buffer();

        const result = this._encodeInto(input, tmpDst);

        // tmpDst を変更しないので参照を作ります。
        encoded = tmpDst.subarray(0, result.written);

        isView = true;
      } else {
        // 文字列が長い場合は、標準の encode メソッドを使用して、適切なサイズのバッファーを新規に割り当てます。
        encoded = this._encode(input);

        isView = false;
      }
    }

    try {
      this._assertSequence(encoded);

      return true;
    } catch {
      return false;
    } finally {
      if (this.caching && cache !== encoded) {
        // この条件分岐に入るということは、入力がエンコードされ、isView が真偽値を持っています。
        const cache = isView! ? encoded.slice() : encoded;

        try {
          this.cacheMap.set(input, cache);
        } catch {}
      }
    }
  }

  /**
   * 現在保持されているエンコードキャッシュをすべてクリアします。
   */
  public clearCache(): void {
    this.cacheMap.clear();
  }

  /**
   * キャッシュ機能を有効化します。
   */
  public enableCache(): void {
    this.caching = true;
  }

  /**
   * キャッシュ機能を無効化します。
   */
  public disableCache(): void {
    this.caching = false;
  }
}
