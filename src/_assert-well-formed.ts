import { tryCaptureStackTrace } from "try-capture-stack-trace";

import isWellFormed from "./_is-well-formed.js";

/**
 * 文字列が適切に構成されていることを検証します。
 *
 * @param s 検証対象の文字列です。
 */
export default function assertWellFormed(s: string): void {
  if (isWellFormed(s)) {
    return;
  }

  // `TextDecoder.decode` を使ってバイト列を検証することもあります。その場合は組み込みのエラーインスタンスをそのまま投げるため、ここでもエラーコンストラクターには独自のではなく、組み込みの `TypeError` を使います。
  const error = new TypeError("The encoded data was not valid for encoding utf-8");
  tryCaptureStackTrace(error, assertWellFormed);
  throw error;
}
