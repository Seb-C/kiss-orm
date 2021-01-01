import 'jasmine';
import { Pool } from 'mysql';
import MySqlDatabase from './MySqlDatabase';
import SqlQuery from '../Queries/SqlQuery';

const sql = SqlQuery.createFromTemplateString;

describe('MySqlDatabase', async function() {
	let db: MySqlDatabase;

	beforeEach(async function() {
		db = new MySqlDatabase({
			host: 'mysql',
			database: 'test',
			user: 'test',
			password: 'test',
			connectionLimit: 2,
		});
	});

	afterEach(async function() {
		await db.disconnect();
	});

	it('indexToPlaceholder', async function() {
		expect(db.indexToPlaceholder(0)).toBe('?');
		expect(db.indexToPlaceholder(1)).toBe('?');
	});

	it('query with results', async function() {
		const result = await db.query(sql`
			SELECT ${42} as foo, ${'test'} as bar
		`);

		expect(result.length).toBe(1);
		expect(result[0]).toEqual(jasmine.objectContaining({ foo: 42, bar: 'test' }));
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
		await db.query(sql`DROP TABLE IF EXISTS TestSequence;`);
		await db.query(sql`CREATE TABLE TestSequence (x INT NOT NULL);`);

		await db.sequence(async sequenceDb => {
			await sequenceDb.query(sql`BEGIN;`);
			await sequenceDb.query(sql`INSERT INTO TestSequence VALUES (1);`);
			await sequenceDb.query(sql`INSERT INTO TestSequence VALUES (2);`);
			await sequenceDb.query(sql`COMMIT;`);
		});

		const result = await db.query(sql`SELECT * FROM TestSequence;`);
		expect(result.length).toBe(2);
		expect(result[0]).toEqual(jasmine.objectContaining({ x: 1 }));
		expect(result[1]).toEqual(jasmine.objectContaining({ x: 2 }));

		const pool = (<Pool>db.connection);
		expect((<any>pool)._freeConnections.length).toEqual((<any>pool)._allConnections.length);
	});
	it('sequence - the connection is dedicated', async function() {
		await db.query(sql`DROP TABLE IF EXISTS TestSequence;`);
		await db.query(sql`CREATE TABLE TestSequence (x INT NOT NULL);`);

		const seq = db.sequence(async sequenceDb => {
			await sequenceDb.query(sql`BEGIN;`);
			await sequenceDb.query(sql`INSERT INTO TestSequence VALUES (1);`);
			await new Promise((resolve) => setTimeout(resolve, 500));
			await sequenceDb.query(sql`INSERT INTO TestSequence VALUES (2);`);
			await sequenceDb.query(sql`ROLLBACK;`);
		});

		// This query should be done at the same time than the two inserts
		await new Promise((resolve) => setTimeout(resolve, 200));
		await db.query(sql`INSERT INTO TestSequence VALUES (3);`);

		await seq;

		const result = await db.query(sql`SELECT * FROM TestSequence;`);
		expect(result.length).toBe(1);
		expect(result[0]).toEqual(jasmine.objectContaining({ x: 3 }));

		const pool = (<Pool>db.connection);
		expect((<any>pool)._freeConnections.length).toEqual((<any>pool)._allConnections.length);
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
		expect((<any>pool)._freeConnections.length).toEqual((<any>pool)._allConnections.length);
	});
	it('sequence - returns the given value', async function() {
		const result = await db.sequence(async query => {
			return 42;
		});

		expect(result).toBe(42);
	});
	it('sequence - a sequence in a sequence works', async function() {
		await db.query(sql`DROP TABLE IF EXISTS TestSequence;`);
		await db.query(sql`CREATE TABLE TestSequence (x INT NOT NULL);`);

		await db.sequence(async db2 => {
			await db2.query(sql`BEGIN;`);
			await db2.query(sql`INSERT INTO TestSequence VALUES (1);`);
			await db2.sequence(async db3 => {
				await db3.query(sql`INSERT INTO TestSequence VALUES (2);`);
			});
			await db2.query(sql`COMMIT;`);
		});

		const result = await db.query(sql`SELECT * FROM TestSequence;`);
		expect(result.length).toBe(2);
		expect(result[0]).toEqual(jasmine.objectContaining({ x: 1 }));
		expect(result[1]).toEqual(jasmine.objectContaining({ x: 2 }));
	});

	it('migrations - from scratch', async function() {
		await db.query(sql`DROP TABLE IF EXISTS Migrations;`);
		await db.query(sql`DROP TABLE IF EXISTS TestMigration;`);
		await db.query(sql`CREATE TABLE TestMigration (text VARCHAR(255) NOT NULL);`);

		await db.migrate({
			'test 1': sql`INSERT INTO TestMigration VALUES ('test 1');`,
			'test 2': sql`INSERT INTO TestMigration VALUES ('test 2');`,
		});

		const results = await db.query(sql`SELECT * FROM TestMigration;`);
		expect(results.length).toBe(2);
		expect(results[0].text).toEqual('test 1');
		expect(results[1].text).toEqual('test 2');
	});
	it('migrations - partial update', async function() {
		await db.query(sql`DROP TABLE IF EXISTS Migrations;`);
		await db.query(sql`DROP TABLE IF EXISTS TestMigration;`);
		await db.query(sql`CREATE TABLE TestMigration (text VARCHAR(255) NOT NULL);`);

		await db.migrate({}); // Creating the Migrations table
		await db.query(sql`INSERT INTO Migrations VALUES ('test 2');`);

		await db.migrate({
			'test 1': sql`INSERT INTO TestMigration VALUES ('test 1');`,
			'test 2': sql`INSERT INTO TestMigration VALUES ('test 2');`,
			'test 3': sql`INSERT INTO TestMigration VALUES ('test 3');`,
		});

		const results = await db.query(sql`SELECT * FROM TestMigration;`);
		expect(results.length).toBe(2);
		expect(results[0].text).toEqual('test 1');
		expect(results[1].text).toEqual('test 3');
	});
	it('migrations - no update required', async function() {
		await db.query(sql`DROP TABLE IF EXISTS Migrations;`);
		await db.query(sql`DROP TABLE IF EXISTS TestMigration;`);
		await db.query(sql`CREATE TABLE TestMigration (text VARCHAR(255) NOT NULL);`);

		await db.migrate({}); // Creating the Migrations table
		await db.query(sql`INSERT INTO Migrations VALUES ('test 1');`);
		await db.query(sql`INSERT INTO Migrations VALUES ('test 2');`);

		await db.migrate({
			'test 1': sql`INSERT INTO TestMigration VALUES ('test 1');`,
			'test 2': sql`INSERT INTO TestMigration VALUES ('test 2');`,
		});

		const results = await db.query(sql`SELECT * FROM TestMigration;`);
		expect(results.length).toBe(0);
	});
	it('migrations - failing migration script', async function() {
		await db.query(sql`DROP TABLE IF EXISTS Migrations;`);
		await db.query(sql`DROP TABLE IF EXISTS TestMigration;`);
		await db.query(sql`CREATE TABLE TestMigration (text VARCHAR(255) NOT NULL);`);

		await expectAsync(
			db.migrate({
				'test 1': sql`BAD QUERY THAT FAILS;`,
				'test 2': sql`INSERT INTO TestMigration VALUES ('test 1');`,
			})
		).toBeRejected();

		const migrations = await db.query(sql`SELECT * FROM Migrations WHERE name LIKE 'test %';`);
		expect(migrations.length).toBe(0);

		const results = await db.query(sql`SELECT * FROM TestMigration;`);
		expect(results.length).toBe(0);
	});

	it('insertAndGet - inserting one row', async function() {
		await db.query(sql`DROP TABLE IF EXISTS TestInsert;`);
		await db.query(sql`CREATE TABLE TestInsert (id INT PRIMARY KEY NOT NULL AUTO_INCREMENT, text VARCHAR(255) NOT NULL);`);

		const result = await db.insertAndGet(sql`
			INSERT INTO TestInsert VALUES (NULL, 'test')
		`);

		expect(result).toEqual([1]);
	});
	it('insertAndGet - inserting multiple rows', async function() {
		await db.query(sql`DROP TABLE IF EXISTS TestInsert;`);
		await db.query(sql`CREATE TABLE TestInsert (id INT PRIMARY KEY NOT NULL AUTO_INCREMENT, text VARCHAR(255) NOT NULL);`);

		const result = await db.insertAndGet(sql`
			INSERT INTO TestInsert VALUES
			(NULL, 'test 1'),
			(NULL, 'test 2')
		`);

		expect(result).toEqual([1]);
	});

	it('updateAndGet - updating one row', async function() {
		await db.query(sql`DROP TABLE IF EXISTS TestUpdate;`);
		await db.query(sql`CREATE TABLE TestUpdate (id INTEGER, text VARCHAR(255) NOT NULL);`);
		await db.query(sql`INSERT INTO TestUpdate VALUES (1, 'test 1');`);

		const result = await db.updateAndGet(sql`
			UPDATE TestUpdate
			SET text = 'test 2'
			WHERE id = 1
		`);

		expect(result).toEqual(null);
	});
	it('updateAndGet - updating multiple rows', async function() {
		await db.query(sql`DROP TABLE IF EXISTS TestUpdate;`);
		await db.query(sql`CREATE TABLE TestUpdate (id INTEGER, text VARCHAR(255) NOT NULL);`);
		await db.query(sql`INSERT INTO TestUpdate VALUES (1, 'test 1');`);
		await db.query(sql`INSERT INTO TestUpdate VALUES (2, 'test 2');`);

		const result = await db.updateAndGet(sql`
			UPDATE TestUpdate
			SET text = 'test'
		`);

		expect(result).toEqual(null);
	});
});
