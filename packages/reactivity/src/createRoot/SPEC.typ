= createRoot API

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

effect とクリーンアップ関数を追跡するクリーンアップスコープを作成する。
コールバック内で作成された templateEffect とネストされた createRoot は自動的に追跡され、
返された dispose 関数が呼び出されたときに破棄される。

== 機能仕様

#feature_spec(
  name: "createRoot",
  summary: [
    templateEffect と cleanup を束ねる owner スコープを作成し、dispose でまとめて破棄する。
  ],
  api: [
    ```typescript
    function createRoot(fn: (dispose: RootDispose) => void): RootDispose

    type RootDispose = () => void;

    interface Owner {
      effects: (() => void)[];
      cleanups: (() => void)[];
    }
    ```

    *スコープの作成*:
    - 追跡用の新しい Owner スコープを作成する
    - コールバック実行中、スコープを現在の owner として設定する
    - クリーンアップ用の dispose 関数を返す

    *Effect の追跡*:
    - スコープ内の templateEffect() は自動的に追跡される
    - スコープ内の effect() は自動追跡されない（独自のクリーンアップを返す）
    - ネストされた createRoot スコープは親によって追跡される

    *Dispose*:
    - dispose 関数はすべての追跡された effect をクリーンアップする
    - その後、登録されたすべてのクリーンアップ関数を呼び出す
    - dispose 後、スコープは空になる

    *ネスト*:
    - ネストされた createRoot は親スコープに登録される
    - 親の dispose は子の dispose をトリガーする
    - 子の dispose は親に影響しない
  ],
  edge_cases: [
    - dispose は冪等（2 回呼び出しても安全）
    - クリーンアップ内の例外 → 他のクリーンアップを継続
    - スコープ外で呼び出し → 自動追跡なし
  ],
  test_cases: [
    - dispose 関数を返す
    - スコープ内で作成された templateEffect を追跡してクリーンアップする
    - 複数の templateEffect を追跡する
    - コールバックに dispose 関数を提供する
    - ネストされた createRoot を処理する
    - createRoot 外の effect は追跡しない
    - 親が破棄されたときに子スコープを破棄する
    - 子の破棄は親に影響しない
    - 2 回目の dispose 呼び出しを無視する
    - クリーンアップ内の例外があっても他のクリーンアップを継続実行する
  ],
)
