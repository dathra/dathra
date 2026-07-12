= source execution contract identity

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

source execution contractが、qualification前のfactを一つのcontract内で参照するためのlocal identityとstable failureを提供する。

SC02A1は`FactId`、`factId()`、`ExecutionContractError`だけをpackage-local facadeから公開する。

semantic modelはSC02A2、unknown inputのparser、budget、closure、digestはSC02A3以降が追加する。

== 設計判断

#adr(
  header("source-local fact identityをqualified identityから分離する", Status.Accepted, "2026-07-12"),
  [
    source declarationの短いIDとmodule namespaceでqualifiedされたIDを同じ型にすると、qualification前のclaimがcompiler evidenceとして使われても型で検出できない。
  ],
  [
    `FactId`は一つのsource contract内だけで意味を持つbranded stringとする。
    `factId()`はnon-emptyなvalid Unicode stringをnormalizationせずに受理する。
    qualified ID、compiled contract、accepted evidenceは後続sliceだけが定義する。
  ],
  [
    - digestの形を持つ文字列もsource-local IDとして扱う
    - provenanceやtrustを文字列形状から推測しない
    - SCC namespaceによるqualificationはSC03だけが行う
  ],
)

#adr(
  header("source contract failureをimmutableなcodeとpathで表す", Status.Accepted, "2026-07-12"),
  [
    parser、closure validator、digestが異なるerror shapeを送出すると、compiler diagnosticが失敗位置と分類を安定して扱えない。
  ],
  [
    source contract operationは`ExecutionContractError`を共通failureとする。
    error codeはclosed union、pathはrootからのpropertyまたはarray indexのimmutable snapshotとする。
    error自身もfreezeし、送出後に分類やpathを書き換えられないようにする。
  ],
  [
    - SC02A1は後続operationが使う全stable codeを先に固定する
    - nested parserは同じerrorへfield prefixを追加する
    - package-local facadeはinternalな`fail()` helperを公開しない
  ],
)

== インターフェース仕様

#interface_spec(
  name: "Source-local fact identity",
  summary: [
    source contract内だけで有効なfact identifierを作成する。
  ],
  format: [
    ```typescript
    type FactId = string & FactIdBrand

    function factId(value: string): FactId
    ```
  ],
  constraints: [
    - `factId()`はempty stringとlone surrogateを`invalid-fact-id`で拒否する
    - Unicode normalizationを行わず、受け取ったcode-unit sequenceを保持する
    - valid surrogate pairは受理する
    - raw stringを`FactId`へ暗黙代入できない
  ],
)

#interface_spec(
  name: "Stable execution contract failure",
  summary: [
    source contract operationの失敗分類とroot-relative pathをimmutableなerrorとして表す。
  ],
  format: [
    ```typescript
    type ExecutionContractErrorCode =
      | "invalid-closed-record"
      | "invalid-field"
      | "invalid-fact-id"
      | "invalid-registry-id"
      | "noncanonical-order"
      | "duplicate-record"
      | "dangling-reference"
      | "kind-mismatch"
      | "version-mismatch"
      | "semantic-mismatch"
      | "budget-exceeded"
      | "crypto-unavailable"

    class ExecutionContractError extends TypeError {
      readonly code: ExecutionContractErrorCode
      readonly path: readonly (string | number)[]
    }
    ```
  ],
  constraints: [
    - constructorはcaller pathをcopyしてからfreezeする
    - error object自身をfreezeする
    - helperが生成するmessageはrootを`$`としてpathを含む
    - facadeのruntime value exportは`ExecutionContractError`と`factId`だけとする
  ],
)

== 振る舞い仕様

#behavior_spec(
  given: "non-emptyなvalid Unicode stringをfactIdへ渡す",
  when: "source-local FactIdを作る",
  then: "normalizationせず同じcode-unit sequenceを返す",
)

#behavior_spec(
  given: "empty string、lone surrogate、または非string runtime valueをfactIdへ渡す",
  when: "source-local FactIdを作る",
  then: "空pathを持つinvalid-fact-idのExecutionContractErrorを送出する",
)

#behavior_spec(
  given: "mutable pathを使ってExecutionContractErrorを作成する",
  when: "callerが元のpath、error.path、error fieldを書き換える",
  then: "error codeとpath snapshotは変化しない",
)

== 機能仕様

#feature_spec(
  name: "Source-local identity boundary",
  description: [
    後続のsemantic modelとstrict parserが共有するsource-local identityとfailure vocabularyを提供する。
  ],
  validation: [
    - valid Unicode、composed/decomposed sequence、surrogate pairを検査する
    - empty、lone surrogate、非string runtime valueを検査する
    - errorとpathのimmutabilityを検査する
    - qualified、compiled、accepted APIがfacadeに存在しないことを検査する
  ],
)
