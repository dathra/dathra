#import "../../functions.typ": *
#import "../../settings.typ": *
#show: apply-settings

#design_proposal(
  issue: 106,
  name: "DocCodeBlock server/client responsibilities",
  summary: [
    This proposal assigns the accepted DocCodeBlock behavior baseline to server
    and client execution without deciding source serialization, artifact
    encoding, or bundler implementation.
  ],
  scope: [
    - source selection and normalization
    - syntax highlighting and static code display
    - static styles, Declarative Shadow DOM, and initial copy control DOM
    - `copied` state, copy interaction, button binding, timer, and cleanup
    - the boundary between initial server display and client activation
  ],
  non_goals: [
    - define the source snapshot transport, identity, integrity, exposure, or
      lifetime representation
    - define manifest, marker, bootstrap, chunk, or bundler adapter formats
    - implement a compiler, server entry, client entry, or browser runtime
    - decide clipboard rejection behavior or diagnostics
    - decide event replay, timer generation, async ordering, or disposal details
    - define dynamic source updates after the initial acceptance fixture render
    - define a general server/client partitioning model for arbitrary components
  ],
  open_questions: [
    - What boundary value carries the normalized source snapshot to the client
      when copy interaction needs it
    - How client activation identifies the intended host and copy control
    - Which atomic display, highlighting, clipboard, and boundary-value update
      semantics a later reactive-source capability should provide
    - How timer generations, pre-activation events, and late callbacks behave
    - What diagnostics and user-visible result follow clipboard or activation
      failure
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/104")[#104],
    link("https://github.com/dathra/dathra/issues/105")[#105],
    link("https://github.com/dathra/dathra/issues/106")[#106],
    link("https://github.com/dathra/dathra/issues/107")[#107],
    link("https://github.com/dathra/dathra/issues/108")[#108],
    link("https://github.com/dathra/dathra/issues/109")[#109],
    link("https://github.com/dathra/dathra/issues/110")[#110],
  ),
)

== Decision

#adr(
  header("DocCodeBlock server/client responsibility split", Status.Accepted, "2026-07-19"),
  [
    The accepted behavior baseline requires readable server output before
    JavaScript and copy interaction after activation. The current component
    performs both kinds of work from one component body, which makes the
    syntax-highlighting dependency reachable from the browser path.
  ],
  [
    Assign each responsibility exactly once:

    *Server responsibilities*

    - Read `children` and `code`, select and normalize the source snapshot.
    - Read the language hint and determine supported, empty, or unsupported
      language display behavior.
    - Load and run the syntax highlighter when available.
    - Produce the readable plain-code fallback when highlighting is unavailable.
    - Generate highlighted HTML, static styles, the initial `Copy` control DOM,
      and the Declarative Shadow DOM response.
    - Render the initial visual state corresponding to `copied = false`.

    *Client responsibilities*

    - Initialize client-owned `copied` state as `false` when activation succeeds.
    - Resolve the intended existing host and copy control from the activation
      handoff.
    - Bind the click listener and update only the copy control's text and class
      for `copied` state changes.
    - Invoke the browser clipboard API using the source snapshot supplied by the
      boundary contract.
    - Own the reset timer and listener/timer cleanup.

    *Shared executable responsibilities*

    - None in the first vertical slice. Source normalization, highlighting,
      static rendering, and interaction are not evaluated by both environments.
      The cross-boundary handoff is an interface to be defined by #107, not a
      shared runtime computation.
  ],
  [
    - The server generates the initial false-state DOM, while the client creates
      its own false state at activation; these are phase-specific responsibilities
      rather than a duplicated shared state implementation.
    - The browser does not re-execute the component body, source selection,
      source normalization, syntax highlighting, or static DOM generation.
    - The highlighted subtree and static styles remain server-generated DOM;
      client activation may not replace or recompute them.
    - The client artifact contains only interaction state, existing-DOM binding,
      clipboard access, timer, cleanup, and the #107 boundary value required for
      copying.
    - A client artifact must not reach the syntax highlighter or its server-only
      dependencies.
  ],
  alternatives: [
    - *Re-execute the component body in the browser*: This reintroduces source
      selection, highlighting, and server-only dependencies into the client path.
    - *Run the syntax highlighter in both environments*: This duplicates static
      work and enlarges the client artifact.
    - *Let the client derive source from displayed DOM*: This makes copied source
      dependent on highlighted markup instead of the normalized source snapshot.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/105")[#105],
    link("https://github.com/dathra/dathra/issues/106")[#106],
    link("https://github.com/dathra/dathra/issues/107")[#107],
  ),
)

#adr(
  header("Phase 1 stable source responsibility boundary", Status.Accepted, "2026-07-20"),
  [
    Phase 1 transfers one stable source snapshot from server rendering to client
    copy behavior. A post-SSR source revision would require the server display
    and client boundary value to be updated atomically, which is not part of
    the first vertical slice.
  ],
  [
    - The server owns evaluation and normalization of the one accepted stable
      source snapshot.
    - The client may consume that snapshot only for copy interaction; it does
      not observe source revisions or update the displayed code.
    - A source classified as revisable after SSR is unsupported in Phase 1 and
      is rejected with the #115 diagnostic instead of being emitted with an
      initial snapshot that can become stale.
    - #107 defines a handoff for one snapshot only. It must not introduce a
      subscription, revision, or update protocol.
    - A later demand-gated capability owns reactive source revision semantics
      and any necessary server re-rendering or browser DOM patching.
  ],
  [
    - This boundary refines the accepted allocation; it does not make component
      props permanently unreactive.
    - #118 must represent only the accepted source snapshot as a cross-boundary
      value in the Phase 1 placement plan.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/106")[#106],
    link("https://github.com/dathra/dathra/issues/107")[#107],
    link("https://github.com/dathra/dathra/issues/115")[#115],
    link("https://github.com/dathra/dathra/issues/118")[#118],
    link("https://github.com/dathra/dathra/issues/222")[#222],
  ),
)

#adr(
  header("DocCodeBlock reactive execution profiles", Status.Accepted, "2026-07-20"),
  [
    The server/client split must preserve the framework rule that behavior
    changing in the browser is owned by a client execution path. The Phase 1
    static split is therefore one execution profile, not a general claim that
    reactive DocCodeBlock inputs belong on the server.
  ],
  [
    - In the Phase 1 stable-snapshot profile, the server evaluates the source,
      normalizes it, and produces the initial display. The client consumes one
      snapshot for copy behavior and does not observe source revisions.
    - In a future client-reactive profile, the server still produces the initial
      SSR display, but the client owns the source dependency and its update
      closure. That closure includes the client-safe source normalization,
      display/highlighting update, language presentation update, clipboard
      snapshot update, and the consistency rules connecting them.
    - A client-reactive profile must not re-execute the arbitrary component body
      or import a server-only highlighter. The compiler must emit the smallest
      client-safe reactive closure, or select another explicitly supported
      delivery profile.
    - A source is unsupported for Phase 1 when the stable-snapshot profile is
      selected but the analysis proves that a client-visible post-SSR revision
      requires a different profile. The diagnostic names the missing execution
      profile; it does not classify reactivity itself as unsupported.
    - #107's Phase 1 handoff carries one stable snapshot. A client-reactive
      handoff and revision protocol belong to #222 and must not be smuggled into
      the static profile.
  ],
  [
    - #115 must classify the update owner and required execution profile before
      #118 creates a placement plan.
    - The client-reactive profile may require a client-safe highlighter or a
      precompiled rendering strategy; reusing the server-only highlighter is not
      an acceptable implicit fallback.
    - A server-owned revision delivery path is a separate profile and requires
      an explicit contract for delivery, ownership, and stale-update rejection.
  ],
  alternatives: [
    - *Put all reactive source handling on the server*: This leaves browser
      mutations without a client execution owner.
    - *Run the entire component body in the browser*: This leaks unrelated
      server work and server-only dependencies into the client artifact.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/106")[#106],
    link("https://github.com/dathra/dathra/issues/115")[#115],
    link("https://github.com/dathra/dathra/issues/118")[#118],
    link("https://github.com/dathra/dathra/issues/222")[#222],
  ),
)

#adr(
  header("Core rollout of the client-reactive profile", Status.Accepted, "2026-07-20"),
  [
    The initial support matrix requires client-owned handling when a
    DocCodeBlock source or language changes in the browser. The stable profile
    is therefore an initial proof step rather than a permanent boundary around
    the component.
  ],
  [
    - #222 defines the client-reactive profile before placement analysis treats
      it as a supported alternative.
    - #224 implements and validates that profile after #120 and #130 establish
      the stable artifact and activation baseline.
    - The placement plan must distinguish the stable-snapshot client closure
      from the client-reactive update closure. It must not expand the former at
      runtime when an update occurs.
    - A browser-visible reactive update belongs to the emitted client-reactive
      closure. If its dependencies are not client-safe, the compiler reports a
      profile-specific diagnostic or requires an explicit server-delivery
      profile; it does not move the update into the server-only closure.
    - Server-owned revision delivery remains outside initial support unless a
      separate consumer justifies and specifies it.
  ],
  [
    - This supersedes the earlier demand-gated rollout assumption without
      changing the stable profile's accepted responsibilities.
    - #107's one-snapshot handoff remains sufficient only for the stable
      profile; #222 defines the client-reactive contract before a revision
      handoff is emitted.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/106")[#106],
    link("https://github.com/dathra/dathra/issues/120")[#120],
    link("https://github.com/dathra/dathra/issues/130")[#130],
    link("https://github.com/dathra/dathra/issues/222")[#222],
    link("https://github.com/dathra/dathra/issues/224")[#224],
  ),
)

== Invariants for Later Proposals

#behavior_spec(
  name: "server-first DocCodeBlock activation",
  summary: [
    Client activation attaches behavior to server-generated DOM without taking
    ownership of static code display work.
  ],
  preconditions: [
    - the server response contains the DocCodeBlock's readable code display,
      static styles, and initial copy control DOM
    - an accepted #107 handoff identifies the intended activation target and
      supplies the source snapshot when copy behavior requires it
  ],
  steps: [
    1. The client resolves the existing activation target.
    2. The client creates `copied = false` and binds copy behavior to the
       existing control.
    3. A click invokes the browser clipboard API and updates only client-owned
       copy-control behavior.
  ],
  postconditions: [
    - no client path runs source selection, normalization, highlighting, or
      static code DOM generation
    - the highlighted subtree keeps its DOM identity through activation
    - static styles remain available without client style generation
    - the client artifact has no reachable syntax-highlighter dependency
  ],
)

== Adoption Gate

Implementation of this accepted allocation cannot begin until #107 provides a
source handoff that lets the client copy the same normalized snapshot displayed
by the server without client source reconstruction. Before implementation,
transfer the allocation to the responsible package specifications and tests.
