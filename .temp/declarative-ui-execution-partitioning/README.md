# Declarative UI execution partitioning

この文書はexecution partitioning設計の正本indexです。
具体的な決定は`decisions/`配下の担当文書を正本とします。

最終目標、保証範囲、基本用語は[`decisions/00-overview.md`](decisions/00-overview.md)が所有します。
特定の設計手段を維持すること自体を目的にしてはいけません。

## 設計文書

| ID | 担当範囲 | 正本 |
| --- | --- | --- |
| `D00` | 最終目標、保証範囲、基本用語 | [`decisions/00-overview.md`](decisions/00-overview.md) |
| `D10` | ObservationContract、constraint、canonical trace、refinement | [`decisions/10-observation-language.md`](decisions/10-observation-language.md) |
| `D11` | ObservationContract compositionとRealizationWitness | [`decisions/11-observation-composition.md`](decisions/11-observation-composition.md) |
| `D12` | ObservationContractの実装監査後契約 | [`decisions/12-observation-audit.md`](decisions/12-observation-audit.md) |
| `D20` | server-first legality、client artifact、artifact identityとresource boundary | [`decisions/20-server-client-legality.md`](decisions/20-server-client-legality.md) |
| `D30` | ModuleCoordinator、ExecutionGraph、rootとedge | [`decisions/30-compiler-execution-model.md`](decisions/30-compiler-execution-model.md) |
| `D40` | component、DOM、function、module extraction、capture | [`decisions/40-components-and-javascript.md`](decisions/40-components-and-javascript.md) |
| `D50` | materialization planning、mechanism、state、identity | [`decisions/50-materialization-planning.md`](decisions/50-materialization-planning.md) |
| `D51` | request graph-table payloadとwire graph | [`decisions/51-graph-table-payload.md`](decisions/51-graph-table-payload.md) |
| `D52` | definition、artifact、registry manifest | [`decisions/52-registry-and-manifest.md`](decisions/52-registry-and-manifest.md) |
| `D53` | projection manifest、loader、BootAuthority | [`decisions/53-projection-and-boot.md`](decisions/53-projection-and-boot.md) |
| `D60` | server render、RenderOperation、delivery、stream | [`decisions/60-server-render-and-delivery.md`](decisions/60-server-render-and-delivery.md) |
| `D70` | ClientScopeGraph、activation、DSD、DOM reconciliation | [`decisions/70-client-scope-and-activation.md`](decisions/70-client-scope-and-activation.md) |
| `D80` | author-facing activation、DOM ownership、lifecycle | [`decisions/80-author-facing-api.md`](decisions/80-author-facing-api.md) |
| `D81` | fact、registry、policy、authorityのcontract foundation | [`decisions/81-contract-foundation.md`](decisions/81-contract-foundation.md) |
| `D82` | sourceとcompiled execution contract | [`decisions/82-source-and-compiled-contract.md`](decisions/82-source-and-compiled-contract.md) |
| `D83` | codec、reference、subscription | [`decisions/83-codec-reference-and-subscription.md`](decisions/83-codec-reference-and-subscription.md) |
| `D84` | remote operation protocol | [`decisions/84-remote-operation.md`](decisions/84-remote-operation.md) |
| `D85` | contract compilation、registry qualification、environment catalog | [`decisions/85-registry-qualification.md`](decisions/85-registry-qualification.md) |
| `D86` | source execution contract、closed-data boundary、canonical measurement | [`decisions/86-source-execution-contract.md`](decisions/86-source-execution-contract.md) |
| `D90` | manual activationと破壊的に削除するAPI | [`decisions/90-manual-activation-and-removal.md`](decisions/90-manual-activation-and-removal.md) |
| `D91` | DocCodeBlockの期待分割 | [`decisions/91-doc-code-block.md`](decisions/91-doc-code-block.md) |
| `D92` | diagnostic、実装方針、検証事項、現行方針 | [`decisions/92-diagnostics-and-implementation.md`](decisions/92-diagnostics-and-implementation.md) |
| `D99` | 破棄した案 | [`decisions/99-rejected-ideas.md`](decisions/99-rejected-ideas.md) |

## 実装文書

- 実装のownerと再開順：[`implementation/README.md`](implementation/README.md)
- 実装進捗：[`implementation/progress/README.md`](implementation/progress/README.md)
- active milestone：[`implementation/milestones/README.md`](implementation/milestones/README.md)

## Process文書

- 設計検討とreviewのowner：[`process/README.md`](process/README.md)
- 自律的な設計検討：[`process/design-workflow.md`](process/design-workflow.md)
- Review policy R8：[`process/review-policy.md`](process/review-policy.md#policy-r8)

## 編集規則

一つの決定は、その責務を所有する一つの設計文書へ記録してください。
複数領域へ影響する決定では、主ownerへ本文を置き、依存側にはdecision IDと正本への参照だけを置いてください。
新しいdecision anchorは、このindex全体や複数文書の連結ではなく、一つの正本pathとstable headingまたはdecision IDを固定してください。

activeな一文書が1,000行へ達する見込み、または独立してreviewできる責務を三つ以上含む場合は、内容を追加する前にowner境界で分割してください。
行数だけを理由に任意の位置で切らず、各分割文書が一つの主ownerと独立したdecision anchorを持つ状態にします。

`archive/`配下は現在の作業再開や設計判断に使わない凍結資料です。
新しい決定や進捗をarchiveへ追加してはいけません。
過去のreview evidenceにある旧パスは、そのevidenceが固定したGit object上で解決してください。

アーカイブの分類は[`archive/README.md`](archive/README.md)、分割境界と完全性証拠は[`archive/document-split-2026-07-13.md`](archive/document-split-2026-07-13.md)に記録しています。
