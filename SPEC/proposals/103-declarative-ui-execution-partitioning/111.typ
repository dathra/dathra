#import "../../functions.typ": *
#import "../../settings.typ": *
#show: apply-settings

#design_proposal(
  issue: 111,
  name: "Consolidated DocCodeBlock acceptance scenario",
  summary: [
    This document consolidates the accepted decisions from #105 through #110
    into one reviewable DocCodeBlock acceptance scenario. It is a traceability
    and handoff artifact, not a new design decision and not a replacement for
    the accepted source proposals.

    The scenario describes the logical contract from server analysis through
    client disposal. Package specifications and executable tests remain the
    authoritative destination for implementation details. The paths listed in
    the adoption map identify transfer targets; they do not make the current
    file layout part of the scenario contract.
  ],
  scope: [
    - one or more DocCodeBlock instances in a server-rendered documentation
      route
    - the stable-snapshot execution profile and its server/client boundary
    - source selection, normalization, language presentation, and readable
      highlighting fallback
    - root-scoped source handoff, component-instance client-root classification,
      and logical artifact inclusion or exclusion
    - activation admission, copy interaction, operation generations, reset
      timer ownership, and terminal disposal
    - phase-local failure outcomes and route, root, instance, and operation
      failure containment
    - the adoption map for transferring the contract into responsible package
      or feature specifications and executable tests
  ],
  non_goals: [
    - change any accepted decision in #105, #106, #107, #108, #109, or #110
    - implement production code, the compiler, the partitioner, the artifact
      emitter, the activation runtime, or the DocCodeBlock migration
    - update package `SPEC.typ` or `implementation.test.ts` files
    - choose concrete manifest, marker, entry, payload, or artifact encoding
    - choose artifact identity, encoded-size measurement, or exact resource caps
    - choose final diagnostic message wording, transport, or localization
    - choose a timer primitive or the copied-state reset delay
    - define the client-reactive revision protocol or server-owned delivery
      protocol
    - define a public API or expose internal phase, identity, or artifact fields
      as component configuration
  ],
  open_questions: [
    - #115 owns the accepted analysis subset, execution-profile proof,
      provenance, and analysis resource caps.
    - #118 owns the Execution Graph and placement plan that provide the accepted
      root set and dependency closures.
    - #119 owns concrete artifact encoding, entry and marker representation,
      handoff serialization, artifact identity, emitter caps, determinism, and
      build integration.
    - #120 owns integrated artifact and browser validation.
    - #109 owns the accepted failure and diagnostic categories. #126 owns the
      concrete interaction and lifetime implementation after #124; final
      diagnostic interface and wording remain outside this consolidation.
    - #222 owns the client-reactive observable contract and update closure, and
      #224 implements and validates that profile after the stable baseline. This
      document does not extend the stable handoff with an implicit revision
      channel.
    - #231 owns the copied-state reset delay.
    - The exact documentation fixture and browser harness remain downstream
      evidence decisions; they must exercise this scenario without changing it.
    - The long-term package owner for the documentation feature surface is not
      established by this consolidation document.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/103")[#103],
    link("https://github.com/dathra/dathra/issues/104")[#104],
    link("https://github.com/dathra/dathra/issues/105")[#105],
    link("https://github.com/dathra/dathra/issues/106")[#106],
    link("https://github.com/dathra/dathra/issues/107")[#107],
    link("https://github.com/dathra/dathra/issues/108")[#108],
    link("https://github.com/dathra/dathra/issues/109")[#109],
    link("https://github.com/dathra/dathra/issues/110")[#110],
    link("https://github.com/dathra/dathra/issues/111")[#111],
    link("https://github.com/dathra/dathra/issues/112")[#112],
    link("https://github.com/dathra/dathra/issues/115")[#115],
    link("https://github.com/dathra/dathra/issues/118")[#118],
    link("https://github.com/dathra/dathra/issues/119")[#119],
    link("https://github.com/dathra/dathra/issues/120")[#120],
    link("https://github.com/dathra/dathra/issues/126")[#126],
    link("https://github.com/dathra/dathra/issues/222")[#222],
    link("https://github.com/dathra/dathra/issues/224")[#224],
    link("https://github.com/dathra/dathra/issues/231")[#231],
  ),
)

== Precedence and terminology

This is a consolidation of accepted decisions. It does not supersede the
source proposals and does not create a second authority for their detailed
decisions. When a later accepted decision in one source proposal refines an
earlier decision, the later decision is used here.

- The root-scoped stable handoff in #107 is the current identity rule. The
  later decision in #107 supersedes the client-facing source-content identity
  parts of its earlier decisions while preserving normalized-source,
  fail-closed, and bounded-lifetime intent.
- The stable-snapshot profile is the first vertical slice. The server evaluates
  one source snapshot and the client consumes that snapshot for Copy behavior.
  It has no implicit source revision protocol.
- Initial execution-partitioning support includes both the stable-snapshot
  profile and a separate client-reactive profile. The client-reactive profile
  owns a client-visible source or language revision through an accepted
  client-safe update closure. Reactivity itself is not rejected and is not
  silently frozen into the stable profile.
- #222 defines the client-reactive observable contract and update closure, and
  #224 implements and validates it after the stable artifact and activation
  baseline. This document integrates the stable scenario and records the
  required profile boundary; it does not invent the reactive revision protocol.
- A server-owned revision delivery profile is also separate. It requires an
  explicit contract and is not an implicit fallback from either stable or
  client-reactive execution.
- A *client root* is a logical client-execution requirement produced by accepted
  analysis and placement evidence. It is not the same thing as an activation
  root.
- An *activation root* is the route or rendered-fragment scope that owns one
  root-scoped handoff table and one activation lifetime. Distinct roots in one
  document remain independent.
- A *logical render result* is the coordinated result from which SSR output,
  root and instance markers, handoff records, and artifact identity are
  produced. A cache may replay one complete result, but may not mix results.
- *Response commitment* separates transaction failures from post-delivery
  activation failures. Before commitment, server-analysis, partition, and emit
  fatals fail the enclosing route or render transaction atomically. After
  delivery, activation failures are contained by root or instance scope.

== Decision sources

The integrated scenario has the following source-to-contract mapping:

- #105 defines observable behavior, source normalization, language fallback,
  empty source behavior, the stable acceptance baseline, and the requirement
  that initial support include a client-reactive profile without making props
  permanently unreactive.
- #106 assigns source selection, normalization, highlighting, static rendering,
  and initial DOM to the server, and assigns activation, Copy state, Clipboard
  API, timer, and cleanup to the client. It also requires placement to
  distinguish the stable and client-reactive closures.
- #107 defines the root-scoped stable handoff, instance binding,
  normalized-source authority, handoff lifetime, and fail-closed validation.
- #108 defines activation admission, pre-activation event handling, operation
  generations, timer invalidation, asynchronous completion ordering, and
  terminal disposal.
- #109 defines phase-local failure ownership, outcome classes, diagnostic
  categories, and failure containment.
- #110 defines component-instance client-root classification, route aggregation,
  logical server and client closures, emission atomicity, and zero-client-root
  output.

== Consolidated contract

=== Source selection and server display

The server establishes one normalized source snapshot for each rendered
DocCodeBlock instance:

1. A non-empty string supplied through `children` takes precedence over the
   `code` property. A whitespace-only string is still a supplied string.
2. If `children` is not a non-empty string, the `code` property is used. An
   absent `code` property produces the empty source.
3. `CRLF` and `CR` line endings become `LF`.
4. Leading and trailing blank lines are removed. A blank line contains only
   whitespace.
5. The longest common literal prefix made of spaces or tabs is removed from
   every non-blank line. Tabs are not expanded and non-common whitespace is not
   removed.
6. Internal blank lines are preserved and the resulting lines are joined with
   `LF`.

The normalized snapshot is the source of truth for both visible code and the
stable client Clipboard operation. Raw children, an unnormalized `code`
property, highlighted markup, and server-only component inputs are not separate
source authorities.

The server renders a readable code block, the supplied language presentation
when applicable, and an accessible `Copy` control before client JavaScript is
available. An empty source still renders the normal shell and Copy control. A
successful copy of an empty source writes the empty snapshot; no placeholder
text is introduced.

The control is a native button or an equivalent keyboard-accessible control. Its
accessible name identifies the initial copy action and the copied state, and
keyboard activation has the same observable result as pointer activation. Code
remains readable when JavaScript is disabled or activation does not occur.

- An empty language hint uses readable plain-code display without an
  unsupported-language diagnostic.
- A supported non-empty language label remains visible and may select syntax
  highlighting.
- An unsupported non-empty language label remains visible and uses readable
  plain-code display rather than pretending to use another grammar.
- Highlighter absence, loading failure, or highlighting failure uses readable
  plain code when the normalized source exists. It does not remove the language
  presentation or Copy control and does not add the highlighter to the client
  closure.
- A source acquisition, source evaluation, normalization, or plain-code
  fallback failure is not converted into a successful empty block. It is a
  `server-analysis` fatal for the enclosing transaction.

=== Server and client responsibility

The stable-snapshot profile assigns each responsibility exactly once:

*Server responsibilities*:

- evaluate `children` and `code`, select and normalize the source snapshot;
- classify the language hint and select supported, empty, unsupported, or plain
  code behavior;
- load and run the syntax highlighter when available;
- produce readable plain-code fallback when highlighting is unavailable;
- generate highlighted or plain code HTML, static styles, the initial Copy
  control, and the Declarative Shadow DOM response;
- produce the initial non-copied visual state and the logical handoff records
  required by a client-rooted stable block.

*Client responsibilities*:

- admit a root and instance only after the accepted handoff and artifact checks;
- resolve the existing host and Copy control;
- initialize client-owned `copied = false` state after successful activation;
- bind one listener and update only Copy-control state;
- pass the handoff's `normalized-source` to the Clipboard API;
- own operation generations, the reset timer, and activation cleanup.

There are no shared executable responsibilities in the first stable vertical
slice. The browser does not rerun the component body, source selection,
normalization, syntax highlighting, static DOM generation, placement analysis,
  or code generation. The separate client-reactive profile contains a separate
client-safe update closure, but it must not re-execute the arbitrary component
body or import a server-only highlighter.

=== Initial support profile boundary

The stable scenario documented below is the first proof step, not the complete
DocCodeBlock support guarantee. Initial execution-partitioning support includes
both profiles:

- The stable-snapshot profile supports a normalized source snapshot that remains
  stable from server render through client activation and disposal. Its client
  closure owns Copy interaction only.
- The client-reactive profile treats the SSR result as an initial baseline. Its
  client closure owns the reactive source or language dependency and the
  client-safe update work required to keep displayed source, highlighting,
  language presentation, and clipboard source consistent.
- The placement plan must distinguish the stable Copy closure from the
  client-reactive update closure. Runtime behavior must not expand the stable
  closure after an update is observed.
- A source or language value that can change in the browser is not rejected
  merely because it is reactive. The compiler selects the client-reactive
  profile when its accepted evidence supports that profile.
- If no accepted profile can own a browser-visible revision, the result receives
  a profile-specific `partition` diagnostic and no block artifact is emitted.
  It is not silently frozen into the stable profile and it is not moved into the
  server-only closure.
- #222 defines the reactive observable contract, revision consistency, and
  client-safe update closure. #224 implements and validates that profile after
  the stable artifact and activation baseline. Server-owned revision delivery
  remains a separate explicitly specified profile.

The integrated behavior contract in this document intentionally exercises the
stable-snapshot profile only. A reactive profile must satisfy the profile
boundary above, but its revision state machine and concrete handoff are not
silently implied by the stable one-snapshot contract.

=== Stable handoff and identity

Each client-rooted stable DocCodeBlock is associated with one logical handoff
record in its activation root:

- The server assigns a local sequential `activation-instance-id` within the
  `activation-root` during one render.
- The effective instance identity is the pair
  `(activation-root, activation-instance-id)`. It is not build-global,
  session-global, source-derived, or document-global.
- The root-scoped handoff table maps local instance IDs to the exact
  `normalized-source` values produced by server analysis.
- The root marker, instance marker, SSR display, and handoff table originate
  from one logical render result. A marker and table from different render
  results cannot be combined.
- The client resolves the root marker first and resolves instance markers only
  within that root. It never reconstructs source from highlighted DOM and never
  performs a server request on Copy.
- The handoff is response-scoped and activation-scoped. The client retains the
  normalized source only while the activation owns the corresponding block.
- Disposal releases the source reference. There is no global source cache,
  cross-route registry, reusable record, acknowledgement channel, or implicit
  revision channel.
- The handoff has a per-block cap and an activation-root total cap. Exact values
  and encoded-size measurement belong to #115 and #119. Exceeding a cap fails
  the stable build or render rather than omitting source, fetching it on click,
  or emitting a partial block.
- Canonical Identity and Module Graph facts remain compiler provenance. They may
  explain how a handoff was produced and may be used by analysis or placement,
  but neither is sent to the browser as a stable handoff field.

Equal source strings in two blocks do not merge their host identity, lifetime,
listener, timer, or failure scope. The source-content identity language in the
earlier #107 decisions is not used as the client host identity or as a client
integrity protocol.

=== Client-root classification and artifacts

Classification is based on the complete accepted analysis and placement result,
not on rendered DOM discovery:

- A component instance is one rendered occurrence. A module name, import path,
  route URL, or DOM shape is not instance proof.
- A reactive read during a stable server snapshot does not create a client root
  by itself. A browser-visible post-SSR revision requires an accepted
  client-reactive or explicitly selected server-owned delivery profile.
- A stable DocCodeBlock with client-owned Copy behavior has a client root even
  when the server highlighter falls back to plain code.
- The route root set is the union of client-root requirements from every
  rendered component instance in the complete accepted route plan.
- Route aggregation does not merge activation-root identity, instance identity,
  handoff lifetime, source ownership, or failure scope.
- Missing, stale, contradictory, or unsupported placement evidence is a
  `partition` failure. It is not evidence of a zero-client-root route.
- A route is zero-client-root only when every relevant instance has a complete
  accepted result and the resulting client-root set is empty.

The logical server artifact includes:

- the server render entry and transitive server render closure;
- source acquisition, selection, normalization, language handling, and
  highlighting or readable plain-code fallback;
- static styles, code DOM, the initial Copy control, and Declarative Shadow DOM;
- the coordinated root and instance records and stable handoff records required
  by client-rooted DocCodeBlock instances.

The logical server artifact excludes client Clipboard interaction, copied state,
listeners, timers, operation generations, activation cleanup, client bootstrap,
and browser re-execution of server work.

The logical client artifact includes only the accepted client closure:

- client entry or bootstrap admission when the route has at least one client
  root;
- root preflight, artifact admission, and root-scoped handoff validation;
- stable DocCodeBlock host and Copy-control binding, normalized-source
  consumption, copied state, Clipboard API interaction, generation checks,
  reset-timer ownership, and disposal cleanup;
- the smallest accepted client-reactive closure when another profile is selected.

The stable logical client artifact excludes the server-only syntax highlighter
and every transitive server-only dependency, server source analysis,
stable-profile source normalization, server rendering, arbitrary component-body
re-execution, placement analysis, code generation, unrelated component
instances, unrelated server data, click-time source requests, and implicit
legacy fallback. A client-reactive artifact may include client-safe highlighting
and update dependencies defined by #222, but it may not reach the server-only
highlighter.

For a zero-client-root route, server rendering and SSR HTML may be emitted, but
the logical result contains no client entry reference, bootstrap, activation
manifest, root marker, instance marker, handoff table, initial-response handoff
payload, or reachable client dependency closure for this profile. An empty
placeholder client artifact is not emitted.

For a client-rooted route, the emitter produces the minimum coordinated logical
server and client closures and records required by the accepted client roots.
The concrete physical representation remains owned by #119. A physically shared
build chunk does not make a route logically client-rooted when that route's own
complete root set is empty.

=== Atomic emission and failure boundary

The logical planning states are distinct:

- `route-unclassified`: not all relevant instances have accepted analysis and
  profile results; no zero-root or client-output decision is allowed;
- `server-analysis-failed`: source acquisition, source evaluation,
  normalization, or the plain-code fallback failed before a stable source
  snapshot could be accepted. The route/render transaction fails through the
  `server-analysis` fatal path and the emitter does not substitute an empty or
  stale source;
- `route-classified`: every relevant instance has a complete accepted result and
  the route has a finite root set;
- `zero-client-root`: the classified root set is empty and only server output is
  planned;
- `client-rooted`: the classified root set is non-empty and minimum logical
  client output is planned;
- `artifacts-planned`: every logical output record and closure boundary exists;
- `emitting`: one coordinated logical result is being produced;
- `committed`: the complete result passed emission validation;
- `partition-failed` and `emit-failed`: no accepted result may be committed.

Before response commitment, a `server-analysis`, `partition`, or `emit` fatal
fails the enclosing route/render transaction atomically. The emitter does not:

- silently omit an affected block;
- freeze a source known to require another execution owner;
- substitute an empty or stale source;
- reuse an older artifact;
- publish partial bootstrap, markers, or handoff data; or
- defer source retrieval to a Copy click.

After response delivery, a root-level artifact or handoff mismatch rejects that
activation root, an instance-level mismatch rejects only that instance, and
independent roots remain eligible. The delivered SSR code and static styles stay
readable.

=== Activation lifecycle and interaction

One stable activation instance has these states:

- `inactive / eligible`: server DOM exists and a valid activation may still
  commit; events are ignored;
- `inactive / rejected`: admission or setup failed while the root is live; no
  listener, state owner, timer, or active source reference exists and retry for
  that emitted instance is a no-op;
- `active / idle`: activation succeeded, `copied = false`, and no operation or
  reset timer is pending;
- `active / pending(n)`: operation generation `n` is pending and the control
  remains in the not-copied state;
- `active / copied(n)`: generation `n` fulfilled and the control displays
  `Copied!` with one reset timer;
- `active / failed(n)`: the current Clipboard operation failed and the failure
  result is retryable according to #109;
- `disposed`: terminal state with no listener, timer, state, or source owner.

Activation follows one commit boundary:

1. Resolve the compiler-generated root and instance markers.
2. Validate artifact admission, the root-scoped handoff table, the host, and the
   Copy control.
3. Recheck root, host, and control liveness immediately before committing.
4. Create one root-scoped activation owner with `copied = false`.
5. Register cleanup and one Copy listener as one commit, rolling back partial
   setup on failure.
6. Leave the server-rendered code subtree, styles, source display, scroll
   position, and DOM identity unchanged.

An event before successful activation is ignored. It is not queued, replayed, or
converted into a synthetic click. Repeated activation for an already active
instance is idempotent and does not create another owner, listener, state, or
timer.

Each accepted click in an active instance receives a strictly increasing local
`operation-generation`:

- starting a new operation invalidates the previous reset timer and enters the
  pending state;
- the handoff's normalized source is passed to the Clipboard API;
- `Copied!` appears only when the current generation fulfills while the instance
  is active;
- an older fulfillment cannot display `Copied!`, schedule a reset timer, or
  change visible state;
- a synchronous exception or rejected promise cannot enter the success state or
  schedule the success reset timer;
- while the operation is pending, the ordinary not-copied label remains valid;
- a current reset-timer event returns the current generation to the not-copied
  state, while a stale timer is a no-op.

Disposal is idempotent and terminal. It invalidates the current generation,
removes the listener, clears or invalidates the timer, releases the normalized
source reference, and prevents delayed activation from creating an owner. A
Clipboard promise or timer that settles after disposal is ignored and cannot
change DOM, state, or timer ownership. The server-rendered code is never
rewritten by cleanup.

=== Failure ownership and containment

The earliest phase that can establish a failure owns its outcome:

- `server-analysis` owns source acquisition, source normalization, language
  classification, and highlighter availability or failure;
- `partition` owns missing or contradictory analysis evidence and the absence of
  an accepted execution profile for a client-visible revision. Unsupported
  component or program syntax and missing profile proof are partition outcomes;
  they are distinct from an unsupported language hint, which remains a readable
  `server-analysis` fallback;
- `emit` owns incomplete, non-deterministic, capped, or internally inconsistent
  server/client artifacts;
- `activation` owns root and instance admission, host and control lookup,
  Clipboard failure, and callbacks after the activation owner has ended.

The logical outcome classes are:

- `fallback`: continue with a result that preserves the accepted invariants;
- `fatal`: stop the current server, partition, or emission transaction before a
  misleading result is produced;
- `rejected`: preserve delivered SSR content but install no failed activation;
- `retryable`: keep a live activation and expose a failed browser operation that
  a later user action may retry;
- `ignored`: treat stale or post-disposal work as a terminal no-op.

Diagnostics preserve phase and category separately from the component-facing
result. The final diagnostic interface and wording remain outside this
consolidation, but the logical categories are already part of this contract:

- `server-analysis` distinguishes `source-unavailable`,
  `unsupported-language`, and `highlight-fallback`;
- `partition` distinguishes missing, contradictory, tampered, or out-of-scope
  evidence, `unsupported-execution-profile`, and unsupported component or
  program syntax;
- `emit` distinguishes a missing plan field, invalid artifact or root/instance
  association, cap violation, incomplete or inconsistent output, and
  non-deterministic emission;
- `activation` distinguishes root or instance admission failure and
  `clipboard-failure`. Stale or late work has the `ignored` outcome and is not
  emitted as a diagnostic.

These developer-facing categories do not replace user-visible results. In
particular, a failed Clipboard operation exposes a visible retryable failure
state with an accessible name that identifies the failure and retry action,
while a post-disposal callback is intentionally ignored and produces no active
operation diagnostic. The clipboard-failure diagnostic reports only its stable
category and does not expose source text or permission details. Root and
instance admission diagnostics do not expose source contents.

The containment rules are:

- source acquisition or normalization failure is a route/render-scoped
  `server-analysis` fatal;
- unsupported language and highlighter failure are readable server fallbacks
  when the normalized source exists;
- unsupported or unproven execution profile is a `partition` fatal before
  emission and does not become a silent stable snapshot;
- incomplete or inconsistent artifact output is an `emit` fatal before
  commitment and publishes no affected partial output;
- root admission failure rejects all instances in that root before any owner is
  created;
- instance admission failure rejects only that instance after root preflight;
- Clipboard absence, denial, synchronous throw, or rejection affects only the
  active instance, exposes an accessible retryable failure state, and never
  displays `Copied!` or schedules a success reset timer;
- stale completion, stale timer, pre-commit disposal, and post-disposal callback
  are ignored without reviving ownership.

Failure handling never repairs a missing proof by searching arbitrary DOM,
using a sibling's handoff, fetching source on click, importing a server-only
highlighter, or replaying the component body in the browser.

== Integrated behavior contract

#behavior_spec(
  name: "DocCodeBlock stable-snapshot acceptance scenario",
  summary: [
    A server-rendered DocCodeBlock remains readable without client JavaScript,
    and a valid client activation copies the exact normalized source belonging to
    its own block without rerendering the displayed code.
  ],
  preconditions: [
    - the route has a complete accepted analysis and placement result for every
      rendered component instance
    - the selected profile is the stable-snapshot profile
    - the source snapshot and optional language hint are available to server
      analysis
    - for a client-rooted stable block, the root marker, instance marker,
      artifact admission, host, Copy control, and root-scoped handoff are
      coordinated from one logical render result
  ],
  steps: [
    1. Server analysis selects and normalizes the source and produces highlighted
       or readable plain-code output.
    2. Classification derives the route client-root set from complete accepted
       component-instance evidence.
    3. The emitter publishes either server-only zero-root output or a complete
       coordinated rooted result.
    4. SSR presents readable code, language presentation when applicable, and an
       accessible Copy control before client activation.
    5. Client activation validates the root, instance, handoff, artifact, host,
       and control, then commits one owner and one listener without replacing
       the display.
    6. The user activates Copy and the client passes that instance's
       normalized-source to the Clipboard API.
    7. The current successful fulfillment displays `Copied!`; the current reset
       timer later returns the control to `Copy`.
    8. Repeated clicks, out-of-order completion, activation failure, Clipboard
       failure, and disposal follow the generation and failure rules above.
  ],
  postconditions: [
    - visible code, language presentation, highlighting or plain-code fallback,
      and the code-display DOM identity remain stable during Copy activation
    - two blocks with equal source remain independent activation instances
    - a zero-client-root route emits no logical client execution output
    - a failed or stale operation cannot appear as a successful current copy
    - a disposed activation owns no listener, timer, state, or source reference
  ],
  errors: [
    - source, partition, or emission fatal before response commitment fails the
      enclosing transaction atomically
    - root or instance admission failure preserves delivered SSR readability and
      installs no partial behavior
    - Clipboard failure exposes the #109 retryable failure outcome and never
      enters `Copied!`
    - stale, pre-activation, or post-disposal work is ignored
  ],
)

== Rejected approaches for this scenario

The following approaches are explicitly not adopted by the integrated
stable-snapshot scenario. A separate accepted profile must preserve the shared
boundaries and record its own revision contract.

- Re-execute the arbitrary component body in the browser.
- Run the server-only syntax highlighter in both environments.
- Derive source from highlighted DOM.
- Fetch source from the server on Copy.
- Use a document-global source registry or source-content identity as host
  identity.
- Treat every reactive read as unsupported.
- Silently freeze a source that analysis proves will change after SSR.
- Emit client artifacts unconditionally and decide at runtime whether they are
  needed.
- Treat missing placement or analysis evidence as zero-client-root.
- Publish a partial server result without its required client handoff.
- Reuse an older artifact or repair a mixed render result at runtime.
- Treat source acquisition failure as an empty source.
- Fail the route for a highlighter-only failure when readable plain code is
  available.
- Queue and replay pre-activation events.
- Display `Copied!` before current Clipboard fulfillment.
- Accept stale Clipboard completion or timer callbacks.
- Allow late callbacks to mutate a disposed instance.
- Fail all independent activation roots because one root failed after response
  delivery.

== Evidence and adoption map

The detailed acceptance evidence matrix belongs to #112. This document fixes
the outcomes that evidence must observe and identifies the specification and
test destinations that must adopt them before production implementation begins.

=== Evidence layers

*Unit evidence* must cover source normalization, empty and unsupported language
outcomes, highlighter fallback, source failure, profile selection, missing
analysis, artifact inconsistency, handoff admission, target lookup, Clipboard
absence or rejection, current success, stale completion, and disposal.

*Integration evidence* must cover the handoff from analysis to partition and
emission, atomic pre-commit failure, highlighter fallback with stable source,
root and instance admission, and consumption of a complete logical render
result.

*Artifact evidence* must inspect transitive dependency reachability and emitted
metadata. It must prove that the highlighter remains server-only, that complete
handoff records are emitted together, that partial or old-artifact fallback is
absent, and that a zero-client-root route emits no client output.

*Browser evidence* must observe readable SSR output, activation without DOM
replacement, keyboard and pointer Copy behavior, pre-activation event ignoring,
out-of-order operations, timer invalidation, failure retry, multiple independent
blocks, root and instance containment, and disposal with late callbacks.

=== Specification and test transfer targets

The following is a transfer inventory, not a new ownership decision:

- `docs/src/components/DocCodeBlock/SPEC.typ` and
  `docs/src/components/DocCodeBlock/implementation.test.ts`: proposed new
  feature-level targets for observable source, language, display, Copy,
  failure, and lifecycle behavior. Neither file exists in the current
  directory; the eventual owner and whether this docs feature follows the
  package convention must be resolved before production migration.
- `packages/transformer/src/transform/SPEC.typ` and
  `packages/transformer/src/transform/implementation.test.ts`: current
  cross-cutting targets for server-analysis evidence, execution-profile
  selection, partition failure, component-instance classification, and the
  distinction between stable snapshot, client-reactive, and server-owned
  delivery. The repository has no dedicated `server-analysis` or `partition`
  feature directory yet; creating one is a later ownership decision.
- `packages/runtime/src/ssr/markers/SPEC.typ` and
  `packages/runtime/src/ssr/markers/implementation.test.ts`, together with
  `packages/runtime/src/ssr/serialize/SPEC.typ` and
  `packages/runtime/src/ssr/serialize/implementation.test.ts`: logical root and
  instance markers, handoff representation, and response scoping when those
  modules own the concrete representation. The corresponding concrete render
  targets are `packages/runtime/src/ssr/render/SPEC.typ` and
  `packages/runtime/src/ssr/render/implementation.test.ts`; hydration state
  decoding targets are `packages/runtime/src/hydration/deserialize/SPEC.typ`
  and `packages/runtime/src/hydration/deserialize/implementation.test.ts`.
- `packages/runtime/src/hydration/hydrate/SPEC.typ` and
  `packages/runtime/src/hydration/hydrate/implementation.test.ts`:
  activation-root preflight, instance admission, existing-DOM binding,
  generation checks, timer invalidation, cleanup, and terminal disposal. The
  existing generic `hydrateIslands` and colocated-action replay specifications
  are separate contracts; they do not authorize replaying a DocCodeBlock event
  before activation.
- `packages/components/src/ssr/SPEC.typ` and
  `packages/components/src/ssr/implementation.test.ts`, plus
  `packages/components/src/defineComponent/SPEC.typ` and
  `packages/components/src/defineComponent/implementation.test.ts`: transfer
  the server-rendered initial DOM, Declarative Shadow DOM, static styles, and
  component cleanup boundary only where those package contracts own the
  behavior.
- `packages/plugin/src/plugin/SPEC.typ` and
  `packages/plugin/src/plugin/implementation.test.ts`: build-mode propagation,
  logical server/client closure integration, artifact emission admission, and
  zero-client-root build evidence when the plugin owns that integration. The
  repository has no dedicated `emit` feature directory yet; #119 must establish
  the concrete emitter specification and test owner before emitter
  implementation.
- `packages/core/src/ssr/SPEC.typ` and
  `packages/core/src/ssr/implementation.test.ts`, together with
  `packages/core/src/hydration/SPEC.typ` and
  `packages/core/src/hydration/implementation.test.ts`: transfer only public
  wrapper or cross-package contract changes that are actually introduced by the
  accepted implementation. This Task does not authorize a public API.
- `docs/src/entry-client.ts` and `docs/index.html`: use as integration evidence
  targets for the documentation route, not as the logical specification source.

Each adopted behavior must be written into the responsible `SPEC.typ` before
the corresponding implementation changes, and each acceptance behavior must
have a matching executable test or explicitly assigned artifact or browser
evidence. This map does not authorize creating package APIs or selecting a
module owner where the repository has not yet made that decision.

== Acceptance coverage

The Task acceptance criteria are satisfied by the following document evidence:

- *Traceable references to every Accepted Proposal*: the Decision sources
  section, the source links in the document metadata, and the per-contract
  references to #105 through #110.
- *Consistent terminology, responsibility, identity, and lifetime*: the
  Precedence and terminology section, the source-to-contract mapping, the
  server/client responsibility section, and the integrated lifecycle and
  failure rules.
- *No unresolved item recorded as accepted*: the Open Questions metadata, the
  deferred ownership described above, and the explicit separation of stable,
  client-reactive, and server-owned profiles.
- *No dependency on current production file placement*: the consolidated
  contract uses logical phases, profiles, roots, instances, and artifacts. File
  paths appear only in the adoption map as transfer targets.
- *Standalone reviewability*: this file contains the integrated scenario,
  evidence requirements, rejected approaches, deferred ownership, and complete
  source references without requiring the Issue body to serve as the design
  record.

== Adoption gate

Before artifact generation or production migration begins, the responsible
package or feature specifications and executable tests must adopt the relevant
parts of this scenario. #112 must map every outcome to reproducible evidence.
#115, #118, #119, #120, #126, #222, #224, and #231 may refine only the areas
explicitly assigned to them; they must not weaken the stable handoff, lifetime,
failure containment, or zero-client-root boundaries recorded here.
