#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

= createAtomStore API

== 目的

atom 定義に対する値実体を app/request 単位で保持し、`signal` と同等の read/write 体験を持つ `AtomRef` を提供する。

== 機能仕様

#feature_spec(
  name: "createAtomStore",
  summary: [
    `AtomStore` instance を作成する。store は sharing boundary の単位であり、`ref()`、`get()`、`peek()`、`set()`、`fork()`、`dispose()` を提供する。
  ],
  api: [
    ```typescript
    type AppId = string;
    type AtomUpdate<T> = T | ((prev: T) => T);

    function createAtomStore(options: {
      appId: AppId;
      values?: Iterable<readonly [PrimitiveAtom<unknown>, unknown]>;
    }): AtomStore;

    interface ReadableAtomRef<T> {
      readonly value: T;
      peek(): T;
    }

    interface WritableAtomRef<T> extends ReadableAtomRef<T> {
      set(update: AtomUpdate<T>): void;
    }

    interface AtomStore {
      readonly appId: AppId;
      ref<T>(atom: DerivedAtom<T>): ReadableAtomRef<T>;
      ref<T>(atom: PrimitiveAtom<T>): WritableAtomRef<T>;
      get<T>(atom: ReadableAtom<T>): T;
      peek<T>(atom: ReadableAtom<T>): T;
      set<T>(atom: PrimitiveAtom<T>, update: AtomUpdate<T>): void;
      fork(options?: {
        values?: Iterable<readonly [PrimitiveAtom<unknown>, unknown]>;
      }): AtomStore;
      dispose(): void;
    }
    ```

    *read semantics*:
    - `ref(atom).value` は tracked read を行う
    - `ref(atom).peek()` は untracked read を行う
    - `get(atom)` は tracked read、`peek(atom)` は untracked read と同義の低レベル API とする

    *write semantics*:
    - writable atom に対する更新は `ref(atom).set()` または `store.set(atom, update)` で行う
    - `Object.is()` を使用して等価性を判定する
    - notification / batching / effect 再実行の意味論は `@dathra/reactivity` の `signal` と一致させる

    *store semantics*:
    - store instance が共有境界を定義する
    - `fork()` は親 store を fallback とする copy-on-write overlay child store を返す
    - `dispose()` 後の store は再利用しない
  ],
  edge_cases: [
    - 同一 store・同一 atom に対する `ref(atom)` は stable identity を返す
    - derived atom の cache は store ごとに分離する
    - child store が atom を override していない場合、親更新は child へ伝播する
    - child store が atom を override した後は、その atom に対する親更新を child へ伝播しない
    - `dispose()` 後の read/write は開発時に fail-fast できる設計を優先する
  ],
  test_cases: [
    - primitive atom の初期値を保持する store を作成する
    - 同じ atom 定義でも別 store 間で値が分離される
    - `ref(atom).value` が effect に追跡される
    - `ref(atom).peek()` が effect に追跡されない
    - `ref(atom).set()` が `signal.set()` と同じ等価性判定を持つ
    - 同一 store・同一 atom の `ref(atom)` が stable identity を返す
    - derived atom が store-local cache で再計算される
    - `fork()` した child store が親値を fallback として読む
    - child store で上書きした atom が親更新から shadow される
    - `dispose()` が child fork を含めて破棄する
  ],
)

== 設計判断

#adr(
  header("store は reactivity とは別パッケージで管理する", Status.Accepted, "2026-03-10"),
  [
    reactivity package に app scope や store graph を持ち込むと、汎用 primitive の純度が下がる。
  ],
  [
    atom/store layer は `@dathra/reactivity` に依存する別パッケージ `@dathra/store` として定義する。
  ],
  [
    - `signal` / `computed` / `effect` は汎用 primitive のまま保てる
    - store 側で appId、fork、dispose などの高レベル責務を扱える
    - 依存方向を `store -> reactivity` の片方向に固定できる
  ],
)

#adr(
  header("store instance を sharing boundary とする", Status.Accepted, "2026-03-10"),
  [
    module scope singleton の state instance は、SSR request・複数 root・テスト間で意図しない共有を起こしやすい。
  ],
  [
    store instance を sharing boundary の唯一の単位とし、`appId` を持つ `createAtomStore()` で生成する。
  ],
  [
    - 共有範囲を root/request ごとに明示できる
    - SSR request 間リークを避けやすい
    - 複数 app root が同じ atom 定義を安全に共有できる
  ],
)

#adr(
  header("AtomRef は signal と同じ read/write surface を持つ", Status.Accepted, "2026-03-10"),
  [
    store API が signal と大きく異なると学習コストが上がり、利用者が atom と signal を別の mental model で扱う必要が生じる。
  ],
  [
    `AtomRef` は `.value`、`.peek()`、`.set()` を中心とする signal-like surface を採用する。
  ],
  [
    - `signal` と `AtomRef` の操作感が揃う
    - `store.set(atom, ...)` は低レベル API として残しつつ、日常的な利用は `ref(atom)` に集約できる
    - derived atom は `.set()` を持たない read-only ref として自然に表現できる
  ],
)

#adr(
  header("fork は copy-on-write overlay とする", Status.Accepted, "2026-03-10"),
  [
    subtree override を context lookup なしで表現するためには、親 store をベースにした部分的な上書きが必要になる。
  ],
  [
    `fork()` は親 store を fallback とする child store を返し、child 側で書き込まれた atom だけを shadow 化する。
  ],
  [
    - theme や feature-local override を明示的に表現できる
    - 未 override atom は親更新をそのまま受け取れる
    - subtree ごとの state 差し替えを context なしで実現できる
  ],
)
