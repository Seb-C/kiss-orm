import QueryParam from './QueryParam';
import CompiledQuery from './CompiledQuery';

export default class Query {
	public readonly parts: ReadonlyArray<any>;

	static createFromTemplateString (
		strings: TemplateStringsArray,
		...params: ReadonlyArray<any>
	): Query {
		const parts: any[] = [strings[0]];

		for (let i = 1; i < strings.length; i++) {
			parts.push(new QueryParam(params[i - 1]));
			parts.push(strings[i]);
		}

		return new Query(parts);
	};

	constructor (parts: ReadonlyArray<any>) {
		this.parts = parts;
	};

	compile(indexToPlaceholder: (i: number) => string): CompiledQuery {
		let sql = '';
		const params: any[] = [];

		for (let i = 0; i < this.parts.length; i++) {
			if (this.parts[i] instanceof QueryParam) {
				sql += indexToPlaceholder(params.length);
				params.push(this.parts[i].param);
			} else {
				sql += this.parts[i];
			}
		}

		return new CompiledQuery(sql, params);
	}
}
