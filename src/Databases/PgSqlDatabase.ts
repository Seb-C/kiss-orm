import { Pool, PoolClient, PoolConfig } from 'pg';
import { ident as formatIdentifier } from 'pg-format';
import SqlQuery from '../Queries/SqlQuery';
import DatabaseInterface from './DatabaseInterface';
import { sql } from '..';

export default class PgSqlDatabase implements DatabaseInterface {
	public readonly pool: Pool;

	constructor(pool: PoolConfig|Pool) {
		if (pool instanceof Pool) {
			this.pool = pool;
		} else {
			this.pool = new Pool(pool);
		}
	}

	async disconnect() {
		await this.pool.end();
	}

	indexToPlaceholder (i: number): string {
		return '$' + (i + 1);
	}

	private queryPoolOrClient = async (client: Pool|PoolClient, query: SqlQuery): Promise<any[]> => {
		const compiledQuery = query.compile(this.indexToPlaceholder, formatIdentifier);
		const result = await client.query(compiledQuery.sql, <any[]><any>compiledQuery.params);

		return result.rows;
	}

	async query(query: SqlQuery): Promise<any[]> {
		return this.queryPoolOrClient(this.pool, query);
	}

	async sequence<T>(
		sequence: (
			query: (query: SqlQuery) => Promise<any[]>,
		) => Promise<T>,
	): Promise<T> {
		const client = await this.pool.connect();

		try {
			const result = await sequence(async (query: SqlQuery): Promise<any[]> => {
				return this.queryPoolOrClient(client, query);
			});
			client.release();
			return result;
		} catch (error) {
			client.release();
			throw error;
		}
	}

	async migrate(migrations: { [key: string]: SqlQuery }) {
		await this.query(sql`
			CREATE TABLE IF NOT EXISTS "Migrations" (
				"name" TEXT PRIMARY KEY NOT NULL
			);
		`);

		const migrationsDone = await this.query(sql`SELECT * FROM "Migrations";`);

		for (const [migrationName, migrationQuery] of Object.entries(migrations)) {
			if (migrationsDone.some(migrationDone => migrationDone.name === migrationName)) {
				continue;
			}

			await this.sequence(async query => {
				await query(sql`BEGIN;`);
				try {
					await query(migrationQuery);
					await query(sql`INSERT INTO "Migrations" VALUES (${migrationName});`);
				} catch (error) {
					await query(sql`ROLLBACK;`);
					throw error;
				}
				await query(sql`COMMIT;`);
			});
		}
	}
}
