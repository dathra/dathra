# 宣言的 UI 実行分割の実装進捗

更新日: 2026-07-12
状態: 実装中

## 再開情報

- 実装指示: `.temp/declarative-ui-execution-partitioning-implementation-goal.md`
- 設計正本: `.temp/declarative-ui-execution-partitioning.md`
- 作業 branch: `feature/declarative-ui-execution-partitioning`
- 起点 commit: `71186a8e919c44d0dbc626effdf08ed5120cd790`
- push 先: `origin/feature/declarative-ui-execution-partitioning`
- 次の作業: 手順 0 の計画 commit と baseline を完了し、手順 1 の implementation matrix を実コードへ対応付ける。
- 外部 blocker: なし

## 状態の意味

- `pending`: 未着手である。
- `in-progress`: 現在の slice で作業している。
- `completed`: 直接的な検証証拠、独立レビュー、commit、push が揃っている。
- `reopened`: 完了後の監査で不足が見つかり、再作業が必要である。

## 手順の進捗

| ID | 作業 | 状態 | 証拠 |
| --- | --- | --- | --- |
| S00 | branch、計画文書、baseline | in-progress | branch は規定の `gnb` command で作成済み |
| S01 | implementation matrix | pending | 実コード調査後に確定する |
| S02 | verification-gate slice | pending | docs と全 playground の実処理 gate を対象にする |
| P01 | ExecutionGraph foundation | pending | 未着手 |
| P02 | semantic contract と registry | pending | 未着手 |
| P03 | 解析と placement | pending | 未着手 |
| P04 | server render | pending | 未着手 |
| P05 | materialization と projection | pending | 未着手 |
| P06 | ClientScopeGraph と client runtime | pending | 未着手 |
| P07 | DOM activation | pending | 未着手 |
| P08 | protocol と lifecycle | pending | 未着手 |
| P09 | 公開 API と移行 | pending | 未着手 |
| P10 | 全体 acceptance | pending | 未着手 |
| S10 | push 後の全体監査 | pending | 未着手 |
| S11 | exact remote OID の最終監査 | pending | 未着手 |

## Baseline

branch 作成前の `doc/hydration-policy` は clean であり、local HEAD と `origin/doc/hydration-policy` は `71186a8e919c44d0dbc626effdf08ed5120cd790` で一致していた。

| Command | 状態 | 結果 |
| --- | --- | --- |
| `pnpm build` | pending | 未実行 |
| `pnpm test` | pending | 未実行 |
| `pnpm typecheck` | pending | 未実行 |
| `pnpm lint` | pending | 未実行 |
| `pnpm fmt:check` | pending | 未実行 |
| `pnpm test:e2e` | pending | 未実行 |
| `pnpm --filter @dathra/config lint` | pending | 未実行 |
| `pnpm --filter @dathra/config lint:type-aware` | pending | 未実行 |
| `pnpm --filter @dathra/docs build` | pending | 未実行 |
| `pnpm --filter @dathra/docs build:cloudflare` | pending | 未実行 |
| `pnpm --filter @dathra/docs fmt:check` | pending | 未実行 |
| `pnpm --filter @playground/e2e build` | pending | 未実行 |
| `pnpm --filter @playground/e2e fmt:check` | pending | 未実行 |
| `pnpm --filter @playground/ssr build` | pending | 未実行 |
| `pnpm --filter @playground/ssr fmt:check` | pending | 未実行 |
| `pnpm --filter @playground/vanilla build` | pending | 未実行 |
| `pnpm --filter @playground/vanilla fmt:check` | pending | 未実行 |
| `pnpm --filter @playground/getting-started-check build` | pending | 未実行 |
| `pnpm --filter @playground/nuxt build` | pending | 未実行 |

## Implementation Matrix

この matrix は手順 1 の実コード調査で API、SPEC、test、implementation の列を確定する。
依存順は foundation から user-visible workflow へ向け、各行を独立した vertical slice に分割する。

| ID | 設計要件 | 主担当 | API / artifact | SPEC | Test | Implementation | Dependency | 状態 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| VG01 | docs と全 playground の実処理 gate | docs / playgrounds | package scripts と workflow test | 調査中 | 調査中 | `package.json` と test infrastructure | なし | pending |
| EG01 | ModuleCoordinator と module graph snapshot | transformer / shared | 調査中 | 調査中 | 調査中 | 調査中 | VG01 | pending |
| EG02 | ExecutionGraph、TemplateNode、Occurrence、identity | transformer / shared | 調査中 | 調査中 | 調査中 | 調査中 | EG01 | pending |
| OC01 | ObservationContract、composition、RealizationWitness | transformer / shared | 調査中 | 調査中 | 調査中 | 調査中 | EG02 | pending |
| ID01 | canonical preimage、digest、qualified ID | shared / transformer | 調査中 | 調査中 | 調査中 | 調査中 | EG01 | pending |
| SC01 | semantic fact、relation、execution contract、registry | transformer / shared | 調査中 | 調査中 | 調査中 | 調査中 | OC01 / ID01 | pending |
| PL01 | root、read、effect、callback、module closure の導出 | transformer | 調査中 | 調査中 | 調査中 | 調査中 | EG02 / SC01 | pending |
| PL02 | placement solver、cost、diagnostic path | transformer | 調査中 | 調査中 | 調査中 | 調査中 | PL01 | pending |
| SR01 | ExecutionGraph 由来の server renderer | transformer / runtime | 調査中 | 調査中 | 調査中 | 調査中 | PL02 | pending |
| SR02 | RenderOperation、header、stream、retry、cancel | runtime / plugin | 調査中 | 調査中 | 調査中 | 調査中 | SR01 | pending |
| MP01 | MaterializationRequirement と MaterializationPlan | transformer / shared | 調査中 | 調査中 | 調査中 | 調査中 | PL02 | pending |
| MP02 | projection、artifact address、manifest、budget、authority | transformer / runtime / plugin | 調査中 | 調査中 | 調査中 | 調査中 | MP01 / SR02 | pending |
| CG01 | ClientScopeGraph と activation group | transformer / runtime | 調査中 | 調査中 | 調査中 | 調査中 | MP02 | pending |
| CR01 | client runtime、ownership、failure、cleanup、zero bootstrap | runtime | 調査中 | 調査中 | 調査中 | 調査中 | CG01 | pending |
| DA01 | marker、existing DOM attachment、DSD fence、reconciliation | components / runtime / transformer | 調査中 | 調査中 | 調査中 | 調査中 | CR01 | pending |
| DA02 | event admission、dynamic UI、`render:client`、`activate:*`、`dom:external` | components / runtime / transformer | 調査中 | 調査中 | 調査中 | 調査中 | DA01 | pending |
| PR01 | reference と subscription lifecycle | runtime / shared | 調査中 | 調査中 | 調査中 | 調査中 | MP02 / CR01 | pending |
| PR02 | remote operation、wire DTO、authority、receipt、recovery | runtime / plugin / shared | 調査中 | 調査中 | 調査中 | 調査中 | PR01 | pending |
| LC01 | effect、activation、dispose、late settlement、budgeted cleanup | runtime / components | 調査中 | 調査中 | 調査中 | 調査中 | CR01 / PR01 | pending |
| API01 | components、runtime、plugin、core の公開 API | components / runtime / plugin / core | 調査中 | 調査中 | 調査中 | 調査中 | DA02 / PR02 / LC01 | pending |
| MG01 | docs、playground、DocCodeBlock の移行 | docs / playgrounds | 調査中 | 調査中 | 調査中 | 調査中 | API01 | pending |
| RM01 | 旧 UI hydration、island、fallback の削除 | components / runtime / transformer / plugin / core | 調査中 | 調査中 | 調査中 | 調査中 | MG01 | pending |

## Acceptance Work

各項目は設計正本の「実装時の検証事項」に一対一で対応する。
`completed` にするには test、command、artifact、benchmark、inspection result のいずれかによる直接証拠が必要である。

| ID | Acceptance work | 状態 | 直接証拠 |
| --- | --- | --- | --- |
| A01 | ModuleCoordinator の incremental build cost と memory usage | pending | 未取得 |
| A02 | declared candidate universe 内の solver 最適性 | pending | 未取得 |
| A03 | ObservationContract と RealizationWitness の canonical comparison | pending | 未取得 |
| A04 | selection-domain class の worst-case metric 再現 | pending | 未取得 |
| A05 | canonical atom classification と digest の順序独立性、排他性、網羅性 | pending | 未取得 |
| A06 | plan-independent DeploymentProjectionDefinition ID | pending | 未取得 |
| A07 | ArtifactAddressId、exact-byte digest、plan ID の非自己参照と再現性 | pending | 未取得 |
| A08 | 一つの ArtifactAddressId に対する単一 bytes identity | pending | 未取得 |
| A09 | ProjectionManifestCore、固定長 envelope、cold reachable bytes の計数 | pending | 未取得 |
| A10 | final bundler closure からの server-only dependency 除外 | pending | 未取得 |
| A11 | source、manifest、contract conflict diagnostic | pending | 未取得 |
| A12 | semantic ID と registry ID の namespace 衝突検査 | pending | 未取得 |
| A13 | module map、import map、integrity、redirect の host profile 適合性 | pending | 未取得 |
| A14 | compiled registry projection と environment closure | pending | 未取得 |
| A15 | GraphPathWitness と private grant/reference identity の事前検証 | pending | 未取得 |
| A16 | codec graph edge slot table の materialization 前検証 | pending | 未取得 |
| A17 | BootAuthority の事前注入と capability binding | pending | 未取得 |
| A18 | policy input、value-domain、failure-schema、host-profile、brand の conformance | pending | 未取得 |
| A19 | RenderOperation の cancel、retry、header、stream race | pending | 未取得 |
| A20 | FinalHeaderCommit と複数 103 publication の linearization | pending | 未取得 |
| A21 | subscription incarnation、pair fence、continuity、resync、ack、budget、GC | pending | 未取得 |
| A22 | allocation token、cleanup deadline、LateSettlementLedger race | pending | 未取得 |
| A23 | creation operation と allocation/commit identity | pending | 未取得 |
| A24 | retention、CleanupTaskToken、LateCleanupLedger、hard budget、generation fence | pending | 未取得 |
| A25 | graph-table budget、codec enforcement、疎配列、symbol validation | pending | 未取得 |
| A26 | carrier attestation、canonical text、JSON depth、local symbol validation | pending | 未取得 |
| A27 | DSD parse fence と custom-element reaction ordering | pending | 未取得 |
| A28 | move、adoption、cross-coordinator migration | pending | 未取得 |
| A29 | input、autofill、history restoration、form reconciliation | pending | 未取得 |
| A30 | interaction、load、media、animation event admission frontier | pending | 未取得 |
| A31 | dynamic UI と late fragment の slot transaction | pending | 未取得 |
| A32 | activation capability の scope、selector、stale rejection、failure | pending | 未取得 |
| A33 | integration key、opaque ref、budgeted operation ledger、CAS、watermark | pending | 未取得 |
| A34 | failure subject、tombstone、snapshot、pin budget、lease | pending | 未取得 |
| A35 | effect、onActivate、onDispose、owned resource cleanup DAG | pending | 未取得 |
| A36 | remote outcome の cancellation、expiry、ambiguity、delivery horizon | pending | 未取得 |
| A37 | remote trust boundary、canonical frame、budget、receipt、recovery | pending | 未取得 |
| A38 | server receipt から closed wire DTO と response proof を構築する順序 | pending | 未取得 |
| A39 | `render:client` の prop 契約と reserved prop removal | pending | 未取得 |
| A40 | `dom:external` の identity、nesting、SSR、lifetime、cleanup | pending | 未取得 |
| A41 | non-atomic writer の BufferedFinalWrite と unknown terminal | pending | 未取得 |
| A42 | DocCodeBlock の server-only highlight artifact closure | pending | 未取得 |
| A43 | client root がない route の zero bootstrap と zero payload | pending | 未取得 |
| A44 | root から失敗 dependency までの diagnostic path | pending | 未取得 |

## Slice Log

| Slice | 状態 | 設計要件 | 検証 | Review | Commit / Push |
| --- | --- | --- | --- | --- | --- |
| PLAN-00 | in-progress | 実装 branch、正本、進捗台帳を確立する | `git status`、local/remote OID | 文書 commit 後に確認 | 未 commit |

## Review Log

| 対象 | Reviewer | 結果 | 採否と対応 |
| --- | --- | --- | --- |
| 未実施 | - | pending | 最初の vertical slice から記録する |

## Commit / Push Log

| Slice | Commit | Remote | 同期確認 |
| --- | --- | --- | --- |
| 未実施 | - | `origin/feature/declarative-ui-execution-partitioning` | pending |

## 未完了事項

- baseline command を実行して結果を記録する。
- 実コードと package ごとの正本を調査し、implementation matrix の `調査中` を具体的な path へ置き換える。
- verification-gate slice を独立レビュー、commit、push まで完了する。
- Phase 1 から Phase 10 を vertical slice 単位で実装する。
- push 後の全体監査と exact remote OID の最終監査を完了する。
