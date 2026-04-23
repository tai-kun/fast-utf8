import assertWellFormed from "./_assert-well-formed.js";
import isWellFormed from "./_is-well-formed.js";
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
export interface IEncodeCacheMap {
  /**
   * キーに対応するエンコード済みのデータを取得します。
   *
   * @param text 検索キーとなる文字列です。
   * @returns キャッシュされた Uint8Array、または存在しない場合は null/undefined を返します。
   */
  get(text: string): Uint8Array<ArrayBuffer> | null | undefined;

  /**
   * エンコード済みのデータをキャッシュに保存します。
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
 * TextDecoder の初期化オプションの型定義です。
 */
export type TextDecoderOptions = {
  /**
   * 不正なバイト列に遭遇した際にエラーを投げるかどうかを指定します。
   */
  readonly fatal?: boolean | undefined;

  /**
   * バイトオーダーマーク（BOM）を無視するかどうかを指定します。
   */
  readonly ignoreBOM?: boolean | undefined;
};

/**
 * {@link FastUtf8} クラスのコンストラクターに渡すオプションの型定義です。
 */
export type FastUtf8Options = {
  /**
   * 内部で使用するバッファーのサイズ（バイト単位）です。
   */
  readonly bufferSize?: number | undefined;

  /**
   * デコーダーの設定オプションです。
   */
  readonly decoder?: TextDecoderOptions | undefined;

  /**
   * エンコード結果のキャッシュを有効にするかどうかを指定します。
   */
  readonly caching?: boolean | undefined;

  /**
   * カスタムのキャッシュマップ実装を提供する場合に使用します。
   */
  readonly encodeCacheMap?: IEncodeCacheMap | undefined;
};

/**
 * 高速な UTF-8 エンコードおよびデコードを提供するクラスです。
 *
 * 頻繁なメモリーアロケーションを抑えるための内部バッファー管理と、オプションによるキャッシュ機能を備えています。
 */
export default class FastUtf8 {
  /**
   * キャッシュ機能が有効かどうかを保持します。
   */
  private caching: boolean;

  /**
   * エンコード結果を保持するキャッシュマップです。
   */
  private readonly eCacheMap: IEncodeCacheMap;

  /**
   * 内部バッファーを遅延初期化して取得する関数です。
   */
  private readonly getBuffer: () => Uint8Array<ArrayBuffer>;

  /**
   * メインの TextDecoder インスタンスを遅延初期化して取得する関数です。
   */
  private readonly getDecoder: () => TextDecoder;

  /**
   * TextEncoder インスタンスを遅延初期化して取得する関数です。
   */
  private readonly getEncoder: () => TextEncoder;

  /**
   * バリデーション用の TextDecoder インスタンス（fatal: true 固定）を取得する関数です。
   */
  private readonly getV8nDecoder: () => TextDecoder;

  /**
   * 事前確保したバッファーを安全に使用できる最大文字数です。
   */
  private readonly safeBufferSize: number;

  /**
   * インスタンスを初期化します。
   *
   * @param options オプションです。
   */
  public constructor(options: FastUtf8Options = {}) {
    const {
      caching = false,
      decoder: { fatal = false, ignoreBOM = false } = {},
      bufferSize = DEFAULT_BUFFER_SIZE,
      encodeCacheMap = new LatestOneCacheMap(),
    } = options;

    // 各リソースは必要になるまで生成されないよう、クロージャー内で管理されます。
    let buffer: Uint8Array<ArrayBuffer> | undefined;
    let decoder: TextDecoder | undefined;
    let encoder: TextEncoder | undefined;
    let v8nDecoder: TextDecoder | undefined;

    this.caching = caching;
    this.eCacheMap = encodeCacheMap;
    this.getBuffer = () => (buffer ||= new Uint8Array(bufferSize));
    this.getDecoder = () => (decoder ||= new TextDecoder("utf-8", { fatal, ignoreBOM }));
    this.getEncoder = () => (encoder ||= new TextEncoder());
    // メインデコーダーが既に fatal: true であればそれを再利用し、そうでなければバリデーション用に別途作成します。
    this.getV8nDecoder = fatal
      ? this.getDecoder
      : () => (v8nDecoder ||= new TextDecoder("utf-8", { fatal: true, ignoreBOM }));
    // エンコード後の配列の長さが元の文字列の長さの 3 倍を超えることは理論上ありません。
    // そのため、bufferSize / 3 以下の長さの文字列であれば、必ず bufferSize 内に収まると保証されます。
    // 参考: https://developer.mozilla.org/docs/Web/API/TextEncoder/encodeInto
    this.safeBufferSize = Math.floor(bufferSize / 3);
  }

  /**
   * バイト列を文字列にデコードします。
   *
   * @param input デコード対象のバイト列です。
   * @returns デコードされた文字列です。
   */
  public decode(input: DecodeInput): string {
    const decoder = this.getDecoder();
    const decoded = decoder.decode(input);

    return decoded;
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
      const encoded = this.eCacheMap.get(input);
      if (encoded != null) {
        // 呼び出し側での変更がキャッシュに影響しないよう、コピーを返します。
        return encoded.slice();
      }
    }

    assertWellFormed(input);

    const encoder = this.getEncoder();
    let encoded: Uint8Array<ArrayBuffer>;

    if (input.length <= this.safeBufferSize) {
      // 文字列が十分短い場合、再利用可能な内部バッファーを使用してヒープアロケーションを削減します。
      const tmpDest = this.getBuffer();
      const result = encoder.encodeInto(input, tmpDest);
      encoded = tmpDest.slice(0, result.written);
    } else {
      // 文字列が長い場合は、標準の encode メソッドを使用して、適切なサイズのバッファーを新規に割り当てます。
      encoded = encoder.encode(input);
    }

    if (this.caching) {
      // 保存時にもコピーを作成し、外部からの変更からキャッシュを保護します。
      const copied = encoded.slice();
      this.eCacheMap.set(input, copied);
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
    assertWellFormed(source);

    const encoder = this.getEncoder();
    const result = encoder.encodeInto(source, destination);

    return result;
  }

  /**
   * 指定された入力が正当な UTF-8/UTF-16 シーケンスであるかどうかを判定します。
   *
   * @param input 判定対象の文字列、またはバイト列です。
   * @returns 正当な場合は true、そうでない場合は false を返します。
   */
  public isValidUtf8(input: string | DecodeInput): boolean {
    if (typeof input === "string") {
      return isWellFormed(input);
    }

    const decoder = this.getV8nDecoder();
    try {
      decoder.decode(input); // 不正な UTF-8 でエラーが投げられます。
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 現在保持されているエンコードキャッシュをすべてクリアします。
   */
  public clearCache(): void {
    this.eCacheMap.clear();
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
