import 'jasmine';
import CompiledQuery from '../Queries/CompiledQuery';
import PgSqlDatabase from './PgSqlDatabase';
import { sql } from '..';

describe('PgSqlDatabase', async function() {
	let db: PgSqlDatabase;

	beforeEach(async function() {
		this.loggedQueries = <CompiledQuery[]>[];

		db = new PgSqlDatabase({
			host: 'database',
			port: 5432,
			database: 'test',
			user: 'test',
			password: 'test'
		}, query => this.loggedQueries.push(query));

		await db.connect();
	});

	afterEach(async function() {
		await db.disconnect();
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

	it('logging queries', async function() {
		await db.query(sql`SELECT 1`);
		await db.query(sql`SELECT ${2}`);

		expect(this.loggedQueries.length).toBe(2);
		expect(this.loggedQueries[0]).toBeInstanceOf(CompiledQuery);
		expect(this.loggedQueries[0].sql).toEqual('SELECT 1');
		expect(this.loggedQueries[0].params).toEqual([]);

		expect(this.loggedQueries[1]).toBeInstanceOf(CompiledQuery);
		expect(this.loggedQueries[1].sql).toEqual('SELECT $1');
		expect(this.loggedQueries[1].params).toEqual([2]);
	});

	it('migrations - from scratch', async function() {
		await db.query(sql`
			DELETE FROM "Migrations" WHERE "name" LIKE 'test %';
			CREATE TEMPORARY TABLE IF NOT EXISTS "TestMigration" ("text" TEXT NOT NULL);
			DELETE FROM "TestMigration";
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
			DELETE FROM "Migrations" WHERE "name" LIKE 'test %';
			CREATE TEMPORARY TABLE IF NOT EXISTS "TestMigration" ("text" TEXT NOT NULL);
			DELETE FROM "TestMigration";
			INSERT INTO "Migrations" VALUES ('test 2');
		`);

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
			DELETE FROM "Migrations" WHERE "name" LIKE 'test %';
			CREATE TEMPORARY TABLE IF NOT EXISTS "TestMigration" ("text" TEXT NOT NULL);
			DELETE FROM "TestMigration";
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
			DELETE FROM "Migrations" WHERE "name" LIKE 'test %';
			CREATE TEMPORARY TABLE IF NOT EXISTS "TestMigration" ("text" TEXT NOT NULL);
			DELETE FROM "TestMigration";
		`);

		let error = null;
		try {
			await db.migrate({
				'test 1': sql`BAD QUERY THAT FAILS;`,
				'test 2': sql`INSERT INTO "TestMigration" VALUES ('test 1');`,
			});
		} catch (e) {
			error = e;
		}

		expect(error).not.toBeNull();

		const migrations = await db.query(sql`SELECT * FROM "Migrations" WHERE "name" LIKE 'test %';`);
		expect(migrations.length).toBe(0);

		const results = await db.query(sql`SELECT * FROM "TestMigration";`);
		expect(results.length).toBe(0);
	});
});
