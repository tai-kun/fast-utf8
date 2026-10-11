# Changelog

## fast-utf8@0.0.8

### 新機能

- 設定を引き継いだインスタンスを作成する clone メソッドを追加 ([406fc30](https://github.com/tai-kun/fast-utf8/commit/406fc30bd076ebb9ff958167c375019e221e057e))
- 内部利用のバッファーをオプションに渡せるようにする ([a1eeebe](https://github.com/tai-kun/fast-utf8/commit/a1eeebe189a592db827e6330c7121341ade4c18e))
- バイト数をカウントするメソッドを追加 ([81d9a13](https://github.com/tai-kun/fast-utf8/commit/81d9a1388d559d74265351391f90f07b45f291c6))

### バグ修正

- プロパティーから状態やフラグの更新をできるようにします ([82826c1](https://github.com/tai-kun/fast-utf8/commit/82826c1ec25893b01bdcbfc76c4058be04c5c615))
- maxCacheSize を露出させる ([3d9340f](https://github.com/tai-kun/fast-utf8/commit/3d9340f34120a341c730cc23d327da7b208567e6))
- bufferSize を allocateSize に変更 ([5c2b571](https://github.com/tai-kun/fast-utf8/commit/5c2b5711e0ece57b83bdefa6bcb9885c72a7e827))
- 不正な UTF-16 でエラーを投げないようにする。キャッシュできていない箇所を修正 ([7708f65](https://github.com/tai-kun/fast-utf8/commit/7708f65e9b975ea8d7a1465b6cd8128865a78286))

### パフォーマンス改善

- 空文字列に対して余計な処理をしない ([395d211](https://github.com/tai-kun/fast-utf8/commit/395d2111957b399914ec0ac2b4da052480ffef66))
- 無駄なコピーを省く ([9c33786](https://github.com/tai-kun/fast-utf8/commit/9c33786e0628c0661cba3d186ed57cdbc278774d))
- 無駄なコピーを減らす ([f54b95e](https://github.com/tai-kun/fast-utf8/commit/f54b95ee5bfad95a8c5ab3c28c38fa9243b34659))

### ドキュメント

- 英語版を追加して公開設定 ([525b3e8](https://github.com/tai-kun/fast-utf8/commit/525b3e8e1b2485aaaf97165eaac23607197e2fe8))
- JSDoc に API リファレンスへのリンクを付ける ([a229431](https://github.com/tai-kun/fast-utf8/commit/a2294319a8299d1b87e1b4a7234387c4c75dc434))
- ドキュメント更新 ([8441a52](https://github.com/tai-kun/fast-utf8/commit/8441a52fb526e9e63711b1bb30c593ec86736276))

### テスト

- API の変更に伴う修正 ([95f0c4d](https://github.com/tai-kun/fast-utf8/commit/95f0c4d9f9161c00ccf3556dd2809c0e96e51b8d))

### その他

- 刷新 ([6cb32d7](https://github.com/tai-kun/fast-utf8/commit/6cb32d7191ef52599449f262f75009d2e1e56046))
- npm から pnpm に移行 ([e104f1b](https://github.com/tai-kun/fast-utf8/commit/e104f1b93bb564ad0478cece3674f609c7aa260e))
- Bun のベンチマーク結果を追加 ([afae9f6](https://github.com/tai-kun/fast-utf8/commit/afae9f633c18c5b2090618f7f0f86f17aace8e39))
- ベンチマーク結果の更新 ([8f59d54](https://github.com/tai-kun/fast-utf8/commit/8f59d542fa10d03193f38fa60c9572970cdabd3c))
- キャッシュ整合性およびメモリー安全性の検証に関するテストを追加 ([073392c](https://github.com/tai-kun/fast-utf8/commit/073392cd8b82d45b8a622f6bf77ab243ea6d4eea))
- package.json を修正 ([5b5f701](https://github.com/tai-kun/fast-utf8/commit/5b5f701e9d84f4b026e84dbea4c44f2f6979c668))
- README を追加 ([82c2e99](https://github.com/tai-kun/fast-utf8/commit/82c2e99ad786b94c87749915d2be8f2d3a9870ce))
- パフォーマンスの改善とそれに伴うオプションの変更 ([8aa27cf](https://github.com/tai-kun/fast-utf8/commit/8aa27cfca2fa71b365b33fd676971d01eb186b1b))
- ベンチマークコードを追加 ([b22dc5d](https://github.com/tai-kun/fast-utf8/commit/b22dc5dea40d15eed9f63efa6d9095fcd2f83952))
- 最初のコミット ([a63f622](https://github.com/tai-kun/fast-utf8/commit/a63f622d972dd0516c980eaf383e4aa951c64185))

**Full Changelog**: https://github.com/tai-kun/fast-utf8/commits/fast-utf8@0.0.8
