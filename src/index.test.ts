import 'jasmine';
import { sql, sqlJoin } from '.';
import SqlQuery from './Queries/SqlQuery';
import QueryParam from './Queries/QueryParam';

describe('index', async function() {
	it('test sql - normal use', async function() {
		expect(sql`foo${'bar'}baz`).toEqual(new SqlQuery(
			['foo', new QueryParam('bar'), 'baz'],
		));
	});
	it('test sql - recursive', async function() {
		const result = sql`foo${42}bar${sql`baz${43}`}`
		expect(result).toEqual(new SqlQuery([
			'foo',
			new QueryParam(42),
			'bar',
			new SqlQuery(['baz', new QueryParam(43), '']),
			'',
		]));
	});
	it('test sqlJoin - normal use', async function() {
		const query = sqlJoin([
			sql`a = ${'b'}`,
			sql`c = ${'d'}`,
		], sql` AND `)
		expect(query).toEqual(new SqlQuery([
			new SqlQuery(['a = ', new QueryParam('b'), '']),
			new SqlQuery([' AND ']),
			new SqlQuery(['c = ', new QueryParam('d'), '']),
		]));
	});
});
