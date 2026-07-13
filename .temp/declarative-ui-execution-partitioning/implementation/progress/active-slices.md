## 現在の Slice

completedまたはsuperseded項目に記録されたreviewer数、manifest、attestationは実行当時の履歴です。
pending、ready、reopenedのsliceには[Review policy R8](../../process/review-policy.md#policy-r8)だけを適用します。

### SC02A source contract decomposition

SC02Aの設計判断は変更しない。
従来のSC02Aは、独立してgreenにできるidentity、model、入力境界、semantic parser、registry/export parser、local closure、source closure、digest/publicationを一つのreview revisionへ束ねていた。
先行testが3,068行、modelが767行となり、新しいreview-unit admission gateの停止条件へ到達したため、未commit変更を保持したまま独立したvertical sliceへ段階的に再編する。
最初の再編ではidentityとmodelをSC02A1へ残したが、手書き差分が1,522行となって停止条件へ再到達した。
`FactId`とstable errorはsemantic unionなしでgreenにできるため、例外扱いせずSC02A1とSC02A2へ分けた。

| slice | 観測可能な契約 | ownerとmodule | 先行test | 単独greenの根拠 | 状態 |
| --- | --- | --- | --- | --- | --- |
| SC02A1 | source-local `FactId`とstable error | `identity.ts`、`implementation.ts` | `factId()`、Unicode、error immutability、facade boundary | semantic modelなしでidentity boundaryとして完結する | completed |
| SC02A2 | source-local subjectとpath taxonomy | `model.ts`、`implementation.ts` | 7 subject、3 pathと全variant shapeのexact type fixture | fact、relation、source envelopeなしでlocation contractとして完結する | completed |
| SC02A3 | 16 source-local factと6 transfer binding | `factModel.ts`、`implementation.ts` | 全fact kind、field、closed enum、brand分離のexact type fixture | subject modelへ依存する一つのfact schemaとして単独greenにできる | completed |
| SC02A4 | 8 source-local semantic relation | `relationModel.ts`、`implementation.ts` | 全relation endpoint、ordinal exclusivity、illegal edge fixture | fact kindへ依存するbehavioral edge schemaとして単独greenにできる | completed |
| SC02A5 | export summary schema | `exportModel.ts`、`implementation.ts` | callable、receiver brand、value domain、transfer summaryのexact fixture | factとtransfer typeだけへ依存する独立summaryである | completed |
| SC02A6 | 10 registry source collection schema | `registrySourceModel.ts`、`implementation.ts` | collection keyと`RegistrySourceEntry<Kind>`のexact mapping | SC01 typeだけへ依存する独立registry source schemaである | completed |
| SC02A7 | source contract envelope | `sourceModel.ts`、`implementation.ts` | source field、export/registry composition、untrusted claim、future API不在 | A1からA6を束ねるaggregateだけを所有する | completed |
| SC02A8-DESIGN | hostile closed-data boundaryとcanonical measurementのowner、counter、snapshot semantics | boundary/canonical別design revision | own-key課金、counter、source profile、alias clone、freeze、sort/meter work | productionをA8A-G、ID01-CB、A8I、A13へ分ける | completed |
| SC02A8A | budget contractとoperation-local ledger | `budget.ts`、focused test/type fixture | 15 field、narrow-only override、cumulative/peak exact/-1、ledger isolation | descriptorやsource semanticsなしでbudget APIを直接検証できる | completed |
| SC02A8B | distinct-container descriptor capture | `closedDescriptor.ts`、focused test | getter非実行、identity一回reflection、header/view、sparse/hidden/symbol rejection | source fieldを解釈せずdescriptor boundaryだけを検証できる | completed |
| SC02A8C | active-ancestor cycle policy | `activeAncestor.ts`、focused test | direct/indirect cycle、strict LIFO rollback、leave後alias、iterative depth | descriptor cloneと独立したcycle policyとしてgreenにできる | completed |
| SC02A8D | profile-driven occurrence walkerとparent-linked plan | historical aggregate | D-P/D-Wへ分割 | planとwalkerが別々にgreenになるため一つのreview unitにしない | superseded |
| SC02A8D-P | parent-linked occurrence planとfailure path materialization | `occurrencePlan.ts`、`occurrencePlan.test.ts`、`occurrencePlan.type-fixture.ts` | full path非保持、root/record/array path、12,000 depth、failure時だけmaterialize | descriptor、budget、profileなしでplan/path contractを直接検証できる | completed |
| SC02A8D-W | iterative occurrence walkerとgeneric profile hook | `closedDataWalker.ts`、`closedDataWalker.test.ts`、`closedDataWalker.type-fixture.ts` | root depth、全input counter、alias再課金、active cycle、hook order、operation isolation | A8A/B/CとD-Pだけを統合し、source fieldとcloneを所有しない | completed |
| SC02A8E | execution-source cardinality/reference profile | historical aggregate | E-C/E-R/E-P/E-Iへ分割 | 三counter familyが別々にgreenになるため一つのreview unitにしない | superseded |
| SC02A8E-C | source collection cardinality profile | `sourceCollectionProfile.ts`、`sourceCollectionProfile.test.ts` | facts、relations、exports、registry collection/implementation exact/limit+1 | collection fieldだけを解釈するindependent hookである | completed |
| SC02A8E-R | source reference cardinality profile | `sourceReferenceProfile.ts`、`sourceReferenceProfile.test.ts` | scalar/array potential reference、semantic validation前課金、exact/limit+1 | reference slotだけを解釈するindependent hookである | completed |
| SC02A8E-P | SemanticPath cardinality profile | `semanticPathProfile.ts`、`semanticPathProfile.test.ts` | empty/repeated segment、全subject occurrence、child descriptor前課金、exact/limit+1 | SemanticPath occurrenceだけを解釈するindependent hookである | completed |
| SC02A8E-I | source profile compositionとlifetime evidenceのcombined review unit | historical aggregate | I-C/I-Lへ追加分割 | 収束reviewにもcorrectness blockerが残ったため同じscopeを再reviewしない | superseded |
| SC02A8E-I-C | source profile composition core | `sourceProfile.ts`、`sourceProfile.test.ts`、`sourceProfile.type-fixture.ts` | fresh child state、hook順序、二重課金なし、ledger共有、failure path、入力非変更。`high` tier三役review | production compositionだけを所有し、lifetime harnessを含めず単独greenにできる | completed |
| SC02A8E-I-L | post-call lifetime evidence | `sourceProfileLifetime.test.ts`だけ。productionなし | live profile下のsuccess/failure collectability、retaining mutant、GC flag復元。`medium` tier二役review | review済みexact I-Cへ依存するtest-only acceptance sliceとして単独greenにできる | completed |
| SC02A8F | alias-expanding closed source clone | main: `SPEC.typ`、`implementation.test.ts`。worker: `snapshot.ts`、`snapshot.test.ts`、`snapshot.type-fixture.ts` | caller mutation隔離、alias identity分離、input再読なし、record/array normalization | completed planから一つのiterative cloneだけを生成し、parser、freeze、publicationを含めずgreenにできる | completed |
| SC02A8G | final public snapshotのiterative deep freeze | `freeze.ts`、focused test | nested freeze、deep chain、visited alias、validation step exact/-1 | A12 domain snapshotだけを入力にしてfreeze policyを検証できる | pending |
| ID01-CB | iterative bounded canonical builder | `canonicalIdentity/`のSPEC/test/implementation | byte identity、2冪境界、common-prefix、cycle/alias、instrumented work | public API/bytesを変えずcanonical builder単独でgreenにできる | completed |
| SC02A8I | canonical JCS byte/work meter | historical aggregate | I-T/I-B/I-W/I-Rへ分割 | traversal、byte、work、reservationが別々にgreenになるため一つのreview unitにしない | superseded |
| SC02A8I-T | canonical measurement traversal/event contract | `canonicalMeasurementTraversal.ts`、`canonicalMeasurementTraversal.test.ts`、`canonicalMeasurementTraversal.type-fixture.ts` | scalar/container/canonical-key event、iterative depth、cycle/alias、property insertion permutation、path | byte/work counterなしでmeasurement traversalを検証できる | deferred |
| SC02A8I-B | exact canonical UTF-8 byte measurement | `canonicalByteMeasurement.ts`、`canonicalByteMeasurement.test.ts` | ID01 byte oracle、escape/number/key punctuation、key order/permutation、exact/limit+1 | T eventだけからbyte countを求められる | pending |
| SC02A8I-W | canonical work upper-bound measurement | `canonicalWorkMeasurement.ts`、`canonicalWorkMeasurement.test.ts` | comparison/move/common-prefix、key permutation、saturation、exact/limit+1 | T eventだけからwork boundを求められる | pending |
| SC02A8I-R | byte/work ledger reservation integration | `canonicalMeasurement.ts`、`canonicalMeasurement.test.ts`、`canonicalMeasurement.type-fixture.ts` | meter/builder二重予約、failure時zero canonicalize/digest | B/W結果をA8A ledgerへ予約するintegrationだけを所有する | pending |
| SC02A9 | subject、fact、relationのstrict parseとcanonical normalization | `semantic.ts` | 全semantic variantとcanonical order | registry、export、cross-record closureなしでstructural parserを検証できる | pending |
| SC02A10 | registry source、transfer binding、export recordのstrict parse | `registrySource.ts`、`exportSource.ts` | 10 registry kind、25 legal role tuple、transfer/export shape | semantic graph closureと独立したSC01 integrationとして検証できる | pending |
| SC02A11 | fact/relation local closure、ownership DAG、ordering semantics | `semanticClosure.ts` | endpoint/subject表、nested fact reference、ownership/order | parsed semantic recordsだけを入力にするpure validatorとして完結する | pending |
| SC02A12 | source assembly、registry/version/export/host closure、creator/parser | `source.ts` | registry reference、version、export direct summary、host assumption | A1からA11のvalidated partsを統合し、source snapshot APIを完成させる | pending |
| SC02A13 | canonical digestとpackage-local facade integration | `digest.ts`、`implementation.ts` | permutation digest、crypto failure、artifact/export boundary | 完成したsource parserへidentity operationだけを追加し、shared root publicationはAS01へ残す | pending |

各sliceは、その時点で実装する契約だけをSPECとtestへ追加し、後続sliceの失敗testを混在させない。
SC02A全体の設計review結果、relation表、reference表、budget表は親契約の制約として維持し、各sliceの実装reviewは[Review policy R8](../../process/review-policy.md#policy-r8)を別revisionへ適用する。

- **設計要件**：opaque boundary と author declaration を、source-local `FactId`、typed `SemanticFact`、typed `SemanticRelation`、export contract、SC01 registry source entry から成る closed `ExecutionContractSource` として表現する。
- **親slice境界**：SC02A1からSC02A13はsource-local契約だけを完成させる。SC02Bはqualified/compiled typeとstructural parserを追加し、SC03だけがSCC namespaceを計算してsource-local IDをqualified IDへ変換する。SC02Bのstructural brandもtrust acceptanceを意味しない。
- **変更範囲**：`packages/shared/src/executionContract/` に四点セットと focused internal module を追加し、source authoring APIをpackage-local facadeへ段階的に追加する。`@dathra/shared` rootまたはrole-scoped subpathへの公開はAS01が所有し、既存 canonical identity と execution registry の意味は変更しない。
- **package-local API**：`factId(value: string): FactId`、`defineExecutionContract(input: ExecutionContractSourceInput, budget?: ExecutionContractBudget): ExecutionContractSource`、`parseExecutionContractSource(value: unknown, budget?: ExecutionContractBudget): ExecutionContractSource`、`digestExecutionContractSource(value: unknown, budget?: ExecutionContractBudget): Promise<Sha256Digest>`、`ExecutionContractError`、`ExecutionContractBudget` と source-local semantic type だけを完成させる。`digestExecutionContractSource()` は unknown input をstrict parserで再検証してからdigestする。AS01とAO01が後でroot/subpathとauthor-facing facadeを所有し、SC02A は qualified type や acceptance API を先行公開しない。
- **trust boundary**：creator と parser の出力は、構造と source-local closure を満たす未信頼 claim である。`integrity.source = "compiler"`、`trust-boundary`、host assumption、canonical digest は evidence admission、host enforcement、placement permission を作らない。SC03 の qualified evidence と後続の `AcceptedExecutionAnalysis` がない source contract を client exclusion に利用できない。
- **behavioral edge**：`SemanticRelation` をbehavioral cross-fact edgeの唯一の正本にする。`read.readEffectFactId`、`write.writeEffectFactId`、`effect.readFactIds`、`effect.writeFactIds`、`effect.invocationFactIds`、`ownership.ownerFactId`、`ownership.lifetimeFactId`、`ordering.memberFactIds` はsource/compiled fact schemaから削除する。read/writeのenvironment/exposureはfactのattribute referenceとして残し、behavioral relationとは扱わない。
- **ownership と ordering**：ownership factはretentionだけを保持する。`owns` relationはoptionalなidentityまたはownership ownerを最大1件、lifetimeをexactly 1件結ぶ。ordering factはrelation kindだけを保持し、`orders-before` relationがmemberを結ぶ。`before`と`serial`では`ordinal`を0から始まるgap-free sequence、`exclusive`と`commutative`では`ordinal: null`のsetとする。
- **source-local closure**：FactId は contract 内で一意とし、read/write の environment と exposure、relation endpoint、export fact、host assumption を同じ contract の fact indexへ解決する。すべての semantic relation は異なる FactId を結ぶ。nested field と endpoint tag は exact reference-kind table と一致させる。host assumption は任意の local fact を未信頼 claim として参照できる。
- **registry closure**：すべての registry reference は同じ source contract の expected kind entry に解決する。version を持つ codec、resolver、subscription、remote transfer は `(kind, id, version)` を source entry と完全一致させる。registry implementation は SC01 の25 legal role tupleだけを許可する。
- **export closure**：export の `factIds` は同じ export name を持つ subject だけを参照し、module-evaluation subject を含めない。直接fieldとの照合対象はexactな`{ kind: "export-value", exportName }` subjectだけとする。`callable = none` は対象invocation fact 0件、その他はcallableとreceiver brandが一致する対象invocation fact 1件を要求する。`transfer.kind = none` は対象transfer fact 0件、その他はbindingが一致する対象transfer fact 1件を要求する。parameter callback、return、allocated resourceのinvocation/transfer factはこの件数へ含めない。value domainとreceiver brandはexact registry kindへ解決する。
- **SC03へ残す検証**：export name、parameter index、path、callback index、allocation site が実際の module signature と一致するか、source解析とcontractが衝突しないか、locator exportがdescriptor/implementation interfaceを満たすか、dependency contract SCCをどうqualificationするかだけを残す。`factId()` と `registryId()` の build-time literal 制約も SC03 が検証する。
- **identity**：source contractはdigest fieldを持たない。`digestExecutionContractSource()`は正規化済みsource snapshot全体のcanonical JCS SHA-256を返す。FactIdとRegistryIdはlocal domainに残し、qualified IDはSC02B/SC03より前に生成しない。
- **hard budget**：overrideはframework capを狭めるだけとし、一つのoperation-local ledgerをschema-aware descriptor preflight、closed snapshot、normalization、index、closure validation、canonical measurement、freeze、digestへ共有する。nested collectionはcloneより前に総数を課金する。getter、custom prototype、hidden/symbol property、sparse array、cycleはcallback実行なしで拒否する。
- **alias と stack**：shared alias は出現ごとに input budget、canonical byte、canonical workへ課金して許可し、active ancestor だけを cycle として拒否する。descriptor capture、walker、deep freeze、canonical builder、meterはiterativeにする。
- **初回並列設計レビュー**：contract、budget、最終目標の三 reviewer は全員 `REJECT` であった。trust acceptance、qualified type owner、relation subject、SemanticPath、canonical order、全 reference/version closure、host assumption、semantic edge 二重表現、ordering semantics、pre-clone budget、complexity table、API/error/test contract の指摘を blocker として採用し、この修正版へまとめた。
- **収束確認**：新しい一人のreviewerは12 blockerのうち7件を解消、5件を未解消として`REJECT`した。ownership/orderの残る二重表現、export照合subject、自己relation、reference-kind表、budget cap/counter名、exact API signatureを採用し、この最終修正版へ反映した。追加の全面reviewは行わず、SPEC tableと独立fixtureを収束証拠にする。
- **設計正本**：最終修正版を設計正本の「source execution contract の canonical boundary」へsuperseding decisionとして追加し、untrusted source、behavioral relation一元化、source closure、API、budget、failureを固定した。
- **親契約の先行draft**：61 test declaration（`it.each`展開後79 cases）と541行のSPECは、review-unit再編で`.temp/sc02a-review-unit-draft/`へそのまま保持した。後続sliceは該当するcontract fixtureだけをdraftから戻し、将来testを現在のsuiteへ混在させない。
- **red test 証拠**：再編前の`pnpm --filter @dathra/shared exec vitest run src/executionContract/implementation.test.ts`は`./implementation`不在の`Cannot find module`で失敗し、SPEC/testがproduction facadeより先に追加されたことを確認した。
- **SC02A1 SPEC/test/implementation**：141行のSPEC、focused identity/error test、`identity.ts`、6行のpackage-local facadeへ縮小した。手書き差分はAGENTSを含めても400行未満であり、後続parser、model、budget、closure、digestを含まない。
- **SC02A1 current validation**：targeted 15 testsとshared全9 files、180 testsが成功した。typecheckと通常lint 0件も成功し、type-aware lintは既存`rlse.config.ts`のwarning 1件だけを報告した。
- **SC02A1 initial parallel review**：同一hash manifestをcorrectness、SPEC/test/artifact、最終目標/package boundaryの三reviewerへ並列に渡した。最終目標と実装境界のreviewerはblockerなしで`ACCEPT`した。残るreviewerの重複指摘から、type-only facade境界の未検査、stable error codeの片方向fixture、digest形状と`FactId`戻り型の未検査をblockerとして採用した。
- **SC02A1 blocker correction**：facadeからinternal path segment typeを除き、qualified、compiled、accepted type-only importのnegative fixture、`Record<ExecutionContractErrorCode, true>`による双方向完全性、digest形状の受理、exact `FactId` return typeを追加した。文章表現だけの指摘はなく、修正後revisionを新しい一人で一回だけ収束確認する。
- **SC02A1 convergence review**：fresh reviewerはerror code完全性とFactId identity fixtureの解消、新しいcorrectness blockerの不在を確認した。internal path segment typeはfacadeから削除済みだが、その再公開を拒否するnegative fixtureがない一点だけを未解消としたため、`ExecutionContractPathSegment`のtype-only import failureを追加した。収束確認は規則どおり一回で終了し、この限定修正はtypecheckで直接検証する。
- **SC02A1 final slice gate**：限定fixture追加後、targeted 15 testsとidentity statement、branch、function、line coverage 100%、shared全9 filesと180 tests、typecheck、通常lint 0件、format、buildが成功した。type-aware lintは既存`rlse.config.ts`のwarning 1件だけであり、build artifactとshared rootにexecutionContract runtime/type APIが存在しないことをnegative inspectionで確認した。
- **dynamic scheduler migration**：worktree変更を保持し、実行中command 0件、read-only planning agent 3件を成果回収済みとしてcheckpointを作った。更新済みgoal、review手順、進捗文書を現行worktreeから再読し、L2からL4が設計レビュー先行であることをready queueへ反映した。
- **process rule commit**：review-unit admission gateとready queue、parallel lane規則を`98585c9c95bc1a02f71e26a764a67e9882519738`としてpushし、localとtracking branchのexact OID一致を確認した。このcommitはscheduler移行指示を受け取る前に完了しており、revertしない。
- **SC02A1 commit and push**：review済みのsource identity、親設計節、dynamic scheduler記録を`d5d704a45ad9366c681547fe875549b272d40d87`としてpushし、localとtracking branchのexact OID一致を確認した。SC02A1をcompletedとし、SC02A2をreadyへ移した。
- **SC02A2 red evidence**：SPECとtype fixtureを先に更新した時点のshared typecheckは、`EffectFact`、`SemanticFact`、`ExecutionContractSource`などが旧facadeに存在しないためexit 2で失敗した。type-only contractの先行失敗を確認してから`model.ts`とfacade type exportを追加した。
- **SC02A2 initial implementation gate**：16 fact、8 relation、7 subject、3 path、6 transfer binding、10 registry collection、removed field、ordinal exclusivity、未信頼source shapeをtype fixtureへ追加した。targeted 18 tests、executionContract runtime coverage 100%、shared全9 filesと183 tests、typecheck、通常lint 0件、format、buildが成功し、type-aware lintは既存warning 1件だけであった。unit差分は1,312行、最大fileは771行で停止条件未満であった。
- **SC02A2 initial parallel review**：最終目標と粒度のreviewerは、semantic taxonomyとsource envelopeが独立してgreenになるためscope blockerとした。correctnessとSPEC/test reviewerは、`ordinal?: never`が`ordinal: undefined`を受理することと、closed unionおよびrelation edge fixtureが片方向であることをblockerとした。三件を根拠とコードで再現し、すべて採用した。
- **SC02A2 first correction**：source envelope、export summary、10 registry collectionをsemantic taxonomyから分離した。non-ordering relationから`ordinal` keyを削除し、closed enum、fact kind、relation kind、endpoint、transfer shapeの双方向fixtureを追加した。
- **SC02A2 admission recheck**：first correctionはsubject/path、fact/transfer、relation matrixという三つの独立契約と手書き差分1,433行を残した。三者review開始直後にadmission gateを再適用し、reviewerを安全にshutdownして結果を採用せず、current revisionをSC02A2からSC02A4へ再編した。
- **SC02A2 subject/path revision**：current production revisionを7 subjectと3 path segmentだけへ縮小した。各variantのkeyとproperty type、closed kind union、repeated path、wrong type、extra field、後続API不在をfixtureで固定した。combined first correctionは`.temp/sc02a-review-unit-draft/`へ保持し、factとrelationの後続sliceで該当部分だけを戻す。
- **SC02A2 corrected gate**：targeted 16 tests、shared全9 filesと181 tests、typecheck、通常lint 0件、format、build、root/artifact negative inspectionが成功した。type-aware lintは既存`rlse.config.ts`のwarning 1件だけであり、SC02A2のwarningとerrorは0件である。SPEC 188行、test 319行、model 45行、facade 8行で、独立したsubject/path contractだけをreview対象とする。
- **SC02A3 red evidence**：SPECとtype fixtureだけを先に追加した時点で、focused testは`./factModel`不在、shared typecheckはfact model export不在によって失敗した。
- **SC02A3 implementation gate**：16 fact kind、6 transfer binding、全variantのexact keyとproperty type、removed behavioral field、RegistryId kind分離、facade AST、memory emit、root非公開を直接検証した。focused 25 tests、shared全12 filesと199 tests、typecheck、通常lint 0件、format、buildが成功した。type-aware lintは変更外の`rlse.config.ts`に既存warning 1件だけを報告した。
- **SC02A3 fixed review**：5 implementation fileと4 direct dependencyをmanifest `28d42170645574170c92cb8f78d13b76df83b8fb623c255d32d81ca55fb904eb`へ固定し、contract correctness、SPEC/test/artifact、最終目標とowner境界の三役へ並列reviewを開始した。
- **SC02A3 R1 blocker**：最終目標とowner境界のreviewerは、root非公開fixtureのcommentがshared root publicationをSC02A13へ誤帰属している一点だけをblockerとした。検査自体は正しく、16 fact、6 transfer binding、attribute-only境界、client/runtime非追加にはblockerがなかった。
- **SC02A3 R2**：5 commentをAS01 ownerへ修正し、SPECにもAS01 ownershipを明記した。R1の残る二reviewを`REVIEW INVALID`として停止し、新manifest `0c217050f7cdaf7381d7ebdffd48e31ffdb35252f6b25a49e8d483b775756c1b`を三役へ並列に渡した。
- **SC02A3 R2 review**：contract correctnessと最終目標/owner境界の二者は`ACCEPT`した。SPEC/test/artifact reviewerは、facadeへdirect type exportまたはruntime statementを追加しても既存fixtureが通るfalse-negative一件だけをblockerとした。
- **SC02A3 R3 correction**：facade sourceをexactly 4 `ExportDeclaration`へ固定し、memory emitを既存identity value re-export一行へ完全一致させた。focused 25 tests、typecheck、formatが成功し、新しい一人へ限定収束確認を依頼した。
- **SC02A3 completion**：収束reviewerはdirect type exportとruntime statementのsynthetic probeが拒否されることを確認して`ACCEPT`した。5 production fileを`43350db7088fa46e6e90f5db9a528b481f624da1`としてpushし、localとtracking branchの一致を確認した。
- **SC02A4 implementation gate**：8 relation kind、全endpoint、`FactEndpoint<Kind>`、`orders-before`だけが持つrequiredな`ordinal: number | null`、他variantのordinal key不在、facade AST、type-only emitを直接検証した。focused 31 tests、shared全14 filesと217 tests、typecheck、lint、format、buildがimmutable snapshotで成功した。
- **SC02A4 R1 review**：correctness reviewerは`ACCEPT`した。SPEC reviewerは`feature_spec`の非正準引数、goal/boundary reviewerはSC02A2/SC02A3節に残るrelation API不在制約をblockerとした。R1固定snapshotはdisjointなAR01 correction前の216 testsであり、current worktreeの217 testsという初期manifest記録を訂正した。
- **SC02A4 R2 convergence**：R1から`SPEC.typ`だけを修正し、stale不在制約を除去して4個の`feature_spec`を`summary`と`test_cases`へ統一した。Newtonはmanifest、10固定blob、依存、decision anchor、31 focused/217 shared test evidenceを再照合し、blocker解消と新規correctness blocker不在を確認して`ACCEPT`した。
- **SC02A4 completion**：review済み9 blobをcurrent HEADへ重ねたintegration tree `bc94eac0fc3ff771628ad0c1cef157ecf1761d39`とstaging/commit treeを一致させ、`fcfe5ee68c0cc049cf762c4578e8dc5600d1eb92`としてpushした。localとtracking branchは同じexact OIDを指す。
- **SC02A5 red evidence**：SPECと先行fixtureを追加した時点でfocused testは`./exportModel`不在、typecheckは`ExportExecutionContract`とmodule export不在によって失敗した。
- **SC02A5 implementation**：5 required readonly field、4 callable literal、`FactId` sequence、brand/value-domain `RegistryId`、既存`TransferBinding`だけを持つtype-only export summaryを追加した。parser、validator、closure、source envelope、runtime value、root exportは追加していない。
- **SC02A5 cumulative fixture correction**：SC02A3とSC02A4のfacade inventory testが5 statementを固定していたため、両testへ`exportModel`の6番目のtype-only exportだけを追加した。factとrelationのmodelまたは契約は変更していない。
- **SC02A5 gate**：focused 4 filesと38 tests、shared全16 filesと227 tests、typecheck、通常lint 0件、format、build、root sourceとgenerated declaration非公開、runtime-empty emit、diff checkが成功した。10-file write setはadmission gate未満である。
- **SC02A5 fixed review**：proposal、10 write-set blob、9 direct dependency、3 decision anchorをsynthetic commit `f75ca1c5cd02b8a8d7e588f2998028051253891d`へ固定し、correctness、SPEC/artifact、最終目標/granularityの三役へ並列reviewを開始した。
- **SC02A5 R1 disposition**：correctnessと最終目標の二役は`ACCEPT`した。SPEC/artifact reviewerの`behavior_spec`正準引数とsource-level API owner表記のblockerを採用し、generated declaration positive control、`SPEC/functions.typ` dependency、fixed/integrated test証拠の区別もR2へ反映した。
- **SC02A5 R2 convergence**：fixed synthetic commit `77f36d25053f3ff10e969981c212ec97e5f0341a`でfocused 38 tests、shared 15 filesと224 tests、typecheck、lint、format、build、declaration positive/negative inspectionが成功した。fresh reviewerは`ACCEPT`し、manifestの削除数だけ22ではなく24というerratumをintegration recordへ残した。
- **SC02A5 completion**：10-file staged treeがsynthetic tree `70eb1245e38d5962078621dca7f288f61dfde884`と一致することを確認し、commit `dc456b8fa31dd6d03a7caeaf385e9ad053e493b3`をpushした。localとtracking branchはexact OIDで一致する。
- **SC02A6 fixed gate**：10 registry kindをexact readonly collectionへ対応付ける7-file revisionをsynthetic commit `13ea5d0e4746c619f52c0c38949ba74dce1929ba`へ固定した。focused 6 filesと44 tests、shared 19 filesと271 tests、typecheck、lint 0件、format、buildがisolated snapshotで成功した。
- **SC02A6 review/completion**：low-tier primary reviewerはexact mapping、SC01/SC02A7+/AS01 owner、正準SPEC、non-vacuous type fixture、runtime-empty emit、root非公開にblocker 0件で`ACCEPT`した。進捗表の現行分割同期だけをfollow-upとして採用し、commit `ea129bb8d47afeb4807d4cbe3bfdb79bfb3094df`をpushした。
- **SC02A7 admission/gate**：A1からA6を束ねる8-field untrusted type-only envelopeだけへ限定した。実装差分は749 additions、10 deletions、最大377 additionsで停止条件未満である。synthetic commit `edd059f4d01f28c9671c517f146facf97ed29e63`でfocused 50 tests、shared 398 tests、typecheck、lint、format、buildが成功した。
- **SC02A7 review/completion**：low-tier primary reviewerはexact readonly shape、無brand alias、invalid claimの表現可能性、runtime-empty/package-local/root非公開、placement authority非追加を確認し、blocker/follow-up 0件で`ACCEPT`した。commit `1c393b3d120859d63a9da8e7045e40a1b0774f97`をpushし、remote OID一致を確認した。
- **SC02A8 admission split**：旧A8はbudget、descriptor capture、active ancestor、occurrence walker、source profile、clone、freeze、canonical builder、meterという別々にgreenへできる契約を含むため、そのままでは`SPLIT`とした。boundary unitはA8AからA8G、canonical unitはID01-CB、A8I、A13へ分け、同じproduction revisionへ戻さない。
- **SC02A8 additional split**：旧A8Dはparent-linked planとwalker integrationをD-P/D-Wへ、旧A8Eはcollection/reference/SemanticPath/compositionをE-C/E-R/E-P/E-Iへ、旧A8Iはmeasurement traversal/byte/work/reservationをI-T/I-B/I-W/I-Rへ分ける。進行中のA8D combined draftは破棄せず、review前にD-Pのplan write setを先に抽出し、D-Wを後続revisionにする。E-C/E-R/E-PとI-B/I-Wだけを並列兄弟として扱い、各integration sliceが二重課金とhook順序を固定する。
- **SC02A8D combined draft recovery**：worker `019f58bd-67d6-7d02-9054-aacd24718583`は旧5-file draftを`+1,188/-0`、focused 117、serialized shared 551、typecheck、lint、scoped type-aware lint、format、build成功として返却した。draftはsynthetic commit `48106fc1bda21d4f09b9e979b57686b2bf62b458`、tree `fe3a27ebd0c106b4dfe379239de72746d768809d`、ref `refs/codex/reviews/sc02a8d-implementation-r1`で保持する。旧combined三役reviewerは新分割指示受領時に全員`running`であり、result未生成のままshutdownした。旧revisionをreview、commit、pushせず、`.temp/review-proposals/SC02A8D-COMBINED-CLASSIFICATION.md`のD-P/D-W対応から再編する。
- **SC02A8 boundary review**：R1三役のdepth cumulative、realm provenance、occurrence reflection、source precharge blockerを採用した。R2はpeak depth、observable prototype、distinct-identity reflection、two-stage profile、alias-expanding clone、A12 final freezeへ修正し、fresh convergence reviewerが`ACCEPT`した。
- **SC02A8 boundary follow-up**：A8Bはprecharge前の追加key metadata copyを作らず、不可避allocationを`Reflect.ownKeys()` resultへ限定する。A12 integration fixtureはfinal snapshot cardinality/depthとA8G validation-stepのexact/-1を検査する。
- **SC02A8 canonical review**：R1のcommon-prefix sort、downstream native sort/recursion、negative zero、byte oracle blockerをR2で修正した。R2 convergenceでactive-path scratch、host/GC resident表現数、shared alias fixtureの三blockerを採用し、R3はproperty cap定数倍、host storage `O(maximumCanonicalBytes)`、occurrence alias測定へ訂正した。targeted reviewerは`ACCEPT`した。
- **SC02A8 canonical follow-up**：ID01-CB/A8I fixtureは多階層active-path scratch peak、sibling record/array aliasのexact二重課金、2冪境界、最大長common-prefixを維持する。A8I admissionでmeter/downstream二重予約後のdefault work capをbenchmarkまたはprobeする。
- **ID01-CB completion**：R1 reviewでpath配列の反復copyによる二次計算量、array sparse pre-scanによるerror precedence変更、array descriptorのscratch計測漏れをblockerとして採用した。R2でparent-linked path cursor、失敗時だけのiterative path materialization、indexごとのsparse検査、array descriptor accounting、12,000-depth fixtureへ修正した。R2収束時に既存Accepted ADRの直接変更を検出したため、R3でR1 ADRをbyte-identicalに復元し、継承する新ADRを追加した。focused 66、shared 440、canonicalIdentity coverage 97.02/94.47/100/96.95、typecheck、lint、format、buildが成功し、commit `e42fec40210aeead036209f209e9038632421f5b`をpush済みである。
- **SC02A8A completion**：15-field budget、narrow-only override、operation-local ledger、cumulative/peak exact/-1、failure rollbackを実装した。R1三役は全員`ACCEPT`し、implementation reviewerのBigInt success-path costというfollow-upを採用した。R2で`amount > limit - current`により成功時をnumber演算だけにし、失敗後だけBigIntでexact attempted valueを生成した。combined gateで26 files、479 tests、`budget.ts` coverage 100%、typecheck、lint、format、buildが成功し、commit `02bdfe4a662de7f0799f3211a9464303f2a2cbbc`をpush済みである。
- **SC02A8B implementation admission**：hostile objectのdistinct-identity header/view captureだけを所有し、budget charge、walker、cycle、profile、clone、freeze、parser、meterを後続へ残す。`executionContract`内のSPEC、cumulative test、new focused module/test/type fixtureだけを専有し、facade/rootは変更しない。hostile reflection boundaryのため`high` tier、三役reviewとする。
- **SC02A8B completion**：R1はoriginal ownKeys、two-phase header/view、identity一回reflection、getter-free frozen view、stable pathを実装し、focused 48、shared 510と全gateを通過した。implementation/boundary reviewerの成功descriptorごとのpath copyとmutable iterator/`push`/inherited setter依存をblockerとして採用した。R2はindex traversal、own data-property definition、failure-only path materialization、reentrant first-failure保持へ修正し、focused 51、shared 519と全gate後にconvergence `ACCEPT`を得た。commit前の再計算で1,534 additionsの停止条件超過を検出したため、R3でerror fixture setupだけをhelper化し、test caseを保ったまま1,482 additionsへ戻した。admission reviewerはblocker/follow-up 0件で`ACCEPT`し、commit `7dc62e79832f28d9a196e6993c7a1d3429b5b5be`をpushしてremote OID一致を確認した。
- **SC02A8C completion**：active identityだけをcycleとして拒否する`WeakSet`とparent-linked LIFO trackerを実装し、leave後alias、fresh operation isolation、12,000 depth、success-path path非保持を固定した。R1 implementation/boundary reviewerは`ACCEPT`し、primary reviewerの「invalid leaveがactive setだけを破壊するmutationを検出できない」blockerを採用した。R2は各invalid leave後にstill-active identityの再enterがcycleのままであるassertionを追加し、production/SPEC/type blobを変更しなかった。fresh convergence reviewerはblocker/follow-up 0件で`ACCEPT`した。isolated focused 27、serialized shared 529、coverage、typecheck、lint、scoped type-aware lint、format、buildが成功し、commit `c37a81e8d932d712c6118d6865b6b29f94d59492`をpushしてremote OID一致を確認した。default parallel full suiteの初回二回は変更外のbuild-spawning testが5秒timeoutしたため、同じfixed revisionを`--maxWorkers=1`で完走させた。
- **WS01-0A1 process convergence**：R1三役はD-P test blobの誤記と、manifest/attestationが保護refから到達できない証跡不備をblockerとした。R2はcompleted D-Pからblobを再計算し、candidate `d641487da4f3ee82187ce95e7ef3cbd2cd967f5d`の子へmanifestとattestationだけを追加したevidence commit `d3ab341818805fe9ec641f524e861ea4fa76fe44`を`refs/codex/reviews/ws01-0a1-r2-evidence`で保護した。fresh convergence reviewerは二つのblocker解消とruntime、owner、write set、acceptanceの不変を確認して`ACCEPT`した。
- **SC02A8D-W completion**：candidate `186528508d077cb3bdfc680b37c54f6b6289947f`とevidence `061042c7b0a4dee6fa84319874d2c51a10a22db8`を三役へ渡し、全員がblockerなしで`ACCEPT`した。isolated focused 24、serialized shared 572、coverage 98.55/96.96/100/98.36、typecheck、lint、scopedとpackage type-aware lint、format、build、artifact非公開検査が成功した。5ファイル、1,189 additionsのcommit `510a13a0a9ed03ee61de0f9c4f34b0d6e1b62d0b`をpushし、local、tracking branch、remote OID一致を確認した。
- **SC02A8D-W follow-up**：framework-owned profile hookがview内のchild objectを変更した場合の契約はD-Wへ追加しない。SC02A8E-Iでprofileをread-only operationとして固定し、必要なmutation probeを同sliceのtestへ置く。
- **WS01-0A2 C/R/P process review**：collection、reference、SemanticPathを別々のprocess revisionへ固定した。Cのevidenceは`6982a15c0ae676c8d8f8b10351fb67ef7822bfe7`、Rは`6a6345c6309e4342ce393badffb3d47a7dbb6898`、Pは`52c897b6071b641183c50b2c21405d228177926c`である。各reviewerは義務保持、exact dependency、排他的focused path、main integration owner、acyclicなIへのedgeを確認し、blockerなしで`ACCEPT`した。
- **WS01-0A2 I process review**：candidate `b813ac1fcee14e6424e31eb8ca637a4629dbbae8`とevidence `ea008fa1f51da98aa42284711911380ac5fb0cfc`へ、C/R/P completion後だけproductionを開始するadmission、exactly-once composition、同一ledger、read-only hook、failure short-circuitを固定した。reviewerはprocess artifactによるdependency代用がないこと、D-Wからmain integrationまでの一方向edge、internal非公開境界を確認し、blockerなしで`ACCEPT`した。
- **SC02A8E implementation admission**：C、R、Pは互いに独立したfocused production/test pathを持つため、process文書commit後に並列実装できる。Iは三sliceのcompleted exact revisionとproduction blobが揃うまで開始しない。共有SPECとcumulative testはIを含む各focused revisionの固定後にmain integration ownerが逐次更新する。
- **SC02A8E-C completion**：candidate `9a5f2cb0ff97661e902011fd6cccdc396a115912`とevidence `81854cd3885978010e19b058a6a88bdde345e77d`を三役へ渡し、全員がblockerなしで`ACCEPT`した。isolated focused 108、shared 605、coverage 95.45/94/100/100、typecheck、lint、scopedとpackage type-aware lint、format、build、artifact非公開検査が成功した。commit `335aae34d659d87660ecb40ba59985f232c61f43`をpushし、local、tracking branch、remote OID一致を確認した。
- **SC02A8E-R implementation admission**：source root、fact、relation endpoint、export、transfer bindingのstructurally presentなpotential referenceだけを`maximumReferences`へ課金するinternal profileを所有する。untrustedな可変長source structureをsemantic validation前に課金し、hard-budget failure precedenceを固定するため`high` tier、三役reviewとする。collection、SemanticPath、profile composition、clone、parser、closure、facade publicationは変更しない。
- **SC02A8E-R completion**：candidate `283806af27f35792381bc9d126b7511b18d3a376`とevidence `158b7300c9d606a181a877515c457239d5f64537`を三役へ渡し、全員がblockerなしで`ACCEPT`した。isolated focused 95、shared 625、coverage 98.18/95/100/100、typecheck、lint、scopedとpackage type-aware lint、format、build、artifact非公開検査が成功した。commit `61a71bece2c0e2a6b1e94ab8beed80df3d30869c`をpushし、local、tracking branch、remote OID一致を確認した。
- **SC02A8E-P implementation admission**：source rootから`facts[*].subject.path`へ至るstructural chainだけを追跡し、target path arrayのlengthを`maximumSemanticPathSegments`へsemantic validation前に課金するinternal profileを所有する。untrustedな可変長source structureとhard-budget failure precedenceを扱うため`high` tier、三役reviewとする。segment grammar、parser、collection/reference counter、profile composition、facade publicationは変更しない。
- **SC02A8E-P completion**：candidate `03354d5dede3f82c1ea8b6ab8168d90fbee4dab9`とevidence `27168403ca474c6b1da5b5fc210e4aac84220d51`を三役へ渡し、全員がblockerなしで`ACCEPT`した。isolated focused 86、shared 636、coverage 100/100/100/100、typecheck、lint、scopedとpackage type-aware lint、format、build、artifact非公開検査が成功した。commit `71cc200bd5998e4716f88ec922adada01bb321ee`をpushし、local、tracking branch、remote OID一致を確認した。
- **SC02A8E-P follow-up**：actual invalid child descriptorによるprecharge precedence、role stateのcaller非保持、occurrence/header非変更、deep-frozen descriptor fixtureを追加候補とする。fixed contractのblockerではない。
- **SC02A8E-I implementation admission**：completed C `335aae34d659d87660ecb40ba59985f232c61f43`、R `61a71bece2c0e2a6b1e94ab8beed80df3d30869c`、P `71cc200bd5998e4716f88ec922adada01bb321ee`だけをproduction dependencyとして、両hook phaseをC、R、P順にexactly-once compositionする。untrusted source preflightのruntime admission、failure order、read-only boundaryを統合するため`high` tier、三役reviewとする。adapterはcounter、source rule、parser、clone、facade publicationを追加しない。
- **SC02A8E-I R1 initial review**：candidate `b6d90834e84e2b047e0a01ae4589e40b8d5c7a82`、evidence `7deead460a6054a616ef6a19d4a64b87817ffa7a`を三役へ渡した。implementationとboundary reviewerは`ACCEPT`した。primary reviewerはSPECが要求するfresh child stateと同期call後のargument non-retentionをfocused testが直接証明していない一件をblockerとした。
- **SC02A8E-I R2 convergence**：R1 blockerに対してchild factory mockとWeakRef/明示GC testを追加し、candidate `5e2c6ca8e316d3d24df66d4250b6114a6a40d913`、evidence `55d443d5073f47ce51c99e59dea767aab8f7ff21`をfresh reviewerへ渡した。reviewerはprofile自体も解放していたためretaining implementationを検出できないことと、V8 expose-GC flagを復元せずprocess-global stateを残すことをblockerとした。両指摘を採用し、同じscopeの三回目reviewは開始しない。
- **SC02A8E-I-C/I-L split**：runtime contractを変更せず、production composition coreをI-C、post-call lifetime evidenceをI-Lへ分ける。I-Cは`sourceProfile.ts`、core focused test、type fixtureだけを所有し、untrusted source admissionを扱う`high` tierとしてprimary、implementation、boundaryの三役で初期reviewする。I-Lはreview済みexact I-Cへ依存し、productionを変更せず`sourceProfileLifetime.test.ts`だけを所有し、GCとtest isolationを扱う`medium` tierとしてprimary、implementationの二役で初期reviewする。I-Lはprofileをstrongly liveに保つpositive test、retaining mutantのnegative control、success/failure、collector取得直後のV8 flag復元を検証する。旧R1/R2 candidateとevidence refは履歴として保持し、combined revisionとしてcommitまたは再reviewしない。
- **SC02A8E-I-C completion**：candidate `549bc17f0721a9fecb2848f93cd68b1565d2c55a`とevidence `cc84b082521340fd62b0c1d0c86072414c677e37`をprimary、implementation、boundaryへ渡し、全員がblockerなしで`ACCEPT`した。isolated focused 146、shared 643、production coverage 100/100/100/100、typecheck、lint、scopedとpackage type-aware lint、format、build、artifact非公開検査が成功した。commit `f35f192fc5ebc316cbe28a8841620237679c83fc`をpushし、local、tracking branch、remote OID一致を確認した。
- **SC02A8E-I-L completion**：review済みI-Cをexact dependencyとするcandidate `6065ecd9cee4865fb140badb8a4faf7aa47fab19`とevidence `a77f89fac1072d2fbdb8751acda5ff1752e08e11`をprimaryとimplementationへ渡し、両者がblockerとfollow-upなしで`ACCEPT`した。profileをstrongly liveに保ったsuccess/failure collectability、exact failure identity、retaining negative control、V8 GC flag復元を直接検証した。isolated focused 147、shared 644、sourceProfile production coverage 100/100/100/100、typecheck、lint、scopedとpackage type-aware lint、format、build、artifact非公開検査が成功した。commit `942003109cbfd0cc8776ae2c665e24828996cdeb`をpushし、local、tracking branch、remote OID一致を確認した。
- **SC02A8E source-profile integration completion**：I-CとI-Lが順番に完了したため、source-profile integrationをcompletedとする。旧combined R1/R2のcandidateとevidenceは履歴証拠として保持し、旧scopeを再reviewまたはcommitしていない。
- **SC02A8F implementation admission**：Accepted decision「hostile closed-data boundary の実装分割」のSC02A8Fだけを適用する。runtime contractは変更せず、completed D-P `fac2f6b9edce32a7470b312f990f238255cb9b7b`、D-W `510a13a0a9ed03ee61de0f9c4f34b0d6e1b62d0b`、I-C `f35f192fc5ebc316cbe28a8841620237679c83fc`、I-L `942003109cbfd0cc8776ae2c665e24828996cdeb`をexact dependencyとする。cloneは`ClosedDataPlan`だけを読み、caller inputを再reflectionせず、preorder occurrenceをiterativeにmaterializeする。shared aliasはpath occurrenceごとのfresh subtreeへ展開し、recordはnull prototype、arrayはstandard array、childrenはenumerable data propertyとして構築する。raw cloneをoperation外へ公開せず、parser、domain record変換、canonical measurement、freeze、digest、facade/root exportは後続ownerへ残す。
- **SC02A8F ownerとwrite set**：main integration ownerだけが共有`packages/shared/src/executionContract/SPEC.typ`とcumulative `implementation.test.ts`を編集する。専有workerはfocused production/test/type evidenceである`snapshot.ts`、`snapshot.test.ts`、`snapshot.type-fixture.ts`だけを編集する。`implementation.ts`、package/root export、既存walker/profile module、ほかの進捗文書はwrite set外とする。workerは変更をcommitせず、focused gate終了後にownershipをmainへ返し、mainがSPEC/test/implementationの一つのcandidateを固定する。
- **SC02A8F review-unit admission**：plan-to-cloneは一つのpure materialization invariantであり、独立parser、validator、solver、state machine、identity operationを含まない。caller isolation、alias expansion、container normalizationは同じ出力treeを組み立てる一操作の観測条件で、別sliceにすると一方だけの有効な中間runtime contractを作れない。先行testはscalar/container fidelity、alias/caller isolation、iterative depth、internal artifact boundaryの契約群とし、予定手書き差分は1,500行未満かつ各file 1,000行未満とする。停止条件へ到達した場合はreview前に未commit差分を保持して再分割する。
- **SC02A8F riskとgate**：runtime behaviorを追加するがpublic API、trust/authority、untrusted parser、server/client artifact inclusionを変更しないためimplementationもprocess revisionも`medium`とする。process revisionはowner、dependency、write set、gate義務を変えるため一人のprimary semantic reviewerを必要とする。implementationはfocused snapshot testとtype fixture、cumulative execution-contract test、shared package test/coverage、typecheck、lint、type-aware lint、format、buildを順に成功させ、source/build artifactとshared rootからclone module、function、typeが到達不能であることを検査する。callerをrevocable Proxyで無効化した後もtrapを呼ばずcloneできること、12,000段をstack overflowなしで処理すること、aliasごとのidentity分離、input plan非変更、A8G前のraw cloneをfinal public snapshotとしてfreezeまたは公開しないことを直接検証する。
- **SC02A8F completion**：R1 primary reviewの正準`behavior_spec`とpurpose summaryに対する二blockerをSPECだけで修正し、fresh convergence reviewerがcandidate `4e9e81ea605f48d0ba17e4c49014d21ce5c961d6`、tree `2ca369bb193701391c597d153701a3cebe7d189d`をblockerなしで`ACCEPT`した。focused 39 tests、shared 38 files/666 testsとcoverage、typecheck、lint、type-aware lint、format、build、artifact非公開検査が成功した。review resultをmanifest `b558c5a6bc56bb5ba058cbb65e3c54183ef5401915708b50a0212276fc8eab86`へ束縛し、同一treeのcommit `4c3f6aa5b6095e03141130eab50b9484f05ae3b6`をpushしてlocal、tracking branch、remote OID一致を確認した。array rootと`__proto__` fixtureはnon-blocking follow-upとして後続test強化へ残す。
- **SC02A8F status checkpoint**：この更新はstatus、OID、gate、review結果、既存Kahn順序から再計算した次actionだけを記録する`low` revisionである。[hostile closed-data boundaryのAccepted decision](../../decisions/86-source-execution-contract.md)とruntime contract、owner、dependency、write set、acceptance obligation、gate義務は変更しないためsemantic reviewerを追加しない。
- **SC02A8E-C/R follow-up**：Cはimplementation aliasの明示fixture、他collection branchのhostile ordering、failure後の非変更を追加候補とする。Rは全reference keyの個別matrix、scalar referenceのchild traversal前failure、caller object非保持の追加証拠を後続test強化候補とする。いずれもfixed contractのblockerではない。
- **follow-up**：AO01 では10 registry collectionの空配列を省略できる author helperを検討する。SC02A の strict output schema は固定collectionを維持する。
- **baseline**：shared全8 files、165 tests、typecheck、通常lint 0件、format、buildが成功した。type-aware lintは既存`rlse.config.ts`のwarning 1件だけを報告した。

#### SC02A relation and subject table

string比較はUnicode normalizationを行わないraw UTF-16 code-unit順とし、enumはこの表とtype unionに記載した固定rankを使う。

| relation | from fact/subject | to fact/subject | 追加制約 |
| --- | --- | --- | --- |
| `reads` | effectまたはinvocation / activeまたはcallable subject | read / module-evaluationまたはvalue subject | N/A |
| `writes` | effectまたはinvocation / activeまたはcallable subject | write / module-evaluationまたはvalue subject | N/A |
| `invokes` | effectまたはinvocation / activeまたはcallable subject | invocation / callable subject | N/A |
| `returns` | invocation / callable subject | any fact / return subject | exportNameを一致させる |
| `owns` | ownership / any subject | identity、ownership、lifetime / any subject | lifetime targetだけをsource ownershipとexact subject一致させる |
| `orders-before` | ordering / any subject | any fact / any subject | sourceとtargetを異なるIDにし、variantに応じたordinalを持つ |
| `transfers-as` | transfer以外のfact / value subject | transfer / 同じsubject | sourceとtargetを異なるIDにし、subjectをexact equalityで一致させる |
| `fails-with` | effectまたはinvocation / activeまたはcallable subject | failure / 同じsubject | subjectをexact equalityで一致させる |

active subject は module-evaluation、export-value、receiver、callback-invocation、allocated-resource とする。
callable subject は export-value、receiver、parameter、return、callback-invocation、allocated-resource とする。
value subject は export-value、receiver、parameter、return、allocated-resource とする。
SC02A はこの pure table と subject shapeを検証し、SC03 は実module signatureとの一致を検証する。
`orders-before` variantだけがrequiredな`ordinal: number | null`を持ち、ほかのrelation variantはordinal fieldを受理しない。
すべてのrelationはsourceとtargetに異なるFactIdを要求する。
一つのownership factは同じsubjectのlifetime targetをexactly 1件、identityまたは別ownershipのowner targetを0件または1件持ち、それ以外の`owns` relationを持てない。
ownershipからownershipへのowner relationはDAGとし、owner cycleを拒否する。
`before`と`serial`のordering factは、targetが重複しない`orders-before` relationを1件以上持ち、ordinalを0から件数未満までgap-freeに使う。
`exclusive`と`commutative`のordering factは、targetが重複しない`orders-before` relationを1件以上持ち、ordinalをすべてnullにする。

#### SC02A exact fact reference table

| owner field | 許可fact kind | nullable | cardinality/semantic |
| --- | --- | --- | --- |
| `read.environmentFactId` | environment | no | exactly 1 |
| `read.exposureFactId` | exposure | no | exactly 1 |
| `write.environmentFactId` | environment | no | exactly 1 |
| `write.exposureFactId` | exposure | no | exactly 1 |
| relation `from` / `to` | relation and subject table | no | endpointごとにexactly 1 |
| export `factIds` | any semantic fact | no | raw UTF-16順のset。subjectをexport closureへ一致させる |
| `hostAssumptionFactIds` | any semantic fact | no | raw UTF-16順の未信頼set |

ownershipとorderingのmember referenceはnested fieldに保持せず、`owns`と`orders-before` relationだけに保持する。

#### SC02A canonical collection table

| collection | semantic | creator | strict parser |
| --- | --- | --- | --- |
| SemanticPath | sequence | 入力順と反復を保持 | 同じsequenceを受理 |
| fact、host assumption、export fact、registry reference set | set | raw UTF-16 ID順へsort | strictly sortedを要求 |
| callback parameter index | set | number昇順へsort | strictly sortedを要求 |
| environment | fixed-order set | build、server-request、browserの順へsort | fixed rank順を要求 |
| relation | set | relation kind、from kind、from ID、ordinal null-first、to kind、to IDの固定tuple順へsort | tupleのstrict orderを要求 |
| registry entry | kind-local set | RegistryId順へsort | strictly sortedを要求 |
| registry implementation | role set | browser、server-request、roleの固定rank順へsort | strictly sortedを要求 |
| export record property | unordered map | property setを保持 | insertion orderを要求しない。JCS key orderをidentityに使う |

#### SC02A parent decomposition and complexity gate

SC02Aはuntrustedな可変長input parserとmany-to-many local referenceを扱うためhigh-cost sliceに該当する。

| 責務 | internal module | owner | dependency |
| --- | --- | --- | --- |
| type、taxonomy、subject/relation table、error | `model.ts` | SC02A schema | SC01/ID01 typeのみ |
| hard cap、schema-aware descriptor preflight、ledger | `budget.ts` | public operation | `model.ts` |
| closed snapshot、scalar、set、JCS byte measurement、freeze | `canonical.ts` | canonical boundary | `budget.ts`、`model.ts` |
| subject、fact、relation、transfer、export parse | `semantic.ts` | semantic schema | `canonical.ts`、`model.ts` |
| registry source、source assembly、local closure、digest | `source.ts` | ExecutionContractSource | `semantic.ts`、SC01 public API |
| package-local orchestration | `implementation.ts` | public facade | 上記全module |

| phaseまたはrelation | owner | input最大cardinality | index | worst-case | output上限 | counterと課金時点 |
| --- | --- | --- | --- | --- | --- | --- |
| descriptor preflight/snapshot | canonical boundary | data node `200,000`、property `1,000,000` | active ancestor、alias map | `O(N)` | data node cap以下 | `maximumInputDepth`、`maximumInputDataNodes`、`maximumInputProperties`、`maximumInputArrayLength`、`maximumInputStringCodeUnits`をdescriptor/container読取前 |
| fact/registry index | source closure | fact `200,000`、registry `200,000` | FactId map、kind/RegistryId map | `O(F + G)` | `F + G` | `maximumFacts`、`maximumRegistryEntries`をclone前、`maximumValidationSteps`をmap insertion前 |
| nested fact/export/host reference | source closure | reference `10,000,000` | FactId map | `O(F + Rf)` | input fact数以下 | `maximumReferences`をclone前に一度、`maximumValidationSteps`をlookup前にprobeごと |
| relation endpoint/subject | semantic schema | relation `200,000`、endpoint `400,000` | FactId map、closed subject table | `O(F + R)` | relation cap以下 | `maximumRelations`とendpoint分の`maximumReferences`をclone前、`maximumValidationSteps`をlookup/subject判定前 |
| ownership DAG | source closure | ownership factとowner relationを各`200,000`以下 | ownership FactIdからoptional owner | `O(F + R)` | base relation以外の出力なし | `maximumValidationSteps`をadjacency insertionとiterative DFS edge probe前 |
| registry reference/version | source closure | reference `10,000,000` | kind/RegistryId map | `O(G + Rg)` | registry cap以下 | `maximumReferences`をclone前に一度、`maximumValidationSteps`をlookup/version比較前 |
| registry implementation | registry source | implementation `400,000` | kind/environment/role key | `O(I log I)` | implementation cap以下 | `maximumRegistryImplementations`をclone前、`maximumCanonicalWorkSteps`をsort前、`maximumValidationSteps`をtuple判定前 |
| normalization | semantic/source creator | 各collection hard cap以下 | fixed comparator | `O(N log N)` | input record数以下 | `maximumCanonicalWorkSteps`のworst-case upper boundをsort前、`maximumValidationSteps`をduplicate判定前 |
| local closure | source closure | `F + G + Rf + Rg` | 上記二map | `O(F + G + Rf + Rg)` | 一つのsource snapshot | `maximumValidationSteps`を各probe前 |
| canonical measurement/JCS | canonical boundary | normalized data node cap以下 | iterative frame | `O(N + P log P)` | canonical byte `200,000,000` | `maximumCanonicalBytes`と`maximumCanonicalWorkSteps`をfull text生成前 |
| deep freeze | canonical boundary | output data node cap以下 | visited set、iterative stack | `O(N)` | 同じsnapshot | `maximumValidationSteps`をstack push前 |
| SHA-256 digest | source identity | canonical byte cap以下 | N/A | `O(B)` | 43文字digest一件 | `maximumCanonicalBytes`検査後にcanonicalizeJsonを一回だけ呼び、そのbytesをsha256Digestへ渡す |

#### SC02A budget proposal

`ExecutionContractBudget` は次のfieldを持ち、default値をframework hard capとする。

| field | default hard cap |
| --- | ---: |
| `maximumInputDepth` | 64 |
| `maximumInputDataNodes` | 200,000 |
| `maximumInputProperties` | 1,000,000 |
| `maximumInputArrayLength` | 200,000 |
| `maximumInputStringCodeUnits` | 20,000,000 |
| `maximumFacts` | 200,000 |
| `maximumRelations` | 200,000 |
| `maximumExports` | 200,000 |
| `maximumRegistryEntries` | 200,000 |
| `maximumRegistryImplementations` | 400,000 |
| `maximumReferences` | 10,000,000 |
| `maximumSemanticPathSegments` | 2,000,000 |
| `maximumCanonicalBytes` | 200,000,000 |
| `maximumCanonicalWorkSteps` | 20,000,000 |
| `maximumValidationSteps` | 20,000,000 |

schema-aware preflightはnested reference、SemanticPath、registry implementationをclosed snapshotより前にdescriptorだけで数える。
exact canonical byte lengthはallocation-freeに測定し、canonical workはobject property sortのworst-case upper boundを先に課金する。
上限内と確認した後だけ`canonicalizeJson()`を一回呼び、返されたexact bytesを`sha256Digest()`へ渡す。

#### SC02A failure and test contract

`ExecutionContractError` は immutable な `(string | number)[]` path と、`invalid-closed-record`、`invalid-field`、`invalid-fact-id`、`invalid-registry-id`、`noncanonical-order`、`duplicate-record`、`dangling-reference`、`kind-mismatch`、`version-mismatch`、`semantic-mismatch`、`budget-exceeded`、`crypto-unavailable` のstable codeを持つ。
SC01/ID01 failureは元のpathへ現在のfield prefixを付けてこのerrorへ変換し、別error classをpublic operationから漏らさない。

先行testは次を独立fixtureで検証する。

- 16 fact kind、8 relation kind、7 subject kind、3 path segment kindの全variant
- fact kind、relation endpoint、subject pair、nested reference kindの正準表と全swap rejection
- 10 registry kind、25 legal role tuple、295 illegal tuple、transfer version mismatch
- cross-fact relationの唯一性とexport callable/receiver/transfer exact closure
- creator permutationの同一snapshot/digestとstrict parserのnoncanonical rejection
- repeated SemanticPath、shared alias、direct/indirect cycle、getter/hidden/symbol/custom prototype/sparse array
- 全budget counterのzero、exact boundary、boundary-minus-oneとnested collectionのpre-clone failure
- deep inputのtyped failure、iterative freeze、caller mutation不変性
- `@dathra/shared` root exportとqualified/accepted APIの不在

### AR01-FT artifact finalization template

- **contract**：`ArtifactFinalizationTemplate`を10個のrequired readonly propertyからなるpackage-local type-only closed productとして追加した。binding、aggregate、validator、identity operation、URL、integrity、closure、runtime value、shared root exportは追加していない。
- **initial implementation gate**：focused 5 tests、shared 12 filesと200 tests、typecheck、lint、format、build、source rootと生成declarationのnegative inspectionが成功した。
- **R2 initial review**：correctnessと最終目標の二reviewerは`ACCEPT`した。SPEC/artifact reviewerは、package build entryだけをinternal facadeへ変更すると生成declarationから型が公開されてもfocused testがgreenになるfixture holeをblockerとした。
- **R3 correction**：SPECへ実build declaration検査を追加し、temporary outputへshared packageをbuildして`index.d.mts`と`index.d.cts`のexport surfaceから`ArtifactAddressId`と`ArtifactFinalizationTemplate`を拒否するtestを追加した。build entry mutationでは新testがexit 1となることを確認した。
- **R3 convergence**：Hubbleはtemporary outputのsuccess、build failure、assertion failureでのcleanup、両declaration entry、mutation resistanceを確認し、`ACCEPT`した。named export抽出のpositive controlは将来強化できるfollow-upであり、current blockerではない。
- **final gate**：immutable R3 snapshotでfocused 6 tests、shared 12 filesと201 tests、typecheck、lint、format、buildが成功した。current integrated shared stateでも14 filesと217 testsが成功した。
- **commitとpush**：type schemaを`9cff8edc119813fdef64980a247eb920de2e0ff2`、declaration boundary correctionを`8d164cdb0234c58a3957dd7d740cd1c4ed7117fb`としてpushし、localとtracking branchの一致を確認した。

### AR01-EB artifact entry binding

- **contract**：`ArtifactEntryRole`の3 literalと、role、semantic ID、exported name、invocation ordinalを持つ`ArtifactEntryBinding`だけをpackage-local type-only schemaとして追加した。ordinal legality、semantic/export existence、canonical order、aggregate、validator、identity、runtime valueは後続へ残した。
- **fixed gate**：focused 2 filesと9 tests、shared 14 filesと214 tests、typecheck、lint、format、build、runtime-empty emit、root/generated declaration非公開がsynthetic commit `8395f3e5dca2f2d348cc8ffdcff36adce7b70331`で成功した。
- **parallel review**：correctness、最終目標/boundary、SPEC/artifactの三役は、exact two-type schema、既存ID/template不変、正準SPEC、cumulative facade、future API不在を確認し、全員`ACCEPT`、blocker/follow-up 0件と判定した。
- **completion**：disjointなSC02A5とRC01-DI2AのHEAD前進後も固定8 blobを維持し、current parentへ重ねたstaged tree `85fd580d21abbbaf3dc4c404730f22b3db4e7ae3`を確認した。commit `106acaea86dabecfb4ce256373279a4fd4801b30`をpushし、localとtracking branchのexact OIDが一致する。

### AR01-DB artifact dependency binding

- **contract/admission**：`slot`、inlineな4 kind、nominal `targetArtifactAddressId`、nullable `targetExportName`を持つrequired readonlyなpackage-local typeだけを所有する。validation、target existence、order、duplicate、aggregate、identity、URL、integrity、trust、root publicationは後続へ残す。永続artifact identity inputを固定するため`high` tierとした。
- **main fixture correction**：review固定前にmodel内のprivate `ArtifactDependencyKind` aliasを見逃す穴を発見し、modelのexact exportとdirect negative importを追加した。初期snapshotではfocused 12 tests、shared 269 tests、typecheck、lint、format、buildが成功した。
- **R1 initial review**：implementationとboundary reviewerは`ACCEPT`した。primary reviewerは、finalization/entry feature specに残る歴史的2/4-type facade期待とdependency-binding不在、およびprivate kind aliasがgreenになるAST fixture holeをblockerとした。両方を採用した。
- **R2 correction/gate**：旧feature/test obligationを現行4-model/5-type累積facadeへ同期し、model ASTで一つのinterface、4 property、direct 4-literal union、type alias不在を固定した。isolated snapshotでfocused 13 tests、typecheck、lint、formatが成功し、private alias mutationはfocused testをexit 1にした。full shared test/buildは変更外R1 attestationを継承し、fresh delta reviewerの収束確認中である。
- **follow-up**：後続validatorで`targetExportName: null`のsort位置とstring comparisonを固定する。identity operationはextra own propertyを拒否したclosed snapshotだけから`ArtifactAddressId`を発行する。
- **R2 convergence/completion**：fresh reviewerはstale cumulative SPECとprivate inline-alias blockerの解消、新規correctness blocker不在を確認して`ACCEPT`した。8 staged blobをR2 manifestと一致させ、commit `31a6da6154d75a58cc09b0946bb2fae6c265a22b`をpushし、localとtracking branchのexact OID一致を確認した。

### AR01 identity preimage admission

- **AR01-XB contract**：`exportName`、`memberSemanticId`、inlineな6-role unionを持つrequired readonlyな`ArtifactExportBinding`だけを所有する。export table、aggregate、validator、identity、URL、integrity、trust、root publication、runtime behaviorは後続へ残す。persistent artifact identity inputを固定するため`high` tierとする。
- **AR01-XB fixed gate**：8-file revisionをsynthetic commit `2abd9d8d5966b69a130df413a8850f01ec7c5a2a`へ固定した。focused 18 tests、shared 414 tests、typecheck、lint、format、build、runtime-empty emit、root/generated declaration非公開が成功した。593 additions、22 deletions、最大214 additionsで停止条件未満である。
- **AR01-XB review/completion**：primary、implementation、boundaryの三役はcanonical 3-field/6-role schema、inline union、non-vacuous fixture、runtime-empty/root非公開、trust/placement非証明を確認し、全員`ACCEPT`、blocker 0件とした。8 staged blobをmanifestへ一致させ、commit `44a1b0f1dbd5c0f4e053040d1df08359ba319b93`をpushし、remote OID一致を確認した。
- **AR01-XB follow-up**：後続文書ではAR01のintegrity schemaとAF01のfinal artifact bytes/integrity table生成を区別して記述する。現行binding contractのblockerではない。
- **AR01-DP/P admission split**：`DeploymentIdentityPreimage`と`ArtifactAddressPreimage`は別々の永続identity schemaであり、後続operationなしにexact type/JCS fixtureで単独greenへできるため、同一revisionへ束ねない。AR01-DPを先行し、そのreview/commit後にAR01-Pを逐次実装する。
- **AR01-DP completion**：`schema: "dathra.deployment-identity/1"`、`applicationNamespaceDigest`、`releaseIdentity`、`targetEnvironmentId`、`canonicalPublicOrigin`、`contractNamespaceGraphDigest`、`hostProfileSetDigest`の7 required readonly fieldを持つtype-only aggregateを追加した。digestはgeneric `Sha256Digest`を再利用し、別ID/aliasを追加していない。R1三役は全員`ACCEPT`し、ID01-CB後のcurrent-base integrationでも8 write-set blobの同一性とfocused 23、shared 445、typecheck、lint、format、buildを再確認した。commit `f56864d544217188e1fd4372d7f180cda435b991`をpush済みである。
- **AR01-P exact pending contract**：正準名は`ArtifactAddressPreimage`とし、`ArtifactAddressPreimageSource`を追加しない。`kind`は`"javascript" | "wasm" | "data"`のinline unionとし、`ArtifactKind` aliasを追加しない。ID01、DP、既存FT/EB/DB/XBへ依存する10-field aggregateだけを所有する。
- **AR01-P implementation admission**：canonical schema順の10 required readonly fieldだけを追加し、collectionのsemantic invariant、snapshot、validation、identity operation、URL、integrity、closureを後続へ残す。`artifactContract`内のSPEC、cumulative facade/test/consumer、new focused model/test/type fixtureだけを専有する。persistent identity inputのため`high` tier、三役reviewとする。
- **AR01-P completion**：R1はexact 10-field、direct inline kind union、invalid-state representability、runtime-empty/root非公開を満たし、isolated focused 29、shared 485、typecheck、lint、scoped type-aware lint、format、buildが成功した。primary/boundary reviewerがpackage `AGENTS.md`のstale owner/7-type記述を同一blockerとして報告したため採用し、implementation reviewerのnon-never witness follow-upもR2へ取り込んだ。R2 convergenceはblocker/follow-up 0件で`ACCEPT`し、commit `c53a50e94b474213511ad73fb106e4681a5de6f9`をpushしてremote OID一致を確認した。
- **AR01-PS scheduler correction**：AR01-P completionだけではproduction-readyにならない。accepted AR01-P designはPS以降をexact hard limit、canonical rule、error vocabularyの先行design review完了まで開始しないと明記しているため、PSを`pending`へ戻した。resource/error foundationを独立してgreenにできる場合はPSへ束ねず別revisionへ分ける。
- **AR01 resource/error decomposition**：先行調査はAR01-DS/PSの前にerror、budget/ledger、snapshot課金順を固定し、DD/PI前にbounded canonical meterを置く必要を確認した。独立してgreenにできるerrorとbudgetを同じrevisionへ束ねず、`AR01-E -> AR01-B -> {AR01-DS, AR01-PS}`へ分ける。generic shared snapshot utilityは追加せず、artifact-local descriptor kernelの共有可否をDS/PSで判断する。
- **AR01 additional split**：AR01-Bをcontract/overrideのB-CとledgerのB-Lへ分け、artifact-local descriptor kernel Kの後にDS/PSを並列化する。bounded canonical meterはCM-T/B/W/Rへ分け、CM-RをDD/PIの必須predecessorにする。旧PVはURL、order/duplicate、entry ordinal、kind/template、local semantic、integrationのPV-U/O/E/K/S/Iへ、旧PCはindex、target、export、compatibility、integrationのPC-I/T/X/S/Cへ、旧ITはtype、snapshot、validationのIT-M/S/Vへ分ける。PVの五validatorはvalidated aggregateを単独発行せずPV-Iが統合し、PC-T/PC-Xだけを並列化してPC-Sはresolved referentだけを受け取る。並列兄弟のproduction/test/type fixtureは設計正本の排他的path表で固定し、共有SPECとcumulative testはmain integration ownerが逐次統合する。
- **AR01-E design admission**：exact ten-code union、immutable root-relative path、package-local error classとinternal `fail`、downstream code ownerだけを決める。budget counter/hard cap、snapshot、validator、precedence、canonical meter、identity、URL、closure、publicationは含めない。一つのpackage-local runtime contractでidentity/trust/public rootを変更しないため`medium` tier、primary/implementation二役reviewとする。
- **AR01-E design completion**：primary/implementation reviewerはexact taxonomy、AF01/SL01/RR01とのfailure owner境界、immutable error/path、facade/root非公開、error/budget/snapshot分割、独立実装可能性を確認し、blocker/follow-up 0件で`ACCEPT`した。canonical integration R1 reviewerのconstructor signature欠落と`invalid-field`からclosed snapshot境界が落ちた二blockerを採用し、R2でaccepted proposalのexact surfaceへ復元した。fresh convergence reviewerはblocker/follow-up 0件で`ACCEPT`した。AR01-Bのcounter/cap/課金順は未決定のまま別revisionに残した。
- **AR01-DP design convergence**：R1で欠けていたDS structural snapshot、DV semantic validator、DD canonical digest、AF01/RR01 binding ownerをR2へ追加した。convergenceでAF01をselected candidateへ依存させた逆順をblockerとして採用し、R3で`CN01-L -> MP02 -> AF01 per candidate -> SL01 -> RR01`へ訂正した。targeted reviewerはblocker/follow-up 0件で`ACCEPT`した。
- **AR01-P design convergence**：runtime JCS fixtureをtype-only PからPIへ移し、legitimate leaf address発行後にbranded dependency corpusを作る。PS/PV/PI/PC/URL/IT、AR01 schema、AF01 production、CN01-L legality、SL01 selection、RR01 conformanceを分離した。R2 convergenceでRR01がgeneric AF01 evidenceを受ける抜け道をblockerとして採用し、R3でSL01-selected AF01 evidenceだけへ限定した。targeted reviewerはblocker/follow-up 0件で`ACCEPT`した。
- **AR01 historical vocabulary**：旧`AR01-P-DECOMP-R2` blobをimmutable dependencyとして固定し、`ArtifactAddressPreimageSource`と`ArtifactKind`をhistorical vocabularyに限定した。現行typeは`ArtifactAddressPreimage`とdirect inline kindだけを使う。
- **AR01 admission estimate**：DPは合計700 additions、最大test 300 additions、Pは合計900 additions、最大test 350 additions以下を見込む。合計1,500または一file 1,000の停止条件へ達した場合は実装を止め、fixture責務を別revisionへ分ける。

| revision | 契約 | 状態 | 次のdependency |
| --- | --- | --- | --- |
| AR01-E | exact package-local error vocabulary | completed | commit `b05c061b6be3be35bbb6f21c3fb9de128c35edcb`をpush済み |
| AR01-B | hard budget/operation-local ledger aggregate | superseded | B-C/B-Lへ分割 |
| AR01-B-C | exact budget contractとnarrow-only override | pending | AR01-Eとexact counter/cap design |
| AR01-B-L | operation-local cumulative/peak ledger | pending | AR01-B-C |
| AR01-CM-T | canonical measurement traversal/event contract | deferred | ID01-CB完了済み。WS01-E後に再開する |
| AR01-CM-B | exact canonical UTF-8 byte measurement | pending | AR01-CM-T |
| AR01-CM-W | canonical work upper-bound measurement | pending | AR01-CM-T |
| AR01-CM-R | byte/work/downstream builder reservation integration | pending | AR01-CM-B、AR01-CM-W、AR01-B-L |
| AR01-K | artifact-local descriptor capture kernel | pending | AR01-B-L |
| AR01-DP | exact 7-field deployment preimage type | completed | ID01 |
| AR01-DS | deployment hostile schema projection | pending | AR01-KとDP |
| AR01-DV | deployment semantic canonical validation | pending | DSとorigin/string rule design |
| AR01-DD | validated deployment preimage digest | pending | DVとAR01-CM-R |
| AR01-P | exact 10-field artifact address preimage type | completed | DP、FT、EB、DB、XB、ID01 |
| AR01-PS | artifact hostile schema/collection projection | pending | AR01-KとP |
| AR01-PV | artifact semantic validator aggregate | superseded | PV-U/O/E/K/S/Iへ分割 |
| AR01-PV-U | artifact base URL canonical validation | pending | AR01-PS |
| AR01-PV-O | collection orderとduplicate validation | pending | AR01-PSとexact comparator design |
| AR01-PV-E | entry orderとgap-free ordinal validation | pending | AR01-PS |
| AR01-PV-K | artifact kind/finalization compatibility | pending | AR01-PSとcompatibility matrix design |
| AR01-PV-S | artifact-local semantic consistency | pending | AR01-PSとrole/reference matrix design |
| AR01-PV-I | semantic evidence integrationとvalidated preimage | pending | PV-U/O/E/K/S |
| AR01-PI | ArtifactAddressId identity operation | pending | PV-IとAR01-CM-R |
| AR01-PC | artifact graph closure aggregate | superseded | PC-I/T/X/S/Cへ分割 |
| AR01-PC-I | immutable artifact/export graph index | pending | AR01-PI |
| AR01-PC-T | dependency target existence closure | pending | AR01-PC-I |
| AR01-PC-X | target export existence closure | pending | AR01-PC-I |
| AR01-PC-S | resolved target/export kind-semantic compatibility | pending | AR01-PC-TとPC-X |
| AR01-PC-C | closed artifact graph integration | pending | AR01-PC-S |
| AR01-URL | canonical artifact URL contract | pending | PI |
| AR01-IT | integrity table schema/validator aggregate | superseded | IT-M/S/Vへ分割 |
| AR01-IT-M | exact type-only integrity table model | pending | AR01-PI |
| AR01-IT-S | hostile integrity table snapshot | pending | AR01-KとIT-M |
| AR01-IT-V | integrity table semantic validation | pending | AR01-IT-S |

### RC01-DI implementation decomposition

R2とR3はRenderDefinition model、closed snapshot、content identity operationを一つのimplementation revisionとしていた。

三契約は依存順に単独greenへできるため、同じrevisionではreviewしない。

| Slice | 契約 | 専有module | 先行test | 単独greenの根拠 | 状態 |
| --- | --- | --- | --- | --- | --- |
| RC01-DI1 | versioned schema、nominal ID、reference claim type、domain error | `model.ts`、`error.ts`、`implementation.ts` | exact type、brand separation、claim非互換、error immutability、後続API不在 | parserとdigestなしで型とfailure vocabularyを直接検証できる | completed |
| RC01-DI2A | record key hard limit、descriptor preflight、identity cache、sanitized occurrence snapshot | `descriptorSnapshot.ts`、focused testとtype fixture | prototype、key cap、descriptor order、alias、structural rejection、primitive deferral | caller objectを後段へ渡さないdescriptor resource境界として単独greenにできる | completed |
| RC01-DI2B | expected string cap、missing/extra、schema/role/digest、fresh scalar construction | `validatedSnapshot.ts`、focused testとtype fixture | string boundary、全failure code/path、fresh preimage/unbranded wrapper | DI2A snapshotだけを入力にしてcallerを再読せず単独greenにできる | completed |
| RC01-DI3A | creator、content digest、brand発行、fresh root freeze | `operations.ts`、`implementation.ts`、`implementation.test.ts`、`typeContract.fixture.ts` | digest equality、mutation snapshot、crypto変換、root freeze、parser不在 | creatorはparser equalityなしでvalidated preimageからidentityを発行し単独greenにできる | completed |
| RC01-DI3B | verified parser、self-digest equality、mismatch | DI3Aと同じ6-file cumulative write set | parse success、mismatch code/path、crypto変換、identity non-sharing | parserはDI3A creatorをpredecessorにして独立追加できる | completed |

RC01-DI2Aはunknown objectの可変own keyを扱うhigh-cost sliceとする。

resource contractは`.temp/review-proposals/RC01-DI-R5-RESOURCE.md`で収束し、per-record cap、最大6 occurrence、最大96 descriptor、deterministic failure orderを固定した。

各distinct recordのhost own-key列挙はalready-materialized ordinary object APIの不可避なcostとして分離し、返却直後からdescriptor scan、nested traversal、snapshot、digestをhard capで有界化する。

Proxyは入力契約外とし、wire ownerはobject construction前のbyte、depth、key count admissionを別に所有する。

- **RC01-DI2 process incident**：combined DI2はdescriptor boundaryとscalar/schema validationを一revisionへ実装し、手書き1,488行、98 focused testsへ到達した。既存implementation goalは「別々にgreenにできる契約を別sliceにする」「実装後に判明してもreviewへ進まず再編する」と既に要求していたため、これはルール不足ではなくworker dispatch前にmainがadmission gateを適用しなかった運用逸脱である。
- **RC01-DI2 incident containment**：combined revisionはreview、commit、pushしていない。5 blobをGit object databaseと`.temp/review-manifests/RC01-DI2-COMBINED-DRAFT.md`へcheckpointし、worktreeから`closedSnapshot.*`を外してDI2AとDI2Bへ分割した。
- **RC01-DI2A boundary**：DI2Aはprototype、16-key cap、128-key-code-unit cap、descriptor取得、structural rejection、object identity cache、schema-path occurrence projectionだけを所有する。256 expected string cap、missing/extra、literal、digest、fresh constructionはDI2Bへ残す。
- **RC01-DI2A main correction**：nested expected fieldのprimitiveをDI2Aで拒否せず親field stateへ保持するようにし、DI2Bがcallerを再読せず分類できる境界を補った。descriptor消失probeを追加し、内部key型を`Reflect.ownKeys()`の実型`string | symbol`へ限定した。
- **RC01-DI2A fixed gate**：synthetic commit `4c62d3b746ef0bf66faace841c5ebdbae46ac87a`でfocused 48 tests、対象production coverage 100%、shared 16 filesと262 tests、typecheck、通常lint 0件、format、build、root/generated/runtime非公開、diff checkが成功した。type-aware lintは変更外の既存warning 1件だけである。1,239 additions、8 deletions、最大file 694行で、一つのdescriptor occurrence契約として三役review中である。
- **RC01-DI2A review/completion**：correctness/security、SPEC/type/artifact、最終目標/granularityの三役は全員`ACCEPT`、blocker 0件と判定した。staged treeをsynthetic tree `94af8a723770eb8202433c5fad91b606eb59d032`と一致させ、commit `bd1fd198a2281c0f5b3725a265e49d0c2db4e0eb`をpushし、localとtracking branchのexact OID一致を確認した。
- **RC01-DI2B required fixture**：DI2Bはsanitized DI2A snapshotだけを入力とし、caller recordへのreflectionとproperty accessをすべて失敗させてもscalar validationとfresh constructionが完了することを先行testで固定する。
- **RC01-DI2B gate**：focused validated snapshot 116 tests、renderContract 3 filesと164 tests、shared全19 filesと382 tests、typecheck、通常lint 0件、format、buildが成功した。caller recordとreflectionをDI2A snapshot後に利用不能にするfixtureもgreenである。
- **RC01-DI2B risk tier**：package-internal APIだが、attacker-controlled scalar inputを後続identity operationより前に閉じるtrust-boundary validatorであるため`high`とした。primary、implementation、boundaryの三役を使う。
- **RC01-DI2B fixed revision**：5-file write setをsynthetic commit `0cda1c775a4f8778555a4413e927a2023916cafa`へ固定した。manifest SHA-256は`53c772eb41234a28b2ff5562ea7ed7b35efe2edc599f5ae1f79d2a911f2a45c0`、attestationは`RC01-DI2B-R1-ATTESTATION-1`である。
- **RC01-DI2B initial review**：implementationとboundary reviewerは`ACCEPT`した。primary reviewerは、R5のpost-digest freezeとDI2B pre-digest freezeの矛盾、およびparser functionとgenerated/runtime artifactの非公開fixture不足をblockerとした。両方を採用した。
- **RC01-DI2B R2 convergence**：type/root negativeとESM/CJS/declaration artifact検査は解消済みと判定された。freeze splitも正しかったが、R1 Accepted ADRを直接変更した履歴違反一件が新blockerとなった。
- **RC01-DI2B R3 convergence/completion**：R1 Accepted ADRの23行をbyte-identicalに戻し、R5 timingだけをsupersedeする新Accepted ADRへ分離した。targeted reviewerはblocker/follow-up 0件で`ACCEPT`した。isolated R2でrender 165 tests、shared 382 tests、typecheck、lint、format、build、R3でrender 165 testsとformatが成功し、commit `50744910cfb052cf5249a40a3b9d60c5128f3a48`をpushした。
- **RC01-DI3 admission split**：creatorとverified parserは別々にgreenへでき、現行DI3説明は非分割の同一不変条件を示せないため、worker dispatch前にDI3A creatorとDI3B parserへ分割した。両sliceはidentity、private brand authority、untrusted parserまたはartifact inclusion境界を扱う`high` tierとし、各revisionを三役reviewする。DI3A/DI3Bのunion write setはAGENTS、SPEC、`operations.ts`、facade、implementation test、`typeContract.fixture.ts`の6ファイルで、逐次実装する。
- **RC01-DI3A gate/review**：synthetic commit `4a2f90790f532c3e8697873ce61d3e4dcd4777b6`でrender 176 tests、shared 409 tests、operations coverage 100%、typecheck、lint、format、buildが成功した。primary、implementation、boundaryの三役はdigest順序、failure mapping、brand authority、preimage reuse、package/root/browser境界を確認し、全員`ACCEPT`、blocker/follow-up 0件とした。
- **RC01-DI3A completion**：6 staged blobとfixed manifestを一致させ、commit `9a1b9b59bfac9c2eee8c4f38ed8c096006a2e110`をpushした。remote branchのexact OID一致を確認し、DI3Bを実装可能にした。
- **RC01-DI3B gate/review**：initial synthetic commit `d9c3632ceefe04414e38cd7f1c4a34f3edc0e593`でrender 187 tests、shared 425 tests、operations coverage 100%、typecheck、lint、format、buildが成功した。primary、implementation、boundaryの三役は全員`ACCEPT`し、AST authority call-site fixtureとDI3A cumulative wordingをfollow-upとして採用した。
- **RC01-DI3B convergence/completion**：R2 synthetic commit `7706eeb50e738dc13e3998a20535805a31feec50`でfocused 187 tests、typecheck、lint、formatが成功した。fresh reviewerはprivate assertionがcreator/parser各一回でmismatch後にだけ呼ばれることと、DI3A/DI3B wordingを確認してblocker/follow-up 0件で`ACCEPT`した。commit `8a70f80dd722ed936a570b7d7e2683daab871a76`をpushし、remote branchとexact OIDで一致した。

- **RC01-DI1 red evidence**：SPECとtestを先に追加した時点で、focused suiteは`./implementation`不在のmodule resolution errorによって失敗した。
- **RC01-DI1 implementation gate**：private nominal ID、四つのrole-specific claim、preimage、definition、input、六error code、immutable error、package-local facadeを追加した。focused 10 tests、shared全13 filesと209 tests、root全test、shared/root build、typecheck、通常lint 0件、formatが成功した。type-aware lintは変更外の`rlse.config.ts`に既存warning 1件だけを報告した。
- **RC01-DI1 boundary**：hard limit、descriptor preflight、snapshot、validator、creator、parser、digest、brand発行、referent closure、envelope、root exportは追加していない。7 implementation fileと2 direct dependencyをmanifest `220fa34f7081fab0d50bac69ca60fca5b19d75861569d64fb1de8c426ad3c102`へ固定した。
- **RC01-DI1 R1 review**：identity/trust reviewerは`ACCEPT`した。correctness reviewerはprivate brand export modifierとerror field modifier/typeのfixture hole二件だけをblockerとした。残るreviewerは固定file変更前に停止したため、R2で三役の初期reviewを再実行する。
- **RC01-DI1 R2 snapshot**：brand export modifierをAST、error fieldのrequired、readonly、exact typeをtype fixtureで固定した。focused 10 tests、typecheck、lint、formatが成功した。7 fileをsynthetic commit `79d5da77cfbc664d23ca99f4c2f7abc413bc799b`へ保存し、shared worktreeではなくimmutable snapshotを三役へ渡した。
- **RC01-DI1 post-commit audit**：R2固定7 blobがcommit `639bc26cf460f5f5c4965d67f5a3e657f4690cca`と一致することをmanifest `b032cc5fc569ded43797ef2699e89cc7b2a93e82725a3adab627cabc50ed76f0`へ固定した。correctness、SPEC/artifact、最終目標/ownerの三役は、R1 fixture blockerの解消、type-only boundary、root/client非追加、後続DI2/DI3責務の維持を確認し、全員`ACCEPT`、blocker/follow-up 0件と判定した。
