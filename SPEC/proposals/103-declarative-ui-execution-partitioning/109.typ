#import "../../functions.typ": *
#import "../../settings.typ": *
#show: apply-settings

#design_proposal(
  issue: 109,
  name: "DocCodeBlock failure and diagnostic behavior",
  summary: [
    This proposal defines the observable outcome, failure ownership, and
    diagnostic phase for failures in the DocCodeBlock execution-partitioning
    slice. It distinguishes a readable server fallback from a failed build,
    an inert activation from a browser operation failure, and an expected late
    callback from a live failure.

    It consumes the behavior baseline from #105, the responsibility split from
    #106, the stable handoff contract from #107, and the interaction lifetime
    contract from #108. It does not define a logging API, final diagnostic
    wording, or production implementation.

    The decision is expressed in two layers: a component-facing contract that
    defines observable results, and a Dathra internal contract that assigns
    execution, artifact, activation, and diagnostic ownership.
  ],
  scope: [
    - source acquisition, normalization, and syntax-highlight failure during
      server processing
    - unsupported or unprovable execution profiles during partition analysis
    - incomplete or inconsistent server/client artifact emission
    - missing, stale, duplicated, or mismatched stable handoff values during
      client activation
    - missing activation root, host, or copy control during activation
    - unavailable, denied, rejected, or synchronously failing Clipboard API
      operations
    - clipboard and timer callbacks that settle after disposal
    - failure containment between independent activation roots and blocks
    - unit, integration, artifact, and browser evidence for these outcomes
  ],
  non_goals: [
    - design a logging, telemetry, or diagnostic transport API
    - select final diagnostic message wording, localization, or stack formatting
    - define a concrete manifest, marker, payload, or entry encoding
    - define the client-reactive revision protocol owned by #222
    - define server-owned revision delivery or subscription semantics
    - select the timer primitive or reset-delay value owned by #231
    - implement compiler, artifact emitter, browser runtime, or DocCodeBlock
    - migrate the production documentation component
  ],
  open_questions: [
    - The concrete user-facing failure label, diagnostic call site, and
      implementation-level diagnostic envelope are deferred to #126; #120 is
      the integration validator. This does not block the failure states, phase
      categories, or user-visible outcomes accepted here.
    - The concrete marker, manifest, payload, and entry encoding are owned by
      #119; #120 consumes and validates that output. This does not block the
      logical fail-closed contract.
    - Client-reactive revision failure and recovery semantics are owned by
      #222; #224 consumes and validates that contract. This proposal's
      stable-snapshot failure contract remains valid without that protocol and
      is not blocked by it.
    - The reset-delay value is deferred to #231; it does not block the failure
      state because failed clipboard operations do not schedule a success reset
      timer.
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
    link("https://github.com/dathra/dathra/issues/113")[#113],
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

=== Responsibility Boundary

This proposal deliberately describes two layers of one failure contract. The
layers are related, but they do not have the same owner or the same audience.

==== Component-facing contract

The component-facing contract describes what the DocCodeBlock feature and its
users can observe. It does not expose compiler phases, artifact fields, root
markers, or activation tables as component API.

- readable source, language presentation, and Copy control remain available
  under the permitted server fallback
- a failed activation does not replace the already-rendered code display
- a failed Clipboard API operation does not display `Copied!`
- a failed Clipboard API operation exposes a retryable and accessible failure
  state
- a stale completion or a disposal race does not visibly mutate the block
- one already-delivered activation block's failure does not change another
  valid block's source or state; a pre-response route failure remains scoped to
  the enclosing route/render transaction

==== Dathra internal enforcement

The Dathra internal contract describes where the framework performs work and
which module prevents a component-facing invariant from being violated.

- `server-analysis` evaluates and normalizes source, classifies the language,
  and performs or falls back from syntax highlighting
- `partition` consumes analysis evidence and selects an accepted execution
  profile without rerunning component code in the browser
- `emit` materializes one accepted plan into coordinated server and client
  artifacts without publishing partial output
- `activation` admits an emitted root and instance, validates the handoff, and
  attaches behavior to existing DOM
- the browser Clipboard API reports the operation result to the activation
  owner; it does not trigger `server-analysis` or artifact generation
- the diagnostic channel records phase and failure category separately from
  the component-facing result

In this proposal, `emit` names the execution phase and `artifact emitter` names
the internal module that performs that phase. Likewise, `activation` names the
phase and `activation runtime` names the module that admits an emitted instance.

==== Execution order and ownership

The same failure is observed at different points by different owners. The
execution order makes that handoff explicit.

1. The DocCodeBlock feature declares the component-facing source and language
   behavior that users are expected to observe. It does not select a client
   artifact or inspect activation markers.
2. `server-analysis` owns acquiring and evaluating that input, normalizing the
   source, classifying the language, and producing either highlighted output or
   the permitted plain-code result.
3. `partition` consumes analysis evidence and decides whether the source uses
   the stable-snapshot, client-reactive, or explicitly selected delivery
   profile.
4. `emit` consumes the accepted placement plan and creates the coordinated
   server entry, client entry, markers, and handoff values.
5. The server entry renders the initial SSR output. It does not require the
   browser to rerun source analysis or syntax highlighting.
6. `activation runtime` validates the emitted root and instance, then attaches
   behavior to the existing host and copy control.
7. The Clipboard API performs only the browser operation. Its result returns to
   the activation owner and does not invoke `server-analysis` or artifact emit.
8. Disposal ends the activation owner. Late Clipboard or timer callbacks are
   evaluated by the activation guard and cannot mutate the component-facing
   result.

==== Contract handoff

The component-facing layer receives only the result of the internal enforcement
described above. The internal layer may use root preflight, instance identity,
operation generations, timers, and owner guards to enforce that result, but
those mechanisms are not author-facing component configuration.

#107 remains the source of truth for the logical stable handoff. #108 remains
the source of truth for activation lifetime, generation invalidation, timer
ownership, and disposal. #109 adds the failure outcome and diagnostic mapping
without re-owning those accepted mechanisms.

#adr(
  header("Dathra phase-local failure ownership", Status.Accepted, "2026-07-28"),
  [
    A DocCodeBlock result passes through `server-analysis`, partition analysis,
    artifact emission, and client activation. Each phase has different
    authority and different recovery options. A downstream phase cannot repair
    an upstream phase's missing proof without changing the execution contract.
  ],
  [
    Assign each failure to the earliest phase that can establish it, and make
    that phase decide the outcome:

    - `server-analysis` owns source acquisition, source normalization, language
      classification, and syntax-highlighter availability or failure.
    - `partition` owns missing or contradictory placement evidence, unsupported
      syntax, and the absence of an accepted execution profile for a
      client-visible revision.
    - `emit` owns incomplete, non-deterministic, capped, or internally
      inconsistent server/client artifacts.
    - `activation` owns runtime handoff admission, root/host/control lookup,
      artifact identity admission, Clipboard API failure, and callbacks after
      the activation owner has ended.

    A diagnostic carries the phase category above and a stable failure
    category. The diagnostic is developer-facing and does not substitute for
    the user-visible result.

    Use five logical outcome classes:

    - `fallback`: continue with a result that preserves the accepted behavior
      invariants.
    - `fatal`: stop the current server, partition, or emit transaction before
      producing a misleading result.
    - `rejected`: keep already-delivered SSR content, but do not install the
      failed activation.
    - `retryable`: keep a live activation and expose a failed browser operation
      that a later user action may retry.
    - `ignored`: treat a stale or post-disposal callback as a terminal no-op.

    A phase may use a fallback only where this proposal explicitly permits it.
    It may not fall back to a different execution owner, guessed identity,
    click-time server request, old artifact, or whole-component browser replay.
  ],
  [
    - The phase that owns a fact also owns the decision to stop, fall back, or
      reject it.
    - Every failed path has a non-success observable outcome or an explicit
      terminal no-op; no rejected operation is presented as successful.
    - A diagnostic never authorizes a downstream phase to ignore a failed
      invariant.
    - Before response commitment, a `server-analysis`, `partition`, or `emit`
      fatal is scoped to the enclosing route/render transaction and fails that
      transaction atomically. After response commitment, activation failure is
      scoped to the affected activation root or block, so independent roots and
      valid sibling blocks are not failed only because another activation scope
      failed.
    - The logical categories remain stable while #126 chooses the concrete
      diagnostic interface, #119 chooses artifact encoding, and #120 validates
      the integrated result.
  ],
  alternatives: [
    - *Always fail the route*: This makes a recoverable highlighter failure
      remove readable documentation and couples browser activation defects to
      server availability.
    - *Always fall back to the browser*: This leaks server-only work into the
      client artifact and can hide missing placement or artifact proof.
    - *Let each downstream phase repair the previous one*: The resulting
      ownership is ambiguous, and a client can silently reconstruct or fetch a
      value that the accepted handoff contract did not authorize.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/106")[#106],
    link("https://github.com/dathra/dathra/issues/107")[#107],
    link("https://github.com/dathra/dathra/issues/108")[#108],
    link("https://github.com/dathra/dathra/issues/115")[#115],
    link("https://github.com/dathra/dathra/issues/119")[#119],
    link("https://github.com/dathra/dathra/issues/120")[#120],
  ),
)

#adr(
  header("DocCodeBlock server output and highlighting failure", Status.Accepted, "2026-07-28"),
  [
    #105 already defines an empty normalized source and a readable plain-code
    fallback for an unsupported language or unavailable highlighter. A source
    that cannot be obtained is different: replacing it with an empty string
    would make the displayed code and the copied source appear valid while
    discarding the author's input.
  ],
  [
    *Component-facing result*:

    - Missing `children` and an absent `code` property are normal inputs. They
      produce the empty source snapshot accepted by #105.
    - An unsupported non-empty language label is preserved for the user and
      uses readable plain-code display.
    - A source acquisition failure produces no misleading code block or active
      copy control. The enclosing server build or render failure is the
      user-visible result; the exact error page is outside this proposal.
    - A highlighter failure leaves readable source, the language presentation,
      the initial `Copy` control, and the stable copy contract intact.

    *Dathra internal enforcement*:

    - A source getter, source evaluation, or normalization failure that prevents
      the server from producing a normalized snapshot is `server-analysis` and
      `fatal`. The server does not substitute an empty source, a stale source,
      or a client request. It emits no client handoff for the failed block and
      reports the failure through the enclosing server build or render failure
      path.
    - An unsupported non-empty language label is a `fallback` with a
      `server-analysis` `unsupported-language` diagnostic. An empty language
      hint is a normal plain-code input and does not produce that category. This
      language-hint fallback is distinct from unsupported component or program
      syntax, which belongs to `partition`.
    - Highlighter absence, loading failure, or highlighting exception is a
      `fallback` when the normalized source is available. When the block has a
      client root, the stable handoff carries the same normalized source; a
      zero-client-root route emits no handoff. Plain code is not presented as
      highlighted code.
    - Failure of the plain-code fallback is `fatal` in `server-analysis`. A
      failure to encode the logical handoff or emitted artifact is `fatal` in
      `emit`. A highlighter fallback cannot excuse a missing source or an
      invalid handoff.
  ],
  [
    *Component-facing consequence*:

    - A source acquisition failure does not appear as a successful empty block.
    - A highlighter failure cannot remove readable source or the Copy control.

    *Dathra internal consequence*:

    - A highlighter failure cannot make the client artifact depend on the
      highlighter.
    - The `server-analysis` diagnostic distinguishes source-unavailable,
      unsupported-language, and highlight-fallback categories without fixing
      final message text.
  ],
  alternatives: [
    - *Treat source acquisition failure as an empty source*: This turns data
      loss into apparent success and makes the clipboard result unverifiable.
    - *Fail on every highlighter failure*: This makes documentation rendering
      depend on optional presentation work even though plain code is readable.
    - *Use a client highlighter as a fallback*: This violates #106's server-only
      highlighter boundary and changes the artifact contract.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/105")[#105],
    link("https://github.com/dathra/dathra/issues/106")[#106],
    link("https://github.com/dathra/dathra/issues/109")[#109],
  ),
)

#adr(
  header("Dathra partition failure and profile selection", Status.Accepted, "2026-07-28"),
  [
    The stable-snapshot profile is allowed to read a reactive value during the
    server render, but a browser-visible revision needs an execution owner.
    #105 and #106 distinguish that future client-reactive profile from the
    stable snapshot. Analysis must therefore reject the unsupported profile,
    not reject reactivity as a property of the input.
  ],
  [
    *Dathra internal enforcement*:

    - Missing, stale, contradictory, tampered, or out-of-scope analysis evidence
      is a `partition` `fatal` outcome. No accepted placement plan is produced.
      Unsupported language hints are not this case; #105's plain-code language
      fallback remains a `server-analysis` outcome.
    - A source with a client-visible post-SSR revision is accepted only when an
      accepted client-reactive profile or an explicitly selected server-owned
      delivery profile owns that revision. If no such profile is available, the
      result is an `unsupported-execution-profile` `partition` diagnostic and
      no block artifact is emitted.
    - The stable-snapshot profile is not used as a silent freeze for a source
      that analysis proves will change in the browser.
    - The client-reactive profile is not synthesized by rerunning the component
      body, importing the server-only highlighter, or using a click-time
      request. #222 owns the later reactive closure and revision contract.
    - Partition failure does not create a partial server root, client root, or
      boundary record for the rejected plan.
    - When detected before response commitment, a partition failure fails the
      enclosing route/render transaction atomically, even when one block or
      root triggered it. It does not silently omit the block, freeze an initial
      snapshot, or commit a successful route without the affected block. The
      enclosing error path determines the exact page.
  ],
  [
    *Dathra internal consequence*:

    - A supported stable source continues to the artifact emitter even when its
      initial server evaluation read a reactive value, provided no post-SSR
      revision requires another owner.

    *Component-facing consequence*:

    - An unsupported profile stops before artifact generation, so the user does
      not receive a block whose displayed source and later behavior are known
      to diverge.

    *Dathra diagnostic consequence*:

    - The diagnostic identifies `partition` as the phase and records the
      missing execution-profile reason without exposing compiler internals to
      the browser.
  ],
  alternatives: [
    - *Reject every reactive input*: This confuses a reactive read with a
      client-visible revision and excludes the accepted stable profile.
    - *Freeze the initial snapshot silently*: This creates a stale display or
      clipboard source without a client-visible failure.
    - *Put the revision in the server-only path*: This leaves the browser
      mutation without a client owner and hides the required delivery profile.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/105")[#105],
    link("https://github.com/dathra/dathra/issues/106")[#106],
    link("https://github.com/dathra/dathra/issues/115")[#115],
    link("https://github.com/dathra/dathra/issues/222")[#222],
    link("https://github.com/dathra/dathra/issues/224")[#224],
  ),
)

#adr(
  header("Dathra artifact emission failure", Status.Accepted, "2026-07-28"),
  [
    The artifact emitter consumes an accepted placement plan and must produce
    coordinated server entry, client entry, root or instance markers, and stable
    handoff values. Emitting only part of that result would make activation
    depend on a guess about which artifact revision is authoritative.
  ],
  [
    *Dathra internal enforcement*:

    - A missing plan field, inconsistent artifact identity, invalid root or
      instance association, cap violation, or non-deterministic emission is an
      `emit` `fatal` outcome when detected by the artifact emitter.
    - When detected before response commitment, an emission failure fails the
      enclosing route/render transaction atomically, even when one block or
      root triggered it. It does not commit a successful route that silently
      omits or disables the affected client-root block.
    - The artifact emitter publishes none of the affected root's client bootstrap,
      activation entry, manifest record, marker, or handoff payload. It does not
      reuse an older artifact, emit a partial block, or defer source retrieval
      to a Copy click.

    *Component-facing consequence after response delivery*:

    - An emit failure discovered after an already delivered server response is
      treated as an activation admission failure by the browser. The browser
      preserves the delivered SSR DOM and rejects the affected activation; it
      does not attempt to repair the artifact or load a different entry.
    - A root-scoped artifact failure rejects activation for that root. A
      block-scoped handoff failure rejects only the affected block. Other
      independent roots remain eligible.
  ],
  [
    *Dathra internal consequence*:

    - A successful artifact transaction provides all values required by #107
      from one logical render result.
    - A build or emit failure cannot produce a route that appears interactive
      while its client entry or handoff is incomplete.

    *Component-facing consequence*:

    - A late browser discovery of an artifact mismatch has a non-destructive
      user result: already-rendered code remains readable and the failed copy
      behavior is not installed.

    *Dathra diagnostic consequence*:

    - The `emit` diagnostic is distinguishable from a `partition` diagnostic
      even when the artifact emitter is the first phase to observe a missing proof.
  ],
  alternatives: [
    - *Emit the server result and omit only the client handoff*: This silently
      changes a client-root block into an inert block and hides an artifact
      defect.
    - *Fetch the source on click*: This adds network authority and availability
      semantics that #107 explicitly excludes from the stable profile.
    - *Use the previous artifact revision*: This can pair a valid DOM with the
      wrong client entry, marker, or source record.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/107")[#107],
    link("https://github.com/dathra/dathra/issues/110")[#110],
    link("https://github.com/dathra/dathra/issues/115")[#115],
    link("https://github.com/dathra/dathra/issues/119")[#119],
    link("https://github.com/dathra/dathra/issues/120")[#120],
  ),
)

#adr(
  header("Dathra fail-closed activation and failure containment", Status.Accepted, "2026-07-28"),
  [
    #107 requires root-scoped instance association, and #108 requires a single
    atomic activation commit after root, host, control, handoff, and artifact
    checks. A browser cannot repair a missing or mismatched value by inspecting
    highlighted DOM without breaking the source and identity contract.
  ],
  [
    *Dathra internal enforcement*:

    - Root admission is one preflight barrier for an `activation root`. It
      validates the root marker, root-level artifact identity, handoff-table
      structure, and duplicate root associations before any instance in that
      root can commit.
    - Activation validates the root marker, artifact admission, instance marker,
      root-scoped handoff record, host, and copy control before it creates a
      listener, state owner, timer owner, or retained source reference.
    - A missing, duplicate, stale, or mismatched handoff value or artifact
      identity is an `activation` `rejected` outcome. The affected block keeps
      its already-rendered SSR code and any existing static style. Its copy
      control remains in its server-rendered non-success state and is not made
      to appear active.
    - A live root with a missing host or copy control is an `activation`
      `rejected` outcome. The runtime does not create a substitute control,
      bind a nearby control, or derive a target from arbitrary DOM structure.
    - If the activation root, host, or copy control is disposed before the
      delayed commit, the instance transitions to `disposed` as defined by
      #108. This expected lifetime race is a no-op and does not retain a source
      reference or install an owner.
    - A root-level admission failure rejects every instance in that root without
      partial root activation. After root preflight succeeds, an
      instance-level failure rejects only that instance. Independent roots and
      valid sibling instances may continue when their own admission checks pass.
      Concurrent requests share the root preflight result and cannot create
      duplicate root or instance owners.
    - A rejected instance is terminal for activation. Repeating the admission
      request is an idempotent no-op; a later render must provide a new instance
      after the artifact or handoff defect is corrected.
  ],
  [
    *Component-facing consequence*:

    - The user can still read the server-rendered code when activation fails.
    - No failed activation can display `Copied!`, call the Clipboard API, or
      mutate the code-display subtree.

    *Dathra diagnostic and lifetime consequence*:

    - The `activation` diagnostic identifies the failed association or target
      lookup without exposing source contents in the browser diagnostic.
    - A normal pre-commit disposal is not reported as an activation defect,
      because its owner has already ended and no user-visible contract was
      violated.
  ],
  alternatives: [
    - *Bind first and validate later*: This leaves a listener or owner attached
      to an artifact the handoff contract has already rejected.
    - *Search for a nearby DOM target*: Layout and repeated blocks do not prove
      instance identity, so the wrong block could receive a copy operation.
    - *Fail the entire document for one block*: This makes independent roots
      share failure scope and removes readable SSR content unnecessarily.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/107")[#107],
    link("https://github.com/dathra/dathra/issues/108")[#108],
    link("https://github.com/dathra/dathra/issues/120")[#120],
  ),
)

== Dathra Failure Scope Matrix

This is an internal enforcement matrix. Its component-facing projection is the
preservation of readable SSR output, block-local behavior, and independent
activation scopes described above.

The failure scope determines which work is rolled back and which already
rendered content may continue. The scope is decided before a downstream phase
is allowed to compensate for the failure.

- *Route/render transaction*: a `server-analysis`, `partition`, or `emit`
  `fatal` detected before response commitment fails the enclosing route/render
  transaction atomically, even when one block or root triggered it. No
  successful response is committed with the affected block silently omitted,
  frozen, or falsely interactive. The enclosing error path owns the exact user
  error page, and server-side sibling roots are not independently committed as
  a partial success.
- *Activation root*: a missing or mismatched root marker, root-level artifact
  identity, or malformed root handoff table rejects every instance in that root
  before any listener, state owner, timer, or source reference is committed.
  Other activation roots are independent.
- *Activation instance*: a missing or mismatched instance marker, handoff record,
  host, or copy control rejects only that instance after root preflight succeeds.
  Valid sibling instances in the same root may commit independently.
- *Activation lifetime*: disposal of the root, host, or copy control before an
  instance commit transitions that instance to `disposed` without a diagnostic
  for a normal lifetime race. A late callback after disposal is ignored.
- *Clipboard operation*: an unavailable, denied, throwing, or rejected browser
  operation changes only its active instance to `active / failed(n)`. No other
  root, block, or server artifact is affected.

#adr(
  header("DocCodeBlock Clipboard failure outcome", Status.Accepted, "2026-07-28"),
  [
    Clipboard writes are asynchronous and can be absent, denied, rejected, or
    synchronously throw. #108 already prevents a pending operation from being
    treated as success; this proposal defines the user-visible failure state
    and its lifetime.
  ],
  [
    *Component-facing result*:

    - The control displays a visible failure label, and its accessible name
      identifies the failed copy attempt and retry action. The exact localized
      wording belongs to #126. It never displays `Copied!` for that operation.
    - The control remains operable for a later retry unless the containing
      activation has been disposed.

    *Dathra internal enforcement*:

    - An unavailable `navigator.clipboard.writeText`, a synchronous exception,
      a permission denial, or a rejected write is an `activation` `retryable`
      outcome for the current operation generation.
    - The current operation transitions from `active / pending(n)` to
      `active / failed(n)`.
    - A failed operation does not schedule the success reset timer. The failure
      state remains until the next accepted click, which invalidates the prior
      generation and starts a new pending operation, or until disposal.
    - A stale rejection from an older generation is ignored exactly like a
      stale fulfillment. It cannot replace a newer failure or success state.
    - The browser reports a stable `activation` clipboard-failure diagnostic to
      the developer-facing diagnostic channel. It reports a category rather
      than source text, permission details that should not be exposed, or an
      exact message contract.
    - A successful clipboard operation follows #108 and enters `Copied!` only
      after the current generation fulfills. A diagnostic or a started promise
      cannot produce the success state.
  ],
  [
    *Component-facing consequence*:

    - The user receives a visible non-success result and can retry without a
      server request or a page reload.

    *Dathra internal consequence*:

    - The copied-state timer remains owned only by a successful current
      generation, so a failure cannot reset or overwrite a later interaction.
    - Clipboard failure does not remove readable code or change the source
      handoff.
    - The failure state is local to one activation instance and does not affect
      another block or root.
  ],
  alternatives: [
    - *Show `Copied!` when the call starts*: This reports success before the
      browser confirms the write.
    - *Leave the ordinary `Copy` label after failure*: The user cannot tell
      whether the operation was attempted or rejected.
    - *Retry through the server*: This changes the stable profile into a
      network-dependent operation and introduces an authority that #107 does
      not define.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/105")[#105],
    link("https://github.com/dathra/dathra/issues/107")[#107],
    link("https://github.com/dathra/dathra/issues/108")[#108],
    link("https://github.com/dathra/dathra/issues/109")[#109],
    link("https://github.com/dathra/dathra/issues/126")[#126],
  ),
)

#adr(
  header("Dathra late asynchronous completion enforcement", Status.Accepted, "2026-07-28"),
  [
    A clipboard promise or reset-timer callback can settle after disposal even
    when the listener and timer handle were cleaned up. #108 defines disposal
    as a terminal ownership change, so a late callback has no live owner that
    can update the block.
  ],
  [
    *Dathra internal enforcement*:

    - Disposal invalidates the current operation generation and releases the
      listener, state owner, timer ownership, and normalized-source reference.
    - A fulfillment, rejection, or timer callback that arrives after disposal
      is an `activation` `ignored` outcome. It cannot update state, DOM, timer
      ownership, source references, or clipboard behavior.
    - A late rejection is not surfaced as a new user-visible failure because
      the operation no longer has a live activation owner. It is not reported as
      an active-operation diagnostic; treating it as an expected no-op avoids
      converting normal navigation and disposal races into application errors.
    - A callback that is stale but arrives before disposal is also ignored when
      its operation generation is no longer current. It cannot schedule a
      success reset or replace the current failure or success state.
    - Repeated disposal and events on the old control are no-ops. A later render
      receives a new activation instance rather than reusing the disposed one.
  ],
  [
    *Component-facing consequence*:

    - Disposal never rewrites the server-rendered code display.
    - No callback can resurrect an activation owner or make a disposed block
      appear to have copied successfully.

    *Dathra diagnostic consequence*:

    - The absence of a late diagnostic is an intentional failure policy, not a
      silent success path: the callback is explicitly ignored and cannot enter
      a success state.
  ],
  alternatives: [
    - *Allow late completion to update the block*: This resurrects state after
      its lifetime and can mutate detached or reused DOM.
    - *Rely only on clearing the platform timer*: A queued callback can still
      run, and Clipboard API promises are not cancelled by this contract.
    - *Keep a global promise or source registry*: This extends the source
      lifetime beyond #107's activation root and complicates cleanup.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/107")[#107],
    link("https://github.com/dathra/dathra/issues/108")[#108],
    link("https://github.com/dathra/dathra/issues/120")[#120],
    link("https://github.com/dathra/dathra/issues/126")[#126],
  ),
)

== Dathra Internal Activation State Model

The following model is an internal enforcement model for one stable-snapshot
activation instance. It is not a component-author API. The component-facing
contract observes its result through DOM and interaction behavior.

It uses the same actors throughout this internal model: `server-analysis`, `partition`,
`artifact emitter`, `activation runtime`, `activation root`, `host`, `copy
control`, `Clipboard API`, and `reset timer`.

`operation-generation` is a local monotonic counter. It is not a handoff field,
source identity, artifact identity, or cross-route revision number.

- `inactive / eligible`: `activation root`, `host`, and `copy control` exist,
  but `activation runtime` has not committed. No listener, state owner, reset
  timer, or active source reference exists. Events are ignored, and one valid
  activation commit may still occur.
- `inactive / rejected`: `activation runtime` found a live handoff, artifact,
  root, host, or control failure. No listener, state owner, reset timer, or
  active source reference exists. The instance is terminal for activation and
  may only become `disposed`.
- `active / idle`: `activation runtime` owns one listener, one state owner, and
  the normalized source for the live instance. `copied = false`; no clipboard
  operation or reset timer is current.
- `active / pending(n)`: `Clipboard API` has received operation generation `n`.
  The control remains in the ordinary not-copied state while completion is
  pending. No success reset timer is current.
- `active / copied(n)`: operation generation `n` fulfilled. The control displays
  `Copied!`, and exactly one reset timer is owned for generation `n`.
- `active / failed(n)`: operation generation `n` failed because the Clipboard
  API was unavailable, threw, or rejected. The control displays a visible
  failure label, its accessible name identifies the failed copy attempt and
  retry action, no success reset timer is owned, and a later click may retry.
- `disposed`: the terminal state. `activation runtime` owns no listener, state,
  timer, or source reference. All later events and completions are ignored.

The legal transitions are:

1. `server-analysis`, `partition`, and `artifact emitter` must complete their
   owned transaction before `activation runtime` can admit an instance.
2. A valid activation changes `inactive / eligible` to `active / idle` only
   when `activation root`, `host`, and `copy control` are still live. A
   concurrent admission request that loses the single commit is a no-op.
3. A live handoff, artifact, root, host, or control failure changes
   `inactive / eligible` to `inactive / rejected` after any partial setup is
   cleaned up. If the root, host, or control was disposed before the commit,
   the instance changes directly to `disposed`.
4. An event before successful activation leaves an eligible or rejected
   instance unchanged and is never replayed.
5. A click from `active / idle`, `active / pending(n)`, `active / copied(n)`, or
   `active / failed(n)` invalidates the previous timer, increments the
   generation, and enters `active / pending(n + 1)`.
6. Fulfillment of the current operation changes `active / pending(n)` to
   `active / copied(n)` and schedules one reset timer.
7. Rejection or synchronous Clipboard API failure changes
   `active / pending(n)` to `active / failed(n)` without scheduling a success
   reset timer.
8. A current reset-timer event changes `active / copied(n)` to `active / idle`.
9. A stale fulfillment, stale rejection, stale timer, or event after disposal
   leaves the state unchanged.
10. Disposal changes every non-disposed phase to `disposed`; repeated disposal
    is a no-op. A rejected instance cannot be activated again.

Every active state owns exactly one listener, one state owner, and one current
source reference. Only `active / copied(n)` owns a reset timer. No state after
`disposed` owns a resource.

== Cross-layer Behavior Contracts

The following contracts state both the component-facing result and the Dathra
internal condition that produces it. The names distinguish which layer owns the
primary contract.

#behavior_spec(
  name: "component-facing server source failure result",
  summary: [
    Server processing does not convert an unavailable source into an apparently
    valid empty code block.
  ],
  preconditions: [
    - `server-analysis` cannot acquire or normalize the required source
    - the input is not merely an absent `children` and absent `code` value,
      which #105 defines as an empty source
  ],
  steps: [
    1. `server-analysis` detects the source failure before a stable handoff is
       accepted.
  ],
  postconditions: [
    - the current server build or render transaction fails
    - no replacement empty source, stale source, or click-time request is used
    - no client handoff is emitted for the failed block
    - the diagnostic phase is `server-analysis`
  ],
  errors: [
    - the enclosing route or server error boundary determines the exact page
      shown to the user; this proposal does not design that error page
  ],
)

#behavior_spec(
  name: "component-facing highlighting fallback result",
  summary: [
    An unavailable or failing highlighter does not make readable source or copy
    behavior unavailable.
  ],
  preconditions: [
    - `server-analysis` has a normalized source snapshot
    - syntax highlighting is unavailable, unsupported, or throws
  ],
  steps: [
    1. Render the normalized source as plain code.
  ],
  postconditions: [
    - source remains readable
    - the supplied language label remains visible when present
    - the initial `Copy` control remains in the server-rendered non-success
      state
    - when the block has a client root, the stable handoff carries the same
      normalized source; a zero-client-root route emits no handoff
    - the diagnostic phase is `server-analysis`
  ],
  errors: [
    - failure to render the plain-code fallback is a `server-analysis` fatal;
      failure to encode its logical handoff or emitted artifact is an `emit`
      fatal. Neither failure becomes a client fallback.
  ],
)

#behavior_spec(
  name: "Dathra partition or emission failure",
  summary: [
    Unproven execution ownership or an inconsistent artifact transaction does
    not produce a partially interactive block.
  ],
  preconditions: [
    - `partition` lacks accepted evidence or an execution profile, or
    - `artifact emitter` detects an incomplete plan, cap violation, or artifact
      mismatch
  ],
  steps: [
    1. Stop the owning transaction at the earliest detecting phase.
  ],
  postconditions: [
    - a partition failure produces no accepted placement plan
    - an emission failure produces no affected client bootstrap, entry, marker,
      manifest record, or handoff payload
    - the client does not rerun analysis, code generation, or source retrieval
    - before response commitment, the enclosing build or render transaction
      fails rather than committing a successful route with the affected block
      silently omitted or frozen
    - after response commitment, the browser preserves SSR content and rejects
      the affected activation without partial ownership
    - the diagnostic phase is `partition` or `emit`, respectively
  ],
  errors: [
    - a server response that was already delivered is handled as activation
      rejection if the mismatch is first visible in the browser
  ],
)

#behavior_spec(
  name: "Dathra activation admission with SSR preservation",
  summary: [
    A missing or mismatched handoff or target leaves server-rendered code
    readable while refusing partial client activation.
  ],
  preconditions: [
    - `activation runtime` is admitting an instance
    - `activation root`, `host`, `copy control`, artifact identity, and
      root-scoped handoff are checked before the activation commit
  ],
  steps: [
    1. Run root preflight for root marker, root-level artifact identity, handoff
       table structure, and duplicate root associations.
    2. Validate artifact, instance, handoff, host, and control association for
       the requested instance.
    3. If validation fails, roll back any partial setup.
  ],
  postconditions: [
    - the affected root or instance has no listener, state owner, timer, or
      retained source reference
    - existing SSR code and static styles are not replaced
    - no guessed DOM target, sibling source, old artifact, or click-time request
      is used
    - the diagnostic phase is `activation`
  ],
  errors: [
    - root-level failure rejects that root while independent roots remain
      eligible
    - instance-level failure rejects only that instance when the root remains
      valid
    - disposal of the root, host, or control before the commit is the terminal
      `disposed` no-op defined by #108, not a partial activation
  ],
)

#behavior_spec(
  name: "component-facing Clipboard operation failure result",
  summary: [
    The current activation reports a failed browser clipboard operation without
    entering the copied-success state.
  ],
  preconditions: [
    - the instance is active
    - `Clipboard API` is unavailable, throws synchronously, or rejects the
      current operation generation
  ],
  steps: [
    1. Start operation generation `n`.
    2. Observe the unavailable API, exception, or rejection.
  ],
  postconditions: [
    - the instance enters `active / failed(n)`
    - the control exposes a visible failure label and an accessible name that
      identifies the failed copy attempt and retry action
    - the control remains operable for a later retry and does not display
      `Copied!`
    - no success reset timer is scheduled
    - a later click may start a new generation without a server request
    - the diagnostic phase is `activation`
  ],
  errors: [
    - an older rejection cannot overwrite a newer generation
    - a rejection after disposal is ignored and cannot change the DOM or state
  ],
)

#behavior_spec(
  name: "Dathra late completion guard",
  summary: [
    A clipboard or timer callback that arrives after the activation lifetime has
    ended cannot mutate the disposed instance.
  ],
  preconditions: [
    - `activation runtime` has disposed the instance
    - `Clipboard API` or `reset timer` later settles or fires
  ],
  steps: [
    1. Deliver the late fulfillment, rejection, or timer event.
  ],
  postconditions: [
    - state, DOM, timer ownership, and source references remain unchanged
    - no user-visible failure or success state is created
    - the event is an explicit `ignored` activation outcome
    - no active-operation diagnostic is emitted
  ],
  errors: [
    - the callback must not recreate an activation owner or retain the source
      for a later use
  ],
)

== Layered Evidence Assignment

The following assignments make both layers testable. Component-facing evidence
observes the result presented to users. Dathra internal evidence observes phase
ownership, artifact boundaries, and enforcement invariants. #112 owns the
consolidated matrix and may refine the fixture names without changing these
outcomes.

*Unit evidence*:

- classify absent source, unsupported language, highlighter failure, source
  failure, unsupported profile, missing evidence, artifact inconsistency,
  missing handoff, missing target, Clipboard API absence, synchronous throw,
  rejection, stale completion, and disposed completion
- assert the selected phase, outcome class, user-visible state, and whether a
  diagnostic is expected
- exercise the state model transitions for current success, current failure,
  stale completion, and disposal

*Integration evidence*:

- render a source with a highlighter failure and verify readable plain code,
  preserved language label, copy control, and stable normalized source
- run analysis and partition fixtures with missing or contradictory evidence and
  verify that no placement or artifact transaction begins
- run the artifact emitter with a mismatched plan, cap violation, or
  non-deterministic result and verify that no affected client handoff is
  published
- run a route/render transaction with a fatal source, partition, or emission
  fixture and verify that the transaction fails before response commitment
  rather than committing a successful response with an omitted or frozen block
- consume a delivered response with missing or mismatched root, instance,
  artifact, or handoff data and verify activation rejection without a partial
  owner

*Artifact evidence*:

- inspect server and client dependency closure to verify that the highlighter
  remains server-only, including on the plain-code fallback path
- inspect deterministic artifact metadata for the presence of all coordinated
  handoff records on success and the absence of partial records on emit failure
- verify that a rejected partition or emit transaction does not generate an
  old-artifact fallback, click-time source request, or unowned client bootstrap
- verify root-scoped and block-scoped artifact failure containment
- verify a zero-client-root route emits no handoff table, payload, bootstrap, or
  client entry, including when another block uses the plain-code fallback

*Browser evidence*:

- observe readable SSR code before activation and after a missing or mismatched
  handoff or target lookup
- reject root preflight and verify that no instance in that root receives a
  listener, state owner, timer, or source reference, while an independent root
  remains eligible
- issue concurrent activation requests and verify one root preflight result,
  one effective listener and owner per valid instance, and no duplicate timer
  owner
- simulate unavailable, denied, synchronous-throwing, and rejecting clipboard
  behavior; verify a visible failure label, an accessible name that identifies
  failure and retry, keyboard retry behavior, no `Copied!`, no success timer,
  and a retry on the next click
- settle an older rejection after a newer click and verify that the newer state
  remains visible
- dispose during a pending clipboard operation or copied timer and verify no
  late DOM or state update and no active-operation diagnostic
- verify that one failed block does not affect a valid sibling or independent
  activation root

== Cross-layer Invariants for Later Proposals

- #105's empty source and readable plain-code fallback remain valid; a failure
  path must not reinterpret them as source acquisition failure.
- #106's server/client responsibility split remains intact. A failure path must
  not move server-only highlighting, source analysis, or component execution
  into the browser.
- #107's root-scoped handoff is the only stable source authority. Activation
  never derives source from highlighted DOM, a sibling, or a server request.
- #108's activation state, generation, timer invalidation, and disposal rules
  remain in force. `active / failed(n)` is the failure substate that #108 leaves
  to this proposal; it does not weaken current-generation success checks.
- #110 and #119 must preserve phase-local fatal emission and root-scoped
  failure containment when they choose concrete artifact boundaries.
- #115 and #118 must preserve the distinction between a reactive read in a
  stable server snapshot and a browser-visible revision without an execution
  owner.
- #222 and #224 must define a separate failure contract for client-reactive
  revisions rather than adding a revision channel to this stable handoff.
- #231 may choose the success reset delay but cannot make a failed operation a
  timer-based success or change disposal terminality.

== Current Evidence and Adoption Gate

At the current repository revision, the existing
`docs/src/components/DocCodeBlock/DocCodeBlock.tsx` starts the Clipboard API
write, discards a rejection, and sets the copied state before fulfillment. This
is evidence of the failure gap, not an accepted behavior. The current syntax
highlight runtime can return no highlighted result when preparation has not
completed, which is compatible with the plain-code fallback but does not prove
the complete server failure contract.

Before implementation begins, #111 must integrate this proposal with the other
accepted decisions and #112 must map every outcome to executable evidence. The
adopted subset must then be transferred to the responsible documentation,
transformer, artifact, and activation specifications and their executable
tests before #113, #119, #120, or #126 implements it.

Concrete diagnostic transport, final message wording, and package export names
remain deferred to their owning implementation issues. No implementation may
use that deferral to omit a phase category, report a failed clipboard operation
as `Copied!`, bind an unverified target, or mutate a disposed instance.
