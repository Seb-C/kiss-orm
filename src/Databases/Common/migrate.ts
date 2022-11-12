import SqlQuery from '../../Queries/SqlQuery';
import DatabaseInterface from '../DatabaseInterface';
import QueryIdentifier from '../../Queries/QueryIdentifier';

const sql = SqlQuery.createFromTemplateString;

export default async (
	database: DatabaseInterface,
	migrations: { [key: string]: SqlQuery },
) => {
	await database.query(sql`
		CREATE TABLE IF NOT EXISTS ${new QueryIdentifier('Migrations')}(
			${new QueryIdentifier('name')} VARCHAR(768) PRIMARY KEY NOT NULL
		);
	`);

	const migrationsDone = await database.query(sql`SELECT * FROM ${new QueryIdentifier('Migrations')};`);

	for (const [migrationName, migrationQuery] of Object.entries(migrations)) {
		if (migrationsDone.some(migrationDone => migrationDone.name === migrationName)) {
			continue;
		}

		await database.sequence(async sequenceDb => {
			await sequenceDb.query(sql`BEGIN;`);
			try {
				await sequenceDb.query(migrationQuery);
				await sequenceDb.query(sql`
					INSERT INTO ${new QueryIdentifier('Migrations')}
					VALUES (${migrationName});
				`);
			} catch (error) {
				await sequenceDb.query(sql`ROLLBACK;`);
				throw error;
			}
			await sequenceDb.query(sql`COMMIT;`);
		});
	}
}
