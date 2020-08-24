required lib imports:
    "pg"
    "pg-format"
    "@types/pg"
    "@types/pg-format"

readme with examples and documentation
explain automatically secured
eager loading should be handled by yourself (only lazy loading is supported)
explain basic principles
    - sane dependency injection
    - separate of concerns
    - let you use the full power of SQL (no query builder)
    - No magic. Everything is explicit. No query is done implicitly.
    - immutable pattern
handles normal and simple uses. Complex and specific cases should be specifically implemented
examples for "events"
examples for custom mappings (assumes same name)
examples for cascade events (via normal functions or normal SQL) + cascade save relationships (do explicitly)?
example for autoloading relationships
example for soft delete using scope (+ handle delete)
example for scoping
configs (ts, npm..., docker)
separate repository

db config object typing
abstraction layer for the id management at insert time (for default queries)
logging
streaming / paging

migrations

update typescript to remove useless model constructors?
