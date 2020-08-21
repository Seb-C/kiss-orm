import SqlQuery from './Queries/SqlQuery';

export const sql = SqlQuery.createFromTemplateString;

export const sqlJoin = SqlQuery.join;
