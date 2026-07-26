#import "../../functions.typ": *
#import "../../settings.typ": *
#show: apply-settings

#design_proposal(
  issue: 107,
  name: "DocCodeBlock stable source handoff",
  summary: [
    This proposal defines the logical cross-boundary contract that lets the
    stable-snapshot client activation copy exactly the normalized source shown
    by a server-rendered DocCodeBlock. It assigns value meaning and validation
    rules without selecting a manifest, marker, payload, or bundler encoding.
  ],
  scope: [
    - the stable-snapshot execution profile from #105 and #106
    - normalized source exposure for one activated DocCodeBlock instance
    - activation-root ownership, instance binding, validation, and lifetime
    - multiple blocks, missing values, and mismatched handoffs
  ],
  non_goals: [
    - define a revision, subscription, or client-reactive source protocol
    - define the concrete manifest, DOM marker, attribute, or payload encoding
    - define the final Canonical Identity API or Module Graph implementation
    - provide hostile-browser tamper resistance or a public security protocol
    - implement compiler, artifact emitter, SSR integration, or browser runtime
    - change clipboard failure, timer, cleanup, or activation ordering semantics
  ],
  open_questions: [
    - Which emitted artifact owns the concrete serialization and decoding format
    - The exact resource-cap values and encoded payload budget
    - Which client-safe representation or revision handoff a client-reactive
      profile requires after #222 defines its observable contract
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/98")[#98],
    link("https://github.com/dathra/dathra/issues/99")[#99],
    link("https://github.com/dathra/dathra/issues/104")[#104],
    link("https://github.com/dathra/dathra/issues/105")[#105],
    link("https://github.com/dathra/dathra/issues/106")[#106],
    link("https://github.com/dathra/dathra/issues/107")[#107],
    link("https://github.com/dathra/dathra/issues/110")[#110],
    link("https://github.com/dathra/dathra/issues/115")[#115],
    link("https://github.com/dathra/dathra/issues/118")[#118],
    link("https://github.com/dathra/dathra/issues/119")[#119],
    link("https://github.com/dathra/dathra/issues/222")[#222],
  ),
)

== Decision

#adr(
  header("Stable source handoff record", Status.Accepted, "2026-07-22"),
  [
    A client activation must call the clipboard API with the normalized source
    shown by its own server-rendered block. Deriving that value from highlighted
    DOM can change whitespace or conflate different instances, while rerunning
    source normalization in the browser duplicates server work.
  ],
  [
    Define one logical stable handoff record for every DocCodeBlock instance
    that has a client root:

    - `activation-instance-id` identifies one emitted DocCodeBlock host within
      one server-rendered response and activation scope.
    - `source-content-id` identifies the normalized source snapshot contents.
      Equal normalized source may intentionally have the same content ID across
      different instances.
    - `normalized-source` is the exact string selected and normalized by the
      server according to #105. It is the only source text the stable client
      activation may pass to the clipboard API.

    `activation-instance-id` and `source-content-id` are separate. The former
    binds a behavior instance to its DOM host; the latter identifies source
    contents. An artifact must not use source-content identity as the host
    identity because multiple blocks can display identical source independently.

    The server produces the record after source selection and normalization.
    The client consumes it only after resolving the corresponding emitted host.
    No client path reconstructs `normalized-source` from highlighted DOM or
    reruns source selection or normalization.
  ],
  [
    - The record is logical. #119 chooses its concrete artifact representation
      and may place its fields in coordinated manifest, marker, and payload
      outputs without changing their meanings.
    - The record does not contain raw children, an unnormalized `code` property,
      highlighter state, component props, reactive dependencies, or a server
      closure.
    - A zero-client-root route emits no record, payload, manifest entry, or
      bootstrap solely for this contract.
  ],
  alternatives: [
    - *Read text from the highlighted subtree*: Highlighting markup is not the
      normalized source contract and can alter whitespace or instance selection.
    - *Rerun source selection in the browser*: This duplicates server work and
      can observe a different reactive value than the initial display.
    - *Use one identity for source and host*: Equal snippets in distinct blocks
      would collide at activation time.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/105")[#105],
    link("https://github.com/dathra/dathra/issues/106")[#106],
    link("https://github.com/dathra/dathra/issues/107")[#107],
    link("https://github.com/dathra/dathra/issues/119")[#119],
  ),
)

#adr(
  header("Identity, provenance, and validation boundary", Status.Accepted, "2026-07-22"),
  [
    A client entry, its manifest record, its DOM host, and its source handoff
    can be mismatched by an emitter defect, stale artifact, or incorrect
    multi-instance association. The first vertical slice must fail closed for
    those inconsistencies without claiming to secure a browser controlled by an
    attacker.
  ],
  [
    - `source-content-id` uses the qualified Canonical Identity of the
      normalized source snapshot once #98 supplies the production consumer
      boundary. This proposal does not redefine its encoding or digest
      algorithm.
    - `activation-instance-id` is generated by the accepted placement and
      artifact path. It is unique within the response and activation scope, and
      is not derived from source contents or DOM structure.
    - The activation artifact must bind its expected instance ID and expected
      source-content ID to the handoff record. The client verifies both bindings
      before registering listener, state, or timer ownership.
    - A missing, duplicate, stale, or mismatched instance ID, source-content ID,
      artifact identity, or handoff record rejects activation for that block.
      The server-rendered code remains readable; partial activation is removed
      and a diagnostic identifies the failed binding.
    - Module Graph identity and source facts remain compiler provenance. #115
      and #118 may trace a handoff record to them, but browser activation does
      not receive the Module Graph as payload.
  ],
  [
    - This detects inconsistent trusted pipeline artifacts. A script with
      browser execution authority can modify DOM, payload, or clipboard behavior
      after delivery; preventing that is outside this execution contract.
    - The concrete content-identity verification mechanism and its resource cap
      are artifact-emitter decisions. It must preserve the accepted bindings and
      cannot weaken a mismatch into a silent fallback.
  ],
  alternatives: [
    - *Treat DOM position or selector as identity*: Layout changes and repeated
      snippets make this neither stable nor instance-specific.
    - *Trust any source payload addressed to the client entry*: This permits an
      accidental cross-instance copy without a detectable contract violation.
    - *Transmit Module Graph provenance to the browser*: The browser only needs
      activation bindings and source text, not compiler internals.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/98")[#98],
    link("https://github.com/dathra/dathra/issues/99")[#99],
    link("https://github.com/dathra/dathra/issues/107")[#107],
    link("https://github.com/dathra/dathra/issues/115")[#115],
    link("https://github.com/dathra/dathra/issues/118")[#118],
    link("https://github.com/dathra/dathra/issues/119")[#119],
  ),
)

#adr(
  header("Stable handoff exposure and lifetime", Status.Accepted, "2026-07-22"),
  [
    Copy behavior requires the exact normalized source while activated. The
    source is already intentionally represented by the readable code block, but
    a handoff must not turn it into a globally retained cache or a revision
    channel.
  ],
  [
    - The handoff record is created for one server-rendered response and one
      activation instance.
    - The client retains `normalized-source` only while its activation owns the
      corresponding block. Disposal releases the client reference with listener,
      state, and timer cleanup defined by #108.
    - A handoff record has no cross-route, cross-request, or global registry
      lifetime. It is not reusable by a later instance merely because its source
      content ID matches.
    - `normalized-source` is exposed only when the block has an emitted client
      root. It is not an additional confidentiality boundary because the same
      source is intentionally displayed, but no unrelated props or server data
      may accompany it.
    - The stable record has no revision, acknowledgement, resynchronization, or
      mutation operation. #222 owns the separate client-reactive contract.
  ],
  [
    - The empty source is a valid normalized source and follows the same record
      contract.
    - Multiple active blocks retain independent records even when their source
      content IDs are equal.
    - #110 decides artifact inclusion and zero-client-root evidence; this ADR
      defines the value lifetime those artifact decisions must preserve.
  ],
  alternatives: [
    - *Use a global source registry keyed by content ID*: This introduces
      retention and cross-instance authority not required for Copy behavior.
    - *Expose all component inputs for future client use*: This enlarges the
      client payload and leaks server-only dependencies across the boundary.
    - *Add a revision field to the stable record*: This implies an update
      protocol before #222 defines its ownership and consistency semantics.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/107")[#107],
    link("https://github.com/dathra/dathra/issues/108")[#108],
    link("https://github.com/dathra/dathra/issues/110")[#110],
    link("https://github.com/dathra/dathra/issues/222")[#222],
  ),
)

#adr(
  header("Root-scoped stable handoff contract", Status.Accepted, "2026-07-26"),
  [
    The earlier handoff decisions used a source-content identity in the client
    contract. That identity does not add a useful client-side guarantee unless
    the browser independently verifies the source digest, while the required
    guarantee is the association between a Copy control and its own block.
    The handoff therefore needs a root-scoped instance mapping, not a client
    source-identity protocol.
  ],
  [
    This decision supersedes the client-facing source-content identity parts of
    the preceding handoff decisions while preserving their normalized-source,
    fail-closed, and bounded-lifetime intent:

    - An `activation-root` is a route or rendered fragment root that owns the
      handoff table and the activation lifetime. Multiple roots in one document
      are independent; a document-wide global registry is not required.
    - The server assigns each client-root DocCodeBlock a local sequential
      `activation-instance-id` within its activation root during that render.
      The effective instance identity is `(activation-root,
      activation-instance-id)`. The ID is not build-global, session-global, or
      derived from source contents.
    - Each activation root has one logical handoff table mapping its local
      instance IDs to the exact `normalized-source` strings produced by #105.
      The table is response-scoped and is not shared across roots, routes, or
      requests.
    - The root marker, each instance marker, the SSR code display, and the
      handoff table are produced from one logical render result. A cache may
      replay that complete result, but a marker and table from different render
      results may not be combined.
    - The client resolves a compiler-generated root marker, then resolves
      instance markers only within that root. A marker identifies the host; the
      root-scoped table supplies `normalized-source`. The client never derives
      source from highlighted DOM or reruns source normalization.
    - `normalized-source` is exposed as plain text in the handoff because the
      same source is intentionally displayed. Encryption or client-side digest
      verification is not part of this contract.
    - Every client-root block receives its handoff in the initial response. A
      Copy click does not make a server request, and a zero-client-root route
      emits no handoff table or payload.
    - The handoff has both a per-block cap and an activation-root total cap.
      Exact values and encoded-size measurement belong to #115 and #119. A cap
      violation is a stable-profile build or render failure; the emitter does
      not silently omit the source, defer it to a click-time request, or emit a
      partially active block.
    - Artifact identity is checked as part of client-entry admission. It is
      not a source-content identity and is not a replacement for root-scoped
      instance binding.
    - Canonical Identity and Module Graph facts remain compiler provenance.
      They may explain how a handoff was produced, but neither is sent to the
      browser as a handoff field.
  ],
  [
    - The logical record is still independent per block even when two blocks
      contain equal source strings. Physical response compression or
      deduplication may be introduced by #119 only if the logical mapping and
      lifetime remain unchanged.
    - The client checks root and instance association, missing or duplicate
      records, and artifact admission. It does not claim to detect a browser
      attacker that can rewrite both marker and payload.
    - A future client-reactive profile may define a revision handoff, but it
      must not extend this stable table with an implicit revision protocol.
  ],
  alternatives: [
    - *Use a source-content ID as the client integrity check*: Without an
      independent trusted digest verification, the ID is only a label and adds
      complexity without detecting a changed source.
    - *Use a document-wide payload registry*: This weakens root lifetime and
      permits accidental cross-route record lookup.
    - *Fetch source on Copy*: This adds network and authority semantics to the
      stable profile and makes the first click dependent on server availability.
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/107")[#107],
    link("https://github.com/dathra/dathra/issues/109")[#109],
    link("https://github.com/dathra/dathra/issues/115")[#115],
    link("https://github.com/dathra/dathra/issues/119")[#119],
    link("https://github.com/dathra/dathra/issues/222")[#222],
  ),
)

== Behavior Contract

#behavior_spec(
  name: "stable source copy binding",
  summary: [
    An activated Copy control writes exactly the normalized source belonging to
    its own server-rendered DocCodeBlock instance.
  ],
  preconditions: [
    - a server response contains a DocCodeBlock with an emitted client root
    - the root marker, host marker, artifact admission, and root-scoped handoff
      table have a matching activation-root and activation-instance identity
  ],
  postconditions: [
    - the client passes `normalized-source` from the accepted handoff record to
      the clipboard API
    - the client does not derive source from highlighted DOM or re-run source
      normalization
    - another block's handoff record cannot satisfy this block's activation
  ],
)

#behavior_spec(
  name: "invalid stable source binding",
  summary: [
    An inconsistent handoff does not create a partially active Copy control.
  ],
  preconditions: [
    - an expected activation root, instance ID, artifact identity, marker, or
      handoff record is missing, stale, duplicated, or mismatched
  ],
  postconditions: [
    - the client registers no listener, state, or timer owner for that block
    - the server-rendered code display remains readable
    - a diagnostic identifies the failed handoff binding
  ],
)

#behavior_spec(
  name: "stable source handoff disposal",
  summary: [
    Disposal ends the handoff record's client lifetime with its activation.
  ],
  preconditions: [
    - an activated block is removed from its owning activation scope
  ],
  postconditions: [
    - the activation releases its normalized-source reference
    - the record cannot be reused to activate another block
    - no global source cache or revision channel remains
  ],
)

== Adoption Gate

Before #118 creates a placement plan, #98 and #99 must provide their accepted
production-consumer boundaries or the plan must report their absence as a
compile diagnostic. Before #119 emits an artifact, this logical record must be
transferred to the responsible package `SPEC.typ` and executable tests, with
the exact encoding and identity-verification mechanism specified there.
