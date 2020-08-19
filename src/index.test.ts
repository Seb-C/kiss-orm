import 'jasmine';
import { sql } from '.';
import Query from './Query';
import QueryParam from './QueryParam';

describe('index', async function() {
	it('test sql - normal use', async function() {
		expect(sql`foo${'bar'}baz`).toEqual(new Query(
			['foo', new QueryParam('bar'), 'baz'],
		));
	});
	it('test sql - recursive', async function() {
		const result = sql`foo${42}bar${sql`baz${43}`}`
		expect(result).toEqual(new Query([
			'foo',
			new QueryParam(42),
			'bar',
			new Query(['baz', new QueryParam(43), '']),
			'',
		]));
	});
});
