import 'jasmine';
import Query from './Query';
import QueryParam from './QueryParam';
import CompiledQuery from './CompiledQuery';

describe('Query', async function() {
	it('constructor', async function() {
		const query = new Query(['foo', new QueryParam(42)]);
		expect(query.parts).toEqual(['foo', new QueryParam(42)]);
	});

	it('createFromTemplateString', async function() {
		const query = Query.createFromTemplateString(
			<TemplateStringsArray><any>['foo', 'bar', ''],
			42,
			new Query(['baz']),
		);
		expect(query.parts).toEqual([
			'foo',
			new QueryParam(42),
			'bar',
			new Query(['baz']),
			'',
		]);
	});

	it('compile', async function() {
		const query = new Query(['foo', new QueryParam(42), 'bar']);
		expect(query.compile(i => '$' + (i + 1))).toEqual(
			new CompiledQuery(
				'foo$1bar',
				[42],
			),
		);
	});
});
