import { Pool, PoolClient, ClientBase, PoolConfig } from 'pg';
import { ident as formatIdentifier } from 'pg-format';
import SqlQuery from '../Queries/SqlQuery';
import DatabaseInterface from './DatabaseInterface';

const sql = SqlQuery.createFromTemplateString;

export default class PgSqlDatabase implements DatabaseInterface {
	public readonly connection: Pool|ClientBase;

	constructor(connection: PoolConfig|Pool|ClientBase) {
		if (connection instanceof Pool || connection instanceof ClientBase) {
			this.connection = connection;
		} else {
			this.connection = new Pool(connection);
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

	private queryPoolOrClient = async (client: Pool|ClientBase, query: SqlQuery): Promise<any[]> => {
		const compiledQuery = query.compile(this.indexToPlaceholder, formatIdentifier);
		const result = await client.query(compiledQuery.sql, <any[]><any>compiledQuery.params);

		return result.rows;
	}

	async query(query: SqlQuery): Promise<any[]> {
		return this.queryPoolOrClient(this.connection, query);
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

			await this.sequence(async sequenceDb => {
				await sequenceDb.query(sql`BEGIN;`);
				try {
					await sequenceDb.query(migrationQuery);
					await sequenceDb.query(sql`INSERT INTO "Migrations" VALUES (${migrationName});`);
				} catch (error) {
					await sequenceDb.query(sql`ROLLBACK;`);
					throw error;
				}
				await sequenceDb.query(sql`COMMIT;`);
			});
		}
	}
}
