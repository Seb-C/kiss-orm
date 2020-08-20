readme with examples and documentation
configs (ts, npm..., docker)
separate repository
import the right typings: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/pg/index.d.ts

Basic requests
try to reduce the boilerplate
default queries
abstraction layer for database
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
merging queries
refresh?
soft delete (=> global scoping for the repository)
order by

test QueryIdentifier usage in Query (+ tests)
implement query identifier formatter in Database https://www.npmjs.com/package/pg-format
test query identifier formatter in Database
test the repository
