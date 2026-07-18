#import "../../functions.typ": *
#import "../../settings.typ": *
#show: apply-settings

#design_proposal(
  issue: 105,
  name: "DocCodeBlock observable behavior",
  summary: [
    This proposal defines the observable behavior and non-goals for the first
    DocCodeBlock acceptance scenario. It does not decide server/client
    placement, the transfer representation, or the implementation mechanism.

    The Accepted ADR below records the adopted behavior baseline. The current
    package specifications and executable tests remain authoritative; this
    decision becomes an implementation input only after its adopted behavior is
    transferred to the responsible specification and tests.
  ],
  scope: [
    The scenario is one or more documentation code blocks rendered as part of a
    server-rendered documentation route. Each block has:

    - source text supplied by the author
    - an optional language label
    - a static code display
    - a copy control

    The scenario covers the route from initial server output through client
    activation and disposal. It does not require the browser to recreate the
    code display or rerun the code-highlighting work.
  ],
  non_goals: [
    - assign work to the server, client, compiler, runtime, or browser
    - choose a serialization or cross-boundary payload format
    - define source identity, integrity, authority, or lifetime representation
    - define timer, promise, event-replay, or cleanup algorithms
    - define clipboard failure UI or diagnostic message text
    - define server/client artifact inclusion or exclusion rules
    - define zero-client-root behavior
    - define a public or internal runtime API
    - migrate DocCodeBlock or change production code
    - define a generic hydration, activation, reconciliation, or scheduler model
    - prescribe exact CSS, theme, markup, chunk names, or bundler behavior
    - generalize the scenario to arbitrary components or arbitrary source types
  ],
  open_questions: [
    - What the user sees when the clipboard API is unavailable or rejects a write
    - Whether a failed clipboard write may show `Copied!`
    - Whether an event before activation is queued, ignored, or replayed
    - Whether a later click replaces an earlier timer or uses generation checks
    - What happens when a clipboard promise settles after disposal
    - What diagnostic is emitted for a missing control, stale block, or mismatched
      source identity
    - Whether source text is exposed through a DOM attribute, request payload, or
      another boundary value
    - Which exact browser and route conditions constitute successful activation
    - How a reactive `code` or `children` value updates the displayed source,
      highlighting, clipboard snapshot, and cross-boundary value atomically
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/103")[#103],
    link("https://github.com/dathra/dathra/issues/104")[#104],
    link("https://github.com/dathra/dathra/issues/105")[#105],
  ),
)

== Decision

#adr(
  header("DocCodeBlock observable behavior baseline", Status.Accepted, "2026-07-17"),
  [
    The first execution-partitioning vertical slice needs a stable user-visible
    contract before server/client responsibility, transfer, lifetime, failure,
    and artifact decisions are made. The current production preview renders a
    readable block but does not yet demonstrate the intended copy interaction,
    so current behavior cannot be used as the acceptance baseline.
  ],
  [
    Accept the behavior contracts in this proposal as the DocCodeBlock
    acceptance baseline:

    - SSR presents readable code, its language label when supplied, and a copy
      control before client JavaScript is available.
    - Activation attaches copy behavior without replacing the displayed code or
      changing its DOM identity, scroll position, source, language label, or
      highlighting.
    - A successful copy writes the source snapshot belonging to the activated
      block, presents `Copied!` for that block, then returns to `Copy` under a
      later-defined reset policy.
    - Repeated interaction and multiple blocks preserve block-local source and
      state ownership; stale work cannot visibly roll back a newer interaction.
    - Disposal does not rewrite displayed code, and late callbacks cannot
      visibly update a disposed block.
    - The copy control is keyboard-accessible, and code remains readable
      without client JavaScript or activation.

    The listed open questions are deliberately deferred rather than implicitly
    answered by the current implementation.
  ],
  [
    - #106 may assign responsibility only while preserving this baseline.
    - #107 decides source identity, exposure, integrity, and lifetime.
    - #108 decides activation-before-event, timer, async ordering, and cleanup
      semantics.
    - #109 decides clipboard failure and diagnostics.
    - #110 decides artifact and zero-client-root rules.
    - This decision does not authorize production implementation. Before #113,
      the adopted behavior must be transferred to the responsible `SPEC.typ`
      and executable tests.
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

#adr(
  header("DocCodeBlock source snapshot normalization", Status.Accepted, "2026-07-18"),
  [
    A code block may receive source through JSX children or through its `code`
    property. Display and copy must refer to one deterministic source snapshot;
    otherwise the user can see one text and copy another.
  ],
  [
    Define the source snapshot as follows:

    1. If `children` is a non-empty string, use it. Whitespace-only strings are
       still supplied strings and therefore take precedence.
    2. Otherwise use the `code` property. If it is absent, use the empty string.
    3. Normalize `CRLF` and `CR` line endings to `LF`.
    4. Remove leading and trailing blank lines. A blank line contains only
       whitespace.
    5. Remove the longest common literal prefix made of spaces or tabs from
       every non-blank line. Do not expand tabs or remove non-common whitespace.
    6. Preserve internal blank lines and join the resulting lines with `LF`.

    The normalized snapshot is the source for both the visible code display and
    the clipboard operation for that rendered block. Source transfer format,
    identity, exposure, and lifetime remain decisions for #107.
  ],
  [
    - Raw source is not copied separately from the displayed source.
    - Empty normalization produces an empty source snapshot; the visual policy
      for an empty block is outside this decision.
    - Source changes after a block has been rendered are outside this decision;
      this ADR defines consistency within one rendered block.
  ],
  alternatives: [
    - *Use raw source for copying*: This can make copied text differ from the
      displayed, dedented code.
    - *Use only the `code` property*: This would break the existing
      children-based documentation authoring form.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/105")[#105],
    link("https://github.com/dathra/dathra/issues/107")[#107],
  ),
)

#adr(
  header("DocCodeBlock empty source and language fallback", Status.Accepted, "2026-07-18"),
  [
    Documentation content can be empty during authoring, and a route can
    receive a language hint that the highlighter does not support. Neither
    input should make the code block disappear or make the route fail.
  ],
  [
    - An empty source still renders the normal code-block shell and copy
      control. A successful copy operation writes the empty source snapshot;
      no placeholder text is introduced.
    - A supported non-empty language hint is shown as the language label and
      may select syntax highlighting.
    - An empty language hint omits the language label and uses plain code
      display.
    - An unsupported non-empty language hint remains visible as the supplied
      label, but uses plain code display rather than pretending to use another
      language's grammar.
    - Highlighter unavailability or failure uses the same readable plain-code
      display and does not remove the copy control.
  ],
  [
    - This decision does not define the exact set of supported language names.
    - This decision does not define label casing, theme, or CSS presentation.
    - Clipboard rejection and its user-visible result remain deferred to #109.
  ],
  alternatives: [
    - *Hide an empty block*: This makes authoring and route output unstable.
    - *Highlight unsupported languages as TypeScript*: This can present a
      misleading grammar while the requested label remains visible.
    - *Fail the route for an unsupported language*: This makes documentation
      rendering unnecessarily fragile.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/105")[#105],
    link("https://github.com/dathra/dathra/issues/109")[#109],
  ),
)

#adr(
  header("DocCodeBlock acceptance fixture source stability", Status.Accepted, "2026-07-18"),
  [
    The first acceptance fixture uses a documentation source that does not
    change from initial render through activation and disposal. A permanent rule that
    ignores reactive source changes would be surprising because component props
    are otherwise reactive.
  ],
  [
    - Capture one normalized source snapshot for each observed render and use it
      consistently for that render's visible code and clipboard operation.
    - Treat source input remaining unchanged from initial render through
      activation and disposal as a precondition of the first acceptance
      fixture.
    - Do not make the `code` prop unreactive as an API rule; post-render source
      update semantics remain unspecified by this proposal.
    - Do not infer from this fixture that reactive source changes are ignored,
      unsupported, or required to create a new block.
  ],
  [
    - Dynamic source updates require a later decision covering displayed code,
      highlighting, clipboard source, identity, and cross-boundary transfer.
    - This does not define the identity or lifetime representation of a source
      value crossing the server/client boundary; #107 owns that decision.
  ],
  alternatives: [
    - *Ignore reactive source changes as a permanent rule*: This conflicts with
      the component props model and is not accepted.
    - *Update only clipboard input*: This allows the user to see one source and
      copy another.
    - *Update only the visible display*: This makes the copied snapshot stale.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/105")[#105],
    link("https://github.com/dathra/dathra/issues/107")[#107],
  ),
)

== Behavior Contract

The source snapshot means the normalized source text represented by a block.
The same block must not copy the source belonging to another block.

#behavior_spec(
  name: "initial display",
  summary: [
    A server-rendered route presents a readable code block and its copy control
    before client JavaScript becomes available.
  ],
  preconditions: [
    - a code block source and optional language hint exist
  ],
  postconditions: [
    - the code text is readable and corresponds to the block's source snapshot
    - the language label is visible when one was supplied
    - a user can identify a copy control in the block
    - syntax highlighting may be used; unavailable highlighting falls back to a
      readable plain-code display rather than a blank block
  ],
)

#behavior_spec(
  name: "client activation",
  summary: [
    Activation connects behavior to an already displayed code block without
    replacing the code display.
  ],
  preconditions: [
    - the block's initial display is present
  ],
  postconditions: [
    - the copy control is interactive
    - displayed source, language label, and visual highlighting do not change
      merely because activation completed
    - existing code-display DOM identity and scroll position are preserved
    - activation is scoped to the intended block and does not bind another
      block's control or source
  ],
)

#behavior_spec(
  name: "successful copy",
  summary: [
    A successful clipboard operation presents a temporary copied state for the
    block whose control was activated.
  ],
  preconditions: [
    - the block is activated
    - the clipboard operation succeeds
  ],
  steps: [
    1. The user activates the copy control.
  ],
  postconditions: [
    - the block's source snapshot is written to the clipboard
    - the control displays `Copied!`
    - the copied state belongs only to the activated block
    - after the reset policy elapses, the control returns to `Copy`
  ],
)

#behavior_spec(
  name: "repeated interaction",
  summary: [
    Repeated interaction preserves block-local source and state ownership.
  ],
  preconditions: [
    - the same control is activated more than once, or multiple blocks exist
  ],
  postconditions: [
    - every accepted click targets its block's current source snapshot
    - a stale earlier completion does not visibly roll back a later interaction
    - interactions with different blocks remain independent
  ],
)

#behavior_spec(
  name: "disposal",
  summary: [
    Disposal stops behavior without rewriting the already-rendered code display.
  ],
  preconditions: [
    - a block is removed from its owning document or activation scope
  ],
  postconditions: [
    - the disposed activation accepts no new behavior
    - cleanup does not remove or rewrite the displayed code
    - late callbacks do not visibly update the disposed block
  ],
)

#behavior_spec(
  name: "accessibility surface",
  summary: [
    The copy interaction remains identifiable and operable without relying on a
    pointer device or client activation for code readability.
  ],
  postconditions: [
    - the control is a native button or an equivalent keyboard-accessible control
    - its accessible name identifies the initial copy action and copied state
    - keyboard activation has the same observable result as pointer activation
    - code remains readable when JavaScript is disabled or activation does not occur
  ],
)

== Current Evidence and Unresolved Baseline

The following observations were made against the current repository on
2026-07-15:

- `pnpm --filter @dathra/docs build` succeeds.
- A rendered documentation route contains a `dathra-code` block with a code
  display, language label, and `Copy` button before client interaction.
- The displayed code is available as server-rendered DOM and the code-display
  subtree is marked for preservation by the current implementation path.
- The local production preview did not produce a clipboard write or change the
  button label after a programmatic click. This conflicts with the intended
  successful-copy behavior and is not accepted as the desired contract.
- The preview exposed the internal `hydrate:preserve` attribute in the live
  code-display DOM, although the transformer specification says the directive
  is not emitted as an HTML attribute. This discrepancy is an investigation
  item, not a behavior to preserve.

The successful-copy behavior is a contract to verify, not a claim that the
current production route already satisfies it. The first acceptance evidence
must distinguish server-rendered display, successful activation, clipboard
success, clipboard failure, and disposal after late callback settlement.

The precise ordering of clipboard completion, timer generations, and state
updates belongs to #108. Failure and diagnostic behavior belongs to #109.
Cross-boundary source identity and exposure belong to #107. Artifact and
zero-client-root rules belong to #110.

== Adoption Gate

Before implementation begins, the accepted subset of this proposal must be
identified for the responsible documentation component owner and represented
by executable tests. The current repository has no dedicated DocCodeBlock
specification or test file, so that ownership and test location are an explicit
prerequisite for #113.

No behavior listed as an open question may be presented as accepted merely
because the current implementation happens to produce it.
