import 'jasmine';
import QueryParam from './QueryParam';

describe('QueryParam', async function() {
	it('constructor', async function() {
		const queryParam = new QueryParam('test param');
		expect(queryParam.param).toEqual('test param');
	});
});
