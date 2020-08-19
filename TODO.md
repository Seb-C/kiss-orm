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
test pg-format for identifiers security: https://www.npmjs.com/package/pg-format
test the remaining classes
replace any types with a proper list (string|number|Date|null?) also need array and/or object?): https://node-postgres.com/features/queries

constructor(database: Database) {
    super({
        table: 'User',
        database,
    });
}

public async getBy(column: string, value: any): Promise<User> => new User(
    await this.db.getOne(sql`
        SELECT *
        FROM "${injectSql(this.table)}"
        WHERE "${injectSql(column)}" = ${value}
    `)
);

const roles = ['admin', 'moderator'];
repo.select(sql`role IN (${roles}) OR id = 1`);

// TODO returning record?
repo.insert({ ... });

// TODO return new user object?
repo.update(user: User, { ... });

repo.delete(user: User);
