import 'jasmine';
import { sql } from '.';
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
});
