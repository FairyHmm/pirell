> [!WARNING]
> **Status: Work in Progress.**
> The core engine is currently under active design.

Pirell is a JavaScript library for transforming relational data.

It focuses on SQL-like transformations while also accounting for the dimensions and shape of the data being transformed. Pirell aims to provide these transformations as a small set of composable operations that work directly on ordinary JavaScript data.

## Design Philosophy

Pirell prioritizes:

- **Small, orthogonal primitives** over a large collection of specialized operations.
- **Readability** so transformations remain understandable as they are composed.
- **Composition** so more complex transformations can be built from simpler ones.
- **Pure operations**, so composition and chaining behave as straightforward function composition, without imposing purity on user-supplied data or callbacks.
- **Functions as the primary abstraction** rather than a separate query or data object model.
- **Data-source independence** so Pirell can transform data regardless of where it came from.
- **Ordinary JavaScript data** without requiring data to be converted into a Pirell-specific representation.
- **Shape-aware transformations** so the structure of a transformation's input and output is explicit and can be checked by the type system.

Pirell is primarily intended for data that is already available in memory, particularly application data. It does not depend on a particular backend or persistence layer.

## Non-goals

Pirell is not intended to be:

- A database
- An ORM
- A distributed query engine
- An analytics or DataFrame framework

Pirell aims to provide the **relational transformation language aspect of SQL**, not to replace SQL as a database system.
