= materialization mechanism taxonomy

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

cross-boundary demandを実現するmaterialization mechanismを、後続のcandidateとplan contractが共有できるclosed taxonomyとして定義する。

このAPIはpackage-localなtype-only foundationであり、runtime operationとshared package rootの公開面を増やさない。

== 設計判断

#adr(
  header("materialization mechanismを直接支配する契約で分類する", Status.Accepted, "2026-07-12"),
  [
    mechanism内部のcodec、locator、initial payload、transport dependencyを分類根拠にすると、一つのmechanismが複数kindへ適合し、後続のidentityとcandidate comparisonがproducerの恣意的なlabel選択へ依存する。
  ],
  [
    mechanismがdemandへ直接提供する結果、またはmechanismを直接支配するcontractによって、7種類のkindから一つを選ぶ。
    内部dependencyを推移的にたどって外側のmechanismを再分類しない。
  ],
  [
    - taxonomyへの所属はplacement、legality、equivalence、trust、client inclusionを証明しない
    - step、DAG、selection、protocolは後続contractが所有する
    - unknown dependencyをfull client moduleへ含めるfallbackには使わない
  ],
  alternatives: [
    1. *全plan stepのkindにする*: step schemaとcompositionを先行固定するため採用しない
    2. *内部dependencyも別kindとして重ねる*: 一つのmechanismを一意に分類できないため採用しない
    3. *placement、outcome、carrierをkindへ含める*: materialization mechanismとは別の責務であるため採用しない
  ],
)

== インターフェース仕様

#interface_spec(
  name: "Materialization mechanism kind",
  summary: [
    materialization candidateまたは後続plan recordが参照するmechanism分類をclosed unionで表す。
  ],
  format: [
    ```typescript
    type MaterializationMechanismKind =
      | "inline"
      | "snapshot"
      | "target-native"
      | "codec"
      | "reference"
      | "subscription"
      | "remote"
    ```
  ],
  constraints: [
    - `inline`はbuild時に完全確定したrepresentationをcompiler-owned literalとしてtarget artifactへ直接含めるmechanismである
    - `snapshot`はinlineまたは継続contractを使わず、source stateの有限なstandalone captureを直接materializeするmechanismである
    - `target-native`はsource-derived representation、locator、codec、reference、subscription、remote contractを直接消費せず、target moduleまたはhost bindingから値を得るmechanismである
    - `codec`はdeclared codec contractによるrepresentation変換またはreconstructionを直接行うmechanismである
    - `reference`はdeclared resolver contractとlocatorによってreferentまたはhandleを直接解決し、remote-operation bindingを含まないmechanismである
    - `subscription`はinitial snapshot revisionとlog-boundary cursorのjoint consistency point、および継続revisionを一体で提供するdeclared subscription contractを直接消費するmechanismである
    - `remote`はdeclared remote-operation contractからauthor-visibleなexplicit async operation bindingを直接得るmechanismである
    - taxonomyへの所属は、`target-native`を含め、target moduleまたはhost bindingのnative closureを証明しない
  ],
)

== 振る舞い仕様

#behavior_spec(
  given: "subscriptionがinitial snapshotとrevision codecを内部dependencyとして持つ",
  when: "外側のmechanism kindを分類する",
  then: "initial payloadやcodecを推移的にたどらずsubscriptionへ分類する",
)

#behavior_spec(
  given: "remote operationがcodec、handle、bindingを内部dependencyとして持つ",
  when: "外側のmechanism kindを分類する",
  then: "codec、reference、target-nativeへ再分類せずremoteへ分類する",
)

== 機能仕様

#feature_spec(
  name: "Type-only mechanism taxonomy",
  description: [
    後続schemaを仮実装せず、一つのclosed unionと単値分類境界だけをpackage-local facadeから提供する。
  ],
  validation: [
    - 7 literalと`MaterializationMechanismKind`を双方向のexact type fixtureで検査する
    - test-localなexhaustive recordで全literalを検査する
    - `server-only`、`graph-table`、`no-transfer`、未知literalがunionに属さないことを検査する
    - shared package rootからtypeをimportできないことを検査する
    - facadeのASTで唯一のexportが`./model`からのtype-only `MaterializationMechanismKind`であることを検査する
    - facadeとmodelのemitにruntime declaration、runtime value import/export、top-level effectがないことを直接検査する
    - 明示的なtype-only consumer entryのemitにruntime import edgeがないことを直接検査する
  ],
)

== 責務境界

- `server-only`はexecution placementであり、このtaxonomyへ含めない
- `graph-table`はrequest-specific data carrierであり、このtaxonomyへ含めない
- `no-transfer`の意味、成立条件、ownerはこのAPIで決定しない
- step、DAG、atomicity、composition、selection、placement、carrier、trust admission、registry closure、protocol execution、diagnosticは後続APIが所有する
- SC02 `TransferBinding`、SC01 registry、trustとのbridgeは後続MP01-DK2が所有し、kind文字列の一致だけで未信頼claimをadmitしない
- candidate behaviorとObservationContractの接続は後続CN01が所有する
- target moduleとhost bindingのnative closure検証は後続のcandidate legalityとartifact closureが所有する
- `inline`もartifact emissionであるため、後続のexposure、integrity、artifact closure検査を省略しない
- subscription protocolとremote protocolのruntime処理をこのAPIへ追加しない
