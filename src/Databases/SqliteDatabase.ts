import { Database } from 'sqlite3';
import { escapeId as formatIdentifier } from 'sqlstring';
import SqlQuery from '../Queries/SqlQuery';
import DatabaseInterface from './DatabaseInterface';

const sql = SqlQuery.createFromTemplateString;

type SqliteConfig = {
	filename: string,
	mode?: number,
};

export default class SqliteDatabase implements DatabaseInterface {
	public readonly connection: Database;

	constructor(connection: SqliteConfig|Database) {
		if (connection instanceof Database) {
			this.connection = connection;
		} else {
			this.connection = new Database(
				connection.filename,
				connection.mode,
			);
		}
	}

	async disconnect(): Promise<void> {
		if (this.connection instanceof Database) {
			return new Promise((resolve, reject) => {
				this.connection.close(err => {
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

			this.connection.all(
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
		sequence: (sequenceDb: SqliteDatabase) => Promise<T>,
	): Promise<T> {
		return new Promise((resolve, reject) => {
			this.connection.serialize(async () => {
				try {
					const result = await sequence(this);
					resolve(result);
				} catch (error) {
					reject(error);
				}
			});
		});
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

	async insertAndGet(standardInsertQuery: SqlQuery): Promise<number[]|string[]|any[]> {
		return new Promise((resolve, reject) => {
			const compiledQuery = standardInsertQuery.compile(this.indexToPlaceholder, formatIdentifier);

			this.connection.run(
				compiledQuery.sql,
				<any[]><any>compiledQuery.params,
				function (error: Error|null) {
					if (error) {
						reject(error);
					} else {
						resolve([this.lastID]);
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
