= source execution contract identity and subject model

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

source execution contractが、qualification前のfactを一つのcontract内で参照するためのlocal identity、stable failure、source-local subjectとvalue pathを提供する。

SC02A1は`FactId`、`factId()`、`ExecutionContractError`だけをpackage-local facadeから公開する。

SC02A2はsemantic subjectとpath segmentをtype-only modelとして追加する。

fact、transfer binding、relation、source envelope、unknown input parser、budget、closure、digestは後続の独立review unitが追加する。

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

#interface_spec(
  name: "Semantic subject and path model",
  summary: [
    semantic factの対象を7種類のclosed discriminated union、nested value pathを3種類のsequence elementで表す。
  ],
  format: [
    ```typescript
    type SemanticPathSegment =
      | { readonly kind: "property"; readonly key: string }
      | { readonly kind: "tuple-index"; readonly index: number }
      | { readonly kind: "element" }

    type SemanticSubject =
      | { readonly kind: "module-evaluation" }
      | { readonly kind: "export-value"; readonly exportName: string }
      | { readonly kind: "receiver"; readonly exportName: string }
      | { readonly kind: "parameter"; readonly exportName: string; readonly index: number; readonly path: readonly SemanticPathSegment[] }
      | { readonly kind: "return"; readonly exportName: string; readonly path: readonly SemanticPathSegment[] }
      | { readonly kind: "callback-invocation"; readonly exportName: string; readonly parameterIndex: number; readonly path: readonly SemanticPathSegment[] }
      | { readonly kind: "allocated-resource"; readonly exportName: string; readonly allocationSiteId: string }
    ```
  ],
  constraints: [
    - pathはsetではなくsequenceであり、同じsegmentを複数回含めることができる
    - callback pathのrootは`parameterIndex`で選んだtop-level parameter valueとする
    - top-level parameter自体がcallback slotなら空path、nested callback slotなら`property`、`tuple-index`、`element`を順に並べたrequired pathで表す
    - `element`はhomogeneous collectionに共通する静的element domainであり、個々のruntime elementやcallback occurrenceを識別しない
    - callback subject identityはruntime function instanceではなく、source-localな静的semantic locationに対して一意とする
    - subjectは未信頼なsource-local location claimであり、型への適合は実module signatureとの一致を証明しない
    - 後続SC02A strict parserはindex、path segment scalar、closed structural ruleを検証する
    - SC03はcompiler-ownedでpath traversal可能なmodule signatureまたはsource-analysis evidenceを使い、export、parameter、callback path、callable location、allocation siteの実在を検証する
    - SC03 evidenceのschemaと生成はSC03の先行review unitが定義し、evidenceがないclaimはfallbackせずdiagnosticにする
    - fact kind、behavioral relation、trust acceptanceをこのmodelへ埋め込まない
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

#feature_spec(
  name: "Source-local subject model",
  description: [
    後続のfact modelとstrict parserが共有するlocationとnested pathのtype-only taxonomyを提供する。
  ],
  validation: [
    - 7 subject kindと3 path segment kindを双方向のexact type fixtureで検査する
    - 各variantのkeyとproperty typeを双方向のexact type fixtureで検査する
    - direct callbackの空path、object property callback、tuple callback、element callbackを区別できることを検査する
    - pathの順序とrepeated path segmentを保持できることを検査する
    - wrong property type、extra property、callback pathの省略をnegative type fixtureで検査する
    - fact、transfer binding、relation、aggregate source、source envelope、qualified、compiled、accepted、digest APIが存在しないことを検査する
    - facadeのruntime valueが`ExecutionContractError`と`factId`だけであることを検査する
  ],
)
