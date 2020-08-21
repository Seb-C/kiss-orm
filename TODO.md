required lib imports:
    "pg"
    "pg-format"
    "@types/pg"
    "@types/pg-format"

readme with examples and documentation
explain automatically secured
examples for "events"
examples for custom mappings (assumes same name)
example for soft delete using scope (+ handle delete)
example for scoping
configs (ts, npm..., docker)
separate repository

composite primary keys
try to reduce the boilerplate

db config object typing
abstraction layer for the id management (for default queries)
rename db to PostgresDb, add interface and abstraction
logging
streaming

migration
caching (= don't create multiple instances of a single row?)?
relations
eager loading
lazy loading
cascade
pagination
refresh?
