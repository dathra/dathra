= effect API

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

追跡された依存関係が変更されたときに再実行されるリアクティブな副作用を登録する。

== 機能仕様

#feature_spec(
  name: "effect",
  summary: [
    依存関係に応じて再実行される副作用を登録し、停止用のクリーンアップ関数を返す。
  ],
  api: [
    ```typescript
    function effect(fn: () => void): EffectCleanup

    type EffectCleanup = () => void;
    ```

    *実行*:
    - effect 関数は作成時に即座に呼び出される
    - 追跡された依存関係が変更されるたびに再実行される
    - 依存関係の変更時に同期的に実行される（batch されていない場合）

    *クリーンアップ*:
    - 返されたクリーンアップ関数は effect を停止する
    - クリーンアップ後、effect は再実行されない
    - クリーンアップはすべての追跡された依存関係を切断する

    *依存関係の追跡*:
    - effect 内での signal/computed の読み取りは依存関係になる
    - 実行ごとに新しい依存関係を追加できる
    - 古い依存関係は自動的に削除される

    *effect スコープ内の onCleanup*:
    - effect 実行中に `onCleanup(fn)` を呼ぶと、その fn は effect スコープに登録される
    - 登録された fn は effect 再実行直前と `stop()` 呼び出し時に実行される
    - effect 再実行のたびに onCleanup は新たに登録し直される
    - createRoot の owner.cleanups には登録しない
  ],
  edge_cases: [
    - effect のクリーンアップは冪等（複数回呼び出しても安全）
    - createRoot 内の effect は owner によって追跡される
    - createRoot 外の effect は独立している
    - effect 内で onCleanup を複数回呼ぶと、すべて登録順に実行される
    - 初回実行中に自身が読んだ signal を更新しても、初回実行が戻る前に同じ effect を再入実行しない
  ],
  test_cases: [
    - 変更に反応し、クリーンアップで再実行を停止する
    - `peek` は依存関係を追跡せずに読み取る
    - 複数の更新を単一の通知にグループ化する（batch）
    - 複数の連続した変更を正しく処理する
    - effect 内で onCleanup を登録し、再実行前に実行される
    - effect 内で onCleanup を登録し、stop() 時に実行される
    - effect 内で複数の onCleanup を登録すると順番に実行される
    - effect 再実行時に前回の onCleanup が破棄され新しいものが登録される
    - effect 内で作成した effect は、外側 effect 再実行時に自動クリーンアップされる
    - 初回実行中の self-write は初回実行中に再入実行されない
  ],
)
