import QueryIdentifier from './QueryIdentifier';
import QueryParam from './QueryParam';
import CompiledQuery from './CompiledQuery';

type QueryPart = string|QueryIdentifier|QueryParam|SqlQuery;

export default class SqlQuery {
	public readonly parts: ReadonlyArray<QueryPart>;

	static createFromTemplateString (
		strings: TemplateStringsArray,
		...params: ReadonlyArray<any>
	): SqlQuery {
		const parts: QueryPart[] = [strings[0]];

		for (let i = 1; i < strings.length; i++) {
			if (
				params[i - 1] instanceof SqlQuery
				|| params[i - 1] instanceof QueryParam
				|| params[i - 1] instanceof QueryIdentifier
			) {
				parts.push(params[i - 1]);
			} else {
				parts.push(new QueryParam(params[i - 1]));
			}

			parts.push(strings[i]);
		}

		return new SqlQuery(parts);
	};

	/**
	 * The delimiter is an SqlQuery rather than a string
	 * in order to avoid potential SQL injections.
	 */
	static join (queries: SqlQuery[], delimiter: SqlQuery): SqlQuery {
		const joinedParts: QueryPart[] = [];

		for (let i = 0; i < queries.length; i++) {
			if (i > 0) {
				joinedParts.push(delimiter);
			}
			joinedParts.push(queries[i]);
		}

		return new SqlQuery(joinedParts);
	};

	constructor (parts: ReadonlyArray<QueryPart>) {
		this.parts = parts;
	};

	compile(
		indexToPlaceholder: (i: number) => string,
		formatIdentifier: (s: string)=> string,
	): CompiledQuery {
		let sql = '';
		const params: any[] = [];

		const recursivelyAddParts = (parts: ReadonlyArray<QueryPart>) => {
			for (let i = 0; i < parts.length; i++) {
				if (parts[i] instanceof SqlQuery) {
					recursivelyAddParts((<SqlQuery>parts[i]).parts);
				} else if (parts[i] instanceof QueryParam) {
					sql += indexToPlaceholder(params.length);
					params.push((<QueryParam>parts[i]).param);
				} else if (parts[i] instanceof QueryIdentifier) {
					sql += formatIdentifier((<QueryIdentifier>parts[i]).identifier);
				} else {
					sql += parts[i];
				}
			}
		};
		recursivelyAddParts(this.parts);

		return new CompiledQuery(sql, params);
	}
}
