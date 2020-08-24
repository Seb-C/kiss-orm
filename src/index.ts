export * as DatabaseInterface from './Databases/DatabaseInterface';
export * as PgSqlDatabase from './Databases/PgSqlDatabase';

export * as CompiledQuery from './Queries/CompiledQuery';
export * as QueryIdentifier from './Queries/QueryIdentifier';
export * as QueryParam from './Queries/QueryParam';
export * as SqlQuery from './Queries/SqlQuery';

export * as CrudRepository from './Repositories/CrudRepository';

import SqlQuery from './Queries/SqlQuery';
export const sql = SqlQuery.createFromTemplateString;
export const sqlJoin = SqlQuery.join;
