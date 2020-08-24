import { Client } from 'pg';
import { ident as formatIdentifier } from 'pg-format';
import SqlQuery from '../Queries/SqlQuery';
import DatabaseInterface from './DatabaseInterface';

export default class PgSqlDatabase implements DatabaseInterface {
	public readonly client: Client;

	// TODO extend config type?
	constructor(config: any) {
		this.client = new Client(config);
	}

	async connect() {
		await this.client.connect()
	}

	async disconnect() {
		await this.client.end()
	}

	async query(query: SqlQuery): Promise<any[]> {
		const indexToPlaceholder = (i: number) => '$' + (i + 1);

		const compiledQuery = query.compile(indexToPlaceholder, formatIdentifier);
		const result = await this.client.query(
			compiledQuery.sql,
			<any[]><any>compiledQuery.params,
		);

		return result.rows;
	}
}
