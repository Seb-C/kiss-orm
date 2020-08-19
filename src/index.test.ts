import 'jasmine';
import { sql } from '.';
import Query from './Query';
import QueryParam from './QueryParam';

describe('index', async function() {
	it('test sql short function', async function() {
		expect(sql`foo${'bar'}baz`).toEqual(new Query(
			['foo', new QueryParam('bar'), 'baz'],
		));
	});
});
