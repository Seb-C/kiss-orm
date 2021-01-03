import SqlQuery from '../Queries/SqlQuery';
import DatabaseInterface from './DatabaseInterface';
import migrate from './Common/migrate';

import {
	Pool,
	PoolConnection,
	PoolConfig,
	MysqlError,
	createPool,
	escapeId as formatIdentifier,
} from 'mysql';

// Note: The mysql package does not expose the classes, so we have to rely on those ugly tests instead.
const isPoolOrPoolConnection = (connection: any) => {
	// Note: The mysql pacakge does not expose the classes, so we cannot use a proper instanceof...
	return connection.query && connection.query instanceof Function;
};
const isPool = (connection: any) => {
	return isPoolOrPoolConnection(connection)
		&& connection.end
		&& !(connection.release);
};

export default class MySqlDatabase implements DatabaseInterface {
	public readonly connection: Pool|PoolConnection;

	constructor(connection: PoolConfig|Pool|PoolConnection) {
		if (isPoolOrPoolConnection(connection)) {
			this.connection = <Pool|PoolConnection>connection;
		} else {
			this.connection = createPool(<PoolConfig>connection);
		}
	}

	async disconnect(): Promise<void> {
		if (isPool(this.connection)) {
			return new Promise((resolve, reject) => {
				this.connection.end(err => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				});
			});
		}
	}

	indexToPlaceholder (i: number): string {
		return '?';
	}

	async query(query: SqlQuery): Promise<any[]> {
		return new Promise((resolve, reject) => {
			const compiledQuery = query.compile(this.indexToPlaceholder, formatIdentifier);

			this.connection.query(
				compiledQuery.sql,
				<any[]><any>compiledQuery.params,
				(error, rows) => {
					if (error) {
						reject(error);
					} else {
						resolve(rows);
					}
				},
			);
		});
	}

	async sequence<T>(
		sequence: (sequenceDb: MySqlDatabase) => Promise<T>,
	): Promise<T> {
		if (!isPool(this.connection)) {
			// Already in a sequence, so another call changes nothing but works for conveniency
			return sequence(this);
		}

		const client: PoolConnection = await new Promise((resolve, reject) => {
			(<Pool>this.connection).getConnection((error: MysqlError, connection: PoolConnection) => {
				if (error) {
					reject(error);
				} else {
					(<Pool>this.connection).acquireConnection(connection, (error: MysqlError, connection: PoolConnection) => {
						if (error) {
							reject(error);
						} else {
							resolve(connection);
						}
					});
				}
			});
		});

		try {
			const result = await sequence(
				new MySqlDatabase(<PoolConnection>client)
			);
			client.release();
			return result;
		} catch (error) {
			client.release();
			throw error;
		}
	}

	async migrate(migrations: { [key: string]: SqlQuery }) {
		await migrate(this, migrations);
	}

	async insertAndGet(standardInsertQuery: SqlQuery): Promise<number[]|string[]|any[]> {
		return new Promise((resolve, reject) => {
			const compiledQuery = standardInsertQuery.compile(this.indexToPlaceholder, formatIdentifier);

			this.connection.query(
				compiledQuery.sql,
				<any[]><any>compiledQuery.params,
				(error, { insertId }) => {
					if (error) {
						reject(error);
					} else {
						resolve([insertId]);
					}
				},
			);
		});
	}

	async updateAndGet(standardUpdateQuery: SqlQuery): Promise<null|any[]> {
		await this.query(standardUpdateQuery);
		return null;
	}
}
