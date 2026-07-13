# 文書分割の完全性証拠

2026-07-13に一体型の設計正本、実装指示、設計workflow、実装進捗をowner別の文書へ分割しました。
この移行はruntime semantics、既存の設計判断、実装順序、完了済みsliceの判定を変更しません。

## 凍結snapshot

| Snapshot | SHA-256 |
| --- | --- |
| [`snapshots/design-monolith-v1.md`](snapshots/design-monolith-v1.md) | `df9a3e0bc704e74c03181387b0fc755482cb2dbf4fa413ff51fba5ab4c71c19b` |
| [`snapshots/implementation-progress-monolith-v1.md`](snapshots/implementation-progress-monolith-v1.md) | `c2956375e05ce9a78e347a768b90301f7f76f8ac1e810f7fe6c5901cbcab50d5` |
| [`snapshots/implementation-goal-monolith-v1.md`](snapshots/implementation-goal-monolith-v1.md) | `72e03086b7a041ded9d39e39914acb2620c779fd78c7c2e322cf911a1c415da1` |
| [`snapshots/design-workflow-monolith-v1.md`](snapshots/design-workflow-monolith-v1.md) | `054950754c95a814d8c9597ea16d8e4d8099a7713221aee2127faf7f0141f149` |

4ファイルは分割直前の内容をbyte-identicalに保存しています。

## 設計分割

| 新しい正本 | 旧snapshotの行 |
| --- | ---: |
| `decisions/00-overview.md` | 1-61 |
| `decisions/10-observation-language.md` | 62-444 |
| `decisions/11-observation-composition.md` | 445-725 |
| `decisions/12-observation-audit.md` | 726-1336 |
| `decisions/20-server-client-legality.md` | 1337-1999 |
| `decisions/30-compiler-execution-model.md` | 2000-2696 |
| `decisions/40-components-and-javascript.md` | 2697-2811 |
| `decisions/50-materialization-planning.md` | 2812-3208 |
| `decisions/51-graph-table-payload.md` | 3209-3482 |
| `decisions/52-registry-and-manifest.md` | 3483-3779 |
| `decisions/53-projection-and-boot.md` | 3780-4132 |
| `decisions/60-server-render-and-delivery.md` | 4133-4491 |
| `decisions/70-client-scope-and-activation.md` | 4492-5282 |
| `decisions/80-author-facing-api.md` | 5283-5582 |
| `decisions/81-contract-foundation.md` | 5583-6350 |
| `decisions/82-source-and-compiled-contract.md` | 6351-6502 |
| `decisions/83-codec-reference-and-subscription.md` | 6503-6800 |
| `decisions/84-remote-operation.md` | 6801-7523 |
| `decisions/85-registry-qualification.md` | 7524-7797 |
| `decisions/86-source-execution-contract.md` | 7798-8214 |
| `decisions/90-manual-activation-and-removal.md` | 8215-8580 |
| `decisions/91-doc-code-block.md` | 8581-8628 |
| `decisions/92-diagnostics-and-implementation.md` | 8629-8824 |
| `decisions/99-rejected-ideas.md` | 8825-8872 |

最初の機械分割では、表の順に連結した本文のSHA-256が設計snapshotと一致しました。
単独文書としてcode fenceを閉じるため、`D52`、`D53`、`D81`から`D85`には見出しまたはfence delimiterだけのeditorial wrapperを追加しています。
wrapperを除いた本文は表の旧snapshot行と一致します。

## 実装指示の分割

| 旧sectionまたは行範囲 | 新しいowner | Editorial wrapper |
| --- | --- | --- |
| 文書導入、`最終目標`、`正本と優先順位`、`完了条件`（1-77） | `implementation/goal.md` | owner文書の導入と正本linkを追加 |
| `作業記録`（78-100） | `implementation/workflow.md` | 進捗正本とR8文書revisionへのlinkへ正規化 |
| `実装戦略 R7`（101-151） | `implementation/roadmap.md` | R8のreviewer数をreview policyへ委譲 |
| `Reviewとgateの負荷配分`のreview規則（152-178） | `process/review-policy.md` | R8を一つのpolicy ownerへ統合 |
| `Reviewとgateの負荷配分`のgate表（179-190） | `implementation/workflow.md` | stable headingを追加 |
| `手順 0`から`手順 4`（191-407） | `implementation/workflow.md` | 現在のfeature branchとcanonical pathへ参照を更新 |
| `実装順序`とPhase 1から10（408-498） | `implementation/roadmap.md` | なし |
| `手順 5`（499-519） | `implementation/acceptance.md` | stable headingを追加 |
| `手順 6`（520-583） | `process/review-policy.md` | R8のunit、evidence、initial reviewへ統合 |
| `手順 7`と`手順 8`（584-607） | `implementation/workflow.md` | acceptanceとreview policyへのhandoffを追加 |
| `手順 9`から`手順 11`（608-699） | `implementation/acceptance.md` | 旧reviewer数をR8へ委譲し、exact remote OID検査を維持 |
| `自律実行と blocker`（700-712） | `implementation/workflow.md` | なし |

`Reviewとgateの負荷配分`は旧section自体が二責務を混在させていたため、規範行をreview policyとworkflowへ分けました。
各規範行のownerは一つだけであり、依存側にはstable headingへのlinkだけを置いています。

## 設計workflowの分割

| 旧sectionまたは行範囲 | 新しいowner | Editorial wrapper |
| --- | --- | --- |
| 文書導入（1-22） | `process/design-workflow.md` | process indexとreview policyへのlinkを追加 |
| `Review protocol R8`（23-57） | `process/review-policy.md` | implementationと共通のR8へ統合 |
| `手順 0`から`手順 3`（58-102） | `process/design-workflow.md` | proposal handoffのstable headingを追加 |
| `手順 4`と`レビュー回数の上限`（103-227） | `process/review-policy.md` | unit、evidence、initial reviewへ責務分割 |
| `手順 5`（228-255） | `process/review-policy.md` | result integrationへ統合 |
| `手順 6`（256-277） | `process/review-policy.md` | convergenceへ統合 |
| `手順 7`から`手順 10`（278-316） | `process/design-workflow.md` | review処理をpolicy IDへのhandoffへ置換 |

設計作業だけに適用されるproduction code変更禁止は`process/design-workflow.md`に残しました。
実装文書は共通review policyだけを参照するため、この禁止条件を継承しません。

## 進捗分割

| 新しい正本 | 旧snapshotの行 |
| --- | ---: |
| `implementation/progress/current.md` | 1-159 |
| `implementation/progress/baseline-and-matrix.md` | 160-303 |
| `implementation/progress/active-slices.md` | 304-703 |
| `implementation/progress/completed-slices.md` | 704-862 |
| `implementation/progress/acceptance-work.md` | 863-915 |
| `implementation/progress/slice-log.md` | 916-941 |
| `implementation/progress/review-log.md` | 942-1139 |
| `implementation/progress/commit-log.md` | 1140-1188 |
| `implementation/progress/blockers.md` | 1189-1192 |

進捗snapshotは分割前の状態を固定しています。
activeな分割文書には分割後のstatus更新とcanonical path置換が入るため、現在の単純連結hashはsnapshotと一致しません。
旧line ownershipは表の連続範囲で保持し、現在の追記は各owner文書だけへ行います。

## Compatibility index

次の旧pathは削除せず、現在の正本へ到達するindexへ置き換えました。

| 旧path | 到達先 |
| --- | --- |
| `.temp/declarative-ui-execution-partitioning.md` | `declarative-ui-execution-partitioning/README.md` |
| `.temp/declarative-ui-execution-partitioning-implementation-goal.md` | `declarative-ui-execution-partitioning/implementation/README.md` |
| `.temp/declarative-ui-execution-partitioning-implementation-progress.md` | `declarative-ui-execution-partitioning/implementation/progress/README.md` |
| `.temp/goal.md` | `declarative-ui-execution-partitioning/process/README.md` |

旧pathへ新しい規則、status、evidenceを追記しません。
過去のimmutable review evidenceは旧pathを書き換えず、candidate commit上のblobを参照します。

## 期限付きgoalの分類

期限付きgoalのprovenanceと状態分類は、owner再編coreから独立したrevisionで扱いました。

| Input | Git blob | SHA-256 |
| --- | --- | --- |
| [文書再編のuser goal snapshot](snapshots/document-owner-reorganization-goal-v1.md) | `761b175dc7cc908b15168eadd4a9e2efedd4d011` | `93aadc1c9f4523eef3fe95f9d3da5076e6fbda2c6842463d2de80c9efcadbc70` |
| [DocCodeBlock動作実証](../implementation/milestones/doc-code-block-demonstration-2026-07-14.md) | `43b26be4aa0b77ba9995e979eea7736cbde6d085` | `ea3040601452d94b44b6db2f52c7af86c6ba1238feda32c5feebc3802f695367` |

二つのinputは、分類前のsynthetic checkpoint `a131ea9e1e4ad38c4c12da49958fa7dac912216b`へ固定しました。
user goal snapshotは受領した指示とbyte-identicalであり、`.temp/declarative-ui-execution-partitioning/`配下の分割文書とarchiveをuser changesとして保持するよう明記しています。
snapshotはprovenance evidenceであり、現在の実行指示または正本として使用しません。

進捗、commit、review、blockerの各logには`DR00`から`DR04`の完了、明示的な中断、supersedeの記録がありません。
この証拠に基づくlifecycle判定は[Milestone index](../implementation/milestones/README.md)、scheduler actionは[現在の進捗](../implementation/progress/current.md)が所有します。
本文のruntime条件、期限、DR00からDR04、完了条件はcheckpoint blobから変更していません。
