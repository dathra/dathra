# Declarative UI execution partitioning design

作成日: 2026-07-08
更新日: 2026-07-13
状態: Experimental / provisional design、実装未完了

この文書は、Dathra の server と client の実行分割について PR #80 で検討した設計判断を保存する。
PR #80 の実装は revert 済みであり、この文書は現在の production 仕様、公開 API、実装状態を表さない。
現行仕様の正本は `SPEC/SPEC.typ`、各 package の `SPEC.typ`、`implementation.test.ts` とする。
本文は将来案の規範的表現を保持しているが、担当仕様とテストへ採用されるまでは provisional decision として扱う。
「破棄した案」は設計経緯であり、現在または将来の実装要件ではない。

後方互換性は設計上の制約にしない。
現行の hydration API、island scheduler、directive、runtime semantics は、必要であれば破壊的に変更する。

設計判断は再検証可能な参照資料として固定し、production code への実装開始をこの文書だけから推論しない。

## 最終目標

開発者が UI を一度自然に宣言すれば、compiler が server と client の実行配置を導出できる状態を目指す。

> 宣言的 UI から server と client の実行配置を導出し、server-first な出力と必要最小限の client runtime を両立する。

この目標は、component を server component と client component に分割すること自体を求めない。
component は UI の構造と所有権を表現できるが、実行場所の境界にはしない。

初期 UI を構成する root は、明示的な client-only opt-out がない限り server で materialize する。
server で完結する計算、依存 package、resource は client artifact に入れない。
browser では、interaction、継続的な state 更新、client-only platform operation に必要な code と runtime だけを起動する。

server が生成した HTML と Declarative Shadow DOM（DSD）は、client activation のために component body を再実行せず、そのまま利用する。
client activation は既存 DOM に listener、binding、effect、cleanup を接続する処理である。

Reactive graph、hydration、island、directive は実現手段であり、最終目標ではない。

## 保証する範囲

現行方針は、次の性質を保証対象にする。

- 初期 UI root は、明示的な client-only opt-out がない限り server artifact から実現する。
- server でだけ必要な計算と依存は server に閉じる。
- client artifact の各 semantic unit は、具体的な client root、materialization、recorder、guard、host adapter のいずれかから根拠を持つ。
- static DOM は client mutation plan に含めず、既存 node を暗黙に置換しない。
- client placement、transfer、activation を安全に構成できない場合は、具体的な dependency path を示して失敗する。
- compiler は暗黙の RPC、component replay、component 全体の rerender fallback を生成しない。

「必要最小限」は、任意の JavaScript 変換に対する大域的な最適解を意味しない。
compiler がサポートする有限候補集合の中で、契約を満たす候補を比較し、server 配置と client cost に関する設定済みの順序で最良の候補を選ぶ。

現行方針は、任意の JavaScript と host の完全な形式検証を保証しない。
任意の第三者 code と同じ authority realm を共有した場合の noninterference、network effect の無条件な exactly-once、すべての scheduler に対する liveness も baseline の保証に含めない。

## 基本用語

- **ObservationContract**：root が外部へ示す value、DOM、artifact、protocol、effect、terminal outcome の観測条件である。
- **ExecutionGraph**：compiler が source と契約から構築する、実行、依存、effect、ownership、transfer の保守的な上限グラフである。
- **TemplateNode**：source 上の静的な operation 定義である。
- **Occurrence**：request、render attempt、activation、event などで生じる TemplateNode の動的な実行である。
- **root**：外部から要求される結果または実行入口を表す obligation である。
- **ClientScopeGraph**：client root、state、artifact、DOM target、ownership、activation を表す compiler 生成グラフである。
- **MaterializationPlan**：cross-boundary demand を target の値、identity、reference、subscription、remote operation として満たす計画である。
- **activation**：既存 DOM または compiler 生成 DOM に client behavior を接続し、client root を実行可能にする処理である。
