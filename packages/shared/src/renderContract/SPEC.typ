= render definition model

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

render outputを構成する四つのreference claimを、一つのversioned preimageへ束縛するpackage-localな型契約とdescriptor snapshot境界を定義する。

DI1はnominal ID、role-specific claim、definition record、creator input、domain errorを提供する。
DI2Aはcreator inputとparser inputのdescriptor occurrenceを同期的にsnapshotするpackage-internal APIを提供する。
DI2Bはそのsnapshotへscalar validationを適用し、fresh preimageとunbranded wrapperを構築する。
DI3Aはcreator snapshotからcontent identityを発行し、freshなreturned definition rootを構築するpackage-local creatorを提供する。
DI3Bはparser snapshotのpreimage content identityとwrapper IDの一致を検証し、freshなreturned definition rootを構築するpackage-local parserを提供する。
shared package rootへの公開は後続sliceが所有する。

== 設計判断

#adr(
  header("render definition IDをprivate brandで区別する", Status.Accepted, "2026-07-12"),
  [
    `RenderDefinitionId`をplain stringまたはgenericな`Sha256Digest`のaliasにすると、未検証のdigestをdefinition identityとして入力できる。
    一方、wrapper objectを使うと既存のdigest APIとstring APIへ直接wideningできない。
  ],
  [
    `RenderDefinitionId`を`Sha256Digest`とprivateな必須`unique symbol` brandのintersectionとして定義する。
    DI1はbrandを型として公開するが、brandを発行するcreator、parser、guard、castを提供しない。
  ],
  [
    - genericなdigestまたはstringをdefinition IDへ直接代入できない
    - definition IDはgenericなdigestまたはstringとして読み出せる
    - lexicalに正しいdigestだけではdefinition preimageとの一致を証明できない
    - brand発行はclosed validationとcontent digestを所有するDI3に限定される
  ],
  alternatives: [
    1. *plain stringまたはgeneric digestのalias*: 未検証のdigestをdefinition IDとして入力できるため採用しない
    2. *opaque wrapper object*: digestとstringへのwideningを妨げるため採用しない
    3. *DI1でlexical parserまたはcastを提供する*: preimage検証なしでbrandを発行するため採用しない
  ],
)

#adr(
  header("reference claimをroleごとに異なる型にする", Status.Accepted, "2026-07-12"),
  [
    四つのreferentは同じ`Sha256Digest`表記を使うため、genericなclaim typeではobservation、response、body、exposureを交差代入できる。
    その代入はpreimage fieldとclaim semanticsの対応を型検査で失わせる。
  ],
  [
    各claimは固有の`schema`と`role` literal、およびgenericな`claimedId`を持つ独立したreadonly interfaceとする。
    `claimedId`は未信頼のreference payloadであり、referentの実在、target schema、self digest、role compatibilityを証明しない。
  ],
  [
    - claimの交差代入をliteral fieldで拒否できる
    - preimageは四つのroleをfield単位で固定できる
    - referent closureとaccepted definitionは後続validatorに残る
  ],
)

#adr(
  header("DI1のruntime surfaceをdomain errorだけに限定する", Status.Accepted, "2026-07-12"),
  [
    schema modelは型だけで表現できるが、後続のvalidationとidentity operationは一つのstable domain errorを共有する必要がある。
    未実装operationの仮exportはslice境界とbrand authorityを曖昧にする。
  ],
  [
    package-local facadeのruntime exportをimmutableな`RenderDefinitionError`だけにする。
    modelとerror codeはtype-onlyで再exportし、facadeのruntime dependencyをerror moduleだけに限定する。
  ],
  [
    - DI1だけでfailure vocabularyとerror immutabilityを検証できる
    - modelのtype-only consumerはruntime dependencyを持たない
    - creator、parser、digest、snapshot、hard limitを後続sliceより先に公開しない
  ],
)

#adr(
  header("DI2Aでdescriptor resource境界を独立させる", Status.Accepted, "2026-07-12"),
  [
    creatorとparserがcaller recordを通常のproperty accessで読むと、accessor実行、入力規模の無制限化、非同期処理中のmutation混入が起きる。
    nested aliasをschema pathごとに再列挙すると、同じobjectのdescriptor観測結果を一operation内で統一できない。
  ],
  [
    current-realmのordinary plain recordまたはnull-prototype recordだけを対象に、prototype、identity cache、own keys、hard limit、descriptor、structural rule、expected child discoveryの順で同期snapshotする。
    reflection結果はobject identityごとに再利用しつつ、schema pathごとのoccurrenceを保持する。
    package-internal surfaceには、凍結したpath、string own key、expected fieldのmissing/string/non-string/object stateだけを公開し、descriptor mapとcaller objectを公開しない。
  ],
  [
    - caller accessorとextra property valueを読まずにdescriptor resource境界を検証できる
    - callerが緩和できない固定上限でdescriptor workを制限できる
    - DI2Bはcaller recordを再読せずscalar validationとfresh constructionへ進める
    - DI2Aはmissing、extra、literal、digestをfailureへ分類しない
    - Proxyは標準APIでtrapなしに識別できないため入力契約外になる
  ],
  alternatives: [
    1. *descriptorとscalar validationを一revisionに束ねる*: resource boundaryを単独検証できずreview責務が過大になるため採用しない
    2. *operation-wide key counter*: expected childのdescriptor取得前にnested key数を確定できないため採用しない
    3. *MapまたはPropertyDescriptorを返す*: mutationとcaller object再読を後段へ漏らすため採用しない
  ],
)

#adr(
  header("DI2Bをsanitized snapshotだけで完結させる", Status.Accepted, "2026-07-12"),
  [
    scalar validationがcaller recordやdescriptorを再読すると、DI2Aの同期snapshot境界を破り、validation結果へ後続mutationを混入できる。
    一方、canonical digestとbrand発行まで同じsliceへ含めると、pure scalar validationとidentity authorityを独立検証できない。
  ],
  [
    DI2Bは`RenderDefinitionDescriptorSnapshot`だけを入力し、DI2Aが投影したkind、path、own key、field stateだけでexpected string budget、missing、extra、literal、digestを検証する。
    DI2Aがdeferしたpresent nested fieldのprimitive stateは、R5 descriptor phaseの完了としてscalar budgetより前に`invalid-closed-record`へ分類する。
    全検証成功後だけ、captured stringからfreshかつdeep-frozenなpreimageまたはgeneric digest IDを持つunbranded wrapperを構築する。
  ],
  [
    - DI2Bはcaller object、Map、PropertyDescriptor、reflectionを必要としない
    - 256 code-unit capとR3 failure precedenceをDI2A resource workから独立検証できる
    - outputはcanonical digest、self-digest equality、brand、accepted evidenceを表さない
    - DI3はvalidated fresh snapshotだけをcanonicalizeし、identity authorityを発行できる
  ],
  alternatives: [
    1. *caller recordを再入力する*: DI2A snapshot後のmutationとaccessorを再観測するため採用しない
    2. *DI2Bでdescriptor snapshotを再実装する*: resource orderとalias cacheを重複させるため採用しない
    3. *DI2Bでcanonical digestまで生成する*: scalar contractとidentity authorityを再結合するため採用しない
  ],
)

#adr(
  header("validated preimageをdigest前にfreezeする", Status.Accepted, "2026-07-13"),
  [
    RC01-DI-R5はdigest成功後にnested recordからrootまでを一度だけdeep freezeするとしていた。
    しかしDI3のcanonical digestは非同期であり、digest inputを呼び出し中のmutationから隔離するにはvalidated preimageをdigest開始前にimmutableにする必要がある。
  ],
  [
    DI2Bはfreshなunbranded preimageをdeep freezeしてから返す。
    DI3はそのpreimageを再構築または再freezeせずcanonical digestへ使い、digest成功後にbranded IDを持つfreshなreturned `RenderDefinition` rootだけを構築してfreezeする。
  ],
  [
    - 非同期digest中にvalidated contentを変更できない
    - nested preimageのfreezeはDI2B、identity authorityを持つreturned rootのfreezeはDI3へ分離される
    - canonicalization、digest、self-digest equality、brand発行はDI3に残る
  ],
  alternatives: [
    1. *digest成功後までpreimageをmutableにする*: 非同期digestとcaller mutationが競合するため採用しない
    2. *DI3でpreimageをcloneしてfreezeする*: validated snapshotを再構築し、DI2B outputとのidentityと責務を曖昧にするため採用しない
    3. *DI2Bでdigestとreturned rootまで生成する*: scalar validationとidentity authorityを再結合するため採用しない
  ],
  supersedes: ("RC01-DI-R5 descriptor resource boundaryのdigest成功後にnested recordからrootまでを一度だけdeep freezeするtiming",),
)

#adr(
  header("creatorのbrand authorityをdigest成功後に限定する", Status.Accepted, "2026-07-13"),
  [
    genericな`Sha256Digest`へ字句検査だけで`RenderDefinitionId` brandを付与すると、render definition preimageとのcontent identity関係を証明できない。
    また、canonical digestは非同期に失敗し得るため、digest完了前のbrandまたはreturned root発行は失敗operationにもauthorityを与える。
  ],
  [
    DI3A creatorはDI2A descriptor snapshotとDI2B scalar validationを最初の非同期境界より前に同期実行し、得られたdeep-frozen preimageへ`digestCanonicalJson`をexactly once開始する。
    canonical identity failureをdomain errorへ変換し、digest成功後だけprivate identity-authority boundaryで`RenderDefinitionId`を発行する。
    DI2B preimageを再構築または再freezeせず、その同じidentityを持つfreshな`{ id, preimage }` rootだけをfreezeする。
  ],
  [
    - validation failureはWebCrypto、brand、returned rootを開始しない
    - crypto failureはbrandとreturned rootを発行しない
    - caller mutationと非同期digestの競合をDI2A/DI2Bの同期captureで遮断できる
    - brand発行の型assertionをdomain-specific digest成功後のprivateな一点へ限定できる
  ],
  alternatives: [
    1. *digest開始前にbrandを付与する*: failed operationにもidentity authorityを与えるため採用しない
    2. *digest成功後にpreimageをcloneまたはdeep freezeする*: DI2B validated outputのidentityとfreeze責務を破るため採用しない
    3. *generic ID castまたはguardを公開する*: preimage検証なしでbrandを発行できるため採用しない
  ],
)

#adr(
  header("verified parserのbrand authorityをself digest一致後に限定する", Status.Accepted, "2026-07-13"),
  [
    lexicalに妥当なwrapper `id`だけへ`RenderDefinitionId` brandを付与すると、closed preimageとのcontent identity関係を証明できない。
    また、DI2Bのunbranded wrapperをそのまま返すと、digest不一致でもreturned definition rootを発行するか、validation ownerとidentity authorityの境界を曖昧にする。
  ],
  [
    DI3B parserはDI2A descriptor snapshotとDI2B scalar validationを最初の非同期境界より前に同期実行し、unbranded wrapperのexact same preimageへ`digestCanonicalJson`をexactly once開始する。
    canonical identity failureをparser wrapper rootに相対なdomain errorへ変換し、computed digestとlexically validなwrapper `id`が一致した後だけ、computed digestをcreatorと共有するprivate assertion一点で`RenderDefinitionId`として発行する。
    DI2B preimageを再構築または再freezeせず、その同じidentityを持つfreshな`{ id, preimage }` rootだけをfreezeし、DI2B unbranded wrapper rootは返さない。
  ],
  [
    - descriptorまたはscalar failureはWebCrypto、brand、returned rootを開始しない
    - canonical identity failureまたはdigest mismatchはbrandとreturned rootを発行しない
    - caller mutationと非同期digestの競合をDI2A/DI2Bの同期captureで遮断できる
    - parser outputはclosed preimageとself digest一致だけを証明し、referentの実在、trust、acceptanceを証明しない
  ],
  alternatives: [
    1. *wrapper IDを字句検査後にbrand化する*: preimageとの一致前にidentity authorityを発行するため採用しない
    2. *computed digestではなくwrapper IDをbrand化する*: authorityの根拠となる計算結果との対応をprivate boundaryで表せないため採用しない
    3. *DI2B unbranded wrapperを返す*: identity authorityを持つfresh rootの発行時点を分離できないため採用しない
    4. *digest後にpreimageをcloneまたはdeep freezeする*: DI2B validated outputのidentityとfreeze責務を破るため採用しない
  ],
)

== インターフェース仕様

#interface_spec(
  name: "Render definition identity",
  summary: [
    closedなrender definition preimageのcanonical SHA-256 digestであることを表すnominal subtypeを定義する。
  ],
  format: [
    ```typescript
    declare const renderDefinitionIdBrand: unique symbol

    type RenderDefinitionId = Sha256Digest & {
      readonly [renderDefinitionIdBrand]: true
    }
    ```
  ],
  constraints: [
    - `renderDefinitionIdBrand`はmodel内部に留め、exportしない
    - brand propertyはreadonlyかつmandatoryとする
    - `string`またはgenericな`Sha256Digest`から`RenderDefinitionId`への代入は失敗する
    - `RenderDefinitionId`から`Sha256Digest`または`string`へのwideningは成功する
    - IDを発行するruntime APIはDI1に含めない
  ],
)

#interface_spec(
  name: "Role-specific reference claims",
  summary: [
    render definitionが参照する四つのroleを、schemaとrole literalが異なるclosed type shapeとして表す。
  ],
  format: [
    ```typescript
    interface RenderObservationReferenceClaim {
      readonly schema: "dathra.render-definition-observation-reference/1"
      readonly role: "observation-contract"
      readonly claimedId: Sha256Digest
    }

    interface RenderResponseReferenceClaim {
      readonly schema: "dathra.render-definition-response-reference/1"
      readonly role: "response-contribution-set"
      readonly claimedId: Sha256Digest
    }

    interface RenderBodyReferenceClaim {
      readonly schema: "dathra.render-definition-body-reference/1"
      readonly role: "ordered-body-plan"
      readonly claimedId: Sha256Digest
    }

    interface RenderExposureReferenceClaim {
      readonly schema: "dathra.render-definition-exposure-reference/1"
      readonly role: "exposure-contract"
      readonly claimedId: Sha256Digest
    }
    ```
  ],
  constraints: [
    - 各claimは`schema`、`role`、`claimedId`の三fieldだけを持つ
    - 全fieldをreadonlyとする
    - 四つのclaim typeは相互に代入できない
    - `claimedId`はgenericな`Sha256Digest`であり、accepted referentを表さない
  ],
)

#interface_spec(
  name: "Render definition records",
  summary: [
    四つのreference claimをversioned preimageへ配置し、identity wrapperとcreator inputの型shapeを固定する。
  ],
  format: [
    ```typescript
    interface RenderDefinitionPreimage {
      readonly schema: "dathra.render-definition/1"
      readonly observationContract: RenderObservationReferenceClaim
      readonly responseContributions: RenderResponseReferenceClaim
      readonly orderedBodyPlan: RenderBodyReferenceClaim
      readonly exposure: RenderExposureReferenceClaim
    }

    interface RenderDefinition {
      readonly id: RenderDefinitionId
      readonly preimage: RenderDefinitionPreimage
    }

    interface RenderDefinitionInput {
      readonly observationContractId: Sha256Digest
      readonly responseContributionSetId: Sha256Digest
      readonly orderedBodyPlanId: Sha256Digest
      readonly exposureContractId: Sha256Digest
    }
    ```
  ],
  constraints: [
    - 各interfaceはformatに示すfieldだけを持ち、全fieldをreadonlyとする
    - `RenderDefinitionInput`は未信頼のgeneric digestを保持し、validation済みsnapshotを表さない
    - readonly typeはruntime freezeを保証しない
  ],
)

#interface_spec(
  name: "Render definition failure",
  summary: [
    後続のclosed validationとcontent identity operationが共有するstable codeとimmutable pathを表す。
  ],
  format: [
    ```typescript
    type RenderDefinitionErrorCode =
      | "invalid-closed-record"
      | "invalid-field"
      | "invalid-reference"
      | "digest-mismatch"
      | "budget-exceeded"
      | "crypto-unavailable"

    class RenderDefinitionError extends TypeError {
      readonly code: RenderDefinitionErrorCode
      readonly path: readonly (string | number)[]
    }
    ```
  ],
  constraints: [
    - constructorは受け取ったpathを新しいarrayへcopyしてfreezeする
    - constructorは初期化後のerror objectをfreezeする
    - callerがconstructorへ渡したpathを後から変更してもerror pathは変わらない
    - error code unionへ別codeを追加しない
  ],
)

== 振る舞い仕様

#behavior_spec(
  name: "Domain error construction",
  summary: [
    stable code、path snapshot、messageを持つ変更不能な`TypeError`を生成する。
  ],
  preconditions: [
    - codeが`RenderDefinitionErrorCode`に属する
    - pathの各segmentがstringまたはnumberである
  ],
  steps: [
    1. messageを`TypeError`へ渡す
    2. error nameとcodeを設定する
    3. pathをfresh arrayへcopyしてfreezeする
    4. error objectをfreezeする
  ],
  postconditions: [
    - errorは`RenderDefinitionError`かつ`TypeError`である
    - source pathとerror pathは異なるarray identityを持つ
    - source path、error path、error codeへの後続mutationはerrorの観測値を変えない
  ],
)

#behavior_spec(
  name: "Closed descriptor snapshot",
  summary: [
    creatorの一record、またはparserのwrapper、preimage、四claimを固定preorderで同期snapshotする。
  ],
  preconditions: [
    - Proxyを入力しない
    - hard limitはown keys 16、property key 128 UTF-16 code unitsである
  ],
  steps: [
    1. occurrenceがnon-null objectで、prototypeがcurrent-realmの`Object.prototype`またはnullであることをown-key列挙前に検査する
    2. object identity cacheにsnapshotがあれば再利用する
    3. 未snapshot objectの`Reflect.ownKeys()`をexactly once呼ぶ
    4. key数16以下、全string key長128以下を順に検査する
    5. 上限内の全own keyのdescriptorをexactly once取得してidentity cacheへ保存する
    6. symbol、hidden property、accessorをrecord pathの`invalid-closed-record`で拒否する
    7. expected enumerable data descriptorだけからnested occurrenceをschema field orderで発見する
  ],
  postconditions: [
    - creatorは最大一occurrence、parserは最大六occurrenceを処理する
    - aliasのhost reflectionは一回で、pathごとのoccurrenceは独立して残る
    - key countまたはkey length超過はrecord pathの`budget-exceeded`になる
    - budget failureでは違反recordのdescriptor、後続record、extra valueを処理しない
  ],
)

#behavior_spec(
  name: "Sanitized descriptor occurrence projection",
  summary: [
    host reflection結果から、DI2Bがcallerを再読せず利用できるimmutableなschema occurrence viewを構築する。
  ],
  steps: [
    1. occurrenceごとにrecord kind、path、全string own keyをfresh arrayへcopyする
    2. expected field orderで、fieldをmissing、string、non-string、objectのいずれかへprojectする
    3. string stateだけがcaptured primitive stringを保持し、object stateはcaller objectを保持しない
    4. field、key、path、occurrence、root snapshotをfreezeする
  ],
  postconditions: [
    - output surfaceにMap、PropertyDescriptor、caller record、symbol keyを含めない
    - missing field、extra field、256 code unitsを超えるexpected stringもfailureへ分類せず保持する
    - nested expected fieldがprimitiveの場合は親field stateへ保持し、child occurrenceを作らない
    - schema、role、digestの意味検証とfresh domain record構築はDI2Bへ残る
  ],
)

#behavior_spec(
  name: "Validated scalar snapshot",
  summary: [
    DI2A occurrence snapshotへfixed resource completionとR5/R3 scalar precedenceを適用する。
  ],
  preconditions: [
    - inputはDI2Aが生成した`RenderDefinitionDescriptorSnapshot`である
    - creator operationへcreator snapshot、parser operationへparser snapshotを渡す
  ],
  steps: [
    1. presentなexpected nested fieldがobject stateであることをschema preorderで検査する
    2. presentなexpected string fieldをrecord preorderとfield orderで走査し、256 UTF-16 code units以下であることを検査する
    3. 全recordをpreorderで走査し、expected key orderで最初のmissing fieldを検査する
    4. 全recordをpreorderで走査し、raw UTF-16順の最初のextra keyを検査する
    5. schemaとroleをrecord preorderとfield orderでexpected literalと比較する
    6. creator digest、parser wrapper ID、claim digestを規定field orderで字句検査する
  ],
  postconditions: [
    - nested primitiveは`invalid-closed-record`とnested field pathになる
    - 257 code units以上のexpected stringは`budget-exceeded`とfield pathになる
    - missing、extra、wrong schema、wrong roleは`invalid-field`とfield pathになる
    - creator digestとclaim `claimedId`のnoncanonical valueは`invalid-reference`とfield pathになる
    - parser wrapper `id`のnoncanonical valueは`invalid-field`と`["id"]`になる
    - canonicalization、digest equality、WebCrypto、brand発行を実行しない
  ],
)

#behavior_spec(
  name: "Fresh immutable validated construction",
  summary: [
    全scalar validation成功後だけ、captured primitiveからDI3用domain recordを構築する。
  ],
  postconditions: [
    - creator operationはfreshかつdeep-frozenな`RenderDefinitionPreimage`を返す
    - parser operationはgeneric `Sha256Digest`の`id`と同じfresh preimageを持つdeep-frozenなunbranded wrapperを返す
    - 二回のoperationは値が等しくてもrootと全nested recordのidentityを共有しない
    - input snapshotとcaller recordをoutputへ保持しない
    - returned `RenderDefinition`、`RenderDefinitionId` brand、self-digest equalityを提供しない
  ],
)

#behavior_spec(
  name: "Render definition creator identity",
  summary: [
    creator inputを同期captureして検証し、validated preimageのcanonical digestを持つfreshなdefinitionを返す。
  ],
  steps: [
    1. `snapshotRenderDefinitionCreatorDescriptors(input)`を同期的に呼ぶ
    2. `validateRenderDefinitionCreatorSnapshot(snapshot)`を同期的に呼び、freshかつdeep-frozenなpreimageを得る
    3. 同じpreimage identityへ`digestCanonicalJson(preimage)`をexactly once開始する
    4. `CanonicalIdentityError`が`crypto-unavailable`なら`crypto-unavailable`とroot path、それ以外なら`invalid-field`とcanonical preimage内の元pathを持つfresh immutable `RenderDefinitionError`へ変換する
    5. digest成功後だけ、返されたdomain-specific digestをprivateな境界で`RenderDefinitionId`として発行する
    6. exact same preimageを持つfreshな`{ id, preimage }` rootを構築し、そのrootだけをfreezeする
  ],
  postconditions: [
    - `id`は`digestCanonicalJson(preimage)`と等しい
    - inputのstructuralまたはscalar failureではcanonical digestとWebCryptoを開始しない
    - callerがoperation返却直後にinputを変更してもcaptured preimageと結果は変わらない
    - `CanonicalIdentityError`をcallerへ公開しない
    - canonical identityの非`crypto-unavailable` failureは`invalid-field`となり、creatorがhashするpreimage rootに相対な元pathを保つ
    - digest失敗ではbrandとreturned rootを発行しない
    - digest成功後にrootだけが追加でfreezeされ、preimageとnested claimはDI2Bがfreezeした同一objectである
    - 値が等しい二回の呼び出しはroot、preimage、全nested claimのidentityを共有しない
  ],
)

#behavior_spec(
  name: "Verified render definition parsing",
  summary: [
    unknown wrapperを同期captureして検証し、validated preimageのcanonical digestとwrapper IDが一致するfreshなdefinitionを返す。
  ],
  steps: [
    1. `snapshotRenderDefinitionParserDescriptors(value)`を同期的に呼ぶ
    2. `validateRenderDefinitionParserSnapshot(snapshot)`を同期的に呼び、freshかつdeep-frozenなunbranded wrapperとpreimageを得る
    3. exact same `unbranded.preimage`へ`digestCanonicalJson(unbranded.preimage)`をexactly once開始する
    4. `CanonicalIdentityError`が`crypto-unavailable`なら`crypto-unavailable`とroot path、それ以外なら`invalid-field`と`["preimage", ...error.path]`を持つfresh immutable `RenderDefinitionError`へ変換する
    5. computed digestとlexically validな`unbranded.id`が異なる場合は、`digest-mismatch`と`["id"]`を持つfresh immutable `RenderDefinitionError`を投げる
    6. equality成功後だけcomputed digestをprivateな境界で`RenderDefinitionId`として発行する
    7. exact same preimageを持つfreshな`{ id, preimage }` rootを構築し、そのrootだけをfreezeする
  ],
  postconditions: [
    - returned `id`は`digestCanonicalJson(returned.preimage)`のcomputed digestであり、validated wrapper `id`と等しい
    - inputのstructuralまたはscalar failureではcanonical digestとWebCryptoを開始しない
    - callerがoperation返却直後にinput rootまたはnested recordを変更してもcaptured preimageと結果は変わらない
    - input root、preimage、nested claimのobject identityを一つもreturned definitionへ保持しない
    - `CanonicalIdentityError`をcallerへ公開せず、canonical identityの非`crypto-unavailable` pathへparser wrapperの`preimage` prefixを付ける
    - digest失敗またはdigest mismatchではbrandとreturned rootを発行しない
    - equality成功後にrootだけが追加でfreezeされ、preimageとnested claimはDI2Bがfreezeした同一objectである
    - DI2B unbranded wrapper rootを返さない
    - 値が等しい二回の呼び出しはroot、preimage、全nested claimのidentityを共有しない
    - outputはreferentの実在、target schema、referent self digest、role compatibility、trust、acceptanceを証明しない
  ],
)

== 機能仕様

#feature_spec(
  name: "RC01-DI1 model and error baseline",
  summary: [
    render definitionの型modelとdomain errorをpackage-local facadeの基礎surfaceとして公開する。
  ],
  api: [
    ```typescript
    export { RenderDefinitionError }
    export type {
      RenderDefinitionErrorCode,
      RenderDefinitionId,
      RenderObservationReferenceClaim,
      RenderResponseReferenceClaim,
      RenderBodyReferenceClaim,
      RenderExposureReferenceClaim,
      RenderDefinitionPreimage,
      RenderDefinition,
      RenderDefinitionInput,
    }
    ```
  ],
  test_cases: [
    - generic digestからdefinition IDへの代入拒否と、definition IDからdigestおよびstringへのwideningを検査する
    - 四つのclaim typeが全方向で交差代入できないことを検査する
    - claim、preimage、definition、inputのexact readonly shapeを検査する
    - error codeのexact unionとerrorのcopy、freeze、継承を検査する
    - facadeのsource ASTでDI1 export名、type-only区分、module specifierを検査する
    - parser、ID parser、ID guard、ID cast、accepted definitionがfacadeに存在しないことをnegative type fixtureで検査する
    - DI1の全exportをshared package rootからimportできないことをnegative type fixtureで検査する
  ],
)

#feature_spec(
  name: "RC01-DI2A package-internal descriptor snapshot",
  summary: [
    DI2Bがscalar validationを行う前に使用する、creator/parser共通のdescriptor occurrence snapshotを提供する。
  ],
  api: [
    ```typescript
    type RenderDefinitionDescriptorRecordKind =
      | "creator-input"
      | "wrapper"
      | "preimage"
      | "observation-claim"
      | "response-claim"
      | "body-claim"
      | "exposure-claim"

    type RenderDefinitionDescriptorFieldSnapshot =
      | { readonly key: string; readonly state: "missing" }
      | { readonly key: string; readonly state: "string"; readonly value: string }
      | { readonly key: string; readonly state: "non-string" }
      | { readonly key: string; readonly state: "object" }

    interface RenderDefinitionDescriptorOccurrence {
      readonly kind: RenderDefinitionDescriptorRecordKind
      readonly path: readonly string[]
      readonly ownKeys: readonly string[]
      readonly fields: readonly RenderDefinitionDescriptorFieldSnapshot[]
    }

    interface RenderDefinitionDescriptorSnapshot {
      readonly occurrences: readonly RenderDefinitionDescriptorOccurrence[]
    }

    function snapshotRenderDefinitionCreatorDescriptors(
      value: unknown,
    ): RenderDefinitionDescriptorSnapshot

    function snapshotRenderDefinitionParserDescriptors(
      value: unknown,
    ): RenderDefinitionDescriptorSnapshot
    ```
  ],
  test_cases: [
    - plain recordとnull-prototype recordを受理し、creator一occurrenceとparser六occurrenceを固定preorderで返す
    - prototype、ownKeys、key count、key length、descriptor、structural rule、child discoveryの順序をprobeする
    - 16 keysと128 key code unitsのboundaryとboundary plus oneを検査する
    - aliasのownKeysとdescriptorが一回で、path occurrenceが別に残ることを検査する
    - nested failureでancestor descriptorだけを読み、違反recordと後続recordを処理しないことを検査する
    - accessor、hidden、symbolをgetter実行なしの`invalid-closed-record`とrecord pathで拒否する
    - missing、extra、long string、wrong literal、malformed digestをDI2Aでは拒否しないことを検査する
    - nested expected fieldのmissing、string、null、numberを親field stateへ保持し、DI2Aでは拒否しないことを検査する
    - extra property valueのProxy trapを実行しないことを検査する
    - outputがimmutableで、Map、descriptor、caller objectを公開しないことを検査する
    - package-local facadeとshared rootへDI2A APIを追加しない
  ],
)

#feature_spec(
  name: "RC01-DI2B package-internal validated snapshot",
  summary: [
    sanitized DI2A snapshotだけからscalar validation済みのfresh immutable recordを構築する。
  ],
  api: [
    ```typescript
    interface UnbrandedRenderDefinitionSnapshot {
      readonly id: Sha256Digest
      readonly preimage: RenderDefinitionPreimage
    }

    function validateRenderDefinitionCreatorSnapshot(
      snapshot: RenderDefinitionDescriptorSnapshot,
    ): RenderDefinitionPreimage

    function validateRenderDefinitionParserSnapshot(
      snapshot: RenderDefinitionDescriptorSnapshot,
    ): UnbrandedRenderDefinitionSnapshot
    ```
  ],
  test_cases: [
    - DI2A snapshot後にcaller propertyとreflectionを利用不能にしてもvalidationとconstructionが成功する
    - 全expected string fieldで256/257 boundaryとexact budget pathを検査する
    - 全fieldのmissing、全recordのfirst extra、全schema/role、全digest roleのexact code/pathを検査する
    - 複数違反でnested structure、budget、missing、extra、literal、digestのprecedenceを検査する
    - alias occurrenceをpathごとにvalidationする
    - outputのfresh identityとdeep freezeを検査する
    - WebCrypto、canonicalization、wrapper digest equalityを実行しないことを検査する
    - package-local facade、shared root、generated declaration、runtime bundleへDI2B APIを公開しない
    - internal typeと二functionのexact signatureをtype fixtureで検査する
  ],
)

#feature_spec(
  name: "RC01-DI3A package-local creator identity",
  summary: [
    DI2A/DI2B capture済みpreimageへcontent identityを発行するcreatorだけをpackage-local facadeへ追加する。
  ],
  api: [
    ```typescript
    function createRenderDefinition(
      input: RenderDefinitionInput,
    ): Promise<RenderDefinition>

    export { createRenderDefinition }
    ```
  ],
  test_cases: [
    - functionのexact signature、英語JSDoc、operations export、facade runtime inventoryを検査する
    - DI3B cumulative facadeでは`parseRenderDefinition`と共存し、generic ID guard/parser/castが存在しないことを維持する
    - returned IDがexact same preimage identityのcanonical digestと等しく、digest callがexactly onceであることを検査する
    - structural failureとscalar failureがcanonical digestおよびWebCryptoより前に完了することを検査する
    - deferred digest中のcaller mutationがcaptured preimageと結果を変更しないことを検査する
    - WebCrypto不在とその他のcanonical identity failureをexact domain code/pathへ変換し、canonical error instanceを漏らさないことを検査する
    - digest成功後のroot freeze、preimage identity reuse、DI2B済みnested freezeを検査する
    - 値が等しい反復callでroot、preimage、nested claimのidentityを共有しないことを検査する
    - package-local facadeだけがcreatorを公開し、shared root source、ESM/CJS declaration、runtime bundleへ含めないことを検査する
    - focused browser emitがNode builtinと`Buffer`を含まず、browser activationまたはruntime placementを追加しないことを検査する
  ],
)

#feature_spec(
  name: "RC01-DI3B package-local verified parser identity",
  summary: [
    DI2A/DI2B capture済みwrapperのpreimage digestを再計算し、wrapper ID一致後だけcontent identityを発行するparserをpackage-local facadeへ追加する。
  ],
  api: [
    ```typescript
    function parseRenderDefinition(
      value: unknown,
    ): Promise<RenderDefinition>

    export { parseRenderDefinition }
    ```
  ],
  test_cases: [
    - functionのexact signature、英語JSDoc、operations export、facadeのerror/creator/parser exact runtime inventoryを検査する
    - valid wrapperでexact same DI2B preimageをexactly once digestし、input record identityを保持せずcomputed digestを返す
    - descriptor failureとscalar failureがcanonical digestおよびWebCryptoより前に完了することを検査する
    - deferred digest中のcaller root/nested mutationがcaptured preimageと結果を変更しないことを検査する
    - lexicalに妥当なwrapper IDのmismatchをfresh immutable `digest-mismatch`と`["id"]`へ変換し、brandとreturned rootを発行しないことを検査する
    - WebCrypto不在をroot pathへ、その他のcanonical identity failureを`preimage` prefix付きpathへ変換し、canonical error instanceを漏らさないことを検査する
    - canonical identity domain外のfailureを同じobject identityで再throwすることを検査する
    - equality成功後だけfresh rootをfreezeし、DI2B preimage identityを再利用してunbranded wrapper rootを返さないことを検査する
    - 値が等しい反復callでroot、preimage、nested claimのidentityを共有しないことを検査する
    - package-local facadeだけがparserを公開し、shared root source、ESM/CJS declaration、runtime bundleへ含めないことを検査する
    - focused browser emitがcreatorとparserを含み、Node builtin、`Buffer`、browser activationまたはruntime placementを含まないことを検査する
  ],
)

== 責務境界

- record key cap、property key cap、descriptor preflight、identity cache、schema occurrence projectionはDI2Aが所有する
- expected string cap、missing/extra classification、schema/role/digest validation、fresh preimageとunbranded wrapper構築はDI2Bが所有する
- DI2AとDI2Bのhard limitはcaller optionにせず、package-local facadeとshared rootへAPIを追加しない
- creator側のcanonical digest、brand発行、freshなreturned `RenderDefinition` rootの構築とfreeze、crypto error変換はDI3Aが所有する
- parser側のcanonical digest、wrapper ID equality、digest mismatch、brand発行、freshなreturned `RenderDefinition` rootの構築とfreeze、crypto error変換はDI3Bが所有する
- referent closureとaccepted definitionは後続RC01 unitが所有する
- `RenderEnvelope`、generation、publication、writer、authority、runtime conformanceは後続unitが所有する
- shared package rootまたはrole-scoped subpathへの公開はAS01が所有する
- DI1はdescriptorを読み取らず、recordを生成またはfreezeせず、WebCryptoとcanonical identity operationを呼び出さない
- DI2Aはscalar semantic validation、domain record構築、canonicalization、content digest、wrapper ID equality、WebCrypto、brand発行、public creator/parser、deep freezeを実行しない
- DI2Bはvalidated preimageとunbranded wrapperだけをdeep freezeし、caller record、reflection、descriptor、canonicalization、content digest、wrapper ID equality、WebCrypto、brand発行、public creator/parser、returned `RenderDefinition`を扱わない
- DI3AはDI2A/DI2Bをfacadeへexportせず、parser、wrapper ID equality、digest mismatch、referent closure、accepted evidence、generation、envelope、authority、shared root publicationを扱わない
- DI3BはDI2A/DI2Bをfacadeへexportせず、referent closure、accepted evidence、generation、envelope、publication、authority、shared root publication、browser activationを扱わない
