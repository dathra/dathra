= batch API

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

シグナルの通知を単一のフラッシュにまとめながらコールバックを実行する。

== 機能仕様

#feature_spec(
  name: "batch",
  summary: [
    複数の signal 更新を 1 回のフラッシュにまとめ、依存先への通知回数を抑える。
  ],
  api: [
    ```typescript
    function batch<T>(fn: () => T): T
    ```

    *バッチング*:
    - コールバック内のすべてのシグナル更新が収集される
    - 依存先は最後に一度だけ通知される
    - 同じシグナルへの複数の更新では最終値が使用される

    *ネスト*:
    - ネストされた batch は外側の batch を拡張する
    - フラッシュは最も外側の batch が完了したときに発生する

    *戻り値*:
    - コールバックの結果を返す
  ],
  edge_cases: [
    - 空の batch → フラッシュ不要
    - コールバック内の例外 → batch は終了し、部分的な更新が可視化される
  ],
  test_cases: [
    - batch 内で複数回更新された場合、最終値のみを使用する
    - batch の最後に一度だけ通知する
    - ネストされた batch は外側の batch が完了するまでフラッシュしない
    - コールバックの戻り値を返す
    - コールバックが throw しても batch は終了し、部分的な更新が可視化される
  ],
)
