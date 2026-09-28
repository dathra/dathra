#import "../../../functions.typ": *
#import "../../../settings.typ": *
#show: apply-settings

#design_proposal(
  issue: 253,
  name: "最初のsliceにおける明示的な実行境界とactivation ownership",
  summary: [
    本Proposalは、Issue #253について利用者がこの作業の委任時に明示決定した方式と共有契約を記録する。
    初期DOMのserver authority、client activationでの再構築禁止、失敗時のSSR保持、共有ownerの解放順を横断契約として定め、最終API、encoding、package内状態遷移は担当Issueへ渡す。
    ADRのAcceptedは利用者の設計決定を示し、GitHubのProposal Progressや独立reviewの状態を示さない。
  ],
  scope: [
    - /store-snapshot-roundtripを代表consumerとするPlain JS/TS authoringと実行境界
    - 専用compilerとJSXを最初のsliceに採用しない判断、および同consumerによる候補比較
    - server artifact、state association、activation owner、mutable targetの共有語彙
    - author / build / server / client / reactivityの責任と初期activationの状態・資源契約
    - #252の承認済みconsumer evidence、候補reportと下位Issueへのhandoff
  ],
  non_goals: [
    - production implementation、package SPEC/tests、reactivity engineの変更
    - 最終API名、DOM marker、wire format、serializer、bundler plugin実装の確定
    - arbitrary JavaScriptのclosure capture、任意ASTの静的解析、全profileのsupport policy
    - performance threshold、migration、release、GitHubへのコメントやmetadata変更
  ],
  open_questions: [
    - 本Proposalで必須の高影響選択は利用者が明示決定済みであり、未回答の選択を後続へ隠していない。
    - compiler-free方式の公開APIとpackage分割は#247へ、request/response形式は#248へ、production activation adapterは#249へ渡す。
    - initial DOM writeのstagingとrollbackは共有契約である。production経路の検証は#249のproduction acceptanceに必要だが、設計と実装の開始を妨げない。
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/245")[Issue #245],
    link("https://github.com/dathra/dathra/issues/246")[Issue #246],
    link("https://github.com/dathra/dathra/issues/247")[Issue #247],
    link("https://github.com/dathra/dathra/issues/248")[Issue #248],
    link("https://github.com/dathra/dathra/issues/249")[Issue #249],
    link("https://github.com/dathra/dathra/issues/250")[Issue #250],
    link("https://github.com/dathra/dathra/issues/251")[Issue #251],
    link("https://github.com/dathra/dathra/issues/252")[Issue #252],
    link("https://github.com/dathra/dathra/issues/253")[Issue #253],
    link("https://www.typescriptlang.org/docs/handbook/jsx.html")[TypeScript Handbook: JSX],
    link("https://vite.dev/guide/features.html")[Vite: Features],
    link("https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API")[TypeScript Compiler API],
    link("https://html.spec.whatwg.org/multipage/scripting.html#the-template-element")[WHATWG HTML: template element],
    link("https://lit.dev/docs/templates/overview/")[Lit: templates overview],
    link("https://lit.dev/docs/templates/expressions/")[Lit: expressions],
  ),
)

== Decision and status

#adr(
  header("最初のsliceのauthoring方式と共有activation contract", Status.Accepted, "2026-09-28"),
  [
    Issue #253はcompiler要否とJSX要否を独立に比較し、最初の実consumerに対する方式を決める。
    利用者は本作業の委任時に、専用compilerなし、JSXなし、Plain JS/TSの明示的な実行境界を選択した。
    stateはserver instance生成時に一度宣言し、SSR時に使った論理値とassociationをclientへ渡す。
    browserでcomponent、setup、render、server初期値取得を再実行してstateやDOMを作り直してはならない。
    #245のserver authority、no-reconstruction、no-implicit-fallback、zero-client-root、reactivity engine維持をこの方式でも必須とする。
  ],
  [
    - 最初のsliceはPlain JS/TSによる明示的なserver/client module boundaryとassociation declarationを使う。
      module/exportと宣言されたcapabilityが実行責務を示し、arbitrary JavaScriptやDOM形状からownershipを推測しない。
    - 専用Dathra compilerとJSXは採用しない。
      一般的なTypeScript変換、通常のbundler、minifierは許容する。
      限定的なbuild graph checkは明示boundary、server-only import漏れ、出力manifestを検査してよいが、arbitrary source semanticsを解析できるcompilerとして扱わない。
    - SSRでstateを一度だけ初期化する。
      clientは受け取った値をclient-localな既存reactivity engineのSignalへ復元し、associationを接続する。
      server/client間の同一memory object共有も、activation後の自動的な双方向server同期も要求しない。
    - client側でpureなassociation metadata/schema moduleを評価し、明示的なinitial tracked getterでsubscriptionを登録することは許可する。
      これはcomponent/setup/renderやinitial value acquisitionの再実行ではない。
    - 通常のJSのtext(count.value)は評価済み値を渡す。
      その一行だけから継続的reactivityや自動closure captureを推論しない。
      更新対象は明示的なgetterまたは登録済みreactive bindingとして既存engineのeffectへ接続する。
    - target、handoff、type/shapeが不正ならactivationを拒否し、SSR表示を保持する。
      CSR default、implicit fallback、暗黙の再構築で失敗を隠さない。
    - 同一SSR rootのadmissionは一つのownerへ集約する。
      resource acquisition中のfailureは全resourceを解放し、initial DOM writesをcommitまでstagingし、SSR表示を残す。
      失敗したinstanceはterminalとする。
    - terminal activation retryには同じDOM/identityを再利用せずfresh SSR instance/responseを使う。
      terminal browser tabではserver-authoritativeな新responseを得るため、再request/reloadが必要になる。
    - 成功済みinstance内のoperation retryは許可する。
      Docs Copyは失敗後の明示的な再clickを例とし、false successを示さず、stale completionに成功状態を上書きさせない。
    - child removalはそのchild scopeだけを止める。
      shared owner terminationはconnected child listener/effectを先に止め、その後Storeをdisposeする。
      cleanupはidempotentで、late completionはdisposedまたは古いgenerationを確認して無視する。
    - user-authored UI creationと明示的server communicationはinitial SSR instance reconstructionとは別capabilityである。
      本sliceは両者を一律unsupportedとせず、必要なAPI/transportと所有責任は#247/#248/#249へ渡す。
  ],
  [
    - authorはmodule/capability境界とassociationを明示するため、接続記述と型の突合せが残る。
      compilerによる自動推測は得られないが、boundaryの根拠をsource上でreviewできる。
    - buildは明示されたmodule graphとentryを使う。
      zero-client-rootは宣言client entry集合が空ならDathra bootstrapを生成・挿入しないことで扱い、静的route flagに依存しない。
      output manifest、emitted files、HTML tags、browser requestsは別々に検査する。
    - preflightとcommitの具体APIは後続ownerが設計する。
      initial DOM更新をtransaction内に段階適用できない経路を使うなら、部分failure時にSSR表示を保てないためcontract不適合である。
    - state associationはruntimeが持つ内部identityとする。
      public author schemaを必須の利用者概念としない。
    - activation acquisition中に失敗したtabではsame-instance retryをせず、新しいSSR responseを回収する。
      これはserver authorityから復旧し、壊れたscopeの再利用を避けるtrade-offである。
  ],
  alternatives: [
    - 明示的な別moduleとentryを採用する。
      authorにboundary/associationの記述は残るが、buildがDathra専用意味解析を必要とせず、未知graphを拒否できる。
    - minimum syntax transformは採用しない。
      JSX/templateから記述量や型推論を得る可能性はあるが、実行ownershipは明示のままで、別transform integration、source map、debugging、診断pointを追加する。
    - bounded compiler analysis/generationは採用しない。
      direct exportや制限されたcall patternの選択を自動化できるが、任意closure captureや一般JS semanticsを証明しない。
      subset外をrejectするなら別source restrictionとtoolchainが必要であり、JS一般への保証として説明できない。
    - JSXは表示treeのsyntaxであってserver/client boundaryやstate handoffを自動で決めないため、採用しない。
    - HTML templateはDOM fragmentを保管するnative機能であり、signal dependency追跡やactivation lifecycleを供給しないため採用しない。
      Litのbinding semanticsもこのProposalでは選択しない。
  ],
  references: (
    link("https://www.typescriptlang.org/docs/handbook/jsx.html")[TypeScript JSX],
    link("https://vite.dev/guide/features.html")[Vite TypeScript/JSX handling],
    link("https://html.spec.whatwg.org/multipage/scripting.html#the-template-element")[HTML template],
    link("https://lit.dev/docs/templates/expressions/")[Lit expressions],
  ),
)

=== Evidence basis and fixed #252 gate

#252のprimary consumerは#raw("@playground/e2e")の/store-snapshot-roundtripであり、SSR snapshotからCount 7、Theme snapshot-midnightを表示し、既存buttonでCountを増やす。
/reactivity docsとDocs Copyは比較consumerであり、#252が選んだconsumerではない。
Home routeもhistorical zero-client-root controlではない。
当時のentry-clientは全routeでappRootをimportしてhydrateIslands(document)を呼んでいた。
zero-root実験はHomeRoute sourceをconsumer-derived fixtureへ写し、automatic selectionを別に検証したものである。

evidenceのversionは混同しない。
#252 accepted evidence revisionは4e6b91eab9147222cbec2b22b53b257a7474b470である。
PR #255 reviewed headはcf4bb4dc6bb0a62be4ae13b81a7090630595504d、PRは2026-09-20にintegration/245-server-authoritative-executionへmergeされ、merge commitは4082f197c721e74ffade589a7fdfb797078c5cf8である。
その後Issue #252は別途close authorizationを経て2026-09-27にcompletedとしてclosedになった。
acceptance、reviewed PR head、merge、Issue closureは別状態であり、open Issueを根拠に#253を止めない。

2026-09-28 collector bundleは/tmp/dathomir-253-luna/proposal-253-inputs-revision-03-task-2c62976be40c.json、SHA-256は58009f854f1acdf8a3377ef2b5d1f3bdc114ddfe3f1454e638f99b3c1b217d18である。
collectedAtは2026-09-28T00:36:01.379Z。
issue、comments、native relationships、referencesのsource groupはcollected。
required Issue fields欠落はなく、duplicate sectionもない。
Proposal groupは作業前にはabsentであり、唯一のwarningは既存253.typを見つけられないという想定された状態だった。
候補46件を本書末尾Coverageへsource heading、line、ordinal付きで対応させた。

後続reportへの/tmpパスはこのworkspaceのlocal scratch evidenceを指し、merged #252のdurable artifactではない。これらはfeasibility限界を判断する入力として記録し、production integration evidenceとは主張しない。別環境でProposalをreviewする場合、coordinatorは必要なscratch evidenceをdurable review artifactとして追加するか、ここに示す制限付きsummaryをそのまま扱う。

#252のcurrent gateは満たされている。
PR #255 merge completion comment 5749927789は、承認済みevidence-only scope、固定consumer/source/revision、#245の必須原則、limitationsとhandoffを記録する。
GitHubのIssue #252はclosed/completed、PR #255はmerged、merge先integration refはmerge SHAである。
既存#253 relationship dataには#252へのnative blocked-by edgeが残っているが、これは完了済みdependencyに対応するstatus discrepancyである。
本Proposalはそのedgeを変更しない。
handoff時にcoordinatorがnative relationshipを解消するか、完了済みdependencyとして残すかを処理する。
このmetadata整理はdesign decisionやevidence gateの未達ではない。

=== Evidence map: baseline, candidate, limits

#table(
  columns: (1.5fr, 1.8fr, 4.5fr),
  table.header([Evidence], [What it establishes], [Limit and policy boundary]),
  [#252 fixed evidence: SPEC/proposals/245/252/252.typ, revision 4e6b91e; measured source c1a30ed86fd2bd79e1c742362f552e9f62ff9f98.],
  [/store-snapshot-roundtrip is the selected real consumer; SSR values, baseline, repeated clicks, cleanup/failure gap and zero-root baseline were recorded.],
  [This was accepted as evidence only. Historical operation/cleanup/failure observations were hypotheses forwarded to #253, not automatically selected contracts. Scratch reports often copy source at HEAD 49b1adf502dad7de0b4709c1595d87529f0d2ebd; that is candidate provenance, not the measured #252 source SHA.],
  [Snapshot owner success: /tmp/dathomir-253-luna/snapshot-owner-verification/REPORT.md and /tmp/dathomir-253-luna/consumer-snapshot-success/REPORT.md.],
  [A candidate restored the real snapshot and retained existing SSR Text nodes through update; current route replaces Count/Theme Text nodes on initial render.],
  [Route-specific adapter and child-owned Store were required. Candidate evaluated atom/schema modules once and ran initial getters. Not proof of generic admission API or zero client module evaluation.],
  [Snapshot failure admission: /tmp/dathomir-253-luna/snapshot-failure-verification/REPORT.md.],
  [Five invalid/missing/mismatched handoff cases were rejected before Store, effect, listener, component registration and fallback; SSR display remained.],
  [Strict route-specific preflight, schema checks and target markers. This is rejection before acquisition, not rollback after partial effects. Baseline missing/shape behavior silently defaults and wrong type can enter state; these are baseline defects, not adopted behavior.],
  [Lifecycle transaction: /tmp/dathomir-253-luna/lifecycle-transaction-verification/REPORT.md.],
  [Source-built reactivity/runtime and a low-level adapter observed single admission, actual resource rollback after partial A/B activation, child removal, shared termination order and repeated cleanup.],
  [Uncoordinated predecessor left B listener alive after Store disposal. Candidate adapter owns scope disposers before effects and does not prove stock high-level hydrate rollback. Initial DOM write staging is a user decision not generally verified in public path.],
  [Docs Copy: /tmp/dathomir-253-luna/docs-copy-verification/REPORT.md and /tmp/dathomir-253-luna/docs-copy-failure-disposal/REPORT.md.],
  [Actual Reactivity docs has five blocks and Copy buttons. Browser candidate copied exact normalized source, showed feedback only on success, handled unavailable/throw/reject and explicit retry, ignored stale rejection and cleaned a success reset timer on removal.],
  [Manual source/operation/association handoff was needed. Production /reactivity baseline showed Copy but click did not activate. This is not production TSX integration or final wording. A callback invoked after timer cancellation modeled a queued race; it was not an observed native queued Chrome task. Docs Copy is a comparison, not #252 primary consumer.],
  [Automatic zero-root: /tmp/dathomir-253-luna/automatic-zero-client-root/REPORT.md.],
  [Adapted HomeRoute with no declared capability produced SSR HTML without Dathra script/preload/request/activation; positive control selected client code. Rebuild removed seeded stale artifacts.],
  [Uses a bounded selector and custom build/server bridge adapted to real HomeRoute; not production plugin or arbitrary JS graph. Empty emitted manifest/helper is distinguished from served HTML and network requests. Feasibility only, no compiler adoption.],
  [Bounded selection: /tmp/dathomir-253-luna/BOUNDED-GUARANTEE-REPORT.md.],
  [TypeScript Compiler API prototype recognizes a limited module/export/call subset and rejects unsupported constructs.],
  [Not arbitrary JS analysis, general closure capture, or adopted compiler. Current decision instead uses explicit capability declarations and an ordinary bundler graph.],
)

=== Terms and minimum capability set

#table(
  columns: (1.7fr, 5.8fr),
  table.header([Term], [Meaning in this Proposal]),
  [Static route/capability ID], [An author/build-declared key carried through the selected client entry. It identifies a declared route capability across responses; it is not an SSR root identity and does not identify DOM by shape.],
  [Server artifact], [The response-bound source of SSR instance identity, logical state values and declared capabilities. The server renderer issues the per-response identity and creates the association record; that artifact owns the immutable record until client admission. Conceptual only; no byte encoding or one-file artifact is mandated.],
  [SSR instance identity], [A fresh identity issued by the server renderer for one server-created root in one response. It is distinct from any static route/capability ID. Client activation associates that exact existing root; it does not reconstruct it.],
  [Declared capability], [An author-declared client operation, tracked display binding, user-created UI operation or explicit server request with identified owner and targets. Its static ID selects the capability; the response associates it with an SSR instance. Initial slice needs existing-root binding and event operation.],
  [Client preflight validator], [The client-side validator that checks the server response's SSR instance identity, static capability ID, handoff fields and explicit root/target associations before admission. It does not infer ownership from arbitrary DOM.],
  [Activation owner], [The unique browser lifetime owner admitted for one validated SSR instance identity. The server artifact remains the source of the immutable association record; the activation owner owns the live restored state, child scopes, operation generations and cleanup order.],
  [Mutable target], [An explicit existing node/attribute/property allowed to change after commit, or explicit creation boundary for later user-requested UI. DOM shape alone grants no authority.],
  [State association], [The server-issued response record maps an SSR instance identity and static capability ID to logical state values and explicit targets. After client preflight, the activation owner maintains the live mapping to client-local Signals. It does not assert shared JS object, public schema API or automatic reactive serialization.],
  [Child scope], [Individually removable consumer/effect/listener set under a shared activation owner.],
)

This slice needs two capability combinations, not an old exhaustive profile taxonomy:
- no declared client capability: server-only for Dathra; keep SSR and require no Dathra bootstrap.
- declared display/event capability: restore logical state and bind only named existing targets.
The runtime-internal logical-state slot key, if represented, is a third distinct value; it is not a public author schema, static capability ID or SSR instance identity. User-created UI and explicit server communication remain separate valid capabilities. This set does not label all application code or constrain later designs.

== Same-consumer option comparison

The examples use the selected route: server displays Count 7 and Theme snapshot-midnight; Increment changes Count to 8 in the existing node. Names in the snippets are explanatory pseudocode, not working implementation or adopted APIs. The `id` in the server example is a static route/capability ID supplied by the author/build; for each response the server renderer separately issues an SSR instance identity and owns the record associating that identity with the selected capability and explicit targets.

=== Explicit Plain JS/TS modules and association (selected)

```ts
// route.server.ts runs once for this server instance
export function renderRoute(request: Request) {
  const count = signal(loadInitialCount(request)); // 7
  const theme = signal("snapshot-midnight");
  const response = renderExistingMarkup({
    count: count.value,
    theme: theme.value,
  });
  return declareCapability(response, {
    id: "store-snapshot-roundtrip", // Static capability ID, not the per-response SSR instance identity.
    state: { count, theme },
    targets: { countText: "#count", themeText: "#theme" },
    bindings: { countText: "countText", themeText: "themeText" },
    events: { increment: ["#increment", "click"] },
    clientModule: "./route.client.ts",
    operation: "increment",
  });
}

// route.client.ts does not import component setup or initial-value loading
export const countText = context => String(context.state("count").value);
export const themeText = context => context.state("theme").value;

export const increment = context => {
  const count = context.state("count");
  count.set(count.value + 1);
};
```

The author marks the server-only initializer and client entry/import boundary. The server renderer issues a fresh SSR instance identity for this response and creates the association record linking it to the static capability ID, logical slots, values and explicit targets; the server response artifact owns that immutable record. The client preflight validator checks that record against the declared client module and targets before admission; after admission, the activation owner owns live state and resources. The browser may load pure metadata, explicit tracked getters and the exported operation, but does not call renderRoute, loadInitialCount or component tree creation. The activation engine restores a browser-local Signal and invokes the declared getters under the existing reactivity effect against the associated existing SSR nodes.

The association is explicit rather than inferred from function.name, closure capture, serialized source, guessed descendant DOM or arbitrary AST. Neither the static capability ID nor a DOM selector alone is an SSR instance identity. TypeScript can check source modules and imported operation types. A narrow build graph validator can check the declared client module and reject known server-only imports. It cannot prove arbitrary runtime behavior or hidden dynamic imports; an unprovable boundary is a build/admission error, not permission to fallback.

=== Minimum syntax transform with explicit responsibility (rejected)

```tsx
// Conceptual JSX input; execution boundaries still have to be authored.
const count = signal(loadInitialCount(request));
return (
  <ServerRoot state={count} clientModule="./route.client">
    <p id="count">{track(() => count.value)}</p>
    <button client:click={["increment", "./route.client"]}>
      Increment
    </button>
  </ServerRoot>
);
```

A small transform could lower marked JSX attributes or declarative template tags into Option A association records. The author still decides server-only initialization, names the client operation and associates targets. It does not remove lifecycle or ownership decisions. It adds transform configuration, source maps, generated-code debugging and another diagnostic stage. TypeScript's JSX support documents syntax/type checking and configurable emit; JSX itself does not specify Dathra's execution boundary or handoff. See the official [TypeScript JSX Handbook](https://www.typescriptlang.org/docs/handbook/jsx.html).

=== Bounded analysis and generation (rejected)

```ts
// Conceptual restricted subset; this is not arbitrary JavaScript.
export const operations = {
  increment: state => state.count.set(state.count.value + 1),
};
export const bindings = {
  countText: state => String(state.count.value),
};
export const targets = {
  countText: "#count",
  increment: { selector: "#increment", event: "click" },
};
```

A Dathra analyzer could resolve accepted exports and known declarative calls, then emit selected entries and association records. It could reduce repeated keys and diagnose an unknown operation at build time. It adds a compiler, schema/version lifecycle and generated artifacts. The prototype proves only a bounded grammar; it does not establish arbitrary closure capture or general JavaScript analysis. Unsupported constructs must be reported, not silently classified as zero capability. This approach is not selected.

=== Syntax comparison is an independent axis

#table(
  columns: (1.1fr, 1.2fr, 4fr),
  table.header([Syntax], [Decision], [Same consumer and trade-off]),
  [JSX/TSX], [Not selected], [Compact nested markup and configured JSX type checking are available. JSX does not identify server-only code, state handoff, mutable targets or activation owner. Choosing JSX would not require a full analyzer; declining it is separate.],
  [HTML template], [Not selected], [Native template content is an inert fragment, not reactive dependency tracking or activation lifecycle. Explicit client module and target association remain. Lit expression/update behavior belongs to Lit runtime semantics, not HTML template syntax alone.],
  [Plain JS/TS calls], [Selected], [Explicit module imports, operation exports, state associations and target declarations compose with normal TS checking and existing reactivity. The consumer needs no JSX. text(count.value) evaluates once unless a tracked getter/effect re-reads it.],
)

These official documents support syntax/tool facts, not Dathra behavior. TypeScript documents JSX syntax and emit/type-checking options; Vite documents TS transformation separately from type checking; the HTML standard defines template content; Lit documents expression/update behavior for Lit templates. None of these external framework contracts is adopted here. See [Vite](https://vite.dev/guide/features.html), [WHATWG template](https://html.spec.whatwg.org/multipage/scripting.html#the-template-element), [Lit templates](https://lit.dev/docs/templates/overview/) and [Lit expressions](https://lit.dev/docs/templates/expressions/).

=== Authoring and execution comparison

#table(
  columns: (1.1fr, 1.45fr, 1.45fr, 1.5fr, 1.6fr),
  table.header([Concern], [Explicit modules], [Minimal transform], [Bounded analysis], [Selected boundary]),
  [Author burden], [Two modules plus matching capability/target names; association is visible but repeated.], [Less descriptor syntax; same explicit execution responsibility remains.], [Less repeated metadata inside accepted subset; source restrictions must be learned.], [Explicit module and association; no required author schema concept.],
  [Type checking], [Normal TS checks imports/types; dynamic name mapping needs validator.], [Typed input remains possible; generated output needs transform checks.], [Only recognized expressions can be analyzed; unknown forms must be rejected.], [Generic TS check plus explicit typed interface and boundary completeness checks.],
  [Debugging], [Source maps to authored module/export; reader sees boundary.], [Generated code/source map is another debug layer.], [Need source-to-generated operation tracing; unsupported syntax points to analyzer boundary.], [Debug selected server or client module; no hidden render replay.],
  [Build and runtime], [Generic TS/bundler plus graph validation; runtime preflights, restores, owns and disposes.], [Same runtime contract plus transform/plugin order and maps.], [AST analysis/generation, selection manifest/versioning and same runtime contract.], [Ordinary bundler receives explicit client entries; runtime provides shared transaction.],
  [Diagnostic timing], [Import/type errors at type/build; response-specific mismatch at preflight.], [Syntax/transform and build errors precede runtime.], [Unsupported subset can fail early but needs stable diagnostics.], [Build rejects known graph violations; client preflight rejects response/target mismatch before admission.],
  [Server-only isolation], [Explicit import boundary; build graph check rejects known server-only imports.], [Syntax markers alone do not prove graph isolation.], [Analyzer proves only known subset; arbitrary dynamic graph remains.], [Keep renderer/loaders out of client entry; fail closed where graph evidence is insufficient.],
  [Zero client root], [Empty declared entry set omits Dathra bootstrap; build/server integration must honor it.], [Possible if transformed declaration list is empty.], [Adapted prototype shows it only for bounded grammar.], [No static route flag; derive no-root from empty declared capabilities.],
  [Closure capture], [No general solution; pass explicit state association/context.], [No general solution.], [Subset proof only; arbitrary closure remains.], [No automatic capture promise; runtime owns internal state map.],
)

=== Same policy, different lifecycle responsibilities

The options above change how an author declares a capability; they do not select different authority or failure semantics. The next comparison holds the accepted #245 invariants constant and shows which declaration, build, and runtime work each authoring option would need. A shared outcome is a contract to implement, not evidence that each option already has a working production path.

#table(
  columns: (1.0fr, 1.6fr, 1.6fr, 1.8fr, 1.6fr),
  table.header([Lifecycle basis], [Explicit modules (selected)], [Minimal transform], [Bounded analysis/generation], [Evidence and limit]),
  [Initial authority and state], [The server module initializes logical state once and emits SSR nodes plus response values/associations. The client module may evaluate metadata and tracked getters, then restores browser-local Signals; it does not call setup, render or initial acquisition.], [The author marks the same server/client boundary and tracked getter in JSX or a template. The transform must lower those marks to explicit associations; syntax cannot authorize replay or make the server value non-authoritative.], [The analyzer may extract state and bindings only from its accepted declarations and emit associations. The runtime still restores response values; an unrecognized initializer must be diagnosed, never replaced with a client default.], [Snapshot owner evidence used adapted modules and a manual bridge to retain SSR text nodes while restoring values. It did not prove production module integration or exercise each rejected authoring form.],
  [Identity, ownership and admission], [The author/build supplies a static route/capability ID; it selects the client entry and is not a root identity. For each response the server renderer issues the SSR instance identity and creates the association record linking it to the ID and explicit targets; the server response artifact owns the immutable record. The client preflight validator checks that record before one activation owner admits it; no DOM-derived ownership.], [The transform preserves the static ID and explicit target declarations in generated records; the server renderer still issues a distinct per-response SSR instance identity and creates the association record, owned by the server response artifact. The client preflight validator checks the exact record before admission. A JSX tree or template instance cannot infer identity or ownership from DOM shape.], [The analyzer/build may derive static IDs and selections only from recognized exports/calls; ambiguous forms fail at build time. At response time the server renderer issues a separate SSR instance identity and creates the association record, owned by the server response artifact. The client preflight validator checks generated capability, identity and target agreement before one owner admits it; no DOM inference.], [The low-level lifecycle adapter supplied an identity and observed duplicate admission resolving to one owner and one subscription/listener per target. It did not prove server issuance, response-artifact ownership or the production validator protocol.],
  [Lifetime and disposal], [The activation owner owns restored state and child scopes. Removing a child stops only its effects/listeners; ending the shared owner stops connected children before disposing the Store. Cleanup is idempotent.], [Lowered declarations must enter the same owner/scope protocol. The transform can describe event syntax but cannot itself guarantee child removal, shared-owner ordering or idempotent cleanup.], [Generated records can enumerate recognized resources, but their runtime must use the same owner/scope protocol. Side effects that escape the accepted subset prevent a completeness claim and must be rejected or explicitly represented.], [Lifecycle transaction evidence observed child-only removal, owner termination ordering, repeated cleanup and actual resource counters using source-built runtime/reactivity plus a low-level adapter. Baseline uncoordinated disposal left a listener active.],
  [Partial failure, retry and late completion], [Preflight rejects invalid handoff before admission. After acquisition starts, the runtime stages initial DOM writes, releases every acquired resource on failure, retains SSR display, and treats that SSR instance identity as terminal. Recovery with a fresh server response/instance is the selected design requirement, not an observed success; successful operation retry remains allowed. Stale generations cannot update.], [Generated records still need that runtime transaction. A successful syntax transform is not activation success and cannot turn partial resource acquisition into rollback. Fresh-response recovery remains an untested server/client integration obligation.], [Build-time rejection can catch unsupported syntax before serving, but response mismatch or runtime acquisition failure still needs the same preflight/transaction. Static analysis cannot replace cleanup of resources acquired at runtime or prove fresh-response recovery.], [The failure/disposal reports observed rollback after A acquired resources and before B completed, SSR node identity, and rejection of retry on the same SSR root in adapted routes. They did not fetch or validate a fresh response, so recovery is selected policy and an untested downstream obligation. Initial DOM staging is a policy requirement; general stock-path rollback/staging is not proved.],
  [Resources and mutable writes], [Declared event listeners, effects and timers register owned cleanup. A committed tracked getter updates only its named existing target through the existing Signals engine; operation writes are explicit.], [The transform must emit listener/effect descriptors that use the same resource registry and target writer. Raw `{count.value}` is only a value read unless lowered into a tracked getter.], [The analyzer can generate registrations only for recognized event/getter forms. It cannot promise arbitrary closure capture or roll back untracked native side effects; the runtime continues to use the existing Signals engine.], [Docs Copy evidence exercised clipboard outcomes, success feedback, retry and timer cleanup against the real consumer-derived DOM with manual association. It does not establish JSX lowering or arbitrary resource capture.],
  [Server-only isolation and zero client root], [The build consumes explicit client entries; an empty declared set serves SSR without Dathra bootstrap. The server renderer and initializers stay outside client entries; uncertain graph edges fail closed.], [The transform must lower no declarations to an empty entry set and must not inject a bootstrap unconditionally. The server bridge uses that set rather than a route flag.], [A complete bounded scan may emit an empty selection only when no supported capability exists; unknown syntax is an error, not proof of zero. The generated manifest and server HTML integration must agree.], [Automatic zero-root evidence exercised an adapted HomeRoute through a bounded selector and custom build/server bridge, with positive control and stale-artifact rebuild. It proves feasibility for that fixture, not explicit-module production integration or arbitrary graph analysis.],
)

These evidence sources are asymmetric by design: the explicit-module-like snapshot/lifecycle adapters support selected runtime obligations, the bounded selector supports only its bounded zero-root pipeline, and there is no working minimal-transform prototype. The bounded-grammar result therefore cannot be cited as proof that the selected compiler-free, explicit-module boundary analyzes arbitrary JavaScript; each eventual implementation owner must validate its own graph and runtime path.

The selected approach trades compactness for reviewable execution ownership. It does not limit JavaScript as a language; it limits what Dathra promises without an explicit declaration. JSX may be used elsewhere, but syntax alone does not grant permission to replay or mutate a server-created instance.

=== Responsibility boundary

#table(
  columns: (1fr, 1.7fr, 1.6fr, 1.7fr, 1.8fr, 1.6fr),
  table.header([Concern], [Author], [Build], [Server], [Client activation], [Reactivity]),
  [Initial state], [Declare logical state once in server instance creation.], [Keep explicit server-only/client-safe graph.], [Evaluate value once and use for SSR and handoff.], [Restore value into browser-local Signal; do not rerun initializer.], [Unchanged engine semantics.],
  [Initial DOM], [Describe output and named mutable targets.], [Do not synthesize second tree for activation.], [Render from request state.], [Reuse exact SSR nodes; validate targets.], [No tree creation authority.],
  [Association], [Declare static route/capability ID, module/export, operation and explicit targets.], [Preserve/check static ID and declared graph; derive no-root from empty entries.], [Issue per-response SSR instance identity, create the association record mapping it to static ID, values and targets, and place that record in the authoritative server response artifact.], [Client preflight validator checks that record before admission; activation owner then owns live mapping once. Never infer ownership from arbitrary DOM.], [Track actual getter reads against admitted client-local state.],
  [Updates], [Declare operation/getter; UI creation is separate.], [Bundle explicit entries; omit Dathra root if set empty.], [No automatic write to a sent response.], [Update named targets after commit; explicit requests use declared API.], [Run effects/subscriptions in owned scope.],
  [Disposal], [Declare root/child ownership boundary.], [No runtime lifetime authority.], [End request-local state at response end.], [Stop child scopes/listeners/timers/generations before Store disposal.], [Dispose effect roots and cleanup once.],
  [Diagnostics], [Provide valid typed declarations.], [Reject known forbidden/missing graph edges.], [Reject inconsistent handoff.], [Reject admission without fallback; operation error cannot show false success.], [Use existing engine and owner error boundary.],
)

== Canonical state and activation transaction

=== State and ownership

The author/build declares a static route/capability ID to select the client entry; this key is not a root identity. For each response, the server renderer issues a fresh SSR instance identity for the root and creates the immutable association record linking that identity to the static ID, rendered initial values, explicit targets and client entry. The server response artifact owns that record until admission. Neither the ID nor descendant DOM shape establishes root ownership.

The client preflight validator checks the server-issued identity, static capability ID, handoff values and explicit target associations before admission; it resolves the existing root only through that record and never infers ownership from arbitrary DOM. One activation owner admits one validated SSR instance identity and owns its live restored state map plus child scopes. Each active mutable target has one declared writer. Repeated admission returns that owner without duplicating Store, listener, effect or target binding. Conflicting payload, static ID or owner identity is rejected.

Initial tracked getters may execute while effects are staged so the existing reactivity engine can establish dependencies and calculate candidate values. DOM writes are buffered until the whole activation commits. Events cannot mutate a partially active instance. On success the engine applies staged current values, then activates resources. On failure it discards the buffer and leaves the original server display unchanged.

=== Lifecycle states

#table(
  columns: (1.1fr, 2.5fr, 3fr),
  table.header([State], [Entry / transition], [Resource and DOM rule]),
  [unadmitted], [SSR root exists; no client owner admitted.], [Only server DOM and response artifact exist.],
  [preflighting], [Client preflight validator checks server-issued SSR instance identity, static capability ID, required handoff, values, exports/capabilities and explicit targets before creating Store/effect/listener.], [No fallback/default Store. Invalid input rejects with DOM and nodes unchanged; root ownership is never guessed from DOM.],
  [staging], [Reserve one owner; restore local state; acquire effects/getters/listeners in transaction-owned scopes.], [Initial writes buffered; handlers gated; resources remain rollback-owned.],
  [active], [All acquisition succeeds and transaction commits.], [Apply writes only to declared targets. Repeated admission of the same validated SSR instance identity returns the same owner. Operation failure does not destroy active instance or claim success.],
  [failed-terminal], [Any acquisition/commit error after preflight.], [Reverse-clean resources; discard writes and state map; preserve SSR. That SSR instance identity cannot retry.],
  [disposed], [Child removal or shared owner termination.], [Child removal stops only child. Owner termination stops connected scopes and pending generations before Store disposal. Cleanup is idempotent.],
)

#behavior_spec(
  name: "Explicit SSR instance admission and activation",
  summary: [Client activation attaches declared capabilities to existing SSR nodes and restores values without replaying server component execution.],
  preconditions: [
    - The server response artifact owns one server-issued SSR instance identity, its static capability association and complete handoff.
    - The explicit client module graph passed build boundary checks.
  ],
  steps: [
    1. Read the server-owned association record and resolve its exact existing root/explicit targets without changing display or deriving ownership from DOM shape.
    2. The client preflight validator checks the server-issued SSR instance identity, static capability ID, fields/types, module/export association and every target before resource acquisition.
    3. Reserve one owner and restore browser-local state values.
    4. Acquire child scopes, tracked getters and listeners transactionally; buffer initial writes and gate actions.
    5. Commit staged values and activate resources only after all acquisition succeeds.
  ],
  postconditions: [
    - Server component/setup/render/initial-value acquisition runs once and is not replayed in the browser.
    - Pure metadata and explicit initial tracked getters may execute.
    - Each active target/subscription has one owner.
  ],
  errors: [
    - Invalid/missing/contradictory handoff is rejected before default Store, listener, effect or fallback.
    - No implicit hydration/CSR fallback or reconstruction occurs.
  ],
)

#behavior_spec(
  name: "Partial failure, terminal activation retry and successful operation retry",
  summary: [Admission is atomic with respect to SSR display and resource lifetime, while an active consumer operation may be retried.],
  preconditions: [
    - The response passed preflight and at least one scope has acquired a resource.
  ],
  steps: [
    1. If later acquisition/commit fails, mark this SSR instance identity failed-terminal.
    2. Stop acquired scopes/listeners in reverse order; cancel timers and invalidate async generations.
    3. Discard staged writes and owner state; dispose shared Store only after child callbacks are inert.
    4. Preserve SSR and reject another admission of this SSR instance identity.
    5. The selected recovery path is a fresh server response with a fresh server-issued SSR instance identity; this behavior has not been experimentally exercised and must be verified in downstream server/client integration.
    6. For an active operation such as Copy, show success only after fulfillment; failure leaves the active instance available for explicit retry.
  ],
  postconditions: [
    - No resource, stale completion or partial write escapes rollback.
    - Fresh-response recovery is the required server-authoritative path, not observed evidence; successful operation retries stay in the active owner.
  ],
  errors: [
    - Same-SSR-instance activation retry rejection and successful Copy retry are different policies.
    - Async details beyond explicit owned generations remain #249 package work.
  ],
)

#behavior_spec(
  name: "Child removal and shared-owner termination",
  summary: [A child can leave without ending sibling ownership; shared termination makes connected consumers inert before disposing shared state.],
  preconditions: [
    - One activation owner has shared restored state and child scopes.
  ],
  steps: [
    1. Child removal releases only that child's listeners, effects, timers and pending generations.
    2. Remaining siblings can use the owner while active.
    3. Owner termination stops every connected child callback/scope before shared Store disposal.
    4. Repeated child/owner cleanup is idempotent.
    5. Async completion checks owner/child liveness and generation before applying state or DOM.
  ],
  postconditions: [
    - No callback accesses disposed state.
    - Late/stale completion cannot update detached or superseded nodes.
  ],
)

=== Scenario evaluation

#table(
  columns: (1.5fr, 2.6fr, 3fr),
  table.header([Scenario], [Required outcome], [Evidence and limit]),
  [Normal snapshot], [Restore Count 7/Theme snapshot-midnight and bind existing DOM; no setup/render replay.], [Candidate retained Text nodes; route adapter is not production integration.],
  [Repeated update], [Click changes existing target through unchanged engine.], [Five-click browser candidate observed 7→12; fixed #252 selected the same consumer.],
  [Invalid handoff], [Reject before resource creation; preserve SSR; no default or fallback.], [Route-specific gate rejected five cases before resources; final API remains #249 work.],
  [Duplicate admission], [One owner, one resource per target, one increment per click.], [Lifecycle candidate observed idempotent admission using low-level adapter.],
  [Partial failure after acquisition], [Rollback all resources; discard staged writes; preserve exact SSR; terminal SSR instance identity.], [Candidate injected failure after A resources and during B, and rejected retry with that same identity. It did not fetch a fresh response or observe recovery; general staging guarantee is not proven in public path.],
  [Child removal], [Stop removed child only while connected sibling remains active.], [Candidate observed A cleanup and B shared update.],
  [Owner disposal], [Stop child callbacks/scopes before Store disposal; repeated cleanup no-op.], [Candidate observed order; uncoordinated baseline left B listener and disposed-store access. This is a baseline defect.],
  [Late completion], [Ignore stale result after newer success or disposal.], [Docs Copy ignored stale rejection; post-cancel timer callback was injected, not native queued Chrome behavior.],
  [Docs Copy failure/retry], [Unavailable/throw/reject never shows success; later success copies exact source and provides feedback.], [Real Docs source/content adapted; clipboard verified. Not production TSX integration or final wording; not primary #252 consumer.],
  [Activation retry], [The failed SSR root instance identity is terminal; selected recovery requires a fresh server response and new identity.], [Only rejection of retry on the same SSR root was observed. Fresh-response recovery remains an untested #248/#249 server/client integration obligation; an explicit new request/reload is the selected recovery cost.],
  [Zero client root], [Empty declared Dathra capability means no script/preload/bootstrap or activation request.], [Adapted HomeRoute positive-to-zero rebuild removed stale artifacts; bridge is not production plugin.],
  [New UI/server request], [Separate declared capability with target or request owner; do not conflate with reconstruction.], [Required boundary distinction; complete integration not demonstrated and not prohibited.],
)

Baseline defaults, inactive Docs Copy, detached button listeners and uncoordinated owner disposal are observed missing behavior/defects. They are not adopted as contract. Strict preflight, rollback, staged DOM writes and coordinated disposal are user-selected candidate policy. Reports establish bounded feasibility, not production completeness.

=== Responsibility and downstream ownership

#table(
  columns: (0.8fr, 2.2fr, 2.7fr, 2.6fr),
  table.header([Issue], [Owner scope], [Blocking status], [Handoff]),
  [#247], [Authoring/delivery API, typed declarations, module/export association, build graph and package SPEC/tests. Dedicated compiler not selected.], [Design can start now. Implementation waits for its own accepted SPEC/tests and shared contracts, not a compiler experiment.], [Specify API, diagnostics, graph validation and mutable-target model.],
  [#248], [Request-scoped render, response artifact, server-issued per-response SSR instance identity and association record, serialization and explicit server communication.], [Design can start now. Exact format/transport waits for #248 SPEC/tests; it does not block this Proposal.], [Define request isolation, static-capability-to-instance association and transfer protocol, not shared server/client memory.],
  [#249], [Client admission/update/new UI/lifecycle integration and fresh-response activation recovery.], [Production implementation and acceptance are blocked on public-path preflight, partial rollback, staged initial writes, owner/child disposal order, late completion and verification that a new response/new identity recovers after terminal rejection. #249 may start now; no experiment is required before start.], [Verify through actual public activation path; low-level adapter and same-instance rejection alone are insufficient.],
  [#250], [Route integration, docs and first-slice workflow.], [Planning can proceed in parallel; integrated proof depends on #247–#249. This Proposal does not wait for #250.], [Use /store-snapshot-roundtrip as primary; Docs Copy and HomeRoute as comparison/control only.],
  [#251], [Measurement and approved thresholds/tolerances.], [No performance pass/fail claim without threshold; threshold work does not block functional design or implementation.], [Keep fixed #252 measures separate from candidate prediction.],
  [#246], [Broader architecture, package responsibility and later profile decisions.], [Not a blocker to this bounded first-slice choice.], [Do not resurrect #103's four-profile taxonomy.],
  [#252], [Consumer and reproducible baseline evidence.], [Gate met: PR merged, Issue closed/completed. Native blocked-by edge in #253 is a status discrepancy for coordinator reconciliation, not missing evidence.], [Keep accepted revision and measured-source provenance distinct.],
)

The public API, serializer, host markers and compiler-free graph integration remain downstream work. This shared contract is sufficient for downstream SPEC work to start. Another #253 experiment is not indispensable. Before production readiness, #249 must verify the public path, especially staged initial writes and rollback from mid-acquisition failure.

=== Proposal state and unpublished coordinator drafts

This unique issue-numbered Proposal is SPEC/proposals/245/253/253.typ in Orca worktree 1415a82f-2232-46f9-ba0a-c1267ad3c774 at /home/kcatt/dev/dathomir-proposal-253-user-decided, on branch docs/proposal-253-user-decided-policy, based on integration/245-server-authoritative-execution at starting SHA 4082f197c721e74ffade589a7fdfb797078c5cf8.

The ADR is Accepted as a user decision. Issue #253 remains open / In Progress pending coordinator integration, the assigned independent review and owning-Issue progress update. No GitHub write, commit, push, PR, merge or issue metadata update was performed. The local drafts below are handoff material only, not posted comments or extra product contract.

=== Work-start comment draft

利用者の依頼に基づき、Proposal SPEC/proposals/245/253/253.typ の作成を開始する。
branch: docs/proposal-253-user-decided-policy。
baseとPRの予定先: integration/245-server-authoritative-execution。
開始SHA: 4082f197c721e74ffade589a7fdfb797078c5cf8。
専用compiler/JSXなし、Plain JS/TSの明示境界、server-authoritative state、transactional activation/disposal policyは利用者がこの委任時に明示決定済みである。
GitHub書き込み、commit/push/PR/merge/close、production implementationはこの作業に含めない。

=== Deferred-owner update draft

#253の最初のsliceは利用者が選んだ専用compilerなし・JSXなし・Plain JS/TS explicit boundaryとしてProposalに記録した。
#252のprimary consumerは/store-snapshot-roundtrip、accepted evidence revisionは4e6b91eab9147222cbec2b22b53b257a7474b470、PR #255はmerge commit 4082f197c721e74ffade589a7fdfb797078c5cf8で統合済み、Issue #252はclosed/completedである。
#253のnative blocked-by #252 relationshipが残るため、content gate達成とrelationship metadataを区別してhandoffする。
#247はAPI/module/exportとbuild graph、#248はrequest/response/明示通信、#249は公開経路のpreflight・部分failure rollback・DOM-write staging・child/root disposal・late completion、#250は統合とdocs、#251はthreshold/measurementを所有する。
このProposalで高影響の選択は決定済みである。別branchで独立reviewを行い、その結果に基づいてProposal Progressを更新する。

=== Review boundary

Independent reviewは未実施であり、Accepted ADR statusとGitHub review statusは別である。#252のclose/mergeは確認済みである。残るrecord discrepancyは#253のclosed #252へのnative blocked-by edgeであり、coordinatorが統合時に解消または明示的に保持する。

== Requirements coverage

Coverage IDは本Proposal内の追跡子で、Issue本文のsource heading/lineとcollector ordinalを保持する。collector bundleは2026-09-28T00:36:01.379Z時点で必須requirements candidateを全件収集した。

#table(
  columns: (auto, 2.2fr, 5.5fr),
  table.header([ID], [Issue source], [Decision / disposition]),
  [DTM-01], [Decision to make, line 3, candidate 1], [方式、compiler/JSXの独立した結論、最小ownership contractをADRとcomparisonに記録した。],
  [CE-01], [Context and evidence, line 11, candidate 1], [serverで一度宣言し、text(count.value)は一度の評価であるstate authoring意図を維持した。],
  [CE-02], [Context and evidence, line 13, candidate 2], [同一memory共有/自動双方向同期を要求せず、local Signal復元と明示server operationを分けた。],
  [CE-03], [Context and evidence, line 14, candidate 3], [SSR-first Plain JS/TSを採用し、専用compilerなし/JSXなしを明示決定に結び付けた。],
  [CE-04], [Context and evidence, line 16, candidate 4], [#245–#251のbodyと必要な直近commentを再読した。],
  [CE-05], [Context and evidence, line 17, candidate 5], [#252固定consumer、baseline、revisionとhypothesis boundaryを記録した。],
  [CE-06], [Context and evidence, line 18, candidate 6], [server authority/no-reconstruction/no-fallback/zero-root/reactivityをshared invariantへ記録した。],
  [CE-07], [Context and evidence, line 19, candidate 7], [new UIとexplicit server communicationをinitial reconstructionと分離し一律禁止しなかった。],
  [CE-08], [Context and evidence, line 20, candidate 8], [#103 profilesを採用せずsliceに必要なcapabilityだけを定義した。],
  [CE-09], [Context and evidence, line 21, candidate 9], [AGENTS、SPEC convention、manage-issue/proposal skillsを確認した。],
  [CE-10], [Context and evidence, line 22, candidate 10], [Orca専用worktree、指定base/start SHAを使いdirty original checkoutを保持した。],
  [OPT-01], [Options considered, line 26, candidate 1], [compiler要否とauthoring syntaxを独立comparison軸にした。],
  [OPT-02], [Options considered, line 28, candidate 2], [explicit module/entryを同consumerで比較し選択した。],
  [OPT-03], [Options considered, line 29, candidate 3], [explicit responsibility付きminimal transformを比較し追加toolingから不採用とした。],
  [OPT-04], [Options considered, line 30, candidate 4], [bounded analysis自動化とsubset/arbitrary JS限界を比較し不採用とした。],
  [OPT-05], [Options considered, line 32, candidate 5], [JSX/template/Plain JS/TSを同consumerで比較しofficial docsを参照した。],
  [DC-01], [Decision criteria, line 38, candidate 1], [silent default、inactive Docs Copy、detached listenerを正解として採用しない。],
  [DC-02], [Decision criteria, line 39, candidate 2], [SSR initial DOM authorityとpost-commit client target rightsを区別した。],
  [DC-03], [Decision criteria, line 40, candidate 3], [author declarationとbuild/server/client checksを分けarbitrary inferenceを否定した。],
  [DC-04], [Decision criteria, line 41, candidate 4], [single admission、rollback、disposal、late completionを規定した。],
  [DC-05], [Decision criteria, line 42, candidate 5], [existing reactivity engineとowned subscriptionsを維持した。],
  [DC-06], [Decision criteria, line 43, candidate 6], [zero-rootを維持しnew UI/server requestsは別capabilityとした。],
  [DC-07], [Decision criteria, line 44, candidate 7], [package detailを#247/#248/#249へ渡し全framework policyは先行設計しない。],
  [DC-08], [Decision criteria, line 45, candidate 8], [fixed baseline、scratch feasibility、user decisionをEvidence/Scenarioで区別した。],
  [AC-01], [Acceptance criteria, line 49, candidate 1], [compilerなし/minimal transform/bounded analysisとJSX/template/Plain APIを別々に比較した。],
  [AC-02], [Acceptance criteria, line 50, candidate 2], [burden、type check、debugging、build/runtime、diagnostic timing、server-only isolationを評価した。],
  [AC-03], [Acceptance criteria, line 52, candidate 3], [evidence revision/source/collector、approval、merge、closureを分けて記録した。],
  [AC-04], [Acceptance criteria, line 53, candidate 4], [authoring/tooling表に加え「Same policy, different lifecycle responsibilities」でauthority、ownership、identity/admission、lifetime/disposal、partial failure/retry/late completion、resources/reactivity、server-only/zero-rootを三案ごとの責務と証拠限界つきで同じ軸に比較した。],
  [AC-05], [Acceptance criteria, line 54, candidate 5], [requested five termsを定義しlegacy taxonomyを採用しない。],
  [AC-06], [Acceptance criteria, line 55, candidate 6], [author/build/server/client/reactivity ownership matrixを作成した。],
  [AC-07], [Acceptance criteria, line 56, candidate 7], [preflight、commit/failure、duplicate、disposal、terminality、retry、late callback/resourceを含めた。],
  [AC-08], [Acceptance criteria, line 57, candidate 8], [正常系、失敗、disposal、zero-root、new UI/server operationをScenario tableに含めた。],
  [AC-09], [Acceptance criteria, line 58, candidate 9], [#247–#251 ownerと開始/完了blocker、#246 broader ownerを記録した。],
  [AC-10], [Acceptance criteria, line 59, candidate 10], [#252 gateとmandatory inputを確認し、高影響決定を未回答へ移していない。],
  [AC-11], [Acceptance criteria, line 60, candidate 11], [一意なissue-numbered Typst文書でdesign_proposal/adr/behavior_specを使用。ledgerなし。],
  [AC-12], [Acceptance criteria, line 61, candidate 12], [Typst/whitespace/collector coverageを検査する。独立reviewはpendingと明記。],
  [AC-13], [Acceptance criteria, line 62, candidate 13], [ADR/Issue status、GitHub authorization boundary、unposted draftsを明記した。],
  [DEP-01], [Dependencies, line 66, candidate 1], [#252 gate complete。native edge discrepancyはreconcile対象で、evidence不足ではない。],
  [DEP-02], [Dependencies, line 67, candidate 2], [#247/#248/#249/#250を待たず設計し、#251 thresholdをProposal gateにしない。],
  [NG-01], [Non-goals, line 71, candidate 1], [production code、package SPEC/tests、reactivityを変更しない。],
  [NG-02], [Non-goals, line 72, candidate 2], [final API/encoding/marker/algorithmを残しcompiler/JSX採否だけを決めた。],
  [NG-03], [Non-goals, line 73, candidate 3], [初期slice以外の全profile/support policyを定義しない。],
  [NG-04], [Non-goals, line 74, candidate 4], [#252 measurementとaccepted criteriaを書き換えない。],
  [NG-05], [Non-goals, line 75, candidate 5], [new UI/server communicationをblanket prohibitせず、無根拠に初期sliceへ追加しない。],
  [NG-06], [Non-goals, line 76, candidate 6], [#103 conclusionとbackward compatibilityを採用根拠にしない。],
  [NG-07], [Non-goals, line 77, candidate 7], [migration/release/performance implementationや大量Issue作成をしない。],
)
