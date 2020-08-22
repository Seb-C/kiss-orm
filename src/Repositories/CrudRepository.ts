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
	protected readonly scope: SqlQuery|null;

	constructor({
		database,
		table,
		model,
		primaryKey,
		scope = null,
	}: {
		database: Database,
		table: string,
		primaryKey: string,
		model: new (attributes: any) => Model,
		scope?: SqlQuery|null,
	}) {
		this.database = database;
		this.table = table;
		this.primaryKey = primaryKey;
		this.model = model;
		this.scope = scope;
	}

	private createModel(attributes: any): Model {
		const model = Object.create(this.model.prototype);
		Object.assign(model, attributes);
		return model;
	}

	public async get(primaryKeyValue: any): Promise<Model> {
		const filters: SqlQuery[] = [
			sql`${new QueryIdentifier(this.primaryKey)} = ${primaryKeyValue}`,
		];
		if (this.scope !== null) {
			filters.push(sql`(${this.scope})`);
		}

		const results = await this.database.query(sql`
			SELECT *
			FROM ${new QueryIdentifier(this.table)}
			WHERE ${SqlQuery.join(filters, sql` AND `)};
		`);

		if (results.length === 0) {
			throw new NotFoundError(`Object not found in table ${this.table} for ${this.primaryKey} = ${primaryKeyValue}`);
		}
		if (results.length > 1) {
			throw new TooManyResultsError(`Multiple objects found in table ${this.table} for ${this.primaryKey} = ${primaryKeyValue}`);
		}

		return this.createModel(results[0]);
	}

	public async search(where: SqlQuery|null = null, orderBy: SqlQuery|null = null): Promise<ReadonlyArray<Model>> {
		const filters: SqlQuery[] = [];
		if (this.scope !== null) {
			filters.push(sql`(${this.scope})`);
		}
		if (where !== null) {
			filters.push(sql`(${where})`);
		}

		const whereClause = filters.length === 0
			? sql``
			: sql`WHERE ${SqlQuery.join(filters, sql` AND `)}`;
		const orderByClause = orderBy === null
			? sql``
			: sql`ORDER BY ${orderBy}`;

		const results = await this.database.query(sql`
			SELECT *
			FROM ${new QueryIdentifier(this.table)}
			${whereClause}
			${orderByClause}
		`);

		return results.map(result => this.createModel(result));
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

		return this.createModel(results[0]);
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

		return this.createModel(results[0]);
	}

	public async delete(model: Model) {
		await this.database.query(sql`
			DELETE FROM ${new QueryIdentifier(this.table)}
			WHERE ${new QueryIdentifier(this.primaryKey)} = ${(<any>model)[this.primaryKey]};
		`);
	}
}
