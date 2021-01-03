import SqlQuery from '../Queries/SqlQuery';

export default interface DatabaseInterface {
	disconnect(): Promise<void>;
	query(query: SqlQuery): Promise<any[]>;
	migrate(migrations: { [key: string]: SqlQuery }): Promise<void>;

	/**
	 * The sequence function allows to perform several queries,
	 * sequentially and on a dedicated connection. This is especially useful
	 * to ensure that multi-queries transactions are done on the same connection,
	 * and without any other async query interfering.
	 */
	sequence<T>(
		sequence: (sequenceDb: DatabaseInterface) => Promise<T>,
	): Promise<T>;

	/**
	 * The insertAndGet method takes a standard INSERT query,
	 * executes and returns either an auto-generated id or
	 * the entire inserted record. Since this is database-dependent,
	 * the repository handles both cases, but it is better
	 * to return the record whenever possible, otherwise
	 * an additional query will have to be performed by the repository
	 * to retrieve the data.
	 * The provided query should not contain any delimiter (like a semicolon) at the end
	 * The returned value is either an array of inserted ids (integers), uuids (strings) or the whole updated records.
	 */
	insertAndGet(standardInsertQuery: SqlQuery): Promise<number[]|string[]|any[]>;

	/**
	 * The updateAndGet method takes a standard UPDATE query and,
	 * if possible, returns the record returned by the database.
	 * If it is not possible, the repository will handle the
	 * null value by performing an additional query.
	 * The provided query should not contain any delimiter (like a semicolon) at the end
	 * The returned value is either null (no data about the result) or the whole updated records.
	 * This method is expected to reject the promise (throw an async exception) is no rows have been updated.
	 */
	updateAndGet(standardUpdateQuery: SqlQuery): Promise<null|any[]>;
};
