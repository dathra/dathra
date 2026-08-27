#import "../../functions.typ": *
#import "../../settings.typ": *
#show: apply-settings

#design_proposal(
  issue: 241,
  name: "Bounded execution partitioning with DOM activation",
  summary: [
    This proposal selects bounded execution partitioning with per-instance DOM
    activation as the execution model for the #103 goal. The compiler creates a
    finite logical plan from explicit execution semantics, the server owns the
    initial SSR result, and the client receives only the accepted behavior or
    update closure required after SSR. Client activation binds to existing
    Declarative Shadow DOM rather than rerunning an arbitrary component body.

    The selection is a design boundary, not a production implementation. The
    existing decisions in #105 through #110 remain the source of truth for the
    DocCodeBlock behavior, responsibility, handoff, lifetime, failure, and
    artifact contracts that this model consumes.
  ],
  scope: [
    - comparison of the six execution-model options in Issue #241
    - the selected server, client, compiler, runtime, and artifact boundaries
    - logical execution profiles for stable snapshots, client-reactive updates,
      and explicit server-owned delivery
    - zero-client-root conditions and fail-closed unsupported-profile behavior
    - authoring information required by `defineComponent` or a later API, and
      information the compiler must not infer
    - a reproducible client-cost baseline, fixtures, measurement method, and
      success thresholds
    - the first vertical slice and the package specifications, tests, browser
      evidence, artifact evidence, and resource evidence it must update
  ],
  non_goals: [
    - implement the compiler, execution partitioner, artifact emitter, or
      activation runtime
    - implement or migrate the production `DocCodeBlock`
    - define the final `defineComponent` option shape or public execution API
    - select a concrete manifest, marker, entry, payload, or chunk encoding
    - select a bundler adapter, physical chunk name, or module coalescing policy
    - define the client-reactive revision algorithm owned by #222
    - define server-owned revision transport, subscription, or streaming
    - change the accepted decisions in #105 through #110
    - make compatibility with the current API, implementation, or data format a
      selection criterion
  ],
  open_questions: [
    - #115 must define the accepted analysis subset, profile proof, provenance,
      and analysis resource caps consumed by partitioning.
    - #118 must define the Execution Graph and placement plan consumed by the
      artifact emitter.
    - #119 must define concrete artifact encoding, identity, determinism,
      encoded-size caps, and build integration.
    - #222 and #224 must define and validate the client-reactive revision
      closure, including a client-safe presentation strategy.
    - A separate future Proposal must define server-owned delivery before that
      profile can be enabled; it is not an implicit fallback.
    - #231 owns the copied-state reset delay.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/103")[#103],
    link("https://github.com/dathra/dathra/issues/242")[#242],
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
    link("https://github.com/dathra/dathra/issues/129")[#129],
    link("https://github.com/dathra/dathra/issues/145")[#145],
    link("https://docs.astro.build/en/concepts/islands/")[Astro Islands],
    link("https://qwik.dev/docs/concepts/resumable/")[Qwik Resumability],
    link("https://markojs.com/docs/explanation/targeted-compilation")[Marko Targeted Compilation],
    link("https://react.dev/reference/rsc/server-components")[React Server Components],
  ),
)

== Decision

#adr(
  header("Selected execution model", Status.Proposed, "2026-08-26"),
  [
    The #103 goal is to preserve observable declarative UI behavior while
    minimizing client code, data, execution, CPU, memory, network, and runtime
    state. Server/client partitioning is therefore a candidate means, not a
    success condition by itself.

    The current docs application gives a concrete baseline. Its client entry
    binds a store, dynamically imports `DocsAppRoot`, and then calls
    `hydrate(document)`. The production client build emits a 52,156-byte entry
    and a 102,441-byte `DocsAppRoot` chunk before route-specific behavior is
    considered. A route without code-block interaction still loads both files.
    The current browser preview also leaves a `DocCodeBlock` in `Copy` after a
    programmatic click, so the current implementation is evidence of cost and
    an implementation gap, not an accepted behavior baseline.
  ],
  [
    Adopt *bounded execution partitioning with per-instance DOM activation*.

    The model has these rules:

    - The compiler consumes explicit execution semantics and complete source and
      dependency evidence, then creates a finite logical execution plan before
      artifact emission and response commitment.
    - A rendered component instance is the logical ownership boundary. A route
      may aggregate physical client output, but it does not own instance
      identity, handoff lifetime, failure containment, or cleanup.
    - The server owns source acquisition, server-only computation, initial DOM,
      Declarative Shadow DOM, and server-owned values for the selected profile.
    - The client owns only an accepted post-SSR behavior or update closure. For
      stable activation it binds to existing SSR DOM and does not rerun the
      component body, source normalization, syntax highlighting, placement, or
      server rendering.
    - A client root is emitted only when the plan proves a client-owned behavior
      or update. A complete plan with no such root produces server output with
      no route-local client bootstrap, handoff, or activation artifact.
    - Physical artifact coalescing is permitted only after logical closure
      inspection proves that server-only dependencies and unrelated component
      instances are excluded from each client closure.
    - An opaque or contradictory execution result is a `partition` failure. The
      compiler must not treat unknown behavior as server-only and must not use a
      whole-component client replay as an implicit fallback.
    - `client:*` scheduling directives may control when an already selected
      client root activates. They do not decide ownership, closure, or whether
      a root exists.
  ],
  [
    This model extends the value of the existing DSD, marker, hydration, signal,
    and host-scoped cleanup primitives without making document-wide hydration the
    authority for every route. It gives static output a strict zero-root result,
    gives stable interaction a small activation closure, and leaves reactive
    revision and server delivery as separate profiles with separate contracts.

    The cost is a new compiler and build boundary. Authors must provide semantic
    execution information for behavior that cannot be proven from ordinary JSX
    syntax, and the compiler must reject unsupported opaque cases instead of
    guessing. That cost is part of the selected model because a smaller client
    artifact without ownership proof would make failure and lifetime behavior
    untestable.
  ],
  alternatives: [
    1. *Optimize current hydration*: useful as an interim improvement, but its
       document or root-wide client entry cannot guarantee zero client output
       for a server-only route.
    2. *Use explicit islands or partial hydration*: useful as an activation
       scheduling and authoring boundary, but insufficient unless it also defines
       bounded closures, handoff authority, and direct DOM activation.
    3. *Use bounded partitioning with DOM activation*: selected because it makes
       ownership, closure, zero-root emission, and existing DOM authority
       explicit before runtime.
    4. *Use resumability*: potentially small startup work, but it moves substantial
       state, listener, closure, serialization, and lifetime semantics into the
       handoff before Dathra needs them.
    5. *Use an RSC-like module graph*: useful for server-only dependency
       exclusion, but module partitioning alone does not define Web Component
       DOM activation, root cleanup, or client update ownership.
    6. *Use uncompiled progressive enhancement*: useful for isolated static
       controls, but it cannot provide a general reactive ownership or handoff
       contract for Dathra components.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/103")[#103],
    link("https://github.com/dathra/dathra/issues/104")[#104],
    link("https://github.com/dathra/dathra/issues/110")[#110],
    link("https://github.com/dathra/dathra/issues/115")[#115],
    link("https://github.com/dathra/dathra/issues/118")[#118],
    link("https://github.com/dathra/dathra/issues/119")[#119],
    link("https://github.com/dathra/dathra/issues/222")[#222],
  ),
)

== Logical Execution Plan

#interface_spec(
  name: "Logical execution plan",
  summary: [
    The compiler and artifact emitter exchange a logical plan. The plan is a
    planning contract, not a browser payload and not a concrete wire format.
  ],
  format: [
    - `render-transaction`: one coherent server render, analysis, partition, and
      emission result that may be cached or replayed only as a whole
    - `component-instance`: one rendered occurrence with its own profile result,
      ownership, and failure scope
    - `execution-profile`: `server-only`, `stable-snapshot`,
      `client-reactive`, or an explicitly selected server-owned delivery profile
    - `activation-root`: the root-scoped lifetime and handoff owner from #107
    - `server-closure`: the modules and values required to produce the accepted
      initial output and server-owned work
    - `client-closure`: the smallest accepted client behavior or update closure
      for one or more logical roots
    - `handoff-record`: the logical boundary value required by the selected
      profile; its concrete representation remains owned by #119
    - `provenance`: source, dependency, and analysis evidence used to justify the
      selected profile and closure
  ],
  constraints: [
    - The plan is complete before artifact emission begins.
    - The plan does not use rendered DOM inspection as proof of ownership.
    - A route is an aggregation boundary, not a replacement for instance or
      activation-root identity.
    - Unknown, stale, missing, or contradictory evidence is a `partition` failure.
    - The browser receives activation values, not the compiler's full provenance
      graph.
    - A plan cannot silently change profile after emission or after a browser
      update requires a different owner.
  ],
  examples: [
    - A static documentation route has a complete plan whose instance set is
      `server-only`; its client-root set is empty.
    - A route with one stable `DocCodeBlock` has a server closure for source
      selection and highlighting and one client closure for copy activation.
    - A route with a reactive counter has a client-reactive closure for the
      counter update, but unrelated server-only route modules remain excluded.
  ],
)

=== Transaction phases

The selected model uses phase-local ownership already established by #109:

1. `server-analysis` acquires source and request values, normalizes them, and
   produces the initial server result or the permitted fallback.
2. `partition` consumes analysis and authoring evidence, selects one profile for
   each component instance, and computes logical ownership and closures.
3. `emit` materializes one complete artifact result from the accepted plan. It
   does not publish a partial entry, marker, handoff, or stale artifact.
4. `server-render` emits the initial HTML and DSD from the same logical result.
5. `activation` admits a client root and instance, validates its handoff, and
   binds behavior to existing DOM.
6. `dispose` ends the root or instance lifetime and invalidates late callbacks,
   timers, listeners, and retained handoff references.

The phases are ordered because a later phase cannot repair a missing ownership
decision. In particular, the browser cannot discover a missing client closure by
rerunning the component or fetching source after a Copy click.

== Candidate Comparison

=== Evaluation criteria

The options use the following criteria. The same criterion applies to every
option; a smaller client bundle alone is not sufficient.

- `C1 client cost`: whether code, data, startup, CPU, memory, network, and
  runtime state can be measured and reduced by the model
- `C2 observable behavior`: whether server-rendered output and required client
  interaction retain their accepted behavior
- `C3 responsibility`: whether server-only, browser-only, and cross-boundary
  values have one explainable owner
- `C4 analysis boundary`: whether arbitrary JavaScript is left unguessed and
  unsupported cases produce diagnostics
- `C5 platform fit`: whether Web Components, DSD, Shadow DOM, multiple instances,
  and host-scoped cleanup remain coherent
- `C6 state and lifetime`: whether reactive updates, failure, disposal, late
  callbacks, and handoff lifetime have explicit semantics
- `C7 zero root`: whether server-only UI can avoid client bootstrap and client
  artifacts
- `C8 authoring cost`: whether the source structure and declarations are usable
  for real consumers
- `C9 implementation value`: whether implementation complexity is justified by
  the client burden removed and the consumers supported

=== Option 1: current hydration optimization

- *Boundary*: the document, custom-element root, or ShadowRoot remains the
  practical hydration boundary. Server and client still share the component
  execution path.
- *Startup and client cost*: an entry must be loaded to discover hydration work.
  The current docs entry imports core/component bindings, dynamically imports
  `DocsAppRoot`, and calls `hydrate(document)` on every route. Optimization can
  reduce work inside that entry, but it does not make an absent client root
  observable before the entry is loaded.
- *SSR DOM authority*: the server supplies the initial DOM, but the client
  hydration algorithm remains responsible for rediscovering bindings and may
  need mismatch or CSR fallback behavior.
- *Handoff*: markers, event bindings, and initial state can be reused, but there
  is no required pre-emission client-root set or per-profile closure contract.
- *Reactivity*: effects are connected by the hydration runtime across the chosen
  root. The model can be fine-grained after hydration, but it does not prove that
  unrelated server work is absent from the client artifact.
- *Failure and lifetime*: the existing runtime provides root and ShadowRoot
  cleanup, but route-wide entry and discovery can make failure and startup scope
  larger than the behavior being activated.
- *Compiler responsibility*: the compiler optimizes CSR/SSR output and markers;
  it does not have to prove server/client ownership before emission.
- *Zero-client-root*: not guaranteed by the current HTML entry. The overview
  route has no code block yet still requests the main and `DocsAppRoot` assets.
- *Result*: retain as a migration and comparison baseline, but do not select it as
  the target execution model.

=== Option 2: explicit islands or partial hydration

- *Boundary*: an author-selected component or subtree becomes an island. Existing
  `client:visible`, `client:idle`, `client:interaction`, `client:media`, and
  `client:load` concepts provide useful scheduling vocabulary.
- *Startup and client cost*: an island can defer startup and a route with no
  islands can omit its client entry. The cost of each island still depends on
  whether it mounts or reruns the whole component subtree.
- *SSR DOM authority*: common island hydration preserves the server result only
  if the island's client path can reconcile or activate it. An explicit island
  boundary alone does not choose between those behaviors.
- *Handoff*: island props and state cross the boundary, but source identity,
  instance binding, artifact identity, and root lifetime still need separate
  contracts.
- *Reactivity*: the island usually owns all reactive work in its subtree. That is
  broader than the minimum behavior closure for a stable interaction such as
  copying an already-rendered code block.
- *Failure and lifetime*: island-scoped failure and scheduling are useful, but
  nested Web Component cleanup and independent repeated instances need an
  activation contract beyond the directive.
- *Compiler responsibility*: the compiler records island boundaries and trigger
  metadata. It does not necessarily analyze server-only dependencies or prove a
  client-safe update closure.
- *Zero-client-root*: achievable when no island is emitted, subject to the
  server's route output not referencing a global bootstrap.
- *Result*: use explicit islands as a possible authoring or scheduling input, but
  do not treat them as the execution model. An island that gains bounded closure
  and direct DOM activation is an instance of the selected model.

=== Option 3: bounded execution partitioning with DOM activation

- *Boundary*: the compiler creates a logical boundary per rendered component
  instance and an activation-root lifetime for grouped handoff records. A route
  aggregates roots only for physical output.
- *Startup and client cost*: client output is admitted only for accepted client
  roots. Stable activation loads a behavior closure and does not load source
  analysis, syntax highlighting, or the full route component tree.
- *SSR DOM authority*: the server-rendered DOM is authoritative for the initial
  display. Stable activation resolves and binds existing host and control nodes;
  client-reactive updates own only their accepted update closure.
- *Handoff*: each profile defines its own logical handoff. #107's root-scoped
  stable snapshot is used for Copy; a reactive revision or server delivery cannot
  be smuggled into that record.
- *Reactivity*: a reactive read during server rendering does not create a root by
  itself. A browser-visible revision requires `client-reactive` or an explicitly
  selected server-delivery profile.
- *Failure and lifetime*: `server-analysis`, `partition`, `emit`, and `activation`
  own distinct failures. Activation and cleanup remain root or instance scoped,
  and late callbacks are ignored after disposal.
- *Compiler responsibility*: analyze declared semantics, inspect dependency
  reachability, select a profile, compute a bounded closure, assign logical
  identity, and fail closed when proof is missing.
- *Zero-client-root*: a complete server-only plan emits no client entry,
  bootstrap, handoff, marker, or route-local client closure.
- *Result*: selected.

=== Option 4: resumability

- *Boundary*: the server serializes enough component state, event information,
  subscriptions, and closure references for the browser to resume work.
- *Startup and client cost*: event-driven loading can minimize immediate startup,
  and the browser need not rerun a complete component tree. Handoff size and
  deserialization work become part of the initial or deferred client cost.
- *SSR DOM authority*: resumability can preserve server DOM, but every serialized
  reference must still identify the right host and survive DOM lifetime changes.
- *Handoff*: the handoff is a central part of the model and must represent
  serializable state and behavior references. Dathra's stable Copy contract only
  requires one normalized source snapshot and does not justify serializing an
  arbitrary component closure.
- *Reactivity*: subscriptions and reactive graph state can resume, but their
  serialization, invalidation, ownership, and disposal semantics are broader
  than the current signal and root contracts.
- *Failure and lifetime*: malformed or stale serialized closures, missing code,
  and disposed hosts need a larger recovery model. Late callbacks cannot rely on
  a simple local owner unless the serialized owner is reconstructed correctly.
- *Compiler responsibility*: the compiler must transform or serialize closure
  captures, event handlers, state, and resource references. Opaque JavaScript is
  therefore a larger unsupported surface.
- *Zero-client-root*: possible for routes without resumable behavior, but it does
  not remove the complexity of the general handoff model.
- *Result*: rejected as the primary model. The serialization and lifetime cost is
  not justified for the first Dathra consumers, and stable interaction needs a
  smaller direct activation contract.

=== Option 5: RSC-like module graph partitioning

- *Boundary*: server-only and client-capable modules are separated by a module
  graph and serializable data boundary. Client components still own browser
  execution and commonly hydrate or mount.
- *Startup and client cost*: server-only dependencies can be excluded from the
  client graph, and server-rendered output can avoid a global client bundle.
  Client component startup remains a separate concern from module graph
  partitioning.
- *SSR DOM authority*: the server owns server output, but the client component
  boundary still needs a DOM activation or mount contract. A module boundary does
  not prove that existing Shadow DOM should remain untouched.
- *Handoff*: serializable props and server component output cross the boundary.
  This is not equivalent to #107's root-scoped normalized source handoff or to a
  reactive signal ownership contract.
- *Reactivity*: client modules can own reactive state, while server modules can
  produce new output through a framework-specific transport. The two revision
  authorities must not be mixed implicitly.
- *Failure and lifetime*: module loading, transport, serialization, client
  component lifetime, and Web Component disposal are separate failures unless an
  additional activation contract joins them.
- *Compiler responsibility*: module graph classification and serializability
  checks are strong, but they do not by themselves compute per-instance DOM
  bindings or cleanup ownership.
- *Zero-client-root*: achievable for server-only routes when the response does
  not reference a client entry.
- *Result*: rejected as the primary model. Adopt module-graph reachability and
  serializability checks as implementation evidence inside the selected model,
  not as a replacement for DOM activation.

=== Option 6: uncompiled progressive enhancement

- *Boundary*: server-rendered DOM is enhanced by hand-written browser handlers
  attached to selectors or custom elements.
- *Startup and client cost*: isolated controls can load very little code, and a
  static route can omit client JavaScript entirely.
- *SSR DOM authority*: existing DOM can remain authoritative because the handler
  need not rerender it.
- *Handoff*: values are usually read from attributes, DOM text, or ad hoc global
  state. Those choices do not provide the root-scoped source and instance
  authority accepted by #107.
- *Reactivity*: a local handler can support one interaction, but reactive signal
  updates, cross-boundary consistency, and server-owned revisions have no common
  compiler contract.
- *Failure and lifetime*: cleanup depends on each hand-written handler. Repeated
  instances, async completion, timer invalidation, and disposal can diverge
  between consumers.
- *Compiler responsibility*: little is required from the compiler, which is also
  why server-only dependency reachability and unsupported behavior are not
  proven before delivery.
- *Zero-client-root*: achievable for pages that have no hand-written enhancement.
- *Result*: rejected as a general framework model. It remains a valid consumer
  technique only when its behavior is represented by an accepted Dathra profile.

=== Criterion results

- *C1 client cost*: option 1 reduces work after a global entry is loaded; option 2
  can defer islands; options 4 and 5 can reduce some startup or graph cost;
  option 6 can be small for one handler. Option 3 controls code, data, startup,
  and runtime state at the same logical root, so it provides the only selected
  model that makes all cost categories part of one pre-emission plan.
- *C2 observable behavior*: option 1 preserves behavior through hydration;
  option 2 depends on whether an island reruns or activates; option 4 depends on
  reconstructed closures; option 5 depends on client component mounting; option
  6 depends on hand-written handlers. Option 3 preserves SSR DOM and assigns
  only post-SSR behavior or bounded updates to the client.
- *C3 responsibility*: options 1, 2, 4, and 6 can define responsibility only
  after additional contracts are added. Option 5 defines a module boundary but
  not DOM or lifetime ownership. Option 3 defines all three boundaries together.
- *C4 analysis boundary*: option 1 can continue through runtime discovery;
  option 2 can treat an explicit island as proof even when its closure is broad;
  option 4 has the largest closure-serialization problem; option 5 has strong
  module analysis; option 6 has little analysis. Option 3 requires explicit
  evidence and fails closed for opaque behavior.
- *C5 platform fit*: option 1 fits current primitives but retains broad hydration;
  option 2 fits scheduling but not necessarily Shadow DOM identity; option 4
  adds serialized lifecycle state; option 5 needs a new DOM boundary; option 6
  lacks shared cleanup. Option 3 directly uses DSD, existing hosts, activation
  roots, and Web Component cleanup.
- *C6 state and lifetime*: option 1 has runtime state but broad discovery;
  option 2 has island lifetime but may have subtree ownership; option 4 and 5
  require new handoff and update semantics; option 6 is ad hoc. Option 3 keeps
  stable, reactive, and server-owned profiles separate and consumes #107 and
  #108 for root-scoped lifetime.
- *C7 zero root*: options 2, 4, 5, and 6 can achieve it in restricted forms;
  option 1 cannot guarantee it with the current global entry. Option 3 makes it
  a successful classified plan with a strict no-client-output rule.
- *C8 authoring cost*: option 1 is easiest initially; option 2 is familiar but
  can hide broad client work; option 4 imposes serializability; option 5 imposes
  module and data boundaries; option 6 pushes lifetime work to each author.
  Option 3 adds declarations only where post-SSR behavior needs an owner and
  leaves static server-only components simple.
- *C9 implementation value*: option 1 is cheaper only while the goal remains
  weaker; option 4 and option 5 require larger new systems; option 6 does not
  scale as a framework contract. Option 3 concentrates implementation work in
  compiler and artifact planning while preserving the runtime's small direct
  DOM primitives.

== Server and Client Boundaries

#interface_spec(
  name: "Logical artifact boundary",
  summary: [
    The selected model separates execution responsibility before physical
    bundling. The following inclusion rules apply to the logical plan and are
    independent of the eventual file names or chunk layout.
  ],
  format: [
    - *Server closure*: source acquisition, source selection, normalization,
      language classification, syntax highlighting or readable plain-code
      fallback, static styles, initial DOM, DSD output, request state, and
      server-owned delivery work for an explicitly selected delivery profile
    - *Stable client closure*: root admission, artifact and handoff validation,
      existing host and control lookup, normalized-source consumption, copy
      interaction, copied state, timer generation, and root-scoped cleanup
    - *Client-reactive closure*: the client-safe dependency, rendering, and update
      operations required by #222 to keep its declared DOM and handoff values
      consistent
    - *Server-owned delivery receiver*: only the client receiver and bounded DOM
      application required by a future explicit delivery contract
    - *Shared boundary*: platform values and the minimal runtime operations that
      both sides explicitly require; stable DocCodeBlock does not share its
      server highlighter or source analysis with the client
  ],
  constraints: [
    - The client closure cannot reach a server-only syntax highlighter through a
      transitive dependency.
    - The client does not receive raw component props, arbitrary server closures,
      compiler provenance, or unrelated route data.
    - The server does not install browser listeners, timers, Clipboard API calls,
      or post-SSR client owners.
    - A physical shared chunk is not evidence that every route referencing the
      build has a client root. Route output must still omit the client reference
      when its logical root set is empty.
    - A missing or inconsistent closure is an emission failure, not permission to
      rerun the component in the browser.
  ],
)

=== SSR DOM authority

The server-rendered DOM owns the initial observable result. This includes the
readable code, language presentation, static styles, Shadow DOM structure, and
initial non-success Copy control accepted by #105 and #106.

Stable activation resolves the compiler-selected host and control, validates the
root-scoped handoff, and attaches behavior without replacing the code-display
subtree. It cannot derive source from highlighted DOM, choose a nearby control,
or rerender `DocCodeBlock`.

The client-reactive profile may update a bounded set of nodes after a source or
language revision. That update is client-owned only when #222 proves a client-safe
closure and atomic consistency between display, highlighting, clipboard source,
and any boundary value. It does not turn the entire SSR component body into a
browser entry.

=== Handoff authority

- `stable-snapshot` consumes the root-scoped, response-scoped handoff from #107.
  It carries one normalized source snapshot per activated instance and has no
  revision or server request operation.
- `client-reactive` uses the separate revision contract from #222. It cannot add
  a revision field to the stable handoff as an implementation shortcut.
- `server-owned-delivery` uses a future explicit delivery record with its own
  authority, stale-update policy, transport, and disposal semantics.
- Canonical Identity and Module Graph values remain compiler provenance. They may
  explain a plan but are not sent to the browser as a replacement for activation
  bindings.

=== Failure and lifetime boundary

The selected model preserves the phase and outcome classes accepted by #109:

- `server-analysis` may use the readable highlighter fallback when a normalized
  source exists, but cannot replace an unavailable source with an empty or stale
  value.
- `partition` fails when a profile or ownership proof is missing. It does not
  choose stable snapshot for a source whose analysis proves a browser-visible
  revision.
- `emit` fails atomically when closure, identity, cap, determinism, or handoff
  records are incomplete. It does not publish partial client output.
- `activation` rejects a missing or mismatched root, host, control, artifact, or
  handoff while preserving readable SSR content. A failed block does not fail an
  independent root.
- `dispose` ends listener, state, timer, and handoff ownership. Late promise and
  timer callbacks are ignored and cannot resurrect a disposed instance.

== Execution Profiles

#behavior_spec(
  name: "server-only outcome",
  summary: [
    A complete plan emits server-rendered UI without client execution when no
    accepted post-SSR behavior or update exists.
  ],
  preconditions: [
    - every rendered instance has complete accepted analysis and profile evidence
    - the client-root set is empty
  ],
  postconditions: [
    - the server may emit HTML, DSD, static styles, and server-owned values
    - the route emits no client entry reference, bootstrap, activation manifest,
      root marker, instance marker, or stable handoff payload
    - the browser performs no route-local client activation work
    - an unrelated physical build chunk does not make this logical route
      client-rooted
  ],
  errors: [
    - incomplete or contradictory evidence is `partition` failure, not a
      server-only classification
  ],
)

#behavior_spec(
  name: "stable-snapshot profile",
  summary: [
    The server produces one stable initial result and the client attaches a
    bounded interaction closure to existing DOM.
  ],
  preconditions: [
    - the component has an accepted stable-snapshot behavior contract
    - the server can establish one normalized source and complete initial output
    - no client-visible revision is required after SSR for this profile
  ],
  steps: [
    1. `server-analysis` selects and normalizes the source and performs optional
       server-only presentation work.
    2. `partition` emits one stable client root only when the interaction requires
       client ownership.
    3. `emit` coordinates the root marker, instance binding, and #107 handoff.
    4. `activation` validates the record and binds behavior to existing DOM.
  ],
  postconditions: [
    - the client does not rerun source selection, normalization, highlighting,
      component execution, or static DOM generation
    - the normalized source used by Copy is the server-produced source for that
      instance
    - the activation owner, listener, timer, and source reference end together at
      disposal according to #108
  ],
  errors: [
    - a source revision requiring post-SSR ownership is not silently frozen
    - no accepted stable handoff means no partial stable activation
  ],
)

#behavior_spec(
  name: "client-reactive profile",
  summary: [
    A browser-visible reactive revision is owned by a bounded client-safe update
    closure rather than by a server-only path or a whole-component replay.
  ],
  preconditions: [
    - #222 has accepted the observable revision and atomicity contract
    - #115 has proved the dependency and execution profile
    - the client closure contains only browser-safe normalization, rendering,
      presentation, and update dependencies
  ],
  steps: [
    1. The server renders the initial SSR baseline.
    2. The client admits the reactive root and owns the declared dependency.
    3. A revision updates the bounded display, presentation, clipboard value, and
       boundary record according to #222.
  ],
  postconditions: [
    - the client owns the browser-visible revision and its cleanup
    - the update does not reach a server-only highlighter or rerun an arbitrary
      component body
    - the stable-snapshot handoff is not mutated into a revision stream
  ],
  errors: [
    - missing client-safe closure or atomic revision proof is an
      `unsupported-execution-profile` partition diagnostic
    - server-owned delivery is not selected implicitly to hide the missing
      client-reactive contract
  ],
)

#behavior_spec(
  name: "server-owned delivery profile",
  summary: [
    An explicitly selected server authority may deliver later revisions to a
    client receiver when a separate contract defines transport and ownership.
  ],
  preconditions: [
    - a future accepted Proposal defines the delivery authority, transport,
      serialization, stale-update policy, and disposal behavior
    - the author explicitly selects that profile for the component behavior
  ],
  steps: [
    1. The server emits the initial result and the delivery admission record.
    2. The client admits only the receiver closure.
    3. The server-owned authority produces revisions under its accepted lifetime
       and failure contract.
  ],
  postconditions: [
    - the server remains the authority for revisions
    - the client receiver does not claim client-reactive ownership of the source
    - delivery resources and late messages are bounded by the explicit profile
  ],
  errors: [
    - no future accepted delivery contract means the profile is unsupported
    - a stable-snapshot or client-reactive contract cannot silently become a
      server-delivery session
  ],
)

=== Profile selection rules

The compiler applies the following semantic rules after it has complete evidence:

1. Select the `server-only` outcome when the instance has no post-SSR client
   behavior or update.
2. Select `stable-snapshot` when the instance has an accepted interaction whose
   source and initial DOM remain stable through activation and disposal.
3. Select `client-reactive` when analysis proves a browser-visible revision and
   #222 supplies a client-safe update closure.
4. Select `server-owned-delivery` only when a separate accepted delivery
   contract exists and the author explicitly requests it.
5. Produce `unsupported-execution-profile` when a browser-visible behavior has no
   accepted owner or when the compiler cannot prove the selected boundary.

The compiler must not select a profile from the presence of a signal, an event
prop, an import path, a route name, a custom-element tag name, or a DOM shape
alone. Those facts may be analysis inputs, but none is ownership proof by itself.

== Authoring and Compiler Contract

#interface_spec(
  name: "Execution semantics supplied by the author",
  summary: [
    The final public syntax remains open, but every supported component must
    provide the following semantic information either through `defineComponent`
    or through a compiler-facing descriptor. The information describes ownership;
    it does not prescribe artifact names or runtime implementation.
  ],
  format: [
    - *post-SSR behavior*: whether the component is server-only, has stable
      interaction, has client-visible reactive updates, or needs explicitly
      server-owned delivery
    - *behavior boundary*: the host, control, DOM region, and component instance
      whose behavior is owned together
    - *boundary values*: the values that must cross from server to client, their
      snapshot or revision meaning, and whether they are intentionally visible
    - *client-safe closure*: for client-owned behavior, the source operations and
      dependencies that may execute in a browser
    - *lifetime*: the owner that disposes listeners, effects, timers, subscriptions,
      and retained boundary values
    - *failure result*: whether a failure is a permitted fallback, fatal analysis
      error, rejected activation, retryable browser operation, or ignored late
      callback
    - *revision authority*: the client, server, or no post-SSR owner for each
      observable value
  ],
  constraints: [
    - The declaration may be added to the component definition or supplied by a
      later API; this Proposal does not choose its final spelling.
    - An author declaration cannot authorize a server-only module in a client
      closure or a client-visible revision without a lifetime owner.
    - A declaration that conflicts with dependency or behavior evidence is a
      partition failure, not a permission to trust the declaration blindly.
    - A scheduling directive such as `client:interaction` is not a substitute for
      post-SSR behavior ownership or a client-safe closure.
  ],
  examples: [
    - A stable `DocCodeBlock` declares that the server owns the normalized source
      and highlighted display while the client owns Copy interaction and its
      root-scoped source handoff.
    - A reactive counter declares a client-owned value dependency, bounded update
      targets, and disposal owner.
    - A server-only article declares no post-SSR behavior and therefore requires
      no client root.
  ],
)

=== Information the compiler may derive

The compiler may derive facts from the explicit semantic declaration and accepted
source evidence:

- static DOM structure, dynamic text and attribute locations, and component
  instance occurrences
- module and symbol reachability for server and client closures
- signal reads, writes, and dependency edges when the accepted analysis subset
  can prove them
- root and instance placement, logical identity, and route-level root aggregation
- the minimal handoff fields required by the selected profile
- whether a server-only dependency is reachable transitively from a client entry
- deterministic artifact input and provenance records

These derivations remain facts used to validate a declaration. They do not turn an
implementation detail such as an event prop into an implicit public execution
policy.

=== Information the compiler must not infer

The compiler must not infer any of the following as ownership proof:

- client ownership from a component tag name, file name, import path, route name,
  or package name
- server-only ownership from the absence of a recognized event prop or signal
  read
- a stable snapshot from a signal read when analysis proves a browser-visible
  revision
- a client-safe closure from `typeof window`, a dynamic import, a small bundle,
  or a dependency that happens to work in one browser
- source identity from DOM position, highlighted text, a CSS selector, or equal
  normalized source in another instance
- server delivery from a failed client-reactive analysis
- zero-client-root from missing metadata, incomplete traversal, or a runtime
  decision made after response commitment

Unknown behavior is not equivalent to `server-only`. The partition phase reports
the missing proof and prevents a misleading artifact from being emitted.

== Baseline and Measurement

=== Current baseline facts

The following facts were measured in the dedicated worktree at revision
`c1a30ed86fd2bd79e1c742362f552e9f62ff9f98` after `pnpm install --frozen-lockfile`:

- `pnpm build` completed for the workspace packages.
- `pnpm --filter @dathra/docs build` completed for client and server output.
- `docs/dist/client/assets/main-DoZ2D7Hc.js` is 52,156 bytes and gzip is 16,832
  bytes.
- `docs/dist/client/assets/DocsAppRoot-BRfkl5ir.js` is 102,441 bytes and gzip is
  24,801 bytes.
- The current route-local client JavaScript total is therefore 154,597 bytes
  raw and 41,633 bytes gzip before external font requests.
- The overview response is 19,120 bytes. The `/getting-started-csr` response is
  54,612 bytes and contains eight rendered `dathra-code` blocks.
- A real browser request for `/getting-started-csr` loads both same-origin client
  assets. The browser reports encoded body sizes of 52,156 and 102,441 bytes.
- The current browser preview leaves all eight Copy labels unchanged after a
  programmatic click. The page itself renders, so this is a behavior gap rather
  than a server-rendering failure.
- The client bundle contains the route and component code but no reachable Shiki
  highlighter module. The server bundle contains the Shiki imports and
  highlighter preparation path.

These values are a repository baseline, not the selected model's acceptance
result. The current docs route does not yet provide the partitioned artifact path
or a passing Copy interaction, so a fair comparison must build the same fixtures
under both models.

=== Fixtures

The first measurement set uses the same source inputs and observable behavior for
the baseline and selected model:

- `F0 server-only`: a server-rendered route with static DSD output and no
  post-SSR behavior. It measures the strict zero-client-root result.
- `F1 stable-one`: one stable-snapshot `DocCodeBlock` with successful server
  highlighting and a Copy interaction.
- `F2 stable-many`: thirty-two stable blocks, including equal normalized source
  in two different instances and one highlighter fallback. It measures per-root
  scaling and server-only dependency exclusion.
- `F3 reactive-update`: a small component with a browser-visible signal update,
  a bounded client-safe update closure, and no server-only dependency in that
  closure. It measures the separate client-reactive profile.
- `F4 unsupported`: an opaque or contradictory source whose browser-visible
  behavior has no accepted profile. It measures diagnostic timing and the
  absence of a partial artifact.

`F0` is necessary because the goal is not merely to make interactive routes
smaller. A model that cannot make `F0` free of route-local client execution has
not established the required zero-root boundary.

=== Measurement method

The baseline and candidate are measured from the same revision, fixture source,
Node version, package build, production preview server, and Chromium version.
The browser run uses a cold profile, disabled cache, locally served fixture assets,
and excludes external fonts and favicon requests from the Dathra cost totals.
Each fixture is navigated at least thirty times. Report the median and p95 for
time-based values; report raw and gzip values for artifacts.

Measure these categories:

1. *Network and data*: initial HTML bytes, same-origin client script bytes, gzip
   bytes, handoff bytes, client request count, and the number of route-local
   client entries.
2. *Startup and CPU*: browser time from client entry evaluation to the last
   accepted activation commit, plus trace CPU time for that interval.
3. *Memory*: peak JavaScript heap or `performance.measureUserAgentSpecificMemory`
   when available, using the same browser fallback for both candidates.
4. *Runtime state*: instrumented counts of activation roots, listeners, effects,
   timers, retained handoff records, and those same resources after disposal.
5. *Dependency closure*: generated artifact metadata and transitive reachability;
   a source-string search alone is not sufficient evidence that a server-only
   module is absent.
6. *Behavior*: SSR readability before JavaScript, DOM identity after activation,
   exact clipboard source, failure state, repeated interaction, disposal, late
   callback behavior, and independent multiple instances.

The current implementation supplies the `B0` comparison baseline for each
fixture. The measured docs values above provide a repository anchor, while the
fixture-specific values are the normative denominator for the thresholds below.

=== Success thresholds

The thresholds are review gates for the selected model, not concrete artifact
encoding caps. #119 may add stricter emitter caps without weakening them.

- `T0 zero-root`: `F0` emits zero route-local client JavaScript bytes, zero
  route-local client requests, zero activation roots, zero listeners, zero
  timers, and zero handoff records. Its response contains no client entry or
  bootstrap reference. This is an exact threshold, not a percentage target.
- `T1 stable cost`: for `F1`, selected-model client JavaScript transfer is at
  most 50% of the same-fixture `B0` raw total and at most 50% of the `B0` gzip
  total. Median activation CPU is at most 50% of `B0`. The client closure has no
  reachable syntax highlighter or source-analysis dependency.
- `T2 root scaling`: for `F2`, the shared client JavaScript and bootstrap CPU
  increase by no more than 10% over `F1`. Handoff data may grow with the
  normalized source payload, but executable closure bytes must not be emitted
  once per block. Each block has exactly one logical instance owner and keeps
  independent source, listener, timer, and disposal state.
- `T3 reactive boundary`: for `F3`, every observed revision updates only the
  accepted client-reactive closure, never the server-only closure or an unrelated
  instance. The profile must pass its semantic and dependency-closure checks
  before #222 and #224 set a separate reactive cost budget.
- `T4 unsupported failure`: for `F4`, the compiler reports a partition diagnostic
  before artifact commitment and emits no client bootstrap, partial handoff, or
  implicit whole-component replay.
- `T5 behavior preservation`: all accepted #105 through #109 browser outcomes
  pass for supported fixtures. A cost reduction that changes SSR DOM authority,
  source identity, failure state, cleanup, or late-callback behavior fails the
  model even when the byte threshold passes.

The 50% and 10% gates deliberately reject an optimization that only removes an
unmeasurable amount of work. They apply to equivalent fixtures and do not claim
that every future component must have the same absolute size.

== First Vertical Slice

=== Slice definition

The first implementation slice proves the selected model with two routes and one
consumer family:

- `F0 server-only` proves a response with no client reference or activation work.
- `F1 stable-one` proves one server-rendered `DocCodeBlock` with a root-scoped
  stable handoff and direct DOM activation.
- The slice includes successful copy, unavailable or rejected Clipboard API,
  repeated clicks, multiple block identity, disposal, and late callback evidence
  already accepted by #105 through #109.
- Server syntax highlighting remains server-only, and a readable plain-code
  fallback remains available when highlighting fails.
- The slice does not implement client-reactive revisions or server-owned delivery.
  It defines their profile boundaries and leaves their implementations to #222,
  #224, and a future delivery Proposal.

The first slice is complete only when artifact and browser evidence demonstrate
that the selected client closure is the behavior closure, not a browser replay of
the full docs component tree.

=== Specification and test ownership

Implementation must update the owning specification and executable test before
changing its implementation:

- `@dathra/components`: update
  `packages/components/src/defineComponent/SPEC.typ` and
  `packages/components/src/defineComponent/implementation.test.ts` if semantic
  execution metadata becomes part of the component definition.
- `@dathra/transformer`: update
  `packages/transformer/src/transform/SPEC.typ` and
  `packages/transformer/src/transform/implementation.test.ts` for execution
  analysis, profile selection, logical plan output, and unsupported diagnostics.
  Mode-specific changes must also update the existing CSR or SSR feature specs
  and tests rather than placing their details only in this Proposal.
- `@dathra/plugin`: update `packages/plugin/src/plugin/SPEC.typ` and
  `packages/plugin/src/plugin/implementation.test.ts` for build-mode propagation,
  entry admission, and artifact-plan integration.
- `@dathra/runtime`: update the responsible hydration, marker, deserialize, or
  event `SPEC.typ` and `implementation.test.ts` files for root admission,
  existing-DOM activation, handoff lifetime, and cleanup. Do not add a new public
  API without its own feature specification and test.
- `@dathra/core`: update the hydration or SSR specification and test only if the
  public facade changes. The core package must not become a second owner of the
  execution plan.
- `docs`: create the missing feature specification and executable test for
  `DocCodeBlock` under `docs/src/components/DocCodeBlock/` before migrating
  `DocCodeBlock.tsx`, `entry-client.ts`, `entry-server.tsx`, or `vite.config.ts`.
- `playgrounds/e2e`: add browser routes and tests for zero-root output, stable
  activation, closure exclusion, failure, repeated interaction, and disposal.
- `#112`: consolidate the unit, integration, artifact, browser, and resource
  evidence without changing the contracts owned by the earlier Proposals.

The exact new transformer feature directory and final public metadata syntax are
implementation decisions. This list identifies owners and required adoption
points without preempting those decisions.

=== Implementation order

1. Transfer the accepted model and profile boundary to the responsible package
   specifications and tests.
2. Implement analysis and logical plan output in the transformer, with diagnostics
   for missing proof and unsupported profiles.
3. Implement plugin integration and complete artifact planning without publishing
   partial outputs.
4. Implement runtime admission and direct DOM activation using the existing root
   and cleanup contracts.
5. Migrate the docs fixture and `DocCodeBlock` only after its behavior tests pass.
6. Run artifact, browser, and resource evidence against `F0` through `F4` and
   compare with the same-fixture `B0`.

No production implementation is authorized by this Proposal alone. The adoption
gate requires the package specifications, tests, and the evidence matrix to be
updated before the implementation Tasks begin.

== Evidence and Follow-up Ownership

The selected decision must remain traceable from its logical rule to the evidence
that can falsify it:

- *Analysis evidence*: #115 owns the accepted analysis subset, profile proof,
  provenance, and resource caps. Transformer unit tests cover profile selection,
  closure reachability, and unsupported outcomes.
- *Placement evidence*: #118 owns the Execution Graph and placement plan. Tests
  prove instance identity, activation-root grouping, and route aggregation.
- *Artifact evidence*: #119 owns concrete encoding, entry and marker output,
  deterministic emission, cap enforcement, and transitive server-only exclusion.
- *Integrated browser evidence*: #120 owns the production artifact and browser
  validation. The e2e suite observes SSR DOM identity, activation, failures,
  disposal, and zero-root network behavior.
- *Behavior consolidation*: #111 records the relationship between this model and
  the accepted #105 through #110 DocCodeBlock decisions. It does not select a
  different execution model.
- *Evidence matrix*: #112 maps each plan state, artifact output, resource metric,
  and browser outcome to an executable test or measurement.
- *Reactive profile*: #222 owns client-reactive revisions and #224 consumes that
  contract in Core validation. Neither may extend the stable handoff implicitly.
- *Diagnostics and interaction*: #109 owns the accepted failure and diagnostic
  behavior. #126 owns concrete copy interaction and lifetime implementation after
  #124. Final diagnostic message wording remains outside this Proposal.
- *Delivery profile*: a future Proposal under the #103 decision family owns
  server-owned revision delivery. #241 does not make delivery a fallback.
- *Reset policy*: #231 owns the copied-state reset delay and does not change
  artifact inclusion or zero-root classification.

=== Phase 1 rescope

The selected model changes the order and boundary of the existing Phase 1 work
without authorizing that work to start:

- #104 remains the acceptance-scenario and contract owner. It must consume this
  selected model by keeping the stable-snapshot and client-reactive profiles
  separate, and by treating server-owned delivery as explicit future work.
- #113 remains the Vite/unplugin compiler-to-artifact vertical slice. It must
  consume the selected logical plan, the existing #98 and #99 foundations, and
  the package specifications updated before implementation. It must not decide
  the execution model or run browser activation.
- #120 remains the end-to-end artifact consumer and browser validator. It starts
  only after #113 has produced finalized server and client artifacts and the
  #105 through #110 contracts have been adopted into Git-managed specifications
  and tests. Its browser must consume the emitted handoff and must not repair
  missing analysis, placement, or artifact output.
- #111 and #112 are adoption gates for #113 and #120. They consolidate the
  accepted component contracts and map them to reproducible unit, integration,
  artifact, browser, and resource evidence; they do not choose a competing
  execution model.

=== Generalization and demand gates

The selected model is not a license to generalize every protocol immediately:

- #129 may start only after #120 completes and the production DocCodeBlock
  evidence is finalized. It generalizes the proven compiler-to-runtime path to
  structurally different production workflows; it must not promote an unproven
  historical RFC, whole-component replay, implicit RPC, or legacy fallback.
- #145 is demand-gated and does not block #129, #140, or #139. Its reference,
  subscription, remote-operation, additional-bundler, and additional-runtime
  capabilities require a selected production consumer, an accepted Proposal,
  explicit authority, identity, exposure, lifetime, failure, and resource
  budget. A listed capability remains deferred until those gates pass.
- `server-owned-delivery` is a demand-gated follow-up under #103 and follows the
  boundary discipline of #145. It is not automatically part of #129's initial
  generalization or a repair path for an absent client-reactive closure.

=== Deferred owner and blocking status

The following items are intentionally outside this decision while their blocking
scope remains explicit:

- *#115*: owns the accepted analysis subset, profile proof, provenance, and
  analysis caps. It does not block accepting this Proposal, but it blocks
  implementation that relies on unproven analysis or profile evidence.
- *#116 and #118*: #116 owns the observed ModuleGraphSnapshot and blocks #118;
  #118 owns the Execution Graph and placement plan and blocks #119. Neither
  changes the selected model.
- *#119*: owns concrete artifact encoding, identity, determinism, caps, and
  build integration. It blocks artifact implementation and #120's finalized
  handoff consumption, but not this Proposal's decision.
- *#222 and #224*: #222 owns the client-reactive revision contract and #224 owns
  its Core production validation. They block supported reactive emission and
  validation, but not the stable `F0`/`F1` slice.
- *Future server-delivery Proposal*: owns server-owned revision authority,
  transport, stale-update policy, and disposal. It blocks that profile only; it
  is not a fallback and does not block stable activation.
- *#124 and #126*: #124 owns activation entry discovery and atomic attachment and
  blocks #126; #126 owns copy interaction, timer, failure outcome, and cleanup
  implementation. Their implementation chain blocks the production vertical
  slice, not the execution-model decision.
- *#231*: owns the concrete copied-state reset delay. It blocks final timing
  acceptance for the stable interaction, but does not change timer generation,
  ownership, disposal, or the selected model.

== Behavior Contract

#behavior_spec(
  name: "partition before emission",
  summary: [
    The compiler must select a supported execution profile and complete logical
    closure plan before the emitter publishes client output.
  ],
  preconditions: [
    - the render transaction contains all relevant component instances
    - the authoring and dependency evidence is available to the accepted analysis
  ],
  steps: [
    1. Analyze each instance.
    2. Select one profile or report a partition failure.
    3. Compute and validate server and client closures.
    4. Pass the complete plan to emission.
  ],
  postconditions: [
    - the client-root set is known before emission
    - server-only dependencies are excluded from every client closure
    - a complete zero-root result is distinguishable from missing evidence
  ],
  errors: [
    - missing, stale, contradictory, or opaque proof is a `partition` failure
    - the emitter cannot receive a plan that silently treats unknown work as
      server-only
  ],
)

#behavior_spec(
  name: "zero-client-root response",
  summary: [
    A server-only route remains useful without a route-local client bootstrap or
    activation payload.
  ],
  preconditions: [
    - the route has a complete accepted plan
    - every instance is server-only and the client-root set is empty
  ],
  postconditions: [
    - initial SSR HTML and DSD are readable
    - the response contains no client entry reference or bootstrap
    - the browser requests no route-local client artifact
    - no client root, marker, handoff, listener, effect, or timer is created
  ],
  errors: [
    - a missing plan is never reported as a successful zero-root response
  ],
)

#behavior_spec(
  name: "stable DOM activation",
  summary: [
    A stable client root attaches accepted behavior to server-created DOM without
    rerunning or replacing the server-rendered component.
  ],
  preconditions: [
    - the server response contains readable SSR output
    - the root, instance, artifact, host, control, and handoff pass #107 and
      #108 admission checks
  ],
  steps: [
    1. Admit the activation root.
    2. Validate the instance-scoped handoff.
    3. Commit one owner, listener, and client state for the existing control.
    4. Dispose all client-owned resources at the root or instance lifetime end.
  ],
  postconditions: [
    - code-display DOM identity and server-owned source remain unchanged
    - Copy receives the exact normalized source for its own instance
    - repeated interaction and late completion follow #108 and #109
  ],
  errors: [
    - invalid admission rejects only the affected root or instance according to
      its failure scope and does not guess a replacement DOM target
  ],
)

#behavior_spec(
  name: "profile separation",
  summary: [
    Stable snapshots, client-reactive revisions, and server-owned delivery never
    silently share an execution owner or boundary protocol.
  ],
  preconditions: [
    - a component has observable behavior after SSR or a browser-visible revision
  ],
  postconditions: [
    - a stable snapshot owns only its stable interaction closure
    - a client-reactive revision has an accepted client-safe update owner
    - server-owned delivery has an explicit server authority and future contract
    - no missing profile is hidden by whole-component replay, stale freeze, or
      click-time source retrieval
  ],
  errors: [
    - absence of an accepted owner produces an unsupported-execution-profile
      diagnostic before successful artifact commitment
  ],
)

== Acceptance Coverage

The Issue #241 acceptance criteria map to this Proposal as follows:

- The reason for separating server and client, and the loss when they are not
  separated, is recorded in `Decision` and `Candidate Comparison`.
- Every candidate is compared for boundary, startup, SSR DOM authority, handoff,
  reactivity, failure, lifetime, compiler responsibility, and zero-root output.
- The selected model, rejected models, application range, and non-goals are
  recorded in `Decision` and `Execution Profiles`.
- The current baseline, equivalent fixtures, measurement method, and success
  thresholds are recorded in `Baseline and Measurement`.
- Required authoring semantics and forbidden compiler inference are recorded in
  `Authoring and Compiler Contract`.
- Stable snapshot, client-reactive update, and server-owned delivery are separate
  profiles with distinct owners and no implicit fallback.
- The first vertical slice and the package specifications, tests, implementations,
  browser routes, and evidence owners it must update are recorded in `First
  Vertical Slice`.
- The decision is traceable to analysis, placement, artifact, browser, behavior,
  and resource evidence in `Evidence and Follow-up Ownership`.

== Input Coverage

Each row maps one collected `requirements.*` candidate from Issue #241 to the
Proposal section that resolves or preserves it. Source line numbers refer to the
Issue body collected in `/tmp/opencode/proposal-241-inputs-20260826-03.json`.

=== Decision to make

- `decisionToMake.1` (Issue #241, line 3) -> `Decision`: select the model that
  satisfies the #103 Goal.
- `decisionToMake.2` (Issue #241, line 5) -> `Decision` and `Server and Client
  Boundaries`: define whether to split execution and at what ownership boundary.
- `decisionToMake.3` (Issue #241, line 7) -> `Candidate Comparison`: compare all
  six listed options and select one.

=== Context and evidence

- `contextAndEvidence.1` (Issue #241, line 11) -> `Decision`: partitioning is a
  means rather than the Goal.
- `contextAndEvidence.2` (Issue #241, line 12) -> `Decision` and `Candidate
  Comparison`: preserve the current SSR, DSD, marker, hydration, and island
  context.
- `contextAndEvidence.3` (Issue #241, line 13) -> `Baseline and Measurement`:
  measure the current hydration entry and its artifact burden.
- `contextAndEvidence.4` (Issue #241, line 14) -> `First Vertical Slice`: use
  DocCodeBlock as the consumer without assuming its split is already optimal.
- `contextAndEvidence.5` (Issue #241, line 15) -> `Decision` and `Server and
  Client Boundaries`: consume the existing DSD, marker, reactive, and cleanup
  primitives.
- `contextAndEvidence.6` (Issue #241, line 16) -> `Candidate Comparison`,
  `Option 2`: compare Astro's server-first, island, zero-root, and client-only
  boundaries.
- `contextAndEvidence.7` (Issue #241, line 17) -> `Candidate Comparison`,
  `Option 4`: compare Qwik's resumable handoff and event-driven loading.
- `contextAndEvidence.8` (Issue #241, line 18) -> `Candidate Comparison`,
  `Option 3`: compare Marko's bounded analysis and targeted compilation.
- `contextAndEvidence.9` (Issue #241, line 19) -> `Candidate Comparison`,
  `Option 5`: compare RSC-like module partitioning without equating it to DOM
  activation.
- `contextAndEvidence.10` (Issue #241, line 20) -> `Decision` and `Candidate
  Comparison`: do not use compatibility as a selection constraint.

=== Options considered

- `optionsConsidered.1` (Issue #241, line 24) -> `Option 1: current hydration
  optimization`.
- `optionsConsidered.2` (Issue #241, line 25) -> `Option 2: explicit islands or
  partial hydration`.
- `optionsConsidered.3` (Issue #241, line 26) -> `Option 3: bounded execution
  partitioning with DOM activation`.
- `optionsConsidered.4` (Issue #241, line 27) -> `Option 4: resumability`.
- `optionsConsidered.5` (Issue #241, line 28) -> `Option 5: RSC-like module
  graph partitioning`.
- `optionsConsidered.6` (Issue #241, line 29) -> `Option 6: uncompiled
  progressive enhancement`, the selected comparison for another approach.

=== Decision criteria

- `decisionCriteria.1` (Issue #241, line 33) -> `Evaluation criteria`, `C1`, and
  `Baseline and Measurement`: measure code, data, startup, CPU, memory, network,
  and runtime state.
- `decisionCriteria.2` (Issue #241, line 34) -> `Evaluation criteria`, `C2`, and
  `Behavior Contract`: preserve SSR behavior and required interaction.
- `decisionCriteria.3` (Issue #241, line 35) -> `Server and Client Boundaries`:
  assign server-only, browser-only, and boundary data ownership.
- `decisionCriteria.4` (Issue #241, line 36) -> `Authoring and Compiler Contract`:
  bound analysis and fail closed for unsupported JavaScript.
- `decisionCriteria.5` (Issue #241, line 37) -> `Candidate Comparison`, `C5`, and
  `First Vertical Slice`: preserve Web Components, DSD, Shadow DOM, instances,
  and cleanup.
- `decisionCriteria.6` (Issue #241, line 38) -> `Failure and lifetime boundary`
  and `Execution Profiles`.
- `decisionCriteria.7` (Issue #241, line 39) -> `server-only outcome` and
  `zero-client-root response`.
- `decisionCriteria.8` (Issue #241, line 40) -> `Authoring and Compiler Contract`:
  bound author declarations and compiler obligations for real consumers.
- `decisionCriteria.9` (Issue #241, line 41) -> `Decision` and `Success
  thresholds`: compare implementation cost with removed client burden and value.

=== Acceptance criteria

- `acceptanceCriteria.1` (Issue #241, line 45) -> `Decision`: record why the
  server/client boundary serves the Goal and what is lost without it.
- `acceptanceCriteria.2` (Issue #241, line 46) -> `Candidate Comparison`: apply
  the complete boundary, startup, authority, handoff, reactivity, failure,
  lifetime, compiler, and zero-root comparison.
- `acceptanceCriteria.3` (Issue #241, line 47) -> `Decision`, `Execution Profiles`,
  and `non_goals`: record selection, rejection, scope, and non-goals.
- `acceptanceCriteria.4` (Issue #241, line 48) -> `Baseline and Measurement`:
  record baseline, fixtures, method, and thresholds.
- `acceptanceCriteria.5` (Issue #241, line 49) -> `Authoring and Compiler Contract`.
- `acceptanceCriteria.6` (Issue #241, line 50) -> `Execution Profiles` and
  `Evidence and Follow-up Ownership`.
- `acceptanceCriteria.7` (Issue #241, line 51) -> `First Vertical Slice` and
  `Specification and test ownership`.
- `acceptanceCriteria.8` (Issue #241, line 52) -> `Evidence and Follow-up
  Ownership` and this coverage map.

=== Dependencies

- `dependencies.1` (Issue #241, line 56) -> `Current baseline facts` and
  `First Vertical Slice`: current hydration and e2e evidence are inputs, not
  implementation authority.
- `dependencies.2` (Issue #241, line 57) -> `Decision` and `Input Coverage`:
  consume the updated #103 Goal, hypothesis, and success conditions.

=== Non-goals

- `nonGoals.1` (Issue #241, line 61) -> `scope` and `Adoption Gate`: no
  production implementation.
- `nonGoals.2` (Issue #241, line 62) -> `non_goals`: no compiler, emitter, or
  activation-runtime implementation.
- `nonGoals.3` (Issue #241, line 63) -> `Authoring and Compiler Contract`: no
  final `defineComponent` implementation.
- `nonGoals.4` (Issue #241, line 64) -> `First Vertical Slice`: no production
  DocCodeBlock migration.
- `nonGoals.5` (Issue #241, line 65) -> `Execution Profiles` and `Adoption Gate`:
  no premature hydration, activation, or mount implementation.
- `nonGoals.6` (Issue #241, line 66) -> `Decision`: compatibility does not
  constrain the selected model.

== Adoption Gate

This Proposal remains `Proposed` until the project accepts the selected model.
Acceptance must not be inferred from a passing existing hydration test or from a
smaller prototype bundle.

Before production implementation begins:

- #111 must preserve the relationship between this decision and the accepted
  DocCodeBlock contracts without changing their meaning.
- #112 must map every selected-model outcome and threshold to executable or
  reproducible evidence.
- The responsible package specifications and tests must be updated before their
  implementations change.
- #115, #118, #119, and #120 must consume this boundary in their respective
  analysis, placement, artifact, and integrated validation work.
- #222 and #224 must define the client-reactive profile before a reactive update
  is emitted as supported.
- A future server-delivery Proposal must be accepted before that profile is used.

No production code, artifact emitter, activation runtime, or public API is changed
by this file.
