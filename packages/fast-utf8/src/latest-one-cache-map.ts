const DEFAULT_MAX_CACHE_SIZE = 10 * 1024;

/**
 * 直近の 1 件だけを保持する簡易なキャッシュです。
 */
export default class LatestOneCacheMap {
  /**
   * 保持している項目です。
   */
  private entry: { key: string; value: Uint8Array<ArrayBuffer> } | undefined;

  /**
   * 保持できる最大のバイト数です。
   */
  public readonly maxCacheSize: number;

  /**
   * インスタンスを初期化します。
   *
   * @param maxCacheSize 保持できる最大のバイト数です。
   * @default 10240
   */
  public constructor(maxCacheSize: number = DEFAULT_MAX_CACHE_SIZE) {
    this.maxCacheSize = maxCacheSize;
  }

  /**
   * 指定したキーと一致する値を返します。
   *
   * @param key 検索するキーです。
   * @returns 一致した値です。一致しない場合は null を返します。
   */
  public get(key: string): Uint8Array<ArrayBuffer> | null {
    if (this.entry !== undefined && key === this.entry.key) {
      return this.entry.value;
    }

    return null;
  }

  /**
   * 新しい値を保存し、古い値を置き換えます。
   *
   * 値が最大バイト数を超える場合は何もせずに返ります。
   *
   * @param key 保存するキーです。
   * @param value 保存する値です。
   */
  public set(key: string, value: Uint8Array<ArrayBuffer>): void {
    if (value.length > this.maxCacheSize) {
      return;
    }

    this.entry = { key, value };
  }

  /**
   * 保持している値を破棄します。
   */
  public clear(): void {
    this.entry = undefined;
  }
}
