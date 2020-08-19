import QueryParam from './QueryParam';
import CompiledQuery from './CompiledQuery';

type QueryPart = string|QueryParam|Query;

export default class Query {
	public readonly parts: ReadonlyArray<QueryPart>;

	static createFromTemplateString (
		strings: TemplateStringsArray,
		...params: ReadonlyArray<any>
	): Query {
		const parts: QueryPart[] = [strings[0]];

		for (let i = 1; i < strings.length; i++) {
			if (params[i - 1] instanceof Query) {
				parts.push(params[i - 1]);
			} else {
				parts.push(new QueryParam(params[i - 1]));
			}

			parts.push(strings[i]);
		}

		return new Query(parts);
	};

	constructor (parts: ReadonlyArray<QueryPart>) {
		this.parts = parts;
	};

	compile(indexToPlaceholder: (i: number) => string): CompiledQuery {
		let sql = '';
		const params: any[] = [];

		const recursivelyAddParts = (parts: ReadonlyArray<QueryPart>) => {
			for (let i = 0; i < parts.length; i++) {
				if (parts[i] instanceof Query) {
					recursivelyAddParts((<Query>parts[i]).parts);
				} else if (parts[i] instanceof QueryParam) {
					sql += indexToPlaceholder(params.length);
					params.push((<QueryParam>parts[i]).param);
				} else {
					sql += parts[i];
				}
			}
		};
		recursivelyAddParts(this.parts);

		return new CompiledQuery(sql, params);
	}
}
