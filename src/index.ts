import DatabaseInterface from './Databases/DatabaseInterface';
import PgSqlDatabase from './Databases/PgSqlDatabase';
export { DatabaseInterface, PgSqlDatabase };

import CompiledQuery from './Queries/CompiledQuery';
import QueryIdentifier from './Queries/QueryIdentifier';
import QueryParam from './Queries/QueryParam';
import SqlQuery from './Queries/SqlQuery';
export { CompiledQuery, QueryIdentifier, QueryParam, SqlQuery };

import NotFoundError from './Errors/NotFoundError';
import TooManyResultsError from './Errors/TooManyResultsError';
export { NotFoundError, TooManyResultsError };

import CrudRepository from './Repositories/CrudRepository';
export { CrudRepository };

export const sql = SqlQuery.createFromTemplateString;
export const sqlJoin = SqlQuery.join;
