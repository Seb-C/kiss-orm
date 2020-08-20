import NotFoundError from '../Errors/NotFoundError';
import TooManyResultsError from '../Errors/TooManyResultsError';
import Database from '../Database';
import Query from '../Queries/Query';
import QueryIdentifier from '../Queries/QueryIdentifier';
import { sql } from '..';

export default class CrudRepository<Model extends {
	[key: string]: any,
	new (attributes: { [key: string]: any }): Model
}> {
	protected readonly database: Database;
	protected readonly table: string;
	protected readonly primaryKey: string;
	protected readonly model: new (attributes: { [key: string]: any }) => Model;

	constructor({
		database,
		table,
		model,
		primaryKey,
	}: {
		database: Database,
		table: string,
		primaryKey: string,
		model: new (attributes: { [key: string]: any }) => Model,
	}) {
		this.database = database;
		this.table = table;
		this.primaryKey = primaryKey;
		this.model = model;
	}

	public async get(primaryKeyValue: any): Promise<Model> {
		const results = await this.database.query(sql`
			SELECT *
			FROM ${new QueryIdentifier(this.table)}
			WHERE ${new QueryIdentifier(this.primaryKey)} = ${primaryKeyValue};
		`);

		if (results.length === 0) {
			throw new NotFoundError(`Object not found in table ${this.table} for ${this.primaryKey} = ${primaryKeyValue}`);
		}
		if (results.length > 1) {
			throw new TooManyResultsError(`Multiple objects found in table ${this.table} for ${this.primaryKey} = ${primaryKeyValue}`);
		}

		return new this.model(results[0]);
	}

	public async search(where: Query|null = null, orderBy: Query|null = null): Promise<Model[]> {
		const results = await this.database.query(sql`
			SELECT *
			FROM ${new QueryIdentifier(this.table)}
			${where === null ? sql`` : sql`WHERE ${orderBy}`}
			${orderBy === null ? sql`` : sql`ORDER BY ${orderBy}`}
		`);

		return results.map(result => new this.model(result));
	}

	public async create(attributes: { [key: string]: any }): Promise<Model> {
		const entries = Object.entries(attributes);
		const fields = entries.map(([key, _]: [string, any]) => sql`${new QueryIdentifier(key)}`);
		const values = entries.map(([_, val]: [string, any]) => sql`${val}`);

		const results = await this.database.query(sql`
			INSERT INTO ${new QueryIdentifier(this.table)} (${Query.joinComma(fields)})
			VALUES (${Query.joinComma(values)})
			RETURNING *;
		`);

		return new this.model(results[0]);
	}

	public async update(model: Model, attributes: { [key: string]: any }): Promise<Model> {
		const fieldQueries = Object.entries(attributes).map(
			([key, value]: [string, any]) => (
				sql`${new QueryIdentifier(key)} = ${value}`
			)
		);

		const results = await this.database.query(sql`
			UPDATE ${new QueryIdentifier(this.table)}
			SET ${Query.joinComma(fieldQueries)}
			WHERE ${new QueryIdentifier(this.primaryKey)} = ${model[this.primaryKey]}
			RETURNING *;
		`);

		if (results.length === 0) {
			throw new NotFoundError(`Object not found in table ${this.table} for ${this.primaryKey} = ${model[this.primaryKey]}`);
		}
		if (results.length > 1) {
			throw new TooManyResultsError(`Multiple objects found in table ${this.table} for ${this.primaryKey} = ${model[this.primaryKey]}`);
		}

		return new this.model(results[0]);
	}

	public async delete(model: Model) {
		await this.database.query(sql`
			DELETE FROM ${new QueryIdentifier(this.table)}
			WHERE ${new QueryIdentifier(this.primaryKey)} = ${model[this.primaryKey]};
		`);
	}
}
