import 'jasmine';
import QueryIdentifier from './QueryIdentifier';

describe('QueryIdentifier', async function() {
	it('constructor', async function() {
		const queryIdentifier = new QueryIdentifier('test param');
		expect(queryIdentifier.identifier).toEqual('test param');
	});
});
