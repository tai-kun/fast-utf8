const DEFAULT_MAX_CACHE_SIZE = 10 * 1024;

/**
 * [API Reference](https://tai-kun.github.io/fast-utf8/api#latest-one-cache-map)
 */
export default class LatestOneCacheMap {
  /**
   * 保持している項目です。
   */
  private entry: { key: string; value: Uint8Array<ArrayBuffer> } | undefined;

  public readonly maxCacheSize: number;

  /**
   * [API Reference](https://tai-kun.github.io/fast-utf8/api#latest-one-cache-map)
   */
  public constructor(maxCacheSize: number = DEFAULT_MAX_CACHE_SIZE) {
    this.maxCacheSize = maxCacheSize;
  }

  public get(key: string): Uint8Array<ArrayBuffer> | null {
    if (this.entry !== undefined && key === this.entry.key) {
      return this.entry.value;
    }

    return null;
  }

  public set(key: string, value: Uint8Array<ArrayBuffer>): void {
    if (value.length > this.maxCacheSize) {
      return;
    }

    this.entry = { key, value };
  }

  public clear(): void {
    this.entry = undefined;
  }
}
