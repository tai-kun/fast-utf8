const B = 1;
const KiB = 1024 * B;

const DEFAULT_MAX_CACHE_SIZE = 10 * KiB;

/**
 * 直近の 1 件のみを保持するシンプルなキャッシュマップの実装です。
 */
export default class LatestOneCacheMap {
  /**
   * キャッシュされているキーです。
   */
  private key: string | undefined;

  /**
   * キャッシュされている値です。
   */
  private value: Uint8Array<ArrayBuffer> | undefined;

  /**
   * このキャッシュインスタンスが許容する最大バイトサイズです。
   */
  public maxCacheSize: number;

  /**
   * インスタンスを初期化します。
   *
   * @param maxCacheSize キャッシュを許可する最大サイズ（バイト単位）です。
   */
  public constructor(maxCacheSize: number = DEFAULT_MAX_CACHE_SIZE) {
    this.maxCacheSize = maxCacheSize;
  }

  /**
   * 指定されたキーがキャッシュされているものと一致すれば値を返します。
   *
   * @param key 検索するキーです。
   * @returns キャッシュされている値、または一致しない場合は null を返します。
   */
  public get(key: string): Uint8Array<ArrayBuffer> | null {
    if (key === this.key) {
      return this.value!;
    }

    return null;
  }

  /**
   * 新しい値をキャッシュに保存します。古いキャッシュは上書きされます。
   *
   * @param key 保存するキーです。
   * @param value 保存する値です。
   */
  public set(key: string, value: Uint8Array<ArrayBuffer>): void {
    if (value.length > this.maxCacheSize) {
      return;
    }

    this.key = key;
    this.value = value;
  }

  /**
   * キャッシュをクリアして初期状態に戻します。
   */
  public clear(): void {
    this.key = undefined;
    this.value = undefined;
  }
}
