import 'jasmine';
import CompiledQuery from './CompiledQuery';

describe('CompiledQuery', async function() {
	it('constructor', async function() {
		const compiledQuery = new CompiledQuery('test query', [42, 'foo']);
		expect(compiledQuery.sql).toEqual('test query');
		expect(compiledQuery.params).toEqual([42, 'foo']);
	});
});
