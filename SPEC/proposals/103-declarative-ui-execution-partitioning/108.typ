#import "../../functions.typ": *
#import "../../settings.typ": *
#show: apply-settings

#design_proposal(
  issue: 108,
  name: "DocCodeBlock interaction and lifetime semantics",
  summary: [
    This proposal defines the interaction state machine and activation lifetime
    for the stable-snapshot DocCodeBlock profile. It specifies activation
    admission, pre-activation events, asynchronous clipboard completion,
    repeated interaction, reset-timer ordering, and disposal. It does not choose
    a timer primitive, a clipboard failure UI, or a concrete artifact encoding.
  ],
  scope: [
    - the stable-snapshot profile defined by #105, #106, and #107
    - activation of an existing server-rendered DocCodeBlock host and control
    - click ordering across concurrent clipboard operations
    - operation generations and reset-timer ownership
    - listener, state, timer, and source-reference lifetime
    - browser-observable evidence for activation, repeated interaction, and disposal
  ],
  non_goals: [
    - define clipboard rejection UI or final diagnostic message text
    - choose a timer API, scheduler, or exact reset-delay value
    - define the stable handoff serialization or artifact marker format
    - define client-reactive source revisions or server-owned delivery
    - rerun the component body, source analysis, highlighting, or code generation
    - change the server-rendered code display during stable-snapshot activation
    - implement the compiler, artifact emitter, browser runtime, or production component
    - define a generic event replay, hydration, or scheduling model
  ],
  open_questions: [
    - Which exact reset-delay value is appropriate for the final component policy;
      the state transition is triggered by a reset-timer event independent of that value.
    - Which diagnostic category and user-visible result represent a rejected or
      unavailable clipboard operation; #109 owns that decision.
    - Which concrete activation entry and cleanup API carry these semantics into
      the artifact and browser runtime; #119 and #120 own that decision.
    - How source revisions change the state machine after #222 defines the
      client-reactive profile.
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
    link("https://github.com/dathra/dathra/issues/119")[#119],
    link("https://github.com/dathra/dathra/issues/120")[#120],
    link("https://github.com/dathra/dathra/issues/222")[#222],
  ),
)

== Decision

#adr(
  header("Activation admission and pre-activation events", Status.Accepted, "2026-07-27"),
  [
    A server-rendered code block must remain readable before client JavaScript
    becomes available. A click can therefore occur before the activation entry
    has resolved the host, handoff, and copy control. Replaying such an event
    would turn an old user action into a new clipboard operation after the
    document or activation scope may have changed.
  ],
  [
    - An activation instance has three lifecycle phases: `inactive`, `active`,
      and `disposed`. The `active` phase has the interaction substates defined
      in the State Model below. The server-rendered instance starts as `inactive`
      from the perspective of client behavior.
    - Activation first resolves the compiler-generated root and instance,
      validates the accepted handoff and artifact admission, and resolves the
      existing host and copy control. It registers no listener, state owner, or
      timer before those checks succeed.
    - Just before activation commits, it rechecks that the activation root, host,
      and copy control still belong to a live activation scope. If the root,
      host, or copy control was disposed while activation was pending, activation
      becomes a no-op and does not retain a source reference or create a client
      owner.
    - A successful activation creates one client-owned state owner, initializes
      `copied = false`, registers its cleanup in that root-scoped owner, and
      registers one listener on the existing copy control. Listener, owner, and
      cleanup registration form one commit; a setup failure disposes any partial
      owner, leaves no active listener, state, or timer, and marks the emitted
      instance as `inactive / rejected` while its root remains live.
    - A successful activation does not replace or rerender the code-display
      subtree.
    - An event observed before successful activation is ignored. It is not
      queued, replayed, or converted into a synthetic click after activation.
    - A repeated activation request for an already `active` instance is
      idempotent. It does not add another listener, reset the copied state, or
      create another state or timer owner.
    - If the owning root, host, or copy control is disposed before activation
      commits, the `inactive` instance becomes `disposed`. A delayed activation
      callback must recheck this terminal state and cannot attach behavior later.
    - A live instance whose handoff, artifact admission, host, or control fails
      validation becomes `inactive / rejected`. Repeated activation requests for
      that emitted instance are no-ops; a later render must provide a new
      activation instance after the failed artifact or handoff is corrected.
    - A `disposed` instance is terminal. Its handoff record cannot be reused to
      activate another host; a later render must provide a new activation
      instance.
  ],
  [
    - The server-rendered `Copy` control remains an ordinary accessible control,
      but no copy behavior is promised before activation.
    - Activation admission and behavior binding have a single ownership point;
      a failed admission cannot leave a partially active control.
    - #107 remains responsible for the logical root and instance binding. This
      decision defines what happens before and after that binding is admitted.
  ],
  alternatives: [
    - *Queue and replay pre-activation events*: This can copy after the user's
      original interaction has become stale and requires an additional event
      lifetime and replay authority.
    - *Bind before validating the handoff*: This can leave a listener and state
      owner attached to a block that the artifact contract has already rejected.
    - *Re-run the component on activation*: This changes DOM identity and leaks
      server-only rendering work into the client path.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/105")[#105],
    link("https://github.com/dathra/dathra/issues/106")[#106],
    link("https://github.com/dathra/dathra/issues/107")[#107],
    link("https://github.com/dathra/dathra/issues/108")[#108],
    link("https://github.com/dathra/dathra/issues/120")[#120],
  ),
)

#adr(
  header("Operation generations and clipboard completion", Status.Accepted, "2026-07-27"),
  [
    Clipboard writes complete asynchronously. Showing a successful state when
    a click merely starts a write makes a rejection indistinguishable from a
    success and lets an earlier completion overwrite a later interaction.
  ],
  [
    - Every accepted click in an `active` instance receives a strictly increasing
      local `operation-generation`.
    - Starting a new operation must invalidate the previous reset timer and move
      the control to the not-copied state. The stable handoff's
      `normalized-source` is passed to the clipboard API; source is never
      reconstructed from the highlighted DOM.
    - The `Copied!` state is entered only when the clipboard operation for the
      current generation fulfills while the instance is still `active`.
    - A fulfillment from an older generation is ignored. It cannot set
      `Copied!`, schedule a reset timer, or change any other visible state.
    - A synchronous clipboard exception or rejected promise cannot satisfy the
      current-success transition or schedule the success reset timer. Its
      failure state, user-visible result, and diagnostic belong to #109.
    - While the current operation is pending, the control exposes the ordinary
      not-copied label. No separate pending label is required by this contract.
  ],
  [
    - Completion order, rather than click order, determines success only when
      the completion belongs to the current generation.
    - A later click cannot be visibly rolled back by an earlier clipboard
      completion, even when the browser settles promises out of order.
    - The generation is local to one activation instance. It is not source
      identity, artifact identity, or a cross-route revision number.
  ],
  alternatives: [
    - *Set `Copied!` immediately on click*: This reports success before the
      browser confirms the clipboard write.
    - *Accept every promise fulfillment*: An older write can roll back the
      visible result of a newer interaction.
    - *Read source from the rendered DOM on completion*: Highlighting markup is
      not the normalized source contract and can change whitespace or instance
      association.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/105")[#105],
    link("https://github.com/dathra/dathra/issues/107")[#107],
    link("https://github.com/dathra/dathra/issues/108")[#108],
    link("https://github.com/dathra/dathra/issues/109")[#109],
  ),
)

#adr(
  header("Reset timer and disposal terminality", Status.Accepted, "2026-07-27"),
  [
    The copied state is temporary, and both reset timers and clipboard promises
    can outlive the interaction that created them. Clearing a timer alone does
    not establish a correctness guarantee because a callback can already be
    queued, and the Clipboard API does not provide cancellation through this
    contract.
  ],
  [
    - A reset timer is created only after the current operation enters the
      `Copied!` state. At most one reset timer belongs to an active instance.
    - The timer is associated with the operation generation that produced the
      copied state. Starting another click must invalidate the old timer before
      the new operation begins. It may also clear the platform timer handle, but
      correctness cannot depend on clearing it.
    - A timer callback may return the control to the not-copied state only when
      the instance is still `active` and the callback's generation is current.
      A stale callback is a no-op.
    - Disposal is idempotent and transitions every non-disposed phase to
      `disposed`. For an active instance it invalidates the current generation,
      removes the listener, clears or invalidates the reset timer, and releases
      the activation's normalized-source reference. For an inactive instance it
      prevents a delayed activation commit from creating any of those owners.
    - A clipboard promise that settles after disposal is observed only as an
      ignored completion. It cannot update state, DOM, or timer ownership. Any
      diagnostic policy for that settlement belongs to #109.
    - Disposal does not rewrite the server-rendered code display. It also does
      not require cancellation of an already-issued browser clipboard request;
      it requires that the request's late settlement has no owner capable of
      changing the disposed block.
  ],
  [
    - Cleanup is a terminal ownership change, not merely a best-effort timer
      operation.
    - Every listener, timer, state owner, and source reference has one activation
      lifetime and cannot be reused after disposal.
    - The exact timer primitive and reset-delay value remain implementation
      choices as long as they preserve generation checks and terminal disposal.
  ],
  alternatives: [
    - *Only call `clearTimeout` on disposal*: A queued callback or a missing
      cleanup path can still mutate a disposed block.
    - *Allow late completion to update the block*: This resurrects disposed
      state and can expose an old interaction after the host has left its scope.
    - *Keep a global timer or source registry*: This extends lifetime beyond the
      activation root and conflicts with #107's response-scoped handoff.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/107")[#107],
    link("https://github.com/dathra/dathra/issues/108")[#108],
    link("https://github.com/dathra/dathra/issues/120")[#120],
  ),
)

== State Model

The following states describe client behavior for one stable-snapshot
activation instance. `operation-generation` is an internal monotonic counter;
it is not exposed as a handoff field.

- `inactive / eligible`: the server-rendered DOM exists, but no client
  listener, state owner, timer, or active source reference exists. Events are
  ignored, and a valid activation may still commit.
- `inactive / rejected`: admission or setup failed while the root remained
  live. No client listener, state owner, timer, or active source reference
  exists, and another activation request for this emitted instance is a no-op.
- `active / idle`: activation has succeeded, `copied = false`, no clipboard
  operation is pending, and no reset timer is owned.
- `active / pending(n)`: operation generation `n` is the current clipboard
  attempt. The control remains in the not-copied state while completion is
  pending.
- `active / copied(n)`: generation `n` fulfilled successfully, the control
  displays `Copied!`, and one reset timer is owned for generation `n`.
- `disposed`: the terminal state. Listener, timer, state, and source ownership
  have ended; all later events and completions are ignored.

The legal transitions are:

1. Valid handoff admission changes `inactive / eligible` to `active / idle`
   only when the root, host, and control are still live. Disposal of the root,
   host, or control changes `inactive / eligible` directly to `disposed` without
   creating an activation owner.
2. An invalid live admission or setup failure changes `inactive / eligible` to
   `inactive / rejected` after partial setup is cleaned up.
3. An event before activation leaves an eligible or rejected instance without
   client behavior.
4. A click from `active / idle`, `active / pending(n)`, or `active / copied(n)`
   invalidates the previous timer, increments the generation, and enters
   `active / pending(n + 1)`.
5. Fulfillment of the current operation changes `active / pending(n)` to
   `active / copied(n)` and schedules one reset timer.
6. Rejection or synchronous failure of the current operation remains within
   `active` without entering `active / copied(n)` or scheduling a success reset;
   #109 defines its failure state and result.
7. A current reset-timer event changes `active / copied(n)` to
   `active / idle`.
8. A stale completion, stale timer, or event after disposal leaves the state
   unchanged.
9. Disposal changes any non-disposed phase to `disposed`; repeated disposal is a
   no-op. A rejected instance cannot be activated again and may only transition
   to `disposed`.

== Behavior Contract

#behavior_spec(
  name: "activation admission",
  summary: [
    A valid stable handoff activates the existing server-rendered block exactly
    once without replacing its static display.
  ],
  preconditions: [
    - the root marker, instance marker, artifact admission, and handoff record
      pass the validation defined by #107
    - the existing host and copy control are resolvable
    - the root, host, and copy control still belong to a live activation scope
  ],
  steps: [
    1. Resolve the host and handoff.
    2. Recheck root, host, and copy-control liveness immediately before the
       activation commit.
    3. Create the activation owner with `copied = false` inside the root scope.
    4. Register cleanup and the one copy listener as one activation commit.
  ],
  postconditions: [
    - the instance is `active / idle`
    - the highlighted subtree, static styles, source display, and scroll position
      retain their DOM identity
    - a repeated activation request does not add another listener or owner
  ],
  errors: [
    - if the root, host, or copy control is disposed before the commit, the
      instance becomes `disposed` without retaining the source or registering
      behavior
    - if setup fails during the commit, partial listener and owner state is
      cleaned up before activation reports failure, and the live instance
      becomes `inactive / rejected` without allowing a retry
    - if handoff, host, or copy-control validation fails while the root remains
      live, the instance becomes `inactive / rejected` with no listener, state
      owner, or timer; #109 owns the diagnostic
  ],
)

#behavior_spec(
  name: "activation after pre-commit disposal",
  summary: [
    A root, host, or copy control removed before delayed activation completes
    cannot receive a late listener or state owner.
  ],
  preconditions: [
    - an activation attempt is pending for an `inactive / eligible` instance
    - the owning root, host, or copy control is disposed before the activation
      commit
  ],
  steps: [
    1. Complete the delayed activation attempt.
  ],
  postconditions: [
    - the instance is `disposed`
    - no listener, state owner, timer, or retained source reference is created
    - the server-rendered code remains unchanged
  ],
)

#behavior_spec(
  name: "pre-activation event",
  summary: [
    A click before successful activation has no client behavior and is not
    replayed later.
  ],
  preconditions: [
    - the server-rendered copy control exists
    - the activation listener has not been registered
  ],
  steps: [
    1. The user activates the control.
    2. Client activation completes later.
  ],
  postconditions: [
    - no clipboard operation is started for the pre-activation event
    - no copied state is shown because of that event
    - activation starts in `active / idle`
  ],
)

#behavior_spec(
  name: "successful current interaction",
  summary: [
    A current clipboard fulfillment produces the temporary copied state for its
    own activation instance.
  ],
  preconditions: [
    - the instance is `active`
  ],
  steps: [
    1. The user activates the copy control.
    2. The browser fulfills the clipboard promise.
    3. The reset timer event occurs.
  ],
  postconditions: [
    - the normalized source from the instance's handoff is passed to the
      clipboard API
    - the control displays `Copied!` after fulfillment
    - the control returns to `Copy` after the current reset timer event
    - no code-display DOM is replaced
  ],
)

#behavior_spec(
  name: "repeated interaction ordering",
  summary: [
    A newer click establishes the only completion that may produce the current
    success state.
  ],
  preconditions: [
    - the same active control is available for repeated interaction
    - clipboard promises can settle in an order different from click order
  ],
  steps: [
    1. Start operation generation `n`.
    2. Start operation generation `n + 1` before generation `n` settles.
    3. Settle both operations in either order.
  ],
  postconditions: [
    - generation `n` cannot display `Copied!` after generation `n + 1` starts
    - only the current generation can schedule a reset timer
    - a stale completion cannot change the newer interaction's visible state
  ],
)

#behavior_spec(
  name: "timer replacement",
  summary: [
    A new interaction cannot be reset by the timer belonging to an earlier
    successful interaction.
  ],
  preconditions: [
    - generation `n` has displayed `Copied!` and owns a reset timer
  ],
  steps: [
    1. Click the control to invalidate the timer for generation `n` and start
       generation `n + 1`.
    2. Complete generation `n + 1` successfully.
    3. Deliver the old and new timer events in either order.
  ],
  postconditions: [
    - the old timer cannot return generation `n + 1` to the not-copied state
    - the current timer controls the reset of generation `n + 1`
  ],
)

#behavior_spec(
  name: "disposal after asynchronous work",
  summary: [
    Disposal ends interaction ownership even when a clipboard promise or reset
    timer settles later.
  ],
  preconditions: [
    - an active instance has a pending clipboard operation or copied-state timer
  ],
  steps: [
    1. Dispose the activation instance.
    2. Settle the pending promise or deliver the timer callback.
    3. Attempt another click on the old control.
  ],
  postconditions: [
    - the listener, timer, state owner, and source reference are not reused
    - no late callback changes the DOM or client state
    - the rendered code remains readable and is not rewritten by cleanup
    - repeated disposal and later events are no-ops
  ],
)

== Browser Evidence Matrix

The acceptance suite must observe the following inputs and results in a real
browser or an equivalent browser-faithful harness:

- click before activation: no clipboard call, no label change, and no replay
  after activation
- valid activation: unchanged code-display node identity and unchanged initial
  `Copy` state; harness instrumentation may additionally verify one listener and
  one state owner
- duplicate activation: one effective listener and one copy operation per click;
  listener and owner counts are optional instrumentation assertions
- keyboard activation after activation: Enter and Space produce the same
  clipboard and copied-state result as pointer activation; pre-activation
  keyboard events are ignored rather than replayed
- live root with a missing or mismatched handoff: readable SSR DOM remains,
  no behavior owner is installed, and a repeated activation request is a no-op
- current successful copy: the exact normalized source reaches the clipboard,
  `Copied!` appears after fulfillment, and the reset returns to `Copy`
- out-of-order repeated clicks: the older completion and timer produce no visible
  change after the newer generation starts
- click during `Copied!`: the old success timer cannot reset the newer operation
- disposal with pending promise: late fulfillment produces no DOM or state change
- disposal with active timer: late timer produces no DOM or state change
- disposal followed by click: no listener or clipboard operation remains
- root, host, or copy-control disposal before delayed activation commits: no late
  listener, state owner, timer, or retained source reference is created, and the
  server-rendered code remains readable
- multiple blocks: each block keeps independent generation, timer, source, and
  disposal ownership

Failure-specific user-visible results and diagnostics are evidence owned by
#109, but the suite must still verify that a failed operation never enters the
success transition defined here.

== Current Evidence and Boundary

At starting revision `c283a8b` on 2026-07-26, the current
`docs/src/components/DocCodeBlock/DocCodeBlock.tsx` starts
`navigator.clipboard.writeText(source)`, attaches a rejection handler that
discards the error, and sets `copied = true` before the clipboard promise
fulfills. It clears an existing timer when another click starts, but it does not
attach fulfillment handling that gates the success state, represent an
operation generation, or distinguish an older completion from a newer
interaction. This is evidence of the gap that motivates the proposal, not an
accepted behavior baseline.

The same implementation revision does not yet implement every normalization
rule accepted by #105, including CRLF/CR conversion and common indentation that
contains tabs. That correction belongs to the #105 adoption and #119 artifact
path; this proposal only consumes the resulting normalized snapshot.

The existing `onCleanup` and event contracts provide root-scoped listener and
cleanup primitives. The activation entry must add the instance-local generation
and terminal-lifetime checks described here; those checks must not be inferred
from a global registry or from the highlighted DOM.

== Invariants for Later Proposals

- #107's root-scoped handoff remains the only source authority for the
  stable-snapshot copy operation.
- The browser changes only client-owned copy-control state. It does not rerun
  the component body or replace the server-rendered code subtree.
- Activation owner creation, listener registration, and cleanup registration are
  one root-scoped commit with rollback on setup failure.
- One active instance owns at most one copy listener, one current operation
  generation, and one reset timer.
- No pre-activation event is replayed, and no post-disposal event or completion
  can mutate the block.
- #109 may define failure UI and diagnostics but may not turn a rejected or
  stale operation into a successful current completion.
- #110 and #119 must preserve the activation lifetime and generation ownership
  when they choose artifact boundaries and concrete encodings.
- #222 may define a separate revision state machine. It must not silently add
  source revisions to the stable-snapshot handoff defined by #107.

== Adoption Gate

Before production implementation begins, the state transitions and browser
evidence above must be transferred to the responsible package or docs feature
specification and executable tests. The implementation must make the
generation, active/disposed guard, and timer ownership testable without
exposing a public lifecycle API.

The accepted behavior must be consumed by #111's consolidated acceptance
scenario and #112's evidence matrix before #113 begins artifact generation.
