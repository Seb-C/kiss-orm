import NotFoundError from '../Errors/NotFoundError';
import TooManyResultsError from '../Errors/TooManyResultsError';
import RelationshipNotFoundError from '../Errors/RelationshipNotFoundError';
import PgSqlDatabase from '../Databases/PgSqlDatabase';
import SqlQuery from '../Queries/SqlQuery';
import QueryIdentifier from '../Queries/QueryIdentifier';
import { sql } from '..';

type Relationship<Model> = ((model: Model) => Promise<any>);
type Relationships<Model> = { [key: string]: Relationship<Model> };

export default class CrudRepository<Model> {
	protected readonly database: PgSqlDatabase;
	protected readonly table: string;
	protected readonly primaryKey: string;
	protected readonly model: new (attributes: any) => Model;
	protected readonly scope: SqlQuery|null;
	protected readonly relationships: Relationships<Model>;

	constructor({
		database,
		table,
		model,
		primaryKey,
		scope = null,
		relationships = {},
	}: {
		database: PgSqlDatabase,
		table: string,
		primaryKey: string,
		model: new (attributes: any) => Model,
		scope?: SqlQuery|null,
		relationships?: Relationships<Model>,
	}) {
		this.database = database;
		this.table = table;
		this.primaryKey = primaryKey;
		this.model = model;
		this.scope = scope;
		this.relationships = relationships;
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

		return this.createModelFromAttributes(results[0]);
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

		return Promise.all(
			results.map(
				result => this.createModelFromAttributes(result),
			),
		);
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

		return this.createModelFromAttributes(results[0]);
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

		return this.createModelFromAttributes(results[0]);
	}

	public async delete(model: Model) {
		await this.database.query(sql`
			DELETE FROM ${new QueryIdentifier(this.table)}
			WHERE ${new QueryIdentifier(this.primaryKey)} = ${(<any>model)[this.primaryKey]};
		`);
	}

	private async createModelFromAttributes(attributes: any): Promise<Model> {
		const model = Object.create(this.model.prototype);
		Object.assign(model, attributes);
		return model;
	}

	public async loadRelationship(model: Model, relationshipName: string): Promise<Model> {
		if (!this.relationships.hasOwnProperty(relationshipName)) {
			throw new RelationshipNotFoundError(`The relationship named ${relationshipName} does not exist (table ${this.table}).`);
		}

		const newModel = await this.createModelFromAttributes(model);
		const relationshipData = await this.relationships[relationshipName](model);
		Object.defineProperty(
			newModel,
			relationshipName,
			{ value: relationshipData },
		);

		return newModel;
	}
}
