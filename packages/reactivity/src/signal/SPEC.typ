= signal API

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

読み取りを追跡し、更新時に依存先へ通知するミュータブルなリアクティブシグナルを作成する。

== 機能仕様

#feature_spec(
  name: "signal",
  summary: [
    読み取り時に依存関係を追跡し、値の変更時に依存先へ通知する基本的なリアクティブプリミティブ。
  ],
  api: [
    ```typescript
    function signal<T>(initialValue: T): Signal<T>

    interface Signal<T> {
      readonly value: T;
      set(update: T | ((prev: T) => T)): void;
      peek(): T;
      readonly __type__: "signal";
    }
    ```

    *読み取り*:
    - `signal.value` は現在の値を返し、依存関係を追跡する
    - `signal.peek()` は追跡せずに現在の値を返す

    *書き込み*:
    - `signal.value` への直接代入（`signal.value = x`）は *禁止*（`readonly`）
    - `signal.set(value)` は値または更新関数を受け取る
    - `T` が関数型の場合、`signal.set(fn)` は関数値の直接設定として扱い、更新関数としては扱わない
    - `Object.is()` を使用して等価性をチェックする

    *通知*:
    - batch されていない限り、依存先は同期的に通知される
    - batch 内での複数回の書き込みは単一の通知になる
  ],
  edge_cases: [
    - NaN === NaN（誤った更新なし）
    - 同じ値を設定 = 通知なし
    - effect 内で読み取り = 依存関係が登録される
    - effect 外で読み取り = 追跡なし
    - 関数値を保持する signal に関数値を設定しても、更新関数として実行されない
    - `.value` への直接代入は TypeScript の `readonly` により静的にエラーとなる（ランタイムテスト対象外）
  ],
  test_cases: [
    - 初期値を正しく設定する
    - `.value` 経由で読み取る
    - `.set()` で値を書き込む
    - `set()` で直接値を更新する
    - `set()` で関数を使って更新する
    - 関数値を保持する signal に `set()` で関数値を直接設定できる
    - effect 内で `.value` を読み取ると依存関係を登録する
    - computed 内で `.value` を読み取ると依存関係を登録する
    - `peek()` を使用すると依存関係を登録しない
    - `__type__` が `"signal"` であることを確認する
    - 値が変更されたときのみ effect が再実行される
    - 同じ値を設定しても effect は再実行されない
    - `Object.is` を使用して NaN を正しく扱う
    - 同じ値を設定しても downstream computed が再評価されない
  ],
)

== 設計判断

#adr(
  header("`.value` 書き込み禁止・`update()` 廃止", Status.Accepted, "2026-03-09"),
  [
    `signal.value` への代入と `update()` の二重 API を許すと、書き込み経路が増えて利用者の認知負荷が上がる。
  ],
  [
    `signal.value` を読み取り専用にし、書き込みは `set()` のみとする。`update()` は公開 API として持たない。
  ],
  [
    - `set()` が値とアップデータ関数の両方を受け取れるため API が簡潔になる
    - `.value++` のような暗黙的 read-modify-write を排除できる
    - TypeScript の `readonly` により誤用を静的に検出できる
  ],
)

#adr(
  header("関数値 signal の `set()` は関数値を直接設定する", Status.Accepted, "2026-06-27"),
  [
    `set(update: T | ((prev: T) => T))` は、`T` 自体が関数型の場合に直接値と更新関数をランタイムで区別できない。
    関数を値として保持できない signal は、コールバックやレンダラ関数を状態として扱う実用的な用途を妨げる。
  ],
  [
    `T` が関数型の signal では `set(fn)` を関数値の直接設定として扱い、更新関数としては実行しない。
    TypeScript 型でも関数型 `T` の `set()` は直接値のみを受け取る。
  ],
  [
    - 関数値を安全に signal として保持できる
    - 関数値 signal では updater 形式を使えないが、ランタイムで曖昧な API を避けられる
    - 非関数値 signal の `set(prev => next)` は従来通り利用できる
  ],
)
