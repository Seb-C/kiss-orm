import { Client, ClientConfig } from 'pg';
import { ident as formatIdentifier } from 'pg-format';
import SqlQuery from '../Queries/SqlQuery';
import CompiledQuery from '../Queries/CompiledQuery';
import DatabaseInterface from './DatabaseInterface';
import { sql } from '..';

type LogFunction = (query: CompiledQuery) => void;

export default class PgSqlDatabase implements DatabaseInterface {
	private readonly config: ClientConfig;
	private readonly logFunction: LogFunction;
	public client!: Client;

	constructor(
		config: ClientConfig,
		logFunction: LogFunction = (query) => {},
	) {
		this.config = config;
		this.logFunction = logFunction;
	}

	async connect(autoReconnectDelay: number|null = null) {
		this.client = new Client(this.config);
		await this.client.connect();

		if (autoReconnectDelay !== null) {
			this.client.on('error', (err) => {
				console.error(err);

				const tryToReconnect = async () => {
					try {
						await this.connect(autoReconnectDelay);
					} catch (error) {
						console.error(error);
						setTimeout(tryToReconnect, autoReconnectDelay);
					}
				};

				setTimeout(tryToReconnect, autoReconnectDelay);
			});
		}
	}

	async disconnect() {
		await this.client.end()
	}

	async query(query: SqlQuery): Promise<any[]> {
		const indexToPlaceholder = (i: number) => '$' + (i + 1);

		const compiledQuery = query.compile(indexToPlaceholder, formatIdentifier);
		this.logFunction(compiledQuery);

		const result = await this.client.query(
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
