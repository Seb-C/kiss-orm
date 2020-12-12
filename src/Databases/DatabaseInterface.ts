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
};
