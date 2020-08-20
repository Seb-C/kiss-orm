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

	it('compile - basic use', async function() {
		const query = new Query(['foo', new QueryParam(42), 'bar']);
		expect(query.compile(i => '$' + (i + 1), s => s)).toEqual(
			new CompiledQuery(
				'foo$1bar',
				[42],
			),
		);
	});

	it('compile - recursively', async function() {
		const sql = Query.createFromTemplateString;
		const subSubQuery = sql`baz${44}`;
		const subQuery = sql`bar${43}${subSubQuery}`;
		const query = sql`foo${42}${subQuery}`;
		expect(query.compile(i => '$' + (i + 1), s => s)).toEqual(
			new CompiledQuery(
				'foo$1bar$2baz$3',
				[42, 43, 44],
			),
		);
	});
});
