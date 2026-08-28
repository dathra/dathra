#import "../../functions.typ": *
#import "../../settings.typ": *
#show: apply-settings

#design_proposal(
  issue: 241,
  name: "Execution model comparison and selective activation",
  summary: [
    This Proposal records an independent comparison of declarative UI execution
    models for the #103 goal. It makes a provisional selection for Dathomir's
    first supported profile, but does not claim that the selection is universally
    optimal or that the candidate has already met its performance gates.

    The decision evidence is limited to the #103 and #242 requirements, current
    repository source, current package specifications and tests, reproducible
    measurements, and official primary documentation for the compared models.
    The previous #241 draft, PR #244, #111, #105 through #110, and other Dathomir
    Proposals are excluded from the decision evidence. Existing Issues may still
    be named as implementation or evidence owners after this decision.
  ],
  scope: [
    - explain when server and client execution need separate responsibilities
    - compare six materially different execution models using one common rubric
    - select one initial Dathomir execution model and define its boundary
    - define server, client, compiler, runtime, artifact, identity, lifetime,
      failure, and resource responsibilities at the design level
    - separate server-only, stable interaction, client-reactive, and server-owned
      delivery profiles
    - define authoring information and compiler non-inference rules
    - define reproducible fixtures, baseline controls, measurements, and gates
    - define the first vertical slice and its later specification and evidence
      owners
  ],
  non_goals: [
    - implement the compiler, artifact emitter, activation runtime, or public API
    - migrate the production DocCodeBlock
    - decide concrete manifest, marker, chunk, payload, or wire encodings
    - decide a final `defineComponent` option shape
    - implement client-reactive revisions or server-owned delivery
    - treat compatibility with the current API, implementation, or data format as
      a selection criterion
    - use a passing current hydration test or an unimplemented prototype as proof
      that the selected model is accepted
  ],
  open_questions: [
    - #115 owns the accepted analysis subset, provenance, profile proof, and
      analysis resource limits; it blocks implementation that depends on unproven
      analysis but not this design decision
    - #118 owns the logical execution graph and legal placement plan; it blocks
      placement implementation but not this design decision
    - #119 owns concrete artifact encoding, determinism, caps, and build
      integration; it blocks artifact implementation and finalized artifact
      evidence but not this design decision
    - #222 and #224 own the client-reactive profile's revision contract and its
      validation; they block supported reactive emission but not the stable slice
    - #145 owns demand-driven server delivery and remote capabilities; it blocks
      the server-owned delivery profile only
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/103")[#103],
    link("https://github.com/dathra/dathra/issues/242")[#242],
    link("https://github.com/dathra/dathra/blob/c1a30ed86fd2bd79e1c742362f552e9f62ff9f98/docs/index.html#L64-L67")[docs entry markup],
    link("https://github.com/dathra/dathra/blob/c1a30ed86fd2bd79e1c742362f552e9f62ff9f98/docs/src/entry-client.ts#L1-L16")[docs client entry],
    link("https://github.com/dathra/dathra/blob/c1a30ed86fd2bd79e1c742362f552e9f62ff9f98/docs/src/DocsAppRoot.tsx#L1-L18")[docs route imports],
    link("https://github.com/dathra/dathra/blob/c1a30ed86fd2bd79e1c742362f552e9f62ff9f98/docs/src/entry-server.tsx#L1-L43")[docs server entry],
    link("https://github.com/dathra/dathra/blob/c1a30ed86fd2bd79e1c742362f552e9f62ff9f98/docs/src/components/DocCodeBlock/DocCodeBlock.tsx#L114-L169")[current code block],
    link("https://github.com/dathra/dathra/blob/c1a30ed86fd2bd79e1c742362f552e9f62ff9f98/packages/runtime/src/hydration/hydrate/implementation.ts#L963-L1080")[runtime hydration],
    link("https://github.com/dathra/dathra/blob/c1a30ed86fd2bd79e1c742362f552e9f62ff9f98/packages/runtime/src/hydration/hydrate/implementation.ts#L1080-L1243")[plan hydration],
    link("https://github.com/dathra/dathra/blob/c1a30ed86fd2bd79e1c742362f552e9f62ff9f98/packages/shared/src/islandsContract/implementation.ts#L1-L54")[islands metadata],
    link("https://github.com/dathra/dathra/blob/c1a30ed86fd2bd79e1c742362f552e9f62ff9f98/packages/transformer/src/transform/SPEC.typ#L9-L28")[transform contract],
    link("https://react.dev/reference/react-dom/client/hydrateRoot")[React hydrateRoot],
    link("https://docs.astro.build/en/concepts/islands/")[Astro Islands],
    link("https://qwik.dev/docs/concepts/resumable/")[Qwik Resumability],
    link("https://markojs.com/docs/explanation/targeted-compilation")[Marko Targeted Compilation],
    link("https://react.dev/reference/rsc/server-components")[React Server Components],
    link("https://docs.solidjs.com/reference/rendering/hydrate")[Solid hydrate],
    link("https://svelte.dev/docs/svelte/svelte-compiler")[Svelte compiler],
  ),
)

== Evidence Boundary

#interface_spec(
  name: "Independent decision evidence",
  summary: [
    The Proposal distinguishes facts about the current repository, facts from
    external documentation, measurements, and conclusions derived from those
    facts. A conclusion is not promoted to a fact merely because it supports the
    selected model.
  ],
  format: [
    - *Current fact*: a statement directly visible in the checked-out source,
      package specification, or executable test
    - *Measured fact*: a value produced by a named command, production build, or
      browser run with its revision and environment recorded
    - *External fact*: a statement supported by an official primary source for a
      compared framework or compiler
    - *Reasoned conclusion*: an evaluation made by applying the Issue rubric to
      the facts above
    - *Unknown*: a result that requires an unimplemented candidate or a future
      consumer measurement
  ],
  constraints: [
    - The decision must not cite #111 or #105 through #110 as a premise, accepted
      contract, or reason for selecting an option.
    - The previous #241 text, PR #244, and other Dathomir Proposals are not
      evidence for the comparison. The current source may be inspected as
      repository evidence, even when its behavior was designed in an earlier
      change.
    - Official documentation establishes what a model claims to provide; it does
      not establish that the model is best for Dathomir.
    - Existing Dathomir hydration or plan primitives establish current capability,
      not route-level partitioning, zero-root emission, or candidate acceptance.
    - Current baseline numbers are not candidate results. The candidate must be
      compared with a behavior-equivalent control fixture.
  ],
  examples: [
    - `entry-client.ts` calling `hydrate(document)` is a current fact.
    - Astro's default removal of client JavaScript from static components is an
      external fact.
    - "selective activation is the best first Dathomir model" is a reasoned
      conclusion and remains provisional until the vertical-slice gates pass.
  ],
)

== Goal and Decision Boundary

The owning Goal is to preserve the observable behavior of declarative UI while
minimizing the client burden.

The burden includes code and data sent to the browser, client bootstrap,
JavaScript execution, CPU, memory, network requests, retained state, and resource
lifetime. A smaller script is not sufficient if it changes the server-rendered
result, loses interaction behavior, or leaves resources alive after disposal.

The decision is whether server and client execution need separate responsibilities,
and if so, what boundary and handoff make that separation useful without making
the framework unable to express reactive browser behavior.

=== Why the current path creates a decision

The current docs page always places `/src/entry-client.ts` in the HTML shell.
That entry binds a store, imports `DocsAppRoot`, and calls `hydrate(document)`.
`DocsAppRoot` statically imports the documentation page modules, while the server
entry prepares syntax highlighting before rendering a route.

This path can make a server-only route pay for client bootstrap even when it has no
browser behavior. It also leaves the client responsible for discovering behavior
after the route and component code have been loaded. The current source does not
prove that every server-only dependency reaches the client, but it does prove that
the route has no pre-emission zero-root decision.

Without a separation, the framework may still optimize a broad hydration path,
but it cannot establish a route with no client root before loading the entry that
would discover that fact. Without a client responsibility, however, a separation
would only move code between artifacts and would not make an interactive control
work. The decision therefore needs both an execution boundary and a post-SSR
activation rule.

=== Terms used by the comparison

- *Server-only*: the instance has no accepted browser behavior or browser-visible
  revision after the initial response.
- *Stable interaction*: the server creates a stable initial result and the browser
  attaches a bounded interaction to that result.
- *Client-reactive*: the browser owns a declared reactive value and a bounded set
  of update targets after the initial response.
- *Server-owned delivery*: a separately accepted server authority sends later
  revisions to a browser receiver. It is not an implicit fallback.
- *Client root*: a logical browser owner for an accepted client closure. A physical
  chunk may serve several roots, but it does not merge their identity or lifetime.

== Current Repository Evidence

The following observations were taken from revision
`c1a30ed86fd2bd79e1c742362f552e9f62ff9f98` and are not imported from another
Proposal.

- `docs/index.html` always references `/src/entry-client.ts` in the HTML shell.
- `docs/src/entry-client.ts` calls `bindStoreToHost`, dynamically imports
  `DocsAppRoot`, and calls `hydrate(document)` in a microtask.
- `docs/src/DocsAppRoot.tsx` imports all documentation page modules into one route
  renderer map.
- `docs/src/entry-server.tsx` performs request routing and calls
  `prepareSyntaxHighlighting()` before SSR rendering.
- The current `DocCodeBlock` creates a `copied` signal, derives its source during
  component setup, writes to `navigator.clipboard`, schedules a reset timer, and
  marks its highlighted subtree with `hydrate:preserve`.
- `hydrateRoot()` tracks hydrated `ShadowRoot` values in a `WeakMap`, restores an
  optional store snapshot, creates a cleanup root, and returns a disposer.
- `hydrateWithPlan()` can connect text, attribute, event, insert, and spread
  bindings to existing DOM paths and markers. It can skip nested or preserved
  boundaries and reports path or marker mismatches through the hydration mismatch
  path.
- The shared islands contract defines `load`, `visible`, `idle`, `interaction`,
  and `media` strategies. The runtime scheduler can collect hosts and dispose a
  scheduled activation.
- The transformer already emits CSR `fromTree()` output, SSR shells and dynamic
  helpers, and client directive metadata. Generic plan metadata and explicit
  unsupported reasons are current implementation capabilities, not proof that a
  route-level artifact partitioner exists.
- SSR state serialization supports serializable values such as dates, regular
  expressions, maps, sets, bigints, arrays, objects, and circular references. This
  is state transfer, not proof that arbitrary component continuations are
  resumable.

=== Reproduced baseline

The workspace and docs builds were rerun in the dedicated worktree at the same
revision:

- `pnpm build` completed successfully.
- `pnpm --filter @dathra/docs build` completed successfully.
- `docs/dist/client/assets/main-DoZ2D7Hc.js` is 52,156 bytes raw and 16,832 bytes
  gzip.
- `docs/dist/client/assets/DocsAppRoot-BRfkl5ir.js` is 102,441 bytes raw and
  24,801 bytes gzip.
- The two route-local client assets total 154,597 bytes raw and 41,633 bytes gzip.
- The `/` response is 19,120 bytes and the `/getting-started-csr` response is
  54,612 bytes.
- `/getting-started-csr` contains eight `dathra-code` hosts and eight Copy
  controls in the open shadow-tree traversal.
- A Chromium run against the production preview requested both client assets for
  `/` and `/getting-started-csr`.
- A programmatic click on the first Copy control left all eight labels as `Copy`.

The current browser result is a baseline implementation observation, not the
accepted behavior of the future slice. The browser route renders, but the Copy
state gap means its exact cost numbers cannot serve as the only behavior-equivalent
comparison control.

== Candidate Comparison

=== Comparison rubric

Every option is evaluated using the same criteria derived from Issue #241:

- `C1 client cost`: code, data, startup, CPU, memory, network, and retained state
- `C2 observable behavior`: server output and required browser interaction
- `C3 responsibility`: server-only, browser-only, and cross-boundary ownership
- `C4 analysis boundary`: treatment of arbitrary JavaScript and unsupported input
- `C5 platform fit`: Web Components, DSD, Shadow DOM, repeated instances, and
  cleanup
- `C6 state and lifetime`: reactive updates, disposal, late callbacks, and handoff
- `C7 zero root`: server-only output without client bootstrap or client artifact
- `C8 authoring cost`: declarations, restrictions, and source ergonomics
- `C9 implementation value`: complexity relative to the burden and consumers

The comparison uses qualitative outcomes because no candidate implementation has
yet produced a fair common benchmark. `Strong` means the model supplies the
responsibility directly, `Partial` means another contract is needed, and `Weak`
means the criterion is outside the model's normal boundary.

=== Option 1: current hydration optimization

- *Boundary*: the document, custom-element root, or ShadowRoot remains the
  hydration boundary. Server and client continue to share a render-oriented path.
- *Startup and cost*: the entry can reduce work after it loads, but it must load an
  entry to discover hydration work. It does not guarantee zero client output for a
  route that has no client behavior.
- *DOM and handoff*: server HTML can be reused when the client render matches it;
  markers and state transfer remain available. There is no required pre-emission
  closure or per-instance activation record.
- *Reactivity and lifetime*: root-scoped effects and events can work, but discovery
  and failure scope remain broader than one behavior. A mismatch may require a
  framework-specific fallback.
- *Compiler and zero root*: the compiler can optimize templates and markers, but
  need not prove server/client ownership. `C7` is weak for the current entry.
- *Authoring and value*: authoring cost is low and platform fit is strong, but the
  model cannot establish the full #103 goal without a larger architectural change.
- *Result*: retain as the behavior-equivalent control and migration baseline, not
  as the primary model.

=== Option 2: explicit islands or partial hydration

- *Boundary*: an author-selected component or subtree becomes a separately
  scheduled client island. Unmarked content remains server-rendered content.
- *Startup and cost*: a page with no islands can omit client bootstrap, and an
  island can defer loading until load, idle, visibility, interaction, or media
  conditions. Island cost still depends on whether its client path mounts,
  reruns, or directly activates the existing DOM.
- *DOM and handoff*: an island boundary identifies where client work may occur, but
  it does not by itself define DOM authority, source identity, payload authority,
  or instance-scoped cleanup.
- *Reactivity and lifetime*: the island usually owns reactive work for its subtree,
  which is useful for widgets but may be broader than a stable interaction's
  minimum closure. Nested Web Component lifetime needs an additional contract.
- *Compiler and zero root*: the compiler can record boundaries and triggers. It
  does not necessarily prove transitive server-only exclusion or a client-safe
  update closure. `C7` is strong only when the shell has no global entry.
- *Authoring and value*: the directive is understandable and useful as scheduling
  input, but it is not a complete execution model for Dathomir's ownership and
  handoff requirements.
- *Result*: retain as a scheduling mechanism that the selected model may consume,
  not as the complete model.

=== Option 3: compiler-directed selective activation

- *Boundary*: the compiler classifies each rendered instance and computes a
  bounded server closure, client closure, profile, identity, and lifetime before
  emission. A physical route or chunk aggregates output but does not own instance
  behavior.
- *Startup and cost*: a client root is emitted only for an accepted browser
  behavior or update. Stable activation loads behavior code and attaches it to
  existing DOM without loading server-only presentation code or rerunning the
  component body.
- *DOM and handoff*: the server owns the initial DOM and DSD. The client validates
  a per-instance activation record and binds known targets. The record contains
  only values required by the selected profile.
- *Reactivity and lifetime*: stable interaction and client-reactive updates have
  separate closures and authorities. Each root owns its listeners, effects,
  timers, subscriptions, and retained handoff until disposal.
- *Compiler and zero root*: the compiler must prove ownership and dependency
  reachability, and must fail closed for opaque or contradictory input. A complete
  server-only plan emits no route-local client root.
- *Authoring and value*: semantic declarations and a bounded supported subset add
  authoring constraints. The cost buys one place to validate ownership, closure,
  zero-root output, and unsupported behavior before the browser runs.
- *Result*: provisionally selected for the initial Dathomir profile. It remains a
  hypothesis until the equivalent fixtures meet the measurement and behavior
  gates.

=== Option 4: resumability

- *Boundary*: the server serializes enough listener, component, state, dependency,
  and closure information for the browser to resume without replaying the whole
  component tree.
- *Startup and cost*: event-driven loading can reduce eager execution, but the
  serialized handoff, loader, deserialization, and deferred module requests are
  part of the client cost.
- *DOM and handoff*: the server DOM can be preserved, but serialized references
  must identify the correct host and survive DOM changes. The handoff is central
  rather than a small stable interaction record.
- *Reactivity and lifetime*: subscriptions and state can resume, but the model
  needs serialization, invalidation, ownership, and disposal rules for arbitrary
  continuations.
- *Compiler and zero root*: a large compiler and serialization surface is needed;
  opaque closures and unsupported values are a primary constraint. Routes without
  resumable behavior can be zero-root, but the general model remains complex.
- *Authoring and value*: the model can provide excellent startup behavior for
  suitable applications, but it imposes DOM-centric and serializability rules
  beyond the first Dathomir consumer.
- *Result*: reject as the initial primary model. Reconsider only if a consumer
  requires resumable continuations and a separate Proposal accepts that cost.

=== Option 5: RSC-like module graph partitioning

- *Boundary*: server-only and client-capable modules are separated by a module
  graph and a serializable data boundary. Client components still need a browser
  execution model.
- *Startup and cost*: server-only dependencies can be removed from the client
  graph, and server output can avoid a global bundle. Module partitioning alone
  does not define client activation or update cost.
- *DOM and handoff*: the server owns server component output, while the client
  component boundary still requires a mount or activation contract. Serializable
  props are not equivalent to a per-instance DOM binding record.
- *Reactivity and lifetime*: client modules can own reactive state and a server can
  produce later output, but the revision authorities and disposal rules must be
  joined explicitly.
- *Compiler and zero root*: module graph classification and serializability checks
  are strong. They do not by themselves compute DOM paths, nested Shadow DOM
  boundaries, or cleanup owners. `C7` is possible for server-only routes.
- *Authoring and value*: server/client module boundaries are a substantial
  authoring and build constraint. They solve dependency reachability, not the full
  Web Component activation problem.
- *Result*: reject as the primary model, but use module reachability and
  serializability checks as evidence inside the selected compiler boundary.

=== Option 6: uncompiled progressive enhancement

- *Boundary*: server-rendered HTML is enhanced by hand-written handlers attached to
  selectors or custom element hosts.
- *Startup and cost*: a static route can ship no JavaScript, and an isolated
  control can ship very little code. The framework has no common plan for sharing
  or deduplicating that behavior.
- *DOM and handoff*: existing DOM can remain authoritative. Values are usually
  read from attributes, text, or ad hoc state, which does not establish a common
  instance identity or handoff authority.
- *Reactivity and lifetime*: one handler can support one interaction, but reactive
  updates, repeated instances, asynchronous completion, timers, and disposal are
  left to each author.
- *Compiler and zero root*: little compiler work is required, which also means
  server-only reachability and unsupported behavior are not proven before delivery.
  `C7` is strong only for pages with no enhancement.
- *Authoring and value*: it is useful for simple controls, but it does not scale to
  a general declarative UI framework with shared reactive and lifecycle semantics.
- *Result*: reject as the general model. Permit it only as an implementation
  technique represented by an accepted Dathomir profile.

=== Criterion synthesis

- `C1`: Options 2, 3, 4, and 5 can reduce selected categories. Option 3 is the
  only compared model that makes code, data, startup, runtime state, and ownership
  part of one pre-emission plan. This is a reasoned advantage, not a measured
  result.
- `C2`: Options 1 and 3 directly preserve SSR DOM when their client path matches
  the server result. Option 2 needs an activation choice; option 4 needs correct
  continuation reconstruction; option 5 needs a client boundary; option 6 needs
  hand-written behavior.
- `C3`: Option 3 joins server closure, client closure, and browser owner. Option 5
  gives a strong module boundary but not a complete DOM or lifetime boundary.
- `C4`: Options 3 and 5 require explicit proof or serializability. Option 4 has
  the largest proof surface. Options 1, 2, and 6 can leave opaque work to runtime
  discovery or author discipline.
- `C5`: Option 1 fits current primitives most directly. Option 3 uses the existing
  DSD, marker, plan, host, and cleanup primitives while adding pre-emission
  ownership. The other options need additional platform contracts.
- `C6`: Option 3 keeps stable, reactive, and server-owned authorities distinct.
  The alternatives can provide parts of this behavior but do not provide the same
  common boundary without additional design work.
- `C7`: Options 2, 4, 5, and 6 can be zero-root in restricted configurations.
  Option 1 does not guarantee it for the current global entry. Option 3 makes
  complete proof of an empty root set a first-class result.
- `C8`: Option 1 is cheapest initially. Option 2 is familiar. Options 3 through 5
  add compiler or serialization constraints, while option 6 shifts lifecycle work
  to each author. Option 3 accepts declarations only where browser behavior exists.
- `C9`: Option 3 concentrates complexity in build-time proof and leaves the
  browser with a small activation primitive. The vertical slice must verify that
  this complexity removes enough client burden to justify itself.

== Decision

#adr(
  header("Provisional initial execution model", Status.Proposed, "2026-08-28"),
  [
    The current route evidence establishes a global client entry and a broad
    hydration path, while the external comparison establishes distinct trade-offs
    among hydration, islands, selective compilation, resumability, module graph
    partitioning, and progressive enhancement. No candidate implementation has
    yet produced equivalent cost and behavior evidence.

    The decision can therefore select an initial direction, but it cannot honestly
    claim a final universal optimum. The selected direction must be falsifiable by
    the first vertical slice rather than protected by the existing Proposal text.
  ],
  [
    Adopt *compiler-directed selective activation with per-instance ownership* as
    Dathomir's initial execution model.

    The model has these design rules:

    - The compiler classifies each rendered component instance and computes a
      finite logical plan before artifact emission and response commitment.
    - The server owns source acquisition, server-only computation, initial HTML,
      Declarative Shadow DOM, and values that have no browser owner.
    - The client receives only the smallest accepted closure for a stable
      interaction or client-reactive update. Stable activation attaches behavior to
      existing DOM and does not rerun the component body.
    - A client root exists only when the plan proves a post-SSR browser behavior or
      update. A complete server-only plan produces no route-local client bootstrap,
      client artifact reference, activation marker, or handoff record.
    - A rendered component instance owns its logical identity and client lifetime.
      Physical chunk sharing must not merge state, source, listeners, timers, or
      disposal between instances.
    - A scheduling directive controls activation timing only. It does not prove
      ownership, closure reachability, or the existence of a client root.
    - Missing, opaque, stale, or contradictory ownership evidence is a build-time
      diagnostic. It is not permission to classify the instance as server-only or
      to fall back silently to whole-component replay.
  ],
  [
    The selection gives Dathomir one boundary that can express zero-root output,
    direct DOM activation, dependency exclusion, instance identity, and cleanup.
    It also reuses current transformer, DSD, marker, plan, and root primitives as
    implementation foundations without treating those primitives as proof that the
    selected architecture already exists.

    The cost is a compiler-supported semantic subset and explicit ownership
    information. The model is rejected by its own gates if the compiler cannot
    prove the boundary or if the first consumer does not obtain a meaningful cost
    reduction without losing behavior.
  ],
  alternatives: [
    1. *Current hydration optimization* remains the control because it is the
       broadest existing behavior path, but it does not guarantee zero-root output
       for the current HTML entry.
    2. *Explicit islands* remains useful as scheduling input, but a trigger does
       not define closure, handoff, identity, or cleanup on its own.
    3. *Resumability* is rejected for the initial profile because its serialized
       continuation and lifetime surface is broader than the first consumer needs.
    4. *RSC-like module partitioning* is rejected as the primary model because
       module reachability does not define DOM activation or Web Component lifetime.
    5. *Uncompiled progressive enhancement* is rejected as a general model because
       it leaves reactive and lifecycle semantics to each consumer.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/103")[#103],
    link("https://github.com/dathra/dathra/issues/242")[#242],
    link("https://react.dev/reference/react-dom/client/hydrateRoot")[React hydrateRoot],
    link("https://docs.astro.build/en/concepts/islands/")[Astro Islands],
    link("https://qwik.dev/docs/concepts/resumable/")[Qwik Resumability],
    link("https://markojs.com/docs/explanation/targeted-compilation")[Marko Targeted Compilation],
    link("https://react.dev/reference/rsc/server-components")[React Server Components],
  ),
)

== Logical Plan and Ownership

#interface_spec(
  name: "Logical execution plan",
  summary: [
    The compiler and later artifact planner exchange a logical plan. The plan is
    a design-level ownership contract, not a browser payload and not a final wire
    encoding.
  ],
  format: [
    - `render-transaction`: one coherent analysis, classification, and emission
      result
    - `component-instance`: one rendered occurrence with its profile, identity,
      ownership, and failure scope
    - `execution-profile`: `server-only`, `stable-interaction`,
      `client-reactive`, or explicitly selected `server-owned-delivery`
    - `server-closure`: modules and values required for the initial server result
    - `client-closure`: the smallest accepted browser behavior or update closure
    - `activation-record`: logical identity, selected profile, required boundary
      values, and artifact admission information
    - `provenance`: source, dependency, and analysis evidence used to validate the
      plan. Provenance is not sent to the browser as a substitute for bindings.
  ],
  constraints: [
    - The plan is complete before artifact emission begins.
    - Rendered DOM inspection is not ownership proof. DOM paths and markers are
      activation references after ownership has been established.
    - A route may aggregate physical output, but it cannot replace instance
      identity or activation lifetime.
    - Unknown or contradictory evidence is a partition failure.
    - The plan cannot silently change profile after response commitment.
    - Physical shared chunks are valid only when each logical closure remains
      independently validated.
  ],
  examples: [
    - A static article has a complete plan with no client root.
    - A code block with Copy has a server closure for source presentation and a
      stable client closure for the control.
    - A counter has a client-reactive closure for its value and update targets.
  ],
)

#interface_spec(
  name: "Server and client closure boundary",
  summary: [
    The selected model separates logical responsibility before physical bundling.
    The final chunk layout is deferred, but no chunk layout may violate these
    inclusion rules.
  ],
  format: [
    - *Server closure*: request input, source acquisition, normalization,
      presentation, server-only dependencies, initial DOM, DSD, and explicitly
      server-owned values
    - *Stable client closure*: activation admission, instance lookup, boundary
      value consumption, event handling, stable state, and disposal
    - *Client-reactive closure*: client-safe dependencies, reactive reads and
      writes, bounded rendering targets, and disposal for a declared revision
    - *Server-owned delivery receiver*: only the receiver and bounded DOM
      application required by a separately accepted delivery profile
    - *Shared boundary*: platform values and runtime primitives explicitly required
      by both sides. Server-only presentation code is not shared merely because
      the component has a client interaction.
  ],
  constraints: [
    - A client closure cannot reach a server-only dependency transitively.
    - The browser does not receive arbitrary server closures, full provenance, or
      unrelated route data as an activation shortcut.
    - The server does not install browser listeners, timers, Clipboard calls, or
      client-owned effects.
    - Missing closure proof is an emission or partition failure, not permission to
      rerun the whole component in the browser.
  ],
)

=== Identity and association

The logical activation identity is the tuple of the finalized artifact identity,
response render identity, and rendered component-instance identity. The exact
encoding is deferred, but DOM position, CSS selectors, highlighted text, equal
source text, and route names are not valid substitutes for the tuple.

One instance may be represented in a shared physical chunk, but its activation
record, state, listeners, timers, source reference, and disposer remain separate.
An activation request for one instance must not discover or attach to a nearby
instance.

== State and Lifetime

#behavior_spec(
  name: "plan and activation state machine",
  summary: [
    Planning and browser activation use one vocabulary for terminal states,
    duplicate requests, disposal, and late callbacks.
  ],
  preconditions: [
    - a render transaction has a declared source and dependency evidence
    - an instance either has no post-SSR behavior or has an accepted client profile
  ],
  steps: [
    1. `unplanned` enters `planned` only after profile, closure, identity, and
       failure evidence are complete.
    2. Missing, opaque, stale, or contradictory evidence enters terminal
       `partition-failed` before artifact emission.
    3. A complete plan enters `emitted` only after artifact materialization and
       response commitment succeed atomically.
    4. A client-rooted instance enters `dormant` in the browser until its selected
       activation condition is admitted. A server-only instance creates no browser
       state.
    5. One admitted request enters `activating`. Concurrent requests for the same
       identity join that attempt and cannot create a second owner, listener, timer,
       or handoff record.
    6. Valid admission enters `active`; invalid artifact, identity, host, control,
       or handoff validation enters terminal `rejected` while preserving readable
       SSR DOM.
    7. `dormant`, `activating`, and `active` may enter terminal `disposed` when
       their owner is removed or explicitly disposed.
  ],
  postconditions: [
    - `partition-failed`, `rejected`, and `disposed` do not silently select another
      profile or perform whole-component replay.
    - `active` owns all listeners, effects, timers, subscriptions, and retained
      boundary values created by its closure.
    - disposal releases those resources and invalidates callbacks that complete
      later.
    - a late timer, promise, event, or module-load completion cannot resurrect an
      instance after `disposed`.
  ],
  errors: [
    - a missing plan is not a successful `server-only` result
    - duplicate activation admission is idempotent and does not duplicate owners
    - automatic retry after `rejected` or `disposed` is not permitted. A future
      explicit retry policy requires a separate decision and identity rule.
  ],
)

== Execution Profiles

#behavior_spec(
  name: "server-only profile",
  summary: [
    A complete plan emits the server-rendered result without a route-local client
    root when no browser behavior or browser-visible revision exists.
  ],
  preconditions: [
    - every instance has complete analysis and no accepted post-SSR client owner
    - the plan's client-root set is empty
  ],
  postconditions: [
    - the response may contain HTML, DSD, static style, and server-owned values
    - the route contains no client entry reference, bootstrap, activation marker,
      client root, or client handoff record
    - the browser performs no route-local activation work
  ],
  errors: [
    - incomplete evidence enters `partition-failed` rather than `server-only`
  ],
)

#behavior_spec(
  name: "stable interaction profile",
  summary: [
    The server creates a stable initial result and the client attaches one bounded
    interaction closure to existing DOM.
  ],
  preconditions: [
    - the instance has an accepted stable interaction
    - the server can produce the complete initial DOM and required boundary values
    - no browser-visible revision is required for this profile
  ],
  steps: [
    1. The server renders the initial result and emits the activation record.
    2. The browser admits the root and validates artifact and instance identity.
    3. The client resolves the compiler-selected target and attaches behavior
       without replacing the server-rendered display subtree.
    4. The root or instance disposer releases the interaction resources.
  ],
  postconditions: [
    - the initial SSR DOM remains authoritative for display content
    - the client receives only the values required by this interaction
    - each repeated instance has independent state and cleanup
  ],
  errors: [
    - a missing or mismatched activation record enters `rejected` for the affected
      instance and preserves its readable SSR output
    - source or presentation work that requires a browser-visible revision cannot
      be silently frozen as stable interaction
  ],
)

#behavior_spec(
  name: "client-reactive profile",
  summary: [
    A browser-visible revision is owned by an explicit client-safe update closure,
    not by the server-only path or a whole-component replay.
  ],
  preconditions: [
    - the analysis proves a client-visible revision
    - the client closure contains only browser-safe dependencies and bounded update
      targets
    - #222 accepts the revision and atomicity contract and #224 validates it
  ],
  steps: [
    1. The server emits the initial SSR result.
    2. The browser admits the reactive root and its declared dependency.
    3. A revision updates only the accepted client-owned targets and boundary
       values.
    4. Disposal ends the reactive owner and invalidates late revisions.
  ],
  postconditions: [
    - the client owns the revision and its cleanup
    - the update cannot reach a server-only dependency
    - a stable interaction record is not mutated into a revision stream
  ],
  errors: [
    - missing client-safe closure or atomicity proof is an unsupported profile
      diagnostic before successful artifact commitment
    - server-owned delivery is not selected implicitly to hide that failure
  ],
)

#behavior_spec(
  name: "server-owned delivery profile",
  summary: [
    A separately accepted server authority may send later revisions to a bounded
    client receiver.
  ],
  preconditions: [
    - #145 or a later owner accepts authority, transport, serialization, stale
      update policy, and disposal behavior
    - the author explicitly selects the delivery profile
  ],
  steps: [
    1. The server emits the initial result and delivery admission record.
    2. The client admits only the receiver closure.
    3. The server authority sends revisions under its accepted lifetime and failure
      rules.
  ],
  postconditions: [
    - the server remains the revision authority
    - the receiver does not claim client-reactive ownership of the source
    - delivery resources and late messages are bounded by the delivery contract
  ],
  errors: [
    - the profile is unsupported until an owning Issue accepts its contract
    - stable or client-reactive behavior cannot silently become a delivery session
  ],
)

=== Profile selection rules

The compiler applies these rules after it has complete semantic and dependency
evidence:

1. Select `server-only` when no accepted post-SSR browser behavior or revision
   exists.
2. Select `stable-interaction` when a declared interaction can attach to the
   stable initial DOM and no browser-visible revision is required.
3. Select `client-reactive` when a browser-visible revision and a client-safe
   bounded update closure are proven.
4. Select `server-owned-delivery` only when its separate authority contract exists
   and the author explicitly requests it.
5. Report an unsupported profile when the compiler cannot prove the selected
   boundary.

The compiler must not infer a profile from a tag name, file name, route name, import
path, DOM shape, signal presence, event prop, `typeof window`, or a small bundle.
Those facts may be analysis inputs, but none is ownership proof by itself.

== Authoring and Compiler Contract

#interface_spec(
  name: "Execution semantics supplied by the author",
  summary: [
    The final public syntax remains open. Every supported browser behavior must
    nevertheless provide semantic information through a component definition or a
    compiler-facing descriptor.
  ],
  format: [
    - post-SSR profile: server-only, stable interaction, client-reactive, or
      explicitly server-owned delivery
    - behavior boundary: host, control, DOM region, and component instance owned
      together
    - boundary values: snapshot or revision values crossing the boundary and their
      authority
    - client-safe closure: browser operations and dependencies allowed to execute
    - identity and lifetime: association key and owner of listeners, effects,
      timers, subscriptions, and retained boundary values
    - failure result: build diagnostic, rejected activation, permitted retryable
      operation, or ignored late callback
  ],
  constraints: [
    - A declaration cannot authorize a server-only dependency in a client closure.
    - A declaration cannot claim a browser-visible revision without a lifetime
      owner and update boundary.
    - A declaration that contradicts dependency evidence fails partitioning rather
      than being trusted blindly.
    - An activation schedule is not a substitute for ownership or closure proof.
    - The final spelling of the API is outside this Proposal.
  ],
  examples: [
    - A code block declares server-owned presentation and a stable client-owned
      control interaction.
    - A counter declares a client-owned value, update targets, and disposal owner.
    - A static article declares no post-SSR behavior and therefore no client root.
  ],
)

=== Facts the compiler may derive

The compiler may derive the following after the author declaration and accepted
analysis subset are available:

- static DOM structure, dynamic text and attribute locations, and instance
  occurrences
- module and symbol reachability for server and client closures
- signal dependencies when the supported analysis can prove them
- stable marker or path references used by activation
- logical root placement and route-level physical aggregation
- minimal handoff fields for the selected profile
- transitive reachability of server-only dependencies from a client entry
- deterministic artifact inputs and provenance records

These are validation facts. They do not become an implicit public policy merely
because the compiler can observe them.

=== Facts the compiler must not infer

The compiler must not infer:

- client ownership from a component or package name, route, file, or import path
- server-only ownership from the absence of a recognized event or signal read
- stable interaction from a signal read when a browser-visible revision is proven
- a client-safe closure from `typeof window`, dynamic import, bundle size, or one
  browser's successful execution
- instance identity from DOM position, CSS selector, highlighted text, or equal
  normalized source
- server delivery from failed client-reactive analysis
- zero-root output from missing metadata, incomplete traversal, or a runtime
  decision made after response commitment

Unknown behavior is not equivalent to `server-only`. The partition phase reports
the missing proof and prevents a misleading artifact from being emitted.

== Baseline and Measurement

=== Behavior-equivalent control

The current docs route is a repository anchor, not the normative control, because
its Copy interaction currently remains unchanged after a programmatic click. The
measurement work must construct `B0`, a conventional hydration control with the
same fixture source and expected observable behavior as the candidate. The current
route measurements are retained as `B0-observed` context and must not be presented
as proof for the selected model.

=== Fixtures

The first common fixture set is:

- `F0 server-only`: static SSR and DSD output with no post-SSR browser behavior
- `F1 stable-one`: one server-rendered code block with readable output, one Copy
  control, one stable interaction, and an explicit success or failure outcome
- `F2 stable-many`: thirty-two repeated blocks, including equal source text in two
  instances, to test identity and resource scaling
- `F3 reactive-update`: a small component with a browser-visible signal revision,
  bounded update targets, and no server-only dependency in the client closure
- `F4 unsupported`: opaque or contradictory browser behavior that has no accepted
  profile and must fail before artifact commitment

`F0` is required because an optimization that only helps interactive routes does
not establish the zero-root part of the Goal. `F1` is required because a static
route alone cannot distinguish selective activation from simply removing all
behavior.

=== Measurement method

The control and candidate use the same fixture source, revision, Node version,
production build command, preview server, Chromium version, and browser profile.
The browser run uses a cold cache and locally served fixture assets. External font,
favicon, and unrelated requests are excluded from Dathomir cost totals. Each
fixture is navigated at least thirty times; report median and p95 for time values.

Measure:

1. *Network and data*: HTML bytes, raw and gzip client script bytes, handoff bytes,
   client request count, and route-local client entry count.
2. *Startup and CPU*: client entry evaluation through the accepted activation
   commit, plus trace CPU for that interval.
3. *Memory*: peak JavaScript heap, or the same browser fallback for both control
   and candidate when `performance.measureUserAgentSpecificMemory` is unavailable.
4. *Runtime state*: activation roots, listeners, effects, timers, subscriptions,
   retained handoff records, and all of those resources after disposal.
5. *Dependency closure*: generated metadata and transitive reachability. A source
   string search alone is insufficient evidence that server-only code is absent.
6. *Behavior*: SSR readability, DOM identity, exact instance association, repeated
   interaction, failure outcome, disposal, late callbacks, and independent
   multiple instances.

=== Review thresholds

These thresholds are falsifiable gates for the first selected profile. They are
not claims about the current baseline and do not authorize implementation by
themselves.

- `T0 zero root`: `F0` has zero route-local client script bytes, zero client
  requests, zero activation roots, zero listeners, zero effects, zero timers, and
  zero handoff records. The response contains no client bootstrap reference.
- `T1 transfer`: for `F1`, candidate raw and gzip client JavaScript are each at
  most 50% of behavior-equivalent `B0`, and the candidate has no reachable
  server-only presentation dependency.
- `T2 startup`: for `F1`, median and p95 startup CPU are each at most 50% of `B0`.
- `T3 memory`: for `F1`, candidate peak heap is no greater than `B0`; the retained
  handoff and all activation resources are zero after disposal.
- `T4 requests and state`: `F1` has no more client entry requests than `B0`, one
  logical owner for the control, no duplicate listeners or timers after duplicate
  admission, and no resource retained after disposal.
- `T5 instance scaling`: in `F2`, executable closure bytes, client entry requests,
  and shared bootstrap CPU do not grow linearly with instance count. Per-instance
  handoff and resources may grow only with the values required by each instance,
  and each instance remains independently disposable.
- `T6 reactive boundary`: `F3` updates only the accepted client-reactive targets,
  never reaches server-only code or an unrelated instance, and releases its owner
  after disposal. A separate numeric reactive budget is owned by #222 and #224.
- `T7 unsupported failure`: `F4` reports the unsupported profile before artifact
  commitment and emits no partial bootstrap, handoff, or implicit whole-component
  replay.
- `T8 behavior`: all fixture behavior checks pass. A byte or CPU reduction that
  changes DOM authority, instance identity, failure outcome, or cleanup fails the
  selected model.

The 50% gates are intentionally explicit and may reject the provisional selection.
They are applied to equivalent controls, not to the current broken Copy route.

== First Vertical Slice

=== Slice definition

The first implementation slice is limited to the two profiles needed to falsify
the initial decision:

- `F0 server-only` proves a readable response with no client reference or browser
  activation.
- `F1 stable-one` proves one server-rendered code block whose Copy control
  activates in place and owns its state and cleanup.

The slice must test successful interaction, unavailable or rejected Clipboard API,
repeated interaction, multiple instance identity, disposal, and late completion.
The fixture feature specification must define the exact observable failure outcome
before implementation begins. Server presentation remains server-owned; the slice
does not implement client-reactive revisions or server-owned delivery.

The slice is complete only when artifact, browser, and resource evidence show that
the client closure is the required behavior closure rather than a replay of the
whole docs component tree.

=== Specification and test ownership

The implementation chain must update the owning specification and executable test
before changing the implementation:

- `@dathra/components`: update
  `packages/components/src/defineComponent/SPEC.typ` and its
  `implementation.test.ts` if semantic execution metadata becomes part of a
  component definition.
- `@dathra/transformer`: update
  `packages/transformer/src/transform/SPEC.typ` and its
  `implementation.test.ts` for profile analysis, closure output, and unsupported
  diagnostics. Mode-specific changes must update their existing specs and tests.
- `@dathra/plugin`: update its `SPEC.typ` and `implementation.test.ts` for build
  mode propagation, entry admission, and artifact-plan integration.
- `@dathra/runtime`: update the responsible hydration, marker, deserialize, or
  event specs and tests for activation admission, existing-DOM binding, handoff
  lifetime, and cleanup. A new public API requires its own feature specification
  and test.
- `@dathra/core`: update its specification and tests only if the public facade
  changes. It must not become a second owner of the logical plan.
- `docs`: create a feature specification and executable test for the code-block
  fixture before migrating the production component or entries.
- `playgrounds/e2e`: add browser routes and tests for zero-root output, stable
  activation, closure exclusion, failure, repeated interaction, and disposal.

=== Implementation order after acceptance

1. Transfer the accepted model and profile rules to package specifications and
   executable tests.
2. Implement analysis and logical plan output with diagnostics for missing proof.
3. Implement plugin admission and complete artifact planning without partial output.
4. Implement runtime admission and direct DOM activation using the accepted state
   and lifetime rules.
5. Validate `F0` and `F1` before migrating the production docs component.
6. Run artifact, browser, and resource evidence against `F0` through `F4` and the
   behavior-equivalent control.

No production implementation is authorized by this Proposal alone.

== Evidence and Follow-up Ownership

The following are coordination owners, not evidence used to select Option 3:

- *Analysis*: #115 owns the supported analysis subset, profile proof, provenance,
  and analysis caps. It blocks implementation that depends on unsupported proof.
- *Placement*: #118 owns logical execution graph and legal placement. It blocks
  placement implementation.
- *Artifact*: #119 owns concrete encoding, deterministic emission, size caps, and
  transitive server-only exclusion. It blocks finalized artifact implementation.
- *Integrated validation*: #120 owns production artifact and browser validation. It
  blocks production rollout of the selected slice.
- *Evidence mapping*: #112 owns the mapping from logical states and resource
  metrics to executable or reproducible evidence.
- *Client-reactive profile*: #222 owns revisions and #224 owns its validation. They
  block supported `client-reactive` emission only.
- *Server-owned delivery*: #145 owns demand-gated delivery and remote capabilities.
  It blocks that profile only and is not a fallback for missing client proof.

The current decision remains reviewable without any of these later implementation
contracts. Each owner becomes blocking only for the capability named above.

== Behavior Contract

#behavior_spec(
  name: "partition before emission",
  summary: [
    The compiler must produce a complete supported profile and closure plan before
    the emitter publishes client output.
  ],
  preconditions: [
    - the render transaction contains every relevant component instance
    - author and dependency evidence is available to the accepted analysis subset
  ],
  steps: [
    1. Analyze each instance.
    2. Select one profile or report `partition-failed`.
    3. Validate server and client closures, identity, and resource ownership.
    4. Pass the complete plan to emission.
  ],
  postconditions: [
    - the client-root set is known before emission
    - server-only dependencies are absent from every client closure
    - complete zero-root output is distinguishable from missing evidence
  ],
  errors: [
    - missing, stale, contradictory, or opaque proof is a partition diagnostic
    - the emitter cannot receive a plan that treats unknown behavior as server-only
  ],
)

#behavior_spec(
  name: "zero-client-root response",
  summary: [
    A complete server-only route remains useful without route-local client
    bootstrap or activation payload.
  ],
  preconditions: [
    - the route has a complete plan
    - every instance is `server-only` and the client-root set is empty
  ],
  postconditions: [
    - initial SSR HTML and DSD are readable
    - the response contains no client entry or bootstrap reference
    - the browser requests no route-local client artifact
    - no client root, marker, handoff, listener, effect, or timer is created
  ],
  errors: [
    - missing or incomplete analysis is not reported as successful zero-root output
  ],
)

#behavior_spec(
  name: "stable DOM activation",
  summary: [
    A stable client root attaches accepted behavior to server-created DOM without
    rerunning or replacing the server-rendered display.
  ],
  preconditions: [
    - the response contains readable SSR output
    - the activation record and instance identity pass admission checks
  ],
  steps: [
    1. Admit one activation root.
    2. Validate the instance-scoped boundary values.
    3. Attach one owner and the required listeners and state to existing targets.
    4. Dispose all client-owned resources at the owner lifetime end.
  ],
  postconditions: [
    - server-owned display DOM remains the same nodes after activation
    - repeated instances use their own boundary values and state
    - repeated admission does not duplicate resources
  ],
  errors: [
    - invalid admission rejects only the affected identity and does not guess a
      replacement DOM target or perform whole-component replay
  ],
)

#behavior_spec(
  name: "profile separation",
  summary: [
    Stable interaction, client-reactive revision, and server-owned delivery never
    silently share an execution owner or boundary protocol.
  ],
  preconditions: [
    - an instance has browser behavior or a browser-visible revision after SSR
  ],
  postconditions: [
    - stable interaction owns only its stable behavior closure
    - client-reactive revision has an accepted client-safe update owner
    - server-owned delivery has an explicit server authority and later owner
    - no missing profile is hidden by replay, stale freezing, or click-time source
      retrieval
  ],
  errors: [
    - absent ownership produces an unsupported profile diagnostic before successful
      artifact commitment
  ],
)

== Acceptance Coverage

The eight Issue #241 acceptance criteria map to this Proposal as follows:

- The reason for separating server and client, the loss without separation, and
  the relationship to the Goal are recorded in `Goal and Decision Boundary`.
- All six options are compared for boundary, startup, DOM authority, handoff,
  reactivity, failure, lifetime, compiler responsibility, and zero-root behavior in
  `Candidate Comparison`.
- The provisional selected model, rejected alternatives, scope, and non-goals are
  recorded in `Decision`, `Execution Profiles`, and `Non-goals`.
- The behavior-equivalent control, fixtures, measurement method, and thresholds
  are recorded in `Baseline and Measurement`.
- Required authoring information and forbidden compiler inference are recorded in
  `Authoring and Compiler Contract`.
- Server-only, stable interaction, client-reactive, and server-owned delivery are
  separate profiles with distinct owners and no implicit fallback.
- The first vertical slice and the package specifications, tests, browser routes,
  artifact evidence, and resource evidence it must update are recorded in `First
  Vertical Slice`.
- The decision is traceable to implementation and evidence owners in `Evidence and
  Follow-up Ownership`; the exact Issue source rows are preserved below.

== Input Coverage

Each row maps one collected `requirements.*` candidate from Issue #241. The source
object preserves the collector's `kind`, `issue`, `heading`, and `line` fields.
The independent collection bundle was
`/tmp/opencode/proposal-241-independent-20260828-01.json`.

=== Decision to make

- `decisionToMake.1` source `{"kind":"issue-body","issue":241,"heading":"Decision to make","line":3}` -> `Goal and Decision Boundary`, `Decision`; `Satisfied`.
- `decisionToMake.2` source `{"kind":"issue-body","issue":241,"heading":"Decision to make","line":5}` -> `Goal and Decision Boundary`, `Logical Plan and Ownership`; `Satisfied`.
- `decisionToMake.3` source `{"kind":"issue-body","issue":241,"heading":"Decision to make","line":7}` -> `Candidate Comparison`, `Decision`; `Satisfied`.

=== Context and evidence

- `contextAndEvidence.1` source `{"kind":"issue-body","issue":241,"heading":"Context and evidence","line":11}` -> `Goal and Decision Boundary`; `Satisfied`.
- `contextAndEvidence.2` source `{"kind":"issue-body","issue":241,"heading":"Context and evidence","line":12}` -> `Current Repository Evidence`; `Satisfied`.
- `contextAndEvidence.3` source `{"kind":"issue-body","issue":241,"heading":"Context and evidence","line":13}` -> `Current Repository Evidence`, `Baseline and Measurement`; `Satisfied`.
- `contextAndEvidence.4` source `{"kind":"issue-body","issue":241,"heading":"Context and evidence","line":14}` -> `Current Repository Evidence`, `First Vertical Slice`; `Satisfied`.
- `contextAndEvidence.5` source `{"kind":"issue-body","issue":241,"heading":"Context and evidence","line":15}` -> `Current Repository Evidence`; `Satisfied`.
- `contextAndEvidence.6` source `{"kind":"issue-body","issue":241,"heading":"Context and evidence","line":16}` -> `Candidate Comparison`, `Option 2`; `Satisfied`.
- `contextAndEvidence.7` source `{"kind":"issue-body","issue":241,"heading":"Context and evidence","line":17}` -> `Candidate Comparison`, `Option 4`; `Satisfied`.
- `contextAndEvidence.8` source `{"kind":"issue-body","issue":241,"heading":"Context and evidence","line":18}` -> `Candidate Comparison`, `Option 3`; `Satisfied`.
- `contextAndEvidence.9` source `{"kind":"issue-body","issue":241,"heading":"Context and evidence","line":19}` -> `Candidate Comparison`, `Option 5`; `Satisfied`.
- `contextAndEvidence.10` source `{"kind":"issue-body","issue":241,"heading":"Context and evidence","line":20}` -> `Evidence Boundary`, `Candidate Comparison`; `Satisfied`.

=== Options considered

- `optionsConsidered.1` source `{"kind":"issue-body","issue":241,"heading":"Options considered","line":24}` -> `Option 1: current hydration optimization`; `Satisfied`.
- `optionsConsidered.2` source `{"kind":"issue-body","issue":241,"heading":"Options considered","line":25}` -> `Option 2: explicit islands or partial hydration`; `Satisfied`.
- `optionsConsidered.3` source `{"kind":"issue-body","issue":241,"heading":"Options considered","line":26}` -> `Option 3: compiler-directed selective activation`; `Satisfied`.
- `optionsConsidered.4` source `{"kind":"issue-body","issue":241,"heading":"Options considered","line":27}` -> `Option 4: resumability`; `Satisfied`.
- `optionsConsidered.5` source `{"kind":"issue-body","issue":241,"heading":"Options considered","line":28}` -> `Option 5: RSC-like module graph partitioning`; `Satisfied`.
- `optionsConsidered.6` source `{"kind":"issue-body","issue":241,"heading":"Options considered","line":29}` -> `Option 6: uncompiled progressive enhancement`; `Satisfied`.

=== Decision criteria

- `decisionCriteria.1` source `{"kind":"issue-body","issue":241,"heading":"Decision criteria","line":33}` -> `C1 client cost`, `Baseline and Measurement`; `Satisfied`.
- `decisionCriteria.2` source `{"kind":"issue-body","issue":241,"heading":"Decision criteria","line":34}` -> `C2 observable behavior`, `Behavior Contract`; `Satisfied`.
- `decisionCriteria.3` source `{"kind":"issue-body","issue":241,"heading":"Decision criteria","line":35}` -> `C3 responsibility`, `Server and client closure boundary`; `Satisfied`.
- `decisionCriteria.4` source `{"kind":"issue-body","issue":241,"heading":"Decision criteria","line":36}` -> `C4 analysis boundary`, `Authoring and Compiler Contract`; `Satisfied`.
- `decisionCriteria.5` source `{"kind":"issue-body","issue":241,"heading":"Decision criteria","line":37}` -> `C5 platform fit`, `Candidate Comparison`, `First Vertical Slice`; `Satisfied`.
- `decisionCriteria.6` source `{"kind":"issue-body","issue":241,"heading":"Decision criteria","line":38}` -> `C6 state and lifetime`, `State and Lifetime`; `Satisfied`.
- `decisionCriteria.7` source `{"kind":"issue-body","issue":241,"heading":"Decision criteria","line":39}` -> `C7 zero root`, `server-only profile`; `Satisfied`.
- `decisionCriteria.8` source `{"kind":"issue-body","issue":241,"heading":"Decision criteria","line":40}` -> `C8 authoring cost`, `Authoring and Compiler Contract`; `Satisfied`.
- `decisionCriteria.9` source `{"kind":"issue-body","issue":241,"heading":"Decision criteria","line":41}` -> `C9 implementation value`, `Decision`, `Review thresholds`; `Satisfied`.

=== Acceptance criteria

- `acceptanceCriteria.1` source `{"kind":"issue-body","issue":241,"heading":"Acceptance criteria","line":45}` -> `Goal and Decision Boundary`, `Decision`; `Satisfied`.
- `acceptanceCriteria.2` source `{"kind":"issue-body","issue":241,"heading":"Acceptance criteria","line":46}` -> `Candidate Comparison`; `Satisfied`.
- `acceptanceCriteria.3` source `{"kind":"issue-body","issue":241,"heading":"Acceptance criteria","line":47}` -> `Decision`, `Execution Profiles`, `Non-goals`; `Satisfied`.
- `acceptanceCriteria.4` source `{"kind":"issue-body","issue":241,"heading":"Acceptance criteria","line":48}` -> `Baseline and Measurement`; `Satisfied`.
- `acceptanceCriteria.5` source `{"kind":"issue-body","issue":241,"heading":"Acceptance criteria","line":49}` -> `Authoring and Compiler Contract`; `Satisfied`.
- `acceptanceCriteria.6` source `{"kind":"issue-body","issue":241,"heading":"Acceptance criteria","line":50}` -> `Execution Profiles`, `Evidence and Follow-up Ownership`; `Satisfied`.
- `acceptanceCriteria.7` source `{"kind":"issue-body","issue":241,"heading":"Acceptance criteria","line":51}` -> `First Vertical Slice`; `Satisfied`.
- `acceptanceCriteria.8` source `{"kind":"issue-body","issue":241,"heading":"Acceptance criteria","line":52}` -> `Evidence and Follow-up Ownership`, `Input Coverage`; `Satisfied`.

=== Dependencies

- `dependencies.1` source `{"kind":"issue-body","issue":241,"heading":"Dependencies","line":56}` -> `Current Repository Evidence`, `Baseline and Measurement`; `Satisfied`.
- `dependencies.2` source `{"kind":"issue-body","issue":241,"heading":"Dependencies","line":57}` -> `Goal and Decision Boundary`, `Input Coverage`; `Satisfied`.

=== Non-goals

- `nonGoals.1` source `{"kind":"issue-body","issue":241,"heading":"Non-goals","line":61}` -> `Scope`, `First Vertical Slice`; `Satisfied`.
- `nonGoals.2` source `{"kind":"issue-body","issue":241,"heading":"Non-goals","line":62}` -> `Non-goals`; `Satisfied`.
- `nonGoals.3` source `{"kind":"issue-body","issue":241,"heading":"Non-goals","line":63}` -> `Authoring and Compiler Contract`; `Satisfied`.
- `nonGoals.4` source `{"kind":"issue-body","issue":241,"heading":"Non-goals","line":64}` -> `First Vertical Slice`; `Satisfied`.
- `nonGoals.5` source `{"kind":"issue-body","issue":241,"heading":"Non-goals","line":65}` -> `Adoption Gate`; `Satisfied`.
- `nonGoals.6` source `{"kind":"issue-body","issue":241,"heading":"Non-goals","line":66}` -> `Evidence Boundary`, `Decision`; `Satisfied`.

== Adoption Gate

This Proposal remains `Proposed`. The selected model is not `Accepted` merely
because the comparison is complete or the current workspace build passes.

Before production implementation begins:

- reviewers must confirm that the decision evidence does not rely on #111,
  #105 through #110, the previous #241 draft, PR #244, or another Dathomir
  Proposal
- the behavior-equivalent `B0` control and selected `F0` and `F1` fixtures must
  be implemented and measured under the same environment
- the package specifications and executable tests must be updated before their
  implementations change
- artifact, browser, resource, and failure evidence must be able to falsify the
  selected model through `T0` through `T8`
- #242 must review the selection and its trade-offs before changing the owning
  Issue's progress to `Accepted`

No production code, compiler, artifact emitter, activation runtime, or public API
is changed by this file.
