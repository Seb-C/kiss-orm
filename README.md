# Kiss-ORM

## Introduction

Kiss-ORM is a new, very opinionated ORM for TypeScript. Here is a description of it's design philosophy:
- No query builder (you can use the full power and expressiveness of SQL)
- Security: Kiss-ORM allows you to write and concatenate SQL queries without worrying about SQL injections
- Fully tested
- Sane dependency-injection (and dependencies!)
- Data-mapper pattern rather than active-record
- Immutability of the objects
- No magic. Everything is explicit. No database operation is done unless explicitly requested.
- Proper separation of concerns for your repositories
- Simplicity: the architecture is ridiculously simple. If you need complex operations, you have the freedom to write it without worries.
- No mappings: Kiss-ORM always assumes that the column and JS properties have the same name.

## Compatibility

Currently, Kiss-ORM is only compatible with PostgreSQL via `node-postgres` (the `pg` package),
but there is an abstraction layer that will allows compatibility
with other databases in the future. You are welcome to contribute :) .

## Basics

Kiss-ORM uses the template-strings tagging feature to secure all the queries.

Here is the basic query syntax:

```typescript
database.query(sql`
    SELECT *
    FROM "Users"
    WHERE "email" = ${unsafeInputs.email}
    AND "password" = CRYPT(${unsafeInputs.password})
`);
```

Did you notice the `sql` tag? This internally transforms the query safely into something like this:

```
{
    query: 'SELECT * FROM "Users" WHERE "email" = $1 AND "password" = $2',
    params: ['bob@example.com', '123456'],
}
```

For security reasons, the query method does not accept raw strings, so you cannot forget to use the `sql` tag.

You can also safely include and concatenate queries:
```typescript
const conditions = sql`"role" = ${'admin'} AND "blocked" = ${false}`;
database.query(sql`SELECT * FROM "Users" WHERE ${conditions};`);
```

Result:
```
{
    query: 'SELECT * FROM "Users" WHERE "role" = $1 AND "blocked" = $2',
    params: ['admin', false],
}
```

## Minimal setup

```typescript
import {
    sql,
    PgSqlDatabase,
    CrudRepository,
} from '../Databases/PgSqlDatabase';

class UserModel {
    public readonly id!: number;
    public readonly email!: string;
    public readonly isBlocked!: boolean;
}

class UserRepository extends CrudRepository<UserModel> {
    constructor(database: PgSqlDatabase) {
        super({
            database,
            table: 'Users',
            primaryKey: 'id',
            model: UserModel,
        });
    }
}

// [...]

const db = new PgSqlDatabase({
    // https://node-postgres.com/api/client#new-clientconfig-object
});
await db.connect();

const repository = new UserRepository(db);

const user = await repository.get(2);
const blockedUsers: User[] = await repository.search(
    sql`"isBlocked" = TRUE OR "email" LIKE ${'%@' + bannedDomain}`,
    sql`"email" ASC`,
);

const updatedUser = await repository.update(user, {
    isBlocked: false,
});

const newUser = await repository.create({
    email: 'alice@example.com',
    isBlocked: false,
});

await repository.delete(user);

await db.disconnect();
```

## Events

There is no specific feature for the events, because the repositories allows you to do it in an explicit way:

```typescript
class UsersRepository extends CrudRepository<UserModel> {
    public async create(attributes: any): Promise<UserModel> {
        doSomeThingBeforeInsert();
        const user = await super.create(attributes);
        doSomeThingAfterInsert();
        return user;
    }

    public async update(user: UserModel, attributes: any): Promise<UserModel> {
        doSomeThingBeforeUpdate();
        const newUser = await super.update(user, attributes);
        doSomeThingAfterUpdate();
        return newUser;
    }

    public async delete(user: UserModel) {
        doSomeThingBeforeDelete();
        await super.delete(user);
        doSomeThingAfterDelete();
    }
}
```

## Cascade

Cascade operations are not supported by Kiss-ORM, but your database engine does it pretty well already :) .

If you have more complex or specific needs, you will have to specifically implement it with the proper transactions.

## Scoping

Scoping allows you to apply a global filter to all SELECT queries.

```typescript
class AdminUsersRepository extends CrudRepository<UserModel> {
    constructor(database: PgSqlDatabase) {
        super({
            // [...]
            scope: sql`"role" = 'admin'`,
        });
    }
}
```

## Soft delete

Soft-delete can be implemented with the scoping feature

```typescript
class UsersRepository extends CrudRepository<UserModel> {
    constructor(database: PgSqlDatabase) {
        super({
            // [...]
            scope: sql`"deletedFlag" = FALSE`,
        });
    }
}
```

When you do this, the `delete` method will still trigger a database `DELETE` operation.
If you want to change this behaviour, you can override it:

```typescript
class UsersRepository extends CrudRepository<UserModel> {
    public async delete(user: UserModel) {
        await this.update(user, { deletedFlag: true });
    }
}
```

## Logging

You can log all SQL queries by defining a callback to the database object.
This callback receives a `CompiledQuery` object.

Example (logging everything with `console.log`):

```typescript
const db = new PgSqlDatabase({
    // https://node-postgres.com/api/client#new-clientconfig-object
}, console.log);
```

## Migrations

Kiss-ORM comes with a simple migration system.
You can execute this whenever you want (when your server starts for example).
Since this is a Javascript object, you can choose to organize your migrations
however you want (for example import it for a big unique file, or split it).

```typescript
await db.migrate({
    'createUserTable': sql`
        CREATE TABLE "User" (
            "id" UUID PRIMARY KEY NOT NULL,
            "email" TEXT NOT NULL
        );
    `,
    'addUserEmailIndex': sql`
        CREATE UNIQUE INDEX "User_email_index" ON "User"("email");
    `,
});
```

## Relationships

Relationships are defined in the repositories and must be explicitly loaded

### one-to-one

```typescript
class RoleModel {
    // [...]
}

class UserModel {
    // [...]
    public readonly roleId!: number;

    public readonly role?: RoleModel;
}

class RoleRepository extends CrudRepository<RoleModel> {
    // [...]
}

class UserRepository extends CrudRepository<UserModel> {
    constructor(database: PgSqlDatabase) {
        super({
            // [...]
            relationships: {
                role: (user: UserModel) => (new RoleRepository(database)).get(user.roleId),
            },
        });
    }
}

const repository = new UserRepository(database);
let user = await repository.get(1);
// Currently. user.role is `undefined`. You explicitly need to load it
user = await repository.loadRelationship(user, 'role');
// `user.role` is now populated with a `RoleModel`.
```

### one-to-many

```typescript
class RoleModel {
    // [...]
    public readonly users?: UserModel[];
}

class RoleRepository extends CrudRepository<RoleModel> {
    constructor(database: PgSqlDatabase) {
        super({
            // [...]
            relationships: {
                users: (role: RoleModel) => (new UserRepository(database)).search(sql`"roleId" = ${role.id}`),
            },
        });
    }
}

const repository = new RoleRepository(database);
let role = await repository.get(1);
role = await repository.loadRelationship(role, 'users');
// role.users is now populated with an array of `UserModel`
```

### many-to-many

```typescript
class ArticleModel {
    // [...]
    public readonly authors?: UserModel[];
}

class UserModel {
    // [...]
    public readonly articles?: ArticleModel[];
}

class ArticleRepository extends CrudRepository<ArticleModel> {
    constructor(database: PgSqlDatabase) {
        super({
            // [...]
            relationships: {
                articles: (user: UserModel) => (new UserRepository(database)).search(sql`
                    "id" IN (
                        SELECT "userId"
                        FROM "ArticleAuthors"
                        WHERE "articleId" = ${article.id}
                    )
                `),
            },
        });
    }
}

class UserRepository extends CrudRepository<UserModel> {
    constructor(database: PgSqlDatabase) {
        super({
            // [...]
            relationships: {
                articles: (user: UserModel) => (new AuthorRepository(database)).search(sql`
                    "id" IN (
                        SELECT "articleId"
                        FROM "ArticleAuthors"
                        WHERE "userId" = ${user.id}
                    )
                `),
            },
        });
    }
}

const repository = new UserRepository(database);
let user = await repository.get(1);
user = await repository.loadRelationship(user, 'articles');
// `user.articles` is now populated with an array of `ArticleModel`.

const repository = new ArticleRepository(database);
let article = await repository.get(1);
article = await repository.loadRelationship(article, 'authors');
// `user.authors` is now populated with an array of `UserModel`.
```

## Eager loading for relationships

Kiss-ORM only supports lazy-loading (on-demand).
If you need something more complex, you should implement the queries specifically.

## Autoloading relationships

```typescript
class UserRepository extends CrudRepository<UserModel> {
    // [...]

    // This function is called everytime an object is created by Kiss-ORM
    // I don't recommend to do this because it will result in a lot of unnecessary queries...
    protected async createModelFromAttributes(attributes: any): Promise<UserModel> {
        const user = super.createModelFromAttributes(attributes);
        await this.loadRelationship(user, 'role');
        await this.loadRelationship(user, 'articles');
        return user;
    }
}
```
