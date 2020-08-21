import NotFoundError from '../Errors/NotFoundError';
import TooManyResultsError from '../Errors/TooManyResultsError';
import Database from '../Database';
import SqlQuery from '../Queries/SqlQuery';
import QueryIdentifier from '../Queries/QueryIdentifier';
import { sql } from '..';

export default class CrudRepository<Model> {
	protected readonly database: Database;
	protected readonly table: string;
	protected readonly primaryKey: string;
	protected readonly model: new (attributes: any) => Model;

	constructor({
		database,
		table,
		model,
		primaryKey,
	}: {
		database: Database,
		table: string,
		primaryKey: string,
		model: new (attributes: any) => Model,
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

		return Object.assign(
			Object.create(this.model.prototype),
			results[0],
		);
	}

	public async search(where: SqlQuery|null = null, orderBy: SqlQuery|null = null): Promise<Model[]> {
		const results = await this.database.query(sql`
			SELECT *
			FROM ${new QueryIdentifier(this.table)}
			${where === null ? sql`` : sql`WHERE ${where}`}
			${orderBy === null ? sql`` : sql`ORDER BY ${orderBy}`}
		`);

		return results.map(result => Object.assign(
			Object.create(this.model.prototype),
			result,
		));
	}

	public async create(attributes: any): Promise<Model> {
		const entries = Object.entries(attributes);
		const fields = entries.map(([key, _]: [string, any]) => sql`${new QueryIdentifier(key)}`);
		const values = entries.map(([_, val]: [string, any]) => sql`${val}`);

		const results = await this.database.query(sql`
			INSERT INTO ${new QueryIdentifier(this.table)} (${SqlQuery.join(fields, sql`, `)})
			VALUES (${SqlQuery.join(values, sql`, `)})
			RETURNING *;
		`);

		return Object.assign(
			Object.create(this.model.prototype),
			results[0],
		);
	}

	public async update(model: Model, attributes: any): Promise<Model> {
		const fieldQueries = Object.entries(attributes).map(
			([key, value]: [string, any]) => (
				sql`${new QueryIdentifier(key)} = ${value}`
			)
		);

		const results = await this.database.query(sql`
			UPDATE ${new QueryIdentifier(this.table)}
			SET ${SqlQuery.join(fieldQueries, sql`, `)}
			WHERE ${new QueryIdentifier(this.primaryKey)} = ${(<any>model)[this.primaryKey]}
			RETURNING *;
		`);

		if (results.length === 0) {
			throw new NotFoundError(`Object not found in table ${this.table} for ${this.primaryKey} = ${(<any>model)[this.primaryKey]}`);
		}
		if (results.length > 1) {
			throw new TooManyResultsError(`Multiple objects found in table ${this.table} for ${this.primaryKey} = ${(<any>model)[this.primaryKey]}`);
		}

		return Object.assign(
			Object.create(this.model.prototype),
			results[0],
		);
	}

	public async delete(model: Model) {
		await this.database.query(sql`
			DELETE FROM ${new QueryIdentifier(this.table)}
			WHERE ${new QueryIdentifier(this.primaryKey)} = ${(<any>model)[this.primaryKey]};
		`);
	}
}
