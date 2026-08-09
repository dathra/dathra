#import "../../functions.typ": *
#import "../../settings.typ": *
#show: apply-settings

#design_proposal(
  issue: 110,
  name: "DocCodeBlock artifact and zero-client-root rules",
  summary: [
    This proposal defines the logical server and client artifact boundary for
    the stable-snapshot DocCodeBlock profile and the conditions under which a
    route has no client root. It consumes the accepted behavior, responsibility,
    handoff, lifetime, and failure contracts from #105 through #109. It defines
    logical ownership and evidence boundaries without selecting a bundler,
    concrete encoding, chunk naming, or production implementation.
  ],
  scope: [
    - client-root classification for each rendered component instance
    - aggregation of client-root requirements at a route/render boundary
    - server and client artifact inclusion and exclusion rules
    - root-scoped markers, handoff records, and client-entry admission
    - zero-client-root output conditions
    - artifact closure, determinism, partial-emission, and failure evidence
    - the relation between logical route output and later physical bundling
  ],
  non_goals: [
    - implement a compiler, partitioner, artifact emitter, activation runtime,
      or production DocCodeBlock migration
    - choose Vite, webpack, Rollup, or another bundler adapter
    - choose chunk names, file names, or physical module coalescing rules
    - choose concrete manifest, marker, entry, or handoff serialization
    - choose exact encoded-size caps or measurement algorithms
    - define the client-reactive revision protocol owned by #222
    - define server-owned revision delivery, subscription, or streaming
    - define the concrete diagnostic interface or user-facing wording
    - define the copied-state reset delay
  ],
  open_questions: [
    - #115 defines the accepted analysis subset, execution-profile proof,
      provenance, and analysis resource caps consumed by root classification.
    - #118 defines the Execution Graph and placement plan that supplies the
      accepted root set and dependency closures.
    - #119 defines concrete artifact encoding, entry and marker representation,
      handoff serialization, artifact identity, emitter caps, determinism, and
      build integration.
    - #120 validates the integrated artifact and activation behavior in the
      production vertical slice.
    - #126 defines the concrete diagnostic interface and final user-facing
      failure wording.
    - #222 defines client-reactive revision ownership and its client-safe update
      closure; #224 consumes that contract in Core validation.
    - #231 defines the copied-state reset delay.
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

== Decision

#adr(
  header("Component-root classification and route aggregation", Status.Accepted, "2026-08-09"),
  [
    A route can contain several component instances, activation roots, and
    execution profiles. A route-level client artifact must not become a route-level identity or
    lifetime scope. Conversely, deciding client output by
    scanning rendered DOM would lose the compiler evidence needed to exclude
    server-only work and to distinguish a missing proof from a genuine absence
    of client behavior.
  ],
  [
    Use component-instance classification as the logical ownership boundary:

    - A *component instance* is one rendered occurrence of a component. A
      component module name, import path, route URL, or DOM shape is not an
      instance proof.
    - A *client root* is a logical client-execution requirement produced by the
      accepted analysis and placement result. It exists only when the result
      proves client-owned behavior after SSR, such as stable DocCodeBlock copy
      activation or a supported client-reactive update closure.
    - A reactive read during a stable server snapshot does not create a client
      root by itself. A client-visible post-SSR revision requires a supported
      client-reactive or explicitly selected server-owned delivery profile.
    - A highlighter failure or unsupported language uses the accepted readable
      plain-code server fallback. It does not remove the client root required by
      copy activation and does not add a client highlighter dependency.
    - An *activation root* remains the runtime scope from #107 that owns a
      root-scoped handoff table and activation lifetime. A client root is a
      placement requirement; it is not a replacement name for an activation
      root.
    - The route/render boundary forms the union of client-root requirements from
      every rendered component instance in the complete accepted route plan.
      The route is an aggregation boundary only. It does not merge
      activation-root identity, instance identity, handoff lifetime, failure
      scope, or source ownership.
    - An omitted or unknown component instance is incomplete analysis evidence
      and therefore a `partition` failure. It cannot be treated as a
      server-only instance or excluded from the root set.
    - Classification completes after the route has a complete accepted plan and
      before artifact emission or response commitment. Missing, stale,
      contradictory, or unsupported evidence is a `partition` failure, not an
      empty client-root set.
    - A route is *zero-client-root* only when the complete accepted plan exists,
      every rendered component instance requires no client-owned behavior, and
      the resulting client-root set is empty.

    This Proposal defines the stable DocCodeBlock handoff and artifact boundary.
    Another accepted client-root component can make a route client-rooted, but
    its own handoff fields and activation contract must come from that
    component's accepted Proposal. This Proposal does not invent a DocCodeBlock
    handoff record for an unrelated component.
  ],
  [
    This is option 1 from Issue #110. It preserves per-instance and
    root-scoped guarantees while allowing a later emitter to coalesce physical
    client modules. The route-level predicate is derived from the classified
    root set and never from runtime discovery.

    The concrete stable profile has a client root for a DocCodeBlock whose copy
    behavior is client-owned, even when its server-side highlighter falls back
    to plain code. A route without DocCodeBlock is not necessarily zero-root;
    another accepted client-root component makes it client-rooted.
  ],
  alternatives: [
    1. *Route-level classification*: A route-level predicate is acceptable only
       when it is derived from the same per-instance accepted root set and all
       closures, handoff records, and failure scopes remain filtered per root.
       In that form it is only a packaging description of this decision. A
       route-level decision that includes all route dependencies is rejected
       because it weakens server-only exclusion and root isolation.
    2. *Always emit client artifacts and decide at runtime*: Rejected because it
       violates the zero-client-root acceptance criterion, creates avoidable
       bootstrap and payload output, and delays missing placement or dependency
       proof until runtime.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/105")[#105],
    link("https://github.com/dathra/dathra/issues/106")[#106],
    link("https://github.com/dathra/dathra/issues/107")[#107],
    link("https://github.com/dathra/dathra/issues/109")[#109],
    link("https://github.com/dathra/dathra/issues/115")[#115],
    link("https://github.com/dathra/dathra/issues/118")[#118],
    link("https://github.com/dathra/dathra/issues/222")[#222],
  ),
)

#adr(
  header("Logical server and client artifact boundaries", Status.Accepted, "2026-08-09"),
  [
    The accepted responsibility split in #106 requires the server to produce
    readable initial output and the client to attach copy behavior. The client
    must receive the logical stable handoff from #107 without rerunning source
    selection, normalization, highlighting, component execution, or placement.
  ],
  [
    Define the logical closures and response records as follows:

    *Server artifact includes*:

    - the server render entry and its transitive server render closure
    - source acquisition, selection, normalization, language handling, and
      syntax highlighting or readable plain-code fallback
    - static styles, highlighted or plain code DOM, the initial `Copy` control,
      and Declarative Shadow DOM output
    - for a stable DocCodeBlock root, compiler-generated root and instance
      marker data and the root-scoped handoff records required by #107, produced
      from the same logical render result as the SSR output
    - for another client-root component, only the records required by that
      component's accepted contract

    *Server artifact excludes*:

    - client clipboard interaction, copied state, listeners, timers, operation
      generations, and activation cleanup
    - client bootstrap, client activation runtime, and client-only update
      closures
    - any browser re-execution of component bodies, source analysis, placement,
      or code generation

    *Client artifact includes only the accepted client closure*:

    - client entry or bootstrap admission when the classified route has at least
      one client root
    - root preflight, artifact identity admission, and root-scoped handoff
      validation required by the selected accepted contract
    - for a stable DocCodeBlock root, instance-to-host and copy-control binding,
      normalized-source consumption, client-owned copied state, Clipboard API
      interaction, operation-generation checks, reset-timer ownership, and
      disposal cleanup from #108
    - the smallest accepted client-reactive update closure when that initial
      support profile is selected; #222 owns its revision and atomicity details

    *Client artifact excludes*:

    - the syntax highlighter and every transitive server-only dependency
    - server source acquisition, stable-profile source normalization, and
      server rendering from a stable DocCodeBlock client closure
    - arbitrary component-body re-execution, placement analysis, and code
      generation
    - unrelated component instances, unrelated server data, click-time source
      requests, and implicit legacy fallback

    *Logical response records*:

    - For stable DocCodeBlock roots, each activation root has its own
      root-scoped handoff table and each client-root block has its own instance
      binding, even when a route-level physical artifact later aggregates them.
      Other client roots use the records defined by their own accepted contract.
    - A handoff table contains only the values required by the accepted profile.
      It does not become a global source registry, cross-route cache, revision
      channel, or server closure payload.
    - A zero-client-root route has no client entry reference, bootstrap,
      activation manifest, root marker, instance marker, handoff table,
      initial-response handoff payload, or client dependency closure for this
      execution-partitioning profile.

    For Issue #110's `request payload` term, this Proposal uses
    *initial-response handoff payload*. It means response data coordinated with
    the rendered response. It never means client-to-server data and does not
    authorize a network request on Copy. The term does not select a concrete
    wire encoding.
  ],
  [
    The logical client-closure exclusion applies even if a later bundler
    physically coalesces several client roots. Artifact evidence must inspect
    transitive dependency reachability and emitted metadata rather than relying
    only on source-string or chunk-name searches.

    Concrete manifest, marker, entry, and handoff encoding; artifact identity;
    encoded-size measurement; emitter caps; determinism; and bundler integration
    remain owned by #119. The logical inclusion and exclusion rules above are
    not deferred.
  ],
  alternatives: [
    1. *Re-execute the component in the browser*: Rejected because it leaks
       server-only rendering and highlighting into the client closure and can
       observe a different source than the server snapshot.
    2. *Read source from highlighted DOM*: Rejected because highlighted markup
       is not the normalized-source handoff and can change whitespace or bind
       the wrong instance.
    3. *Fetch source on Copy*: Rejected because it adds network authority and
       availability semantics that the stable profile does not define.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/106")[#106],
    link("https://github.com/dathra/dathra/issues/107")[#107],
    link("https://github.com/dathra/dathra/issues/108")[#108],
    link("https://github.com/dathra/dathra/issues/119")[#119],
    link("https://github.com/dathra/dathra/issues/222")[#222],
  ),
)

#adr(
  header("Zero-client-root output and emission atomicity", Status.Accepted, "2026-08-09"),
  [
    #109 assigns incomplete or non-deterministic artifact output to the emit
    phase and requires failure containment before and after response commitment.
    A missing client root is a successful result only after the complete plan
    proves that no client-owned behavior exists. It must not be used to hide a
    missing proof or an accidentally omitted artifact.
  ],
  [
    Use the following logical planning states for one route/render transaction:

    - `route-unclassified`: relevant component instances or execution profiles
      have not all received an accepted analysis result. No zero-root decision
      or client artifact decision is allowed.
    - `server-analysis-failed`: source acquisition, source evaluation, or source
      normalization, or the plain-code fallback failed before a stable snapshot
      could be accepted. The route/render transaction fails through the
      `server-analysis` fatal path; the emitter does not substitute an empty or
      stale source. A highlighter failure with an available normalized source is
      the accepted readable fallback, not this state.
    - `route-classified`: every relevant instance has a complete accepted result
      and the route has a finite client-root set.
    - `zero-client-root`: the classified set is empty. The route may emit server
      artifacts and SSR HTML, but emits none of the client outputs listed in
      this proposal.
    - `client-rooted`: the classified set is non-empty. The emitter plans the
      minimal server and client closures and the coordinated root and instance
      records for those roots.
    - `artifacts-planned`: all logical output records and closure boundaries
      required by the accepted plan are present.
    - `emitting`: the emitter is producing one coordinated logical result.
    - `committed`: the complete result has passed emission validation and may be
      committed to the response or build output.
    - `partition-failed`: classification lacks accepted evidence or a supported
      execution profile. No accepted placement plan exists.
    - `emit-failed`: the plan is incomplete, inconsistent, over a named cap, or
      non-deterministic. No affected client output is published.

    Before response commitment, a `server-analysis`, `partition`, or `emit` fatal fails the
    enclosing route/render transaction atomically. It does not silently omit a
    block, freeze a stale snapshot, reuse an older artifact, emit partial
    bootstrap or handoff data, or defer source retrieval to a Copy click.

    After response delivery, an artifact or handoff mismatch is handled by
    #109 and #108: a root-level failure rejects that activation root, an
    instance-level failure rejects only that instance, and independent roots
    remain eligible. SSR-rendered code and static styles remain readable. No
    listener, state owner, timer, or source reference is installed for a
    rejected instance.

    A cache may replay one complete logical render result, including its
      coordinated server output, root and instance records, handoff data, and
      artifact identity. It may not combine HTML, markers, handoff data, or client
      artifacts from different render results.

    A physically shared build chunk may exist because another route has a
    client root. That shared physical artifact does not make this route
    client-rooted. The zero-client-root rule applies to this route's logical
    response and reachable client closure.
  ],
  [
    The state model separates a successful zero-root result from partition and
    emission failure. It also keeps route aggregation separate from the
    root-scoped activation lifetime and failure scope already accepted by #107,
    #108, and #109.
  ],
  alternatives: [
    1. *Emit a partial server result and omit client handoff*: Rejected because
       it silently turns a client-root block into inert output and hides an
       emission defect.
    2. *Allow runtime discovery to repair missing output*: Rejected because it
       violates compiler-generated association, fail-closed activation, and the
       no-browser-replay contract.
    3. *Fail every independent root after response delivery*: Rejected because
       #109 requires root- and instance-scoped containment after delivery.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/107")[#107],
    link("https://github.com/dathra/dathra/issues/108")[#108],
    link("https://github.com/dathra/dathra/issues/109")[#109],
    link("https://github.com/dathra/dathra/issues/119")[#119],
    link("https://github.com/dathra/dathra/issues/120")[#120],
  ),
)

== Behavior Contract

#behavior_spec(
  name: "zero-client-root route",
  summary: [
    A route with a complete accepted plan and no client-root requirement emits
    server output without client execution artifacts.
  ],
  preconditions: [
    - every rendered component instance in the complete accepted route plan has
      a complete accepted profile result
    - the resulting client-root set is empty
  ],
  postconditions: [
    - server rendering and SSR HTML may be emitted
    - no client entry, bootstrap, activation manifest, root marker, instance
      marker, handoff table, initial-response handoff payload, or client
      dependency closure is emitted
    - an empty placeholder client artifact is not emitted
  ],
  errors: [
    - missing or contradictory classification evidence is `partition-failed`,
      not `zero-client-root`
  ],
)

#behavior_spec(
  name: "client-rooted route aggregation",
  summary: [
    A route with one or more accepted client roots emits the minimum logical
    client output for those roots while preserving root-scoped ownership.
  ],
  preconditions: [
    - every rendered component instance in the complete accepted route plan has
      a complete accepted profile result
    - at least one instance has an accepted client-root requirement
  ],
  postconditions: [
    - server and client closures follow the inclusion and exclusion rules
    - a stable DocCodeBlock root emits the client entry or bootstrap, activation
      manifest, root and instance markers, and initial-response handoff payload
      required by #107, subject to #119's concrete encoding
    - another client-root component emits only the records required by its own
      accepted contract; this Proposal does not invent its handoff fields
    - each activation root keeps its own handoff table and lifetime
    - each client-root instance keeps its own host association and owned values
    - unrelated server-only component work is not included in the client closure
  ],
  errors: [
    - a missing, duplicate, stale, or mismatched logical record fails emission or
      activation according to the phase and response-commit boundary
  ],
)

#behavior_spec(
  name: "server-analysis source and language outcomes",
  summary: [
    Server analysis preserves the accepted readable result for normal and
    presentation-only input conditions while failing closed when the source
    snapshot itself cannot be established.
  ],
  preconditions: [
    - the server evaluates a DocCodeBlock source and optional language hint
  ],
  postconditions: [
    - absent `children` and absent `code` produce the empty source snapshot
      accepted by #105
    - an empty language hint uses readable plain-code display without an
      unsupported-language diagnostic
    - an unsupported non-empty language label remains visible while the source
      uses readable plain-code fallback and receives the `unsupported-language`
      `server-analysis` diagnostic category
    - a supported non-empty language with successful highlighting produces the
      labeled highlighted display and, for a stable DocCodeBlock root, the same
      normalized-source handoff required for Copy
    - highlighter absence, loading failure, or highlighting exception falls back
      to readable plain code when the normalized source exists; a stable
      DocCodeBlock client root keeps the same copy handoff
  ],
  errors: [
    - source acquisition, source evaluation, or source normalization failure is
      a `server-analysis` fatal and does not substitute an empty or stale source
    - failure of the plain-code fallback is a `server-analysis` fatal
    - a `server-analysis` fatal emits no affected client handoff or partial
      artifact before the enclosing transaction fails
  ],
)

#behavior_spec(
  name: "artifact closure isolation",
  summary: [
    The client closure cannot reach the server-only syntax highlighter or other
    server-only dependencies, including through transitive paths.
  ],
  preconditions: [
    - a client-rooted route has a valid accepted placement plan
  ],
  postconditions: [
    - dependency metadata proves the highlighter is reachable only from the
      server closure
    - the plain-code fallback keeps the same client closure boundary
    - a closure intersection with a server-only dependency is an `emit` fatal
  ],
)

#behavior_spec(
  name: "complete-render replay",
  summary: [
    A cache may replay a complete logical render result without changing root,
    instance, handoff, or artifact association.
  ],
  preconditions: [
    - the cached result contains coordinated server output, client records, and
      artifact identity from one logical render
  ],
  postconditions: [
    - root-scoped handoff and instance bindings remain valid after replay
    - no HTML, marker, handoff, or client artifact from another render result is
      combined with the replayed result
  ],
  errors: [
    - an incomplete or mixed cached result fails emission or activation rather
      than being repaired by DOM discovery or a click-time request
  ],
)

== Route Output Matrix

The following matrix distinguishes logical route output from any later physical
bundler artifact:

- *Zero-client-root route*: The route emits server rendering and SSR HTML only.
  It emits no client entry reference, bootstrap, activation manifest, root or
  instance marker, initial-response handoff payload, or reachable client
  closure.
- *One stable DocCodeBlock client root*: The route emits the server rendering
  closure, the client copy-activation closure, the logical root and instance
  bindings, and the initial-response handoff payload required by #107. The
  concrete entry and encoding are owned by #119.
- *Multiple stable DocCodeBlock roots*: The route may aggregate their physical
  client output, but each activation root keeps its own handoff table and each
  instance keeps its own source, host, lifetime, and failure scope.
- *No DocCodeBlock with another accepted client root*: The route is not
  zero-client-root. It emits the server and client outputs required by that
  component's accepted contract. This Proposal does not invent DocCodeBlock
  handoff fields for it.
- *Stable DocCodeBlock with highlighter fallback*: The route remains
  client-rooted because Copy is client-owned. The server emits readable plain
  code and the client closure remains unable to reach the highlighter.

== Option Comparison

The selected design is option 1 from Issue #110: component-instance
classification with route-level aggregation. The route-level aggregation in
this decision is a packaging boundary only; it does not replace the logical
root, instance, or closure boundaries.

*Option 1 satisfies the mandatory criteria*:

- It records separate server and client inclusion and exclusion rules.
- It uses accepted analysis and placement evidence before emission.
- It emits no client output when the complete root set is empty.
- It supports per-root transitive closure inspection for server-only exclusion.
- It distinguishes zero-root, one-root, multi-root, and unrelated-client-root
  route results.
- It leaves adapters, chunk names, concrete encodings, and production code out
  of scope.

*Option 2 is rejected as a semantic boundary*:

- A route-level predicate is safe only when derived from the same classified
  component-instance root set.
- It still needs per-root closure, handoff, identity, and failure filtering.
- Once those rules exist, route-level detection is only a packaging label for
  option 1 and cannot be the ownership boundary.

*Option 3 is rejected*:

- It emits client output for zero-client-root routes.
- It prevents pre-emission dependency and placement proof from controlling
  inclusion.
- It delays missing or inconsistent artifact handling until runtime.
- It conflicts with #107, #108, and #109's compiler-generated association and
  fail-closed activation rules.

== Criterion Results

The three Issue options are evaluated against every mandatory decision criterion
and acceptance boundary:

- *Separate inclusion and exclusion rules*: option 1 satisfies the criterion
  with per-instance closures; option 2 satisfies it only when route aggregation
  retains those per-instance closures; option 3 fails because unconditional
  output prevents the zero-root boundary from controlling inclusion.
- *Inputs and decision timing*: option 1 uses the complete accepted analysis and
  placement result before emission; option 2 is safe only with the same input;
  option 3 moves the decision to runtime and fails the pre-emission proof
  requirement.
- *Zero-client-root output*: option 1 emits no logical client output for an
  empty accepted root set; option 2 does so only when it derives the set from
  classified instances; option 3 always emits output and fails this criterion.
- *Server-only dependency evidence*: option 1 supports closure inspection per
  client root; option 2 supports it only when route aggregation remains
  filtered per root; option 3 cannot use runtime gating to repair a leaked
  client closure and fails the criterion.
- *Route expectations*: option 1 distinguishes zero-root, stable DocCodeBlock,
  multiple-root, and unrelated-client-root routes; option 2 can distinguish them
  only by retaining the same component-instance classification; option 3 gives
  zero-root and rooted routes the same initial output class and fails the
  criterion.
- *Component and route consistency*: option 1 keeps component-instance root
  ownership consistent with route aggregation and artifact boundaries; option 2
  does so only when route detection remains a derived packaging predicate;
  option 3 makes route runtime output the authority and therefore conflicts with
  component-level ownership and fail-closed artifact boundaries.
- *Non-goals*: option 1 preserves the adapter, chunk-name, and production-code
  non-goals; option 2 preserves them only as a packaging interpretation; option
  3 can preserve those textual non-goals but remains rejected by the mandatory
  artifact and zero-root criteria.

== Stress-Test Evidence

The following scenarios are mandatory evidence for this decision and are
assigned to later implementation and validation work without weakening the
current logical contract:

- A route with no DocCodeBlock and no other client root emits server output only
  and no client entry, bootstrap, manifest, marker, or handoff payload.
- A route with one stable DocCodeBlock emits the server rendering closure, the
  copy activation closure, and one logical handoff for that client root.
- Multiple DocCodeBlocks preserve independent source, host, listener, timer,
  and disposal ownership, including when normalized source strings are equal.
- A route without DocCodeBlock but with another accepted client-root component
  is not classified as zero-client-root.
- A component with a highlighter failure keeps readable plain code, its language
  presentation, and its Copy control while the highlighter remains absent from
  the client closure.
- Absent `children` and absent `code` produce the accepted empty source snapshot;
  an empty language hint uses plain code without an unsupported-language
  diagnostic.
- An unsupported non-empty language label remains visible, uses readable plain
  code, and produces the `unsupported-language` server-analysis category.
- A supported non-empty language with successful highlighting preserves the
  language label, highlighted display, and stable normalized-source handoff.
- Source acquisition, source evaluation, source normalization, or plain-code
  fallback failure fails the server-analysis transaction without substituting an
  empty or stale source or emitting a partial handoff.
- A server-only rendering fixture with a highlighter fallback and an empty
  accepted root set emits no handoff or client output. A stable DocCodeBlock
  fallback is different because its Copy behavior gives it a client root.
- Missing, duplicate, stale, or mismatched root, instance, artifact, host,
  control, or handoff data fails closed without DOM guessing or source fetch.
- A root-level post-delivery mismatch rejects that root while an independent root
  remains eligible; an instance-level mismatch rejects only that instance.
- A partition or emission failure before response commitment publishes no
  partial client entry, bootstrap, manifest, marker, or handoff payload.
- A complete cached render replays successfully, while records from different
  render results cannot be combined.
- Concurrent activation requests do not create duplicate root owners, listeners,
  timers, or source references.
- Disposal during pending clipboard work or timer execution prevents late DOM or
  state changes and releases the handoff reference.
- Artifact evidence inspects dependency reachability and emitted metadata, not
  only source strings or chunk names.

== Acceptance Coverage

The Issue acceptance criteria map to this Proposal as follows:

- Separate server and client inclusion and exclusion rules are defined in the
  `Logical server and client artifact boundaries` ADR.
- Client-root inputs, the component-to-route relation, and the pre-emission
  decision point are defined in the `Component-root classification and route
  aggregation` ADR.
- Zero-client-root conditions and the absence of client bootstrap, activation
  manifest, and initial-response handoff payload are defined in the
  `Zero-client-root output and emission atomicity` ADR and its behavior
  contract.
- Server-only dependency exclusion is mapped to transitive closure evidence in
  the `artifact closure isolation` behavior contract and stress-test evidence.
- DocCodeBlock and non-DocCodeBlock route expectations are separated in the
  zero-root and client-rooted route behavior contracts.
- Bundler adapters, chunk naming, and production implementation remain explicit
  non-goals.

The positive client-rooted output rule is explicit: a non-empty accepted root
set emits the logical client entry or bootstrap, activation manifest, root and
instance bindings, and initial-response handoff payload needed by those roots.
The physical representation remains owned by #119.

== Deferred Ownership

These deferrals do not remove any current #110 requirement. The controller must
re-read each owner's current GitHub state before publishing this handoff. The
status below describes the blocking role of each owner; it does not add a
native dependency edge. The collector found #110's existing native blocking
edge to #111 and no other native dependency edge.

- #115 owns accepted analysis evidence, execution-profile proof, provenance,
  and analysis resource caps. It does not block acceptance of #110, but its
  evidence is required before concrete root classification is consumed by later
  implementation work.
- #118 owns Execution Graph and placement-plan construction. It does not block
  acceptance of #110, but it cannot produce the concrete root-selection
  consumer without this logical boundary and #115's accepted proof.
- #119 owns concrete artifact encoding, entry and marker representation,
  handoff serialization, artifact identity, encoded-size measurement, emitter
  caps, determinism, and build integration. It does not block acceptance of
  #110; it is the downstream owner of the concrete emitter contract and is not
  redefined here.
- #120 owns integrated artifact and browser validation. It consumes this
  logical acceptance boundary, does not block acceptance of #110, and does not
  replace its validation work.
- #126 owns the concrete diagnostic interface and final user-facing wording.
  It does not block acceptance of #110; #110 preserves the phase and outcome
  categories from #109 without selecting message text.
- #222 owns client-reactive revision and client-safe update semantics. Its
  current review status is separate from this decision. It does not block
  acceptance of #110; #110 applies the root and artifact classification to the
  initial client-reactive support profile without defining its revision,
  atomicity, or client-safe rendering protocol.
- #231 owns the copied-state reset delay. It does not block acceptance of #110;
  the delay does not affect artifact inclusion or zero-root classification.

No deferred item changes the current #110 decision boundary. Native Issue
relationships and blocking status remain the controller's canonical record.

== Adoption Gate

The accepted logical subset must be transferred to the responsible package
specifications and executable tests before implementation begins. #111 must
integrate this decision with the other accepted DocCodeBlock decisions, and
#112 must map every artifact, zero-root, closure, and failure outcome to
reproducible unit, integration, artifact, and browser evidence before #113
generates production artifacts.
