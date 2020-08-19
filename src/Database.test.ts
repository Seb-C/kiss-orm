import 'jasmine';
import Database from './Database';
import { sql } from '.';

describe('Database', async function() {
	beforeEach(async function() {
		this.db = new Database({
			host: 'database',
			port: 5432,
			database: 'test',
			user: 'test',
			password: 'test'
		});

		await this.db.connect();
	});

	afterEach(async function() {
		await this.db.disconnect();
	});

	it('query with results', async function() {
		const result = await this.db.query(sql`
			SELECT CAST (${42} AS INT) as foo, ${'test'} as bar
		`);

		expect(result.length).toBe(1);
		expect(result[0]).toEqual({ foo: 42, bar: 'test' });
	});

	it('query without results', async function() {
		const result = await this.db.query(sql`
			SELECT *
			FROM (
				SELECT 1 AS foo
			) AS test
			WHERE 1 = 2
		`);

		expect(result.length).toBe(0);
	});
});
