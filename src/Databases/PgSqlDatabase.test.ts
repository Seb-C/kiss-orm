import 'jasmine';
import { Pool } from 'pg';
import PgSqlDatabase from './PgSqlDatabase';
import SqlQuery from '../Queries/SqlQuery';

const sql = SqlQuery.createFromTemplateString;

describe('PgSqlDatabase', async function() {
	let db: PgSqlDatabase;

	beforeEach(async function() {
		db = new PgSqlDatabase({
			host: 'pgsql',
			port: 5432,
			database: 'test',
			user: 'test',
			password: 'test',
			max: 2,
		});
	});

	afterEach(async function() {
		await db.disconnect();
	});

	it('indexToPlaceholder', async function() {
		expect(db.indexToPlaceholder(0)).toBe('$1');
		expect(db.indexToPlaceholder(1)).toBe('$2');
		expect(db.indexToPlaceholder(2)).toBe('$3');
	});

	it('query with results', async function() {
		const result = await db.query(sql`
			SELECT CAST (${42} AS INT) as foo, ${'test'} as bar
		`);

		expect(result.length).toBe(1);
		expect(result[0]).toEqual({ foo: 42, bar: 'test' });
	});

	it('query without results', async function() {
		const result = await db.query(sql`
			SELECT *
			FROM (
				SELECT 1 AS foo
			) AS test
			WHERE 1 = 2
		`);

		expect(result.length).toBe(0);
	});

	it('sequence - normal use', async function() {
		await db.query(sql`
			DROP TABLE IF EXISTS "TestSequence";
			CREATE TABLE "TestSequence" (x INT NOT NULL);
		`);

		await db.sequence(async sequenceDb => {
			await sequenceDb.query(sql`BEGIN;`);
			await sequenceDb.query(sql`INSERT INTO "TestSequence" VALUES (1);`);
			await sequenceDb.query(sql`INSERT INTO "TestSequence" VALUES (2);`);
			await sequenceDb.query(sql`COMMIT;`);
		});

		const result = await db.query(sql`SELECT * FROM "TestSequence";`);
		expect(result.length).toBe(2);
		expect(result[0]).toEqual({ x: 1 });
		expect(result[1]).toEqual({ x: 2 });

		const pool = (<Pool>db.connection);
		expect(pool.idleCount).toEqual(pool.totalCount);
	});
	it('sequence - the connection is dedicated', async function() {
		await db.query(sql`
			DROP TABLE IF EXISTS "TestSequence";
			CREATE TABLE "TestSequence" (x INT NOT NULL);
		`);

		const seq = db.sequence(async sequenceDb => {
			await sequenceDb.query(sql`BEGIN;`);
			await sequenceDb.query(sql`INSERT INTO "TestSequence" VALUES (1);`);
			await new Promise((resolve) => setTimeout(resolve, 500));
			await sequenceDb.query(sql`INSERT INTO "TestSequence" VALUES (2);`);
			await sequenceDb.query(sql`ROLLBACK;`);
		});

		// This query should be done at the same time than the two inserts
		await new Promise((resolve) => setTimeout(resolve, 200));
		await db.query(sql`INSERT INTO "TestSequence" VALUES (3);`);

		await seq;

		const result = await db.query(sql`SELECT * FROM "TestSequence";`);
		expect(result.length).toBe(1);
		expect(result[0]).toEqual({ x: 3 });

		const pool = (<Pool>db.connection);
		expect(pool.idleCount).toEqual(pool.totalCount);
	});
	it('sequence - the connection is released when failing', async function() {
		try {
			await db.sequence(async query => {
				throw new Error('test');
			});
		} catch (error) {
			if (error.message !== 'test') {
				throw error;
			}
		}

		const pool = (<Pool>db.connection);
		expect(pool.idleCount).toEqual(pool.totalCount);
	});
	it('sequence - returns the given value', async function() {
		const result = await db.sequence(async query => {
			return 42;
		});

		expect(result).toBe(42);
	});
	it('sequence - a sequence in a sequence works', async function() {
		await db.query(sql`
			DROP TABLE IF EXISTS "TestSequence";
			CREATE TABLE "TestSequence" (x INT NOT NULL);
		`);

		await db.sequence(async db2 => {
			await db2.query(sql`BEGIN;`);
			await db2.query(sql`INSERT INTO "TestSequence" VALUES (1);`);
			await db2.sequence(async db3 => {
				await db3.query(sql`INSERT INTO "TestSequence" VALUES (2);`);
			});
			await db2.query(sql`COMMIT;`);
		});

		const result = await db.query(sql`SELECT * FROM "TestSequence";`);
		expect(result.length).toBe(2);
		expect(result[0]).toEqual({ x: 1 });
		expect(result[1]).toEqual({ x: 2 });
	});

	it('migrations - from scratch', async function() {
		await db.query(sql`
			DROP TABLE IF EXISTS "Migrations";
			DROP TABLE IF EXISTS "TestMigration";
			CREATE TABLE "TestMigration" ("text" TEXT NOT NULL);
		`);

		await db.migrate({
			'test 1': sql`INSERT INTO "TestMigration" VALUES ('test 1');`,
			'test 2': sql`INSERT INTO "TestMigration" VALUES ('test 2');`,
		});

		const results = await db.query(sql`SELECT * FROM "TestMigration";`);
		expect(results.length).toBe(2);
		expect(results[0].text).toEqual('test 1');
		expect(results[1].text).toEqual('test 2');
	});
	it('migrations - partial update', async function() {
		await db.query(sql`
			DROP TABLE IF EXISTS "Migrations";
			DROP TABLE IF EXISTS "TestMigration";
			CREATE TABLE "TestMigration" ("text" TEXT NOT NULL);
		`);

		await db.migrate({}); // Creating the Migrations table
		await db.query(sql`INSERT INTO "Migrations" VALUES ('test 2');`);

		await db.migrate({
			'test 1': sql`INSERT INTO "TestMigration" VALUES ('test 1');`,
			'test 2': sql`INSERT INTO "TestMigration" VALUES ('test 2');`,
			'test 3': sql`INSERT INTO "TestMigration" VALUES ('test 3');`,
		});

		const results = await db.query(sql`SELECT * FROM "TestMigration";`);
		expect(results.length).toBe(2);
		expect(results[0].text).toEqual('test 1');
		expect(results[1].text).toEqual('test 3');
	});
	it('migrations - no update required', async function() {
		await db.query(sql`
			DROP TABLE IF EXISTS "Migrations";
			DROP TABLE IF EXISTS "TestMigration";
			CREATE TABLE "TestMigration" ("text" TEXT NOT NULL);
		`);

		await db.migrate({}); // Creating the Migrations table
		await db.query(sql`
			INSERT INTO "Migrations" VALUES ('test 1');
			INSERT INTO "Migrations" VALUES ('test 2');
		`);

		await db.migrate({
			'test 1': sql`INSERT INTO "TestMigration" VALUES ('test 1');`,
			'test 2': sql`INSERT INTO "TestMigration" VALUES ('test 2');`,
		});

		const results = await db.query(sql`SELECT * FROM "TestMigration";`);
		expect(results.length).toBe(0);
	});
	it('migrations - failing migration script', async function() {
		await db.query(sql`
			DROP TABLE IF EXISTS "Migrations";
			DROP TABLE IF EXISTS "TestMigration";
			CREATE TABLE "TestMigration" ("text" TEXT NOT NULL);
		`);

		await expectAsync(
			db.migrate({
				'test 1': sql`BAD QUERY THAT FAILS;`,
				'test 2': sql`INSERT INTO "TestMigration" VALUES ('test 1');`,
			})
		).toBeRejected();

		const migrations = await db.query(sql`SELECT * FROM "Migrations" WHERE "name" LIKE 'test %';`);
		expect(migrations.length).toBe(0);

		const results = await db.query(sql`SELECT * FROM "TestMigration";`);
		expect(results.length).toBe(0);
	});

	it('insertAndGet - inserting one row', async function() {
		await db.query(sql`
			DROP TABLE IF EXISTS "TestInsert";
			CREATE TABLE "TestInsert" ("id" SERIAL, "text" TEXT NOT NULL);
		`);

		const result = await db.insertAndGet(sql`
			INSERT INTO "TestInsert" VALUES (DEFAULT, 'test')
		`);

		expect(result).toEqual([
			{
				id: 1,
				text: 'test',
			},
		]);
	});
	it('insertAndGet - inserting multiple rows', async function() {
		await db.query(sql`
			DROP TABLE IF EXISTS "TestInsert";
			CREATE TABLE "TestInsert" ("id" SERIAL, "text" TEXT NOT NULL);
		`);

		const result = await db.insertAndGet(sql`
			INSERT INTO "TestInsert" VALUES
			(DEFAULT, 'test 1'),
			(DEFAULT, 'test 2')
		`);

		expect(result).toEqual([
			{
				id: 1,
				text: 'test 1',
			}, {
				id: 2,
				text: 'test 2',
			},
		]);
	});

	it('updateAndGet - updating one row', async function() {
		await db.query(sql`
			DROP TABLE IF EXISTS "TestUpdate";
			CREATE TABLE "TestUpdate" ("id" INTEGER, "text" TEXT NOT NULL);
			INSERT INTO "TestUpdate" VALUES (1, 'test 1');
		`);

		const result = await db.updateAndGet(sql`
			UPDATE "TestUpdate"
			SET "text" = 'test 2'
			WHERE "id" = 1
		`);

		expect(result).toEqual([
			{
				id: 1,
				text: 'test 2',
			},
		]);
	});
	it('updateAndGet - updating multiple rows', async function() {
		await db.query(sql`
			DROP TABLE IF EXISTS "TestUpdate";
			CREATE TABLE "TestUpdate" ("id" INTEGER, "text" TEXT NOT NULL);
			INSERT INTO "TestUpdate" VALUES (1, 'test 1');
			INSERT INTO "TestUpdate" VALUES (2, 'test 2');
		`);

		const result = await db.updateAndGet(sql`
			UPDATE "TestUpdate"
			SET "text" = 'test'
		`);

		expect(result).toEqual([
			{
				id: 1,
				text: 'test',
			}, {
				id: 2,
				text: 'test',
			},
		]);
	});
});
