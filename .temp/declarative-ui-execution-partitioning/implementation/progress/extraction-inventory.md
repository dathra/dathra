# default branch回収inventory

更新日: 2026-07-13

## 回収方針

この文書は、`feature/declarative-ui-execution-partitioning`の成果をdefault branchへ回収する判断を記録する。
元branchは削除せず、実装履歴と設計検証の証拠として保持する。

回収対象は、次の条件をすべて満たす成果に限る。

- 現在のDathomirで独立した利用価値がある。
- 宣言的UI実行分割の詳細設計を変更しても価値が残る。
- main起点のbranchで差分を説明できる。
- 対象範囲のtest、型検査、lint、formatを実行できる。
- push後にPRを作成し、default branchへ入れる判断を独立して行える。

「将来使う可能性がある」だけでは回収しない。
consumerが存在しないcontractは、consumerと同じPRで有効性を検証できるまで元branchへ保留する。

## 回収済みのVerification Gate

元commit `8fe6c60cd2e4cab82b9785525a76e5f485148e95`は35ファイルを同時に変更していた。
この単位ではdefault branch上の失敗原因と責任範囲を分離できないため、次の5件へ分割した。

| 対象 | 抽出commit | PR | base | 検証 |
| --- | --- | --- | --- | --- |
| getting-started production SSR | `119c256` | [#81](https://github.com/dathra/dathra/pull/81) | `main` | production server build、1 test、追加ファイルの型検査、lint、format、frozen lockfile |
| docs production SSR | `85730a1` | [#82](https://github.com/dathra/dathra/pull/82) | `main` | production server build、1 test、追加ファイルの型検査、lint、format、frozen lockfile |
| request-scoped SSR | `cb017f6` | [#83](https://github.com/dathra/dathra/pull/83) | `main` | production server build、1 test、追加ファイルの型検査、lint、format、frozen lockfile |
| vanilla JSX counter | `e882738` | [#84](https://github.com/dathra/dathra/pull/84) | `main` | production browser test、追加ファイルの型検査、lint、format、frozen lockfile |
| E2E harness lifecycle | `96a0b0a` | [#85](https://github.com/dathra/dathra/pull/85) | `main` | 全production build、全E2E、package型検査、lint、format |
| vanilla Runtime API | `ec947a8` | [#87](https://github.com/dathra/dathra/pull/87) | PR #84 | production browser test 2件、対象ファイルの型検査、lint、format |
| vanilla Functional Component | `7497346` | [#88](https://github.com/dathra/dathra/pull/88) | PR #87 | production browser test 3件、対象ファイルの型検査、lint、format |
| vanilla Web Components | `5da249e` | [#89](https://github.com/dathra/dathra/pull/89) | PR #88 | production browser test 4件、対象ファイルの型検査、lint、format |

PR #84は回帰testだけでなく、既存counterが使用していた廃止済み`Signal.update()`を現在の`Signal.set()`へ移行する。
production buildだけでは操作時の失敗を検出できなかったため、Chromiumで`0 -> 1 -> 0`とcomputed値を検証する。

PR #85は元commitのharness差分をmainへ移した後、現行lintが検出したcallback宣言順を修正した。
したがって、PR #85のcontentは元commitの機械的な複製ではなく、mainの現行gateを満たす後継revisionである。

PR #87から#89はPR #84を起点にしたstacked PRである。
各PRは一つの実行経路だけを接続し、直前PRをbaseにすることでbrowser test基盤の重複と経路間の責任混在を避ける。

## Verification Gateの残作業

次の差分は、元commitに含まれるがまだ回収していない。

| 対象 | 状態 | 保留理由 | 再開条件 |
| --- | --- | --- | --- |
| root `build:apps`、`test:apps`、CI接続 | deferred | 個別appのtest commandがmainへ入る前にroot gateだけを追加すると、PR間dependencyを隠す | 必要な個別app PRをmergeした後、root scriptsとCIだけのPRを作る |
| Nuxt SSR gate | deferred | 9ファイルの差分がAPI移行、format、plugin設定、SSR testを混在させている | API互換修正とSSR gateを独立して説明できる単位へ分ける |

## Evergreen候補

次の成果は宣言的UI実行分割のconsumerがなくても価値が残る。
ただし、元branchの隣接commitへ依存する場合は、そのままcherry-pickせずmain上で再構成する。

| 元commitまたは範囲 | 候補 | 現在の判断 |
| --- | --- | --- |
| `8fe6c60` | application verification gates | 回収中。5件をPR #81から#85へ提出済み |
| `d2822b1` | workspace test artifact生成とCI安定化 | 再評価対象。feature固有testへの変更を除き、mainで再現する問題だけを抽出する |
| `6565c76`、`63f4597` | transformer stress testの資源分離 | consumer非依存だが、mainのtest構成で再現と効果を測定してから回収する |
| `686fa4d`、`dd7826f` | deterministic review evidence | 現行の巨大feature運用に強く依存する。default branchの日常開発で利用するworkflowが決まるまで保留する |

## Consumerと同時に回収する成果

次の成果はtestと実装を備えるが、default branch上のproduction consumerが未接続である。
コード品質を理由に保留するのではなく、公開または内部contractの有効性をconsumer経路で検証できないため保留する。

| 成果 | 主な元commit | 保留理由 | merge条件 |
| --- | --- | --- | --- |
| Canonical Identity | `3816c34` | 後続contract群だけが使用し、mainの既存機能には接続しない | 最初の既存consumerまたはvertical consumerと同じPRで利用する |
| Execution Registry | `da05b19` | registry projectionとruntime conformanceが未接続 | compilerまたはruntime consumerがexact contractを消費する |
| Observation Contract | `86204da` | proof acceptanceとcompositionを既存render経路が消費しない | 一つの実render workflowでsourceとcandidateの検証に使う |
| Module Graph Snapshot | `4efc445` | snapshotはModule Coordinator以外の既存consumerを持たない | coordinatorから既存transformer出力まで接続する |
| Module Coordinator | `dd54efc` | module graphとExecutionGraphの中間で止まる | 既存transformerまたは最初のvertical compiler pathへ接続する |
| Execution Graph | `4ebd220` | graph contractは大きいが、現行build outputを生成しない | supported subsetのcompiler outputとE2Eを同じPR系列で示す |
| SC02 source execution contract | `d5d704a`から`4c3f6aa` | budget、walker、profile、cloneが内部chainで完結し、domain conversionが未実装 | domain parserから既存またはvertical consumerまで接続する |
| Artifact、Render、Materialization contract | AR01、RC01、MP01の各commit | type foundationが中心で、artifact finalizationとrendererが未接続 | artifact生成と消費を同じacceptance evidenceで検証する |

## 実験成果として保持する範囲

設計文書のうち、Observation DFA、proof acceptance、candidate finalization、authority、subscription、remote operationの完全系は実験成果として元branchへ保持する。
これらは個別の型やvalidatorだけをdefault branchへ移さない。

完全系を回収する条件は、一つの実用的なworkflowが該当するvariantを必要とし、browserまたはserverの動作とartifact検査でcontractを検証できることである。
条件を満たすまでは、設計の参照資料として扱い、default branchのproduction surfaceを増やさない。

## 次の回収順序

次の順序は、独立した価値とPR dependencyを基準にする。

1. PR #81から#85のCI結果を確認し、指摘があれば各PR内で修正する。
2. 個別app gateのmerge後、root scriptsとCI接続を一つのPRへ抽出する。
3. stacked PR #87から#89のCI結果を確認し、PR #84から順にmerge可能な状態を維持する。
4. NuxtのAPI互換修正とSSR gateを分離する。
5. mainでCI不安定性を再現できる場合に限り、`d2822b1`、`6565c76`、`63f4597`から最小修正を抽出する。
6. consumer未接続contractは、最初のvertical consumerの設計が固定されるまで開始しない。
