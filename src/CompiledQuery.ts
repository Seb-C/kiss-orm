export default class CompiledQuery {
	public readonly sql: string;
	public readonly params: ReadonlyArray<any>;

	constructor (sql: string, params: ReadonlyArray<any>) {
		this.sql = sql;
		this.params = params;
	};
}
