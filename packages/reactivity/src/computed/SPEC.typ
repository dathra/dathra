= computed API

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

追跡された依存関係が変更されたときに再計算される、キャッシュされた派生値を作成する。

== 機能仕様

#feature_spec(
  name: "computed",
  summary: [
    依存関係の変化に応じて遅延再計算される、キャッシュ付きの派生値を提供する。
  ],
  api: [
    ```typescript
    function computed<T>(getter: (previousValue?: T) => T): Computed<T>

    interface Computed<T> {
      readonly value: T;
      peek(): T;
      readonly __type__: "computed";
    }
    ```

    *遅延評価*:
    - getter は `.value` が最初に読み取られるまで呼び出されない
    - 計算後は値がキャッシュされる

    *再計算*:
    - 依存関係が変更され、かつ値が読み取られたときのみ再計算される
    - 依存関係が変更されていなければ再計算されない
    - 依存関係の変更後、最初の読み取り時に getter が一度だけ呼び出される

    *依存関係の追跡*:
    - computed 内で読み取られた signal は依存関係になる
    - computed を読み取る effect は computed に依存する
    - `computed.peek()` は値を読み取るが、呼び出し元を computed の依存先として登録しない
    - 最初の計算時には `undefined` が渡される
    - 以降の計算では前回の値が渡される

    *例外処理*:
    - getter が throw した場合、computed は dirty のまま
    - deps は保持され、次回の読み取りで再試行される
    - 例外によって状態が破損しない
  ],
  edge_cases: [
    - getter 実行時の throw → deps を保持、dirty のまま
    - 循環依存 → 未定義の動作（検出されない）
    - NaN の等価性 → `Object.is` を使用
  ],
  test_cases: [
    - `.value` が読み取られるまで getter を呼び出さない
    - 依存関係の変更後、`.value` が読み取られるまで再計算しない
    - 依存関係が変更されていなければ 2 回目の読み取りで再計算しない
    - 依存関係の変更後、最初の読み取り時に getter を一度だけ呼び出す
    - computed を読み取る effect は computed に依存する
    - computed 内で読み取られた signal は computed の依存関係になる
    - 最初の計算時に `undefined` を渡す
    - 以降の計算では前回の値を渡す
    - getter が throw しても状態を破損しない
    - getter が throw しても既存 deps が保持され、次の依存元更新で再通知される
    - computed の戻り値が `NaN` から `NaN` のままの場合、下流の effect は再実行されない
    - `__type__` が `"computed"` であることを確認する
    - signal → computed → computed → effect の chain で signal 変更時に effect が最新値を取得する
    - chain 途中の computed の値が変わらない場合、下流の effect は再実行されない
  ],
)
