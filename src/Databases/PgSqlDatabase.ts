import { Client, ClientConfig } from 'pg';
import { ident as formatIdentifier } from 'pg-format';
import SqlQuery from '../Queries/SqlQuery';
import CompiledQuery from '../Queries/CompiledQuery';
import DatabaseInterface from './DatabaseInterface';

type LogFunction = (query: CompiledQuery) => void;

export default class PgSqlDatabase implements DatabaseInterface {
	public readonly client: Client;
	public readonly logFunction: LogFunction;

	constructor(
		config: ClientConfig,
		logFunction: LogFunction = (query) => {},
	) {
		this.client = new Client(config);
		this.logFunction = logFunction;
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
		this.logFunction(compiledQuery);

		const result = await this.client.query(
			compiledQuery.sql,
			<any[]><any>compiledQuery.params,
		);

		return result.rows;
	}
}
