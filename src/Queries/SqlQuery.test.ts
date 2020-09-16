import 'jasmine';
import SqlQuery from './SqlQuery';
import QueryParam from './QueryParam';
import QueryIdentifier from './QueryIdentifier';
import CompiledQuery from './CompiledQuery';

describe('SqlQuery', async function() {
	it('constructor', async function() {
		const query = new SqlQuery(['foo', new QueryParam(42)]);
		expect(query.parts).toEqual(['foo', new QueryParam(42)]);
	});

	it('createFromTemplateString', async function() {
		const query = SqlQuery.createFromTemplateString(
			<TemplateStringsArray><any>['foo', 'bar', '', ''],
			42,
			new SqlQuery(['baz']),
			new QueryIdentifier('identifier'),
		);
		expect(query.parts).toEqual([
			'foo',
			new QueryParam(42),
			'bar',
			new SqlQuery(['baz']),
			'',
			new QueryIdentifier('identifier'),
			'',
		]);
	});

	it('join', async function() {
		const query = SqlQuery.join([
			new SqlQuery(['foo', new QueryParam(42)]),
			new SqlQuery(['bar', new QueryParam(43)]),
			new SqlQuery(['baz', new QueryParam(44)]),
		], new SqlQuery([', ']));
		expect(query.parts).toEqual([
			new SqlQuery(['foo', new QueryParam(42)]),
			new SqlQuery([', ']),
			new SqlQuery(['bar', new QueryParam(43)]),
			new SqlQuery([', ']),
			new SqlQuery(['baz', new QueryParam(44)]),
		]);
	});

	it('join - default delimiter', async function() {
		const query = SqlQuery.join([
			new SqlQuery(['foo', new QueryParam(42)]),
			new SqlQuery(['bar', new QueryParam(43)]),
		]);
		expect(query.parts).toEqual([
			new SqlQuery(['foo', new QueryParam(42)]),
			new SqlQuery([', ']),
			new SqlQuery(['bar', new QueryParam(43)]),
		]);
	});

	it('compile - basic use', async function() {
		const query = new SqlQuery(['foo', new QueryParam(42), 'bar']);
		expect(query.compile(i => '$' + (i + 1), s => s)).toEqual(
			new CompiledQuery(
				'foo$1bar',
				[42],
			),
		);
	});

	it('compile - recursively', async function() {
		const subSubQuery = SqlQuery.createFromTemplateString`baz${44}`;
		const subQuery = SqlQuery.createFromTemplateString`bar${43}${subSubQuery}`;
		const query = SqlQuery.createFromTemplateString`foo${42}${subQuery}`;
		expect(query.compile(i => '$' + (i + 1), s => s)).toEqual(
			new CompiledQuery(
				'foo$1bar$2baz$3',
				[42, 43, 44],
			),
		);
	});

	it('compile - identifiers', async function() {
		const query = new SqlQuery([
			new QueryIdentifier('foo'),
			' = ',
			new QueryParam('bar'),
		]);

		expect(query.compile(
			i => '$' + (i + 1),
			s => '`' + s + '`',
		)).toEqual(
			new CompiledQuery(
				'`foo` = $1',
				['bar'],
			),
		);
	});
});
