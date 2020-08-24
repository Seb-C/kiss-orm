import 'jasmine';
import CompiledQuery from '../Queries/CompiledQuery';
import PgSqlDatabase from './PgSqlDatabase';
import { sql } from '..';

describe('PgSqlDatabase', async function() {
	beforeEach(async function() {
		this.loggedQueries = <CompiledQuery[]>[];

		this.db = new PgSqlDatabase({
			host: 'database',
			port: 5432,
			database: 'test',
			user: 'test',
			password: 'test'
		}, query => this.loggedQueries.push(query));

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

	it('logging queries', async function() {
		await this.db.query(sql`SELECT 1`);
		await this.db.query(sql`SELECT ${2}`);

		expect(this.loggedQueries.length).toBe(2);
		expect(this.loggedQueries[0]).toBeInstanceOf(CompiledQuery);
		expect(this.loggedQueries[0].sql).toEqual('SELECT 1');
		expect(this.loggedQueries[0].params).toEqual([]);

		expect(this.loggedQueries[1]).toBeInstanceOf(CompiledQuery);
		expect(this.loggedQueries[1].sql).toEqual('SELECT $1');
		expect(this.loggedQueries[1].params).toEqual([2]);
	});
});
