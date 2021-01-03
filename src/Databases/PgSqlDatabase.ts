import { Pool, PoolClient, ClientBase, PoolConfig, Client } from 'pg';
import { ident as formatIdentifier } from 'pg-format';
import SqlQuery from '../Queries/SqlQuery';
import DatabaseInterface from './DatabaseInterface';
import migrate from './Common/migrate';

const sql = SqlQuery.createFromTemplateString;

export default class PgSqlDatabase implements DatabaseInterface {
	public readonly connection: Pool|ClientBase;

	constructor(connection: PoolConfig|Pool|ClientBase) {
		if (connection instanceof Pool || connection instanceof Client) {
			this.connection = connection;
		} else {
			this.connection = new Pool(<PoolConfig>connection);
		}
	}

	async disconnect() {
		if (this.connection instanceof Pool) {
			await this.connection.end();
		}
	}

	indexToPlaceholder (i: number): string {
		return '$' + (i + 1);
	}

	async query(query: SqlQuery): Promise<any[]> {
		const compiledQuery = query.compile(this.indexToPlaceholder, formatIdentifier);
		const result = await this.connection.query(compiledQuery.sql, <any[]><any>compiledQuery.params);

		return result.rows;
	}

	async sequence<T>(
		sequence: (sequenceDb: PgSqlDatabase) => Promise<T>,
	): Promise<T> {
		if (!(this.connection instanceof Pool)) {
			// Already in a sequence, so another call changes nothing but works for conveniency
			return sequence(this);
		}

		const client = <PoolClient>(await this.connection.connect());

		try {
			const result = await sequence(
				new PgSqlDatabase(<ClientBase>client)
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
		return this.query(sql`
			${standardInsertQuery}
			RETURNING *;
		`);
	}

	async updateAndGet(standardUpdateQuery: SqlQuery): Promise<null|any[]> {
		return this.query(sql`
			${standardUpdateQuery}
			RETURNING *;
		`);
	}
}
