export * as DatabaseInterface from './Databases/DatabaseInterface';
export * as PgSqlDatabase from './Databases/PgSqlDatabase';

export * as CrudRepository from './Databases/CrudRepository';

import SqlQuery from './Queries/SqlQuery';
export const sql = SqlQuery.createFromTemplateString;
export const sqlJoin = SqlQuery.join;
