# @dathra/store

Atom-based store layer for Dathra.

This package is currently in a specification-first scaffolding stage. The initial design centers on:

- `atom(...)` for store-independent state definitions
- `createAtomStore(...)` for app/request-scoped store instances
- `withStore(store, render)` for explicit store boundaries

The current public work in this package is the initial specification under `src/*/SPEC.typ`.

- `getCurrentStore()` for reading the active synchronous store boundary

## License

MPL-2.0
