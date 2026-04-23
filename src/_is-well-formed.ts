/**
 * 文字列が適切に構成されているかどうかを判定します。
 *
 * @param s 判定対象の文字列です。
 * @returns 文字列が適切に構成されている場合は `true` を、そうでない場合は `false` を返します。
 */
let isWellFormed: (s: string) => boolean;

if ("isWellFormed" in String.prototype) {
  // oxlint-disable-next-line typescript/unbound-method
  const StringIsWellFormed = String.prototype.isWellFormed;
  isWellFormed = function isWellFormed(s) {
    return s === "" || StringIsWellFormed.call(s);
  };
} else {
  isWellFormed = function isWellFormed(s) {
    if (s === "") {
      return true;
    }

    if (s == null) {
      throw new TypeError("String.prototype.isWellFormed called on null or undefined");
    }

    try {
      s = String(s);
      // encodeURIComponent は不正なサロゲートペアが含まれている場合に URIError を投げます。
      encodeURIComponent(s);
      return true;
    } catch {
      return false;
    }
  };
}

export default isWellFormed;
