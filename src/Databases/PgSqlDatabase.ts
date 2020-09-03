import { Client, PoolConfig } from 'pg';
import * as Pool from 'pg-pool';
import { ident as formatIdentifier } from 'pg-format';
import SqlQuery from '../Queries/SqlQuery';
import DatabaseInterface from './DatabaseInterface';
import { sql } from '..';

export default class PgSqlDatabase implements DatabaseInterface {
	public readonly pool: Pool<Client>;

	constructor(pool: PoolConfig|Pool<Client>) {
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

	async query(query: SqlQuery): Promise<any[]> {
		const compiledQuery = query.compile(this.indexToPlaceholder, formatIdentifier);
		const result = await this.pool.query(compiledQuery.sql, <any[]><any>compiledQuery.params);

		return result.rows;
	}

	async migrate(migrations: { [key: string]: SqlQuery }) {
		await this.query(sql`
			CREATE TABLE IF NOT EXISTS "Migrations" (
				"name" TEXT PRIMARY KEY NOT NULL
			);
		`);

		const migrationsDone = await this.query(sql`SELECT * FROM "Migrations";`);

		for (const [migrationName, query] of Object.entries(migrations)) {
			if (migrationsDone.some(migrationDone => migrationDone.name === migrationName)) {
				continue;
			}

			await this.query(sql`BEGIN;`);
			try {
				await this.query(query);
				await this.query(sql`INSERT INTO "Migrations" VALUES (${migrationName});`);
			} catch (error) {
				await this.query(sql`ROLLBACK;`);
				throw error;
			}
			await this.query(sql`COMMIT;`);
		}
	}
}
