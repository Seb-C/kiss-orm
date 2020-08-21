required lib imports:
    "pg"
    "@types/pg"

readme with examples and documentation
configs (ts, npm..., docker)
separate repository
import the right typings: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/pg/index.d.ts

composite primary keys
try to reduce the boilerplate
abstraction layer for the id management (for default queries)
migration
caching?
relations
eager loading
lazy loading
events
cascade
pagination
streaming
logging
schema declaration?
mappings?
replace pg-promise with node-postgres
refresh?
soft delete (=> global scoping for the repository)

implement query identifier formatter in Database + test https://www.npmjs.com/package/pg-format
test the repository
