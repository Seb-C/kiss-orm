required lib imports:
    "pg"
    "pg-format"
    "@types/pg"
    "@types/pg-format"

later: replace the cache Map with a Map of WeakRef (not fully supported for now)
readme with examples and documentation
explain automatically secured
eager loading should be handled by yourself (only lazy loading is supported)
explain basic principles
    - sane dependency injection
    - separate of concerns
    - let you use the full power of SQL (no query builder)
    - No magic. Everything is explicit. No query is done implicitly.
examples for "events"
examples for custom mappings (assumes same name)
examples for cascade events (via normal functions or normal SQL) + cascade save relationships (do explicitly)?
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
streaming / paging

migrations

reusing the instances (already implemented) = good idea? Should remove?
relations = simple methods in the models
cache the array relations?

autoloadRelationships: {
    propertyNameForHasMany: async (model: Model): Promise<OtherModel[]> => {
        return (new OtherRepository(database)).search(sql`relationId = ${model.id}`);
    },
    propertyNameForHasOne: async (model: Model): Promise<OtherModel> => {
        return (new OtherRepository(database)).get(sql`id = ${model.relationId}`);
    },
    propertyNameForManyMany: async (model: Model): OtherModel[] => {
        // TODO
    },
}
