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
