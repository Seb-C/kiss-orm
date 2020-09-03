import { Client, PoolConfig } from 'pg';
import * as Pool from 'pg-pool';
import { ident as formatIdentifier } from 'pg-format';
import SqlQuery from '../Queries/SqlQuery';
import CompiledQuery from '../Queries/CompiledQuery';
import DatabaseInterface from './DatabaseInterface';
import { sql } from '..';

type LogFunction = (query: CompiledQuery) => void;

export default class PgSqlDatabase implements DatabaseInterface {
	public readonly config: PoolConfig;
	public readonly logFunction: LogFunction;
	public readonly pool: Pool<Client>;

	constructor(
		config: PoolConfig,
		logFunction: LogFunction = (query) => {},
	) {
		this.config = config;
		this.logFunction = logFunction;
		this.pool = new Pool(this.config);
	}

	async disconnect() {
		await this.pool.end();
	}

	async query(query: SqlQuery): Promise<any[]> {
		const indexToPlaceholder = (i: number) => '$' + (i + 1);

		const compiledQuery = query.compile(indexToPlaceholder, formatIdentifier);
		this.logFunction(compiledQuery);

		const result = await this.pool.query(
			compiledQuery.sql,
			<any[]><any>compiledQuery.params,
		);

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
