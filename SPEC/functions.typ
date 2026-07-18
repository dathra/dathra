#let Status = (
  Proposed: "Proposed",
  Accepted: "Accepted",
  Rejected: "Rejected",
  Deprecated: "Deprecated",
  Superseded: "Superseded",
)

#let header(title, status, date) = {
  assert(
    status in Status.values(),
    message: "ADR status must be one of: " + repr(Status.values()) + ", got: " + repr(status),
  )
  [
    === ADR: #title

    *Status:* #status
    *Date:* #date
  ]
}

#let adr(
  header,
  contexts,
  decisions,
  consequences,
  alternatives: none,
  supersedes: none,
  references: none,
) = {
  if supersedes != none {
    assert(
      type(supersedes) == array,
      message: "supersedes must be an array, got: " + repr(type(supersedes)),
    )
  }
  if references != none {
    assert(
      type(references) == array,
      message: "references must be an array of link() calls, got: " + repr(type(references)),
    )
  }
  [
    #header

    ==== Context
    #contexts

    ==== Decision
    #decisions

    ==== Consequences
    #consequences

    #if alternatives != none [
      ==== Alternatives Considered
      #alternatives
    ]

    #if supersedes != none [
      ==== Supersedes
      #for item in supersedes [
        - #item
      ]
    ]

    #if references != none [
      ==== References
      #for ref in references [
        - #ref
      ]
    ]

    #align(start)[
      #line(length: 80%, stroke: (paint: gray, dash: "dashed"))
    ]
  ]
}

// ============================================================
// Interface Specification Template
// ============================================================

#let interface_spec(
  name: none,
  summary: none,
  format: none,
  constraints: none,
  examples: none,
) = {
  assert(name != none, message: "interface_spec: name is required")
  assert(summary != none, message: "interface_spec: summary is required")
  [
    === #name

    #summary

    #if format != none [
      ==== Format
      #format
    ]

    #if constraints != none [
      ==== Constraints
      #constraints
    ]

    #if examples != none [
      ==== Examples
      #examples
    ]

    #align(start)[
      #line(length: 80%, stroke: (paint: gray, dash: "dashed"))
    ]
  ]
}

// ============================================================
// Behavior Specification Template
// ============================================================

#let behavior_spec(
  name: none,
  summary: none,
  preconditions: none,
  steps: none,
  postconditions: none,
  errors: none,
) = {
  assert(name != none, message: "behavior_spec: name is required")
  assert(summary != none, message: "behavior_spec: summary is required")
  [
    === #name

    #summary

    #if preconditions != none [
      ==== Preconditions
      #preconditions
    ]

    #if steps != none [
      ==== Steps
      #steps
    ]

    #if postconditions != none [
      ==== Postconditions
      #postconditions
    ]

    #if errors != none [
      ==== Error Cases
      #errors
    ]

    #align(start)[
      #line(length: 80%, stroke: (paint: gray, dash: "dashed"))
    ]
  ]
}

// ============================================================
// Feature Specification Template (for TDD)
// ============================================================

#let feature_spec(
  name: none,
  summary: none,
  api: none,
  edge_cases: none,
  test_cases: none,
  impl_notes: none,
) = {
  assert(name != none, message: "feature_spec: name is required")
  assert(summary != none, message: "feature_spec: summary is required")
  [
    === #name

    #summary

    #if api != none [
      ==== API
      #api
    ]

    #if edge_cases != none [
      ==== Edge Cases
      #edge_cases
    ]

    #if test_cases != none [
      ==== Test Cases
      #test_cases
    ]

    #if impl_notes != none [
      ==== Implementation Notes
      #impl_notes
    ]

    #align(start)[
      #line(length: 80%, stroke: (paint: gray, dash: "dashed"))
    ]
  ]
}

// ============================================================
// Design Proposal Template
// ============================================================

#let design_proposal(
  issue: none,
  name: none,
  summary: none,
  scope: none,
  non_goals: none,
  open_questions: none,
  references: none,
) = {
  assert(issue != none, message: "design_proposal: issue is required")
  assert(name != none, message: "design_proposal: name is required")
  assert(summary != none, message: "design_proposal: summary is required")
  [
    == Proposal #issue: #name

    #summary

    #if scope != none [
      === Scope
      #scope
    ]

    #if non_goals != none [
      === Non-goals
      #non_goals
    ]

    #if open_questions != none [
      === Open Questions
      #open_questions
    ]

    #if references != none [
      === References
      #for ref in references [
        - #ref
      ]
    ]

    #align(start)[
      #line(length: 80%, stroke: (paint: gray, dash: "dashed"))
    ]
  ]
}
