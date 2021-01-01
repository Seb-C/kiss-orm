import 'jasmine';
import NotFoundError from '../Errors/NotFoundError';
import TooManyResultsError from '../Errors/TooManyResultsError';
import DatabaseInterface from '../Databases/DatabaseInterface';
import PgSqlDatabase from '../Databases/PgSqlDatabase';
import CrudRepository from './CrudRepository';
import SqlQuery from '../Queries/SqlQuery';

const sql = SqlQuery.createFromTemplateString;

class TestModel {
	public readonly id!: number;
	public readonly text!: string;
	public readonly number!: number;
	public readonly date!: Date;

	public relatedTests?: ReadonlyArray<RelatedTestModel>;
	public manyManyRelatedTests?: ReadonlyArray<RelatedTestModel>;

	public propertyUnrelatedToTheTable?: boolean;
}

class RelatedTestModel {
	public readonly id!: number;
	public readonly testId!: number;

	public test?: TestModel;
}

class TestRepository extends CrudRepository<TestModel> {
	constructor(database: DatabaseInterface) {
		super({
			database,
			table: 'Test',
			primaryKey: 'id',
			model: TestModel,
		});
	}

	async loadRelatedTestsRelationship(test: TestModel): Promise<TestModel> {
		return this.createModelFromAttributes({
			...test,
			relatedTests: await (new RelatedTestRepository(this.database)).search(sql`"testId" = ${test.id}`),
		});
	}

	async loadManyManyRelatedTestsRelationship(test: TestModel) {
		return this.createModelFromAttributes({
			...test,
			manyManyRelatedTests: await (new RelatedTestRepository(this.database)).search(sql`
				"id" IN (
					SELECT "relatedTestId"
					FROM "ManyManyTest"
					WHERE "testId" = ${test.id}
				)
			`),
		});
	}
}

class TestScopedRepository extends CrudRepository<TestModel> {
	constructor(database: DatabaseInterface) {
		super({
			database,
			table: 'Test',
			primaryKey: 'id',
			model: TestModel,
			scope: sql`number = 42`,
		});
	}
}

class RelatedTestRepository extends CrudRepository<RelatedTestModel> {
	constructor(database: DatabaseInterface) {
		super({
			database,
			table: 'RelatedTest',
			primaryKey: 'id',
			model: RelatedTestModel,
		});
	}

	async loadTestRelationship(relatedTest: RelatedTestModel): Promise<RelatedTestModel> {
		return this.createModelFromAttributes({
			...relatedTest,
			test: await (new TestRepository(this.database)).get(relatedTest.testId),
		});
	}
}

describe('CrudRepository', () => {
	let db: PgSqlDatabase;
	let repository: TestRepository;
	let scopedRepository: TestScopedRepository;
	let relatedTestRepository: RelatedTestRepository;

	beforeEach(async () => {
		db = new PgSqlDatabase({
			host: 'database',
			port: 5432,
			database: 'test',
			user: 'test',
			password: 'test'
		});

		await db.query(sql`
			CREATE TEMPORARY TABLE "Test" (
				"id" INTEGER NOT NULL,
				"text" TEXT NOT NULL,
				"number" INTEGER NOT NULL,
				"date" DATE NOT NULL
			);

			CREATE TEMPORARY TABLE "RelatedTest" (
				"id" INTEGER NOT NULL,
				"testId" INTEGER NOT NULL
			);

			CREATE TEMPORARY TABLE "ManyManyTest" (
				"testId" INTEGER NOT NULL,
				"relatedTestId" INTEGER NOT NULL
			);
		`);

		repository = new TestRepository(db);
		scopedRepository = new TestScopedRepository(db);
		relatedTestRepository = new RelatedTestRepository(db);
	});
	afterEach(async () => {
		await db.query(sql`DROP TABLE "Test";`);
		await db.query(sql`DROP TABLE "RelatedTest";`);
		await db.query(sql`DROP TABLE "ManyManyTest";`);
		await db.disconnect();
	});

	it('get - normal case', async () => {
		await db.query(sql`
			INSERT INTO "Test" VALUES
				(1, 'test 1', 11, DATE 'yesterday'),
				(2, 'test 2', 12, DATE 'tomorrow');
		`);

		const result = await repository.get(2);
		expect(result).toBeInstanceOf(TestModel);
		expect(result.id).toEqual(2);
		expect(result.text).toEqual('test 2');
		expect(result.number).toEqual(12);
		expect(result.date).toBeInstanceOf(Date);
	});
	it('get - not found case', async () => {
		await expectAsync(repository.get(1)).toBeRejectedWithError(NotFoundError);
	});
	it('get - too many results case', async () => {
		await db.query(sql`
			INSERT INTO "Test" VALUES
				(1, 'test 1', 11, DATE 'yesterday'),
				(1, 'test 1', 11, DATE 'yesterday');
		`);

		await expectAsync(repository.get(1)).toBeRejectedWithError(TooManyResultsError);
	});

	it('get - scoped case', async () => {
		await db.query(sql`
			INSERT INTO "Test" VALUES
				(1, 'test 1', 42, DATE 'yesterday'),
				(1, 'test 2', 12, DATE 'tomorrow');
		`);

		const result = await scopedRepository.get(1);
		expect(result.text).toEqual('test 1');
	});
	it('get - not found in scope case', async () => {
		await db.query(sql`INSERT INTO "Test" VALUES (1, 'test 2', 12, DATE 'tomorrow');`);

		await expectAsync(scopedRepository.get(1)).toBeRejectedWithError(NotFoundError);
	});

	it('search - normal case without filters', async () => {
		await db.query(sql`
			INSERT INTO "Test" VALUES
				(1, 'test 1', 11, DATE 'yesterday'),
				(2, 'test 2', 12, DATE 'tomorrow');
		`);

		const results = await repository.search();
		expect(results.length).toEqual(2);

		expect(results[0]).toBeInstanceOf(TestModel);
		expect(results[0].id).toEqual(1);
		expect(results[0].text).toEqual('test 1');
		expect(results[0].number).toEqual(11);
		expect(results[0].date).toBeInstanceOf(Date);

		expect(results[1]).toBeInstanceOf(TestModel);
		expect(results[1].id).toEqual(2);
		expect(results[1].text).toEqual('test 2');
		expect(results[1].number).toEqual(12);
		expect(results[1].date).toBeInstanceOf(Date);
	});
	it('search - no results case', async () => {
		const results = await repository.search();
		expect(results.length).toEqual(0);
	});
	it('search - with a filter', async () => {
		await db.query(sql`
			INSERT INTO "Test" VALUES
				(1, 'test 1', 11, DATE 'yesterday'),
				(2, 'test 2', 12, DATE 'tomorrow'),
				(3, 'test 3', 13, DATE 'today');
		`);

		const results = await repository.search(sql`number > 11 AND text LIKE '%2'`);
		expect(results.length).toEqual(1);
		expect(results[0].id).toEqual(2);
	});
	it('search - with an order', async () => {
		await db.query(sql`
			INSERT INTO "Test" VALUES
				(1, 'test 1', 11, DATE 'yesterday'),
				(2, 'test 2', 12, DATE 'tomorrow');
		`);

		const results = await repository.search(null, sql`number DESC`);
		expect(results.length).toEqual(2);
		expect(results[0].id).toEqual(2);
		expect(results[1].id).toEqual(1);
	});
	it('search - with a filter and order', async () => {
		await db.query(sql`
			INSERT INTO "Test" VALUES
				(1, 'test 1', 11, DATE 'yesterday'),
				(2, 'test 2', 12, DATE 'tomorrow'),
				(3, 'test 3', 13, DATE 'today');
		`);

		const results = await repository.search(sql`number > 11`, sql`number DESC`);
		expect(results.length).toEqual(2);
		expect(results[0].id).toEqual(3);
		expect(results[1].id).toEqual(2);
	});
	it('search - scoped', async () => {
		await db.query(sql`
			INSERT INTO "Test" VALUES
				(1, 'test 1', 42, DATE 'yesterday'),
				(2, 'test 2', 42, DATE 'tomorrow'),
				(3, 'test 3', 13, DATE 'today');
		`);

		const results = await scopedRepository.search();
		expect(results.length).toEqual(2);
		expect(results[0].id).toEqual(1);
		expect(results[1].id).toEqual(2);
	});
	it('search - scoped and filtered', async () => {
		await db.query(sql`
			INSERT INTO "Test" VALUES
				(1, 'test 1', 42, DATE 'yesterday'),
				(2, 'test 2', 42, DATE 'tomorrow'),
				(3, 'test 3', 13, DATE 'today');
		`);

		const results = await scopedRepository.search(sql`text = 'test 2'`);
		expect(results.length).toEqual(1);
		expect(results[0].id).toEqual(2);
	});

	it('create - normal case', async () => {
		const result = await repository.create({
			id: 2,
			text: 'test 2',
			number: 12,
			date: new Date(),
		});
		expect(result).toBeInstanceOf(TestModel);
		expect(result.id).toEqual(2);
		expect(result.text).toEqual('test 2');
		expect(result.number).toEqual(12);
		expect(result.date).toBeInstanceOf(Date);
	});
	it('create - the database does not return new records', async () => {
		db.insertAndGet = async (q: SqlQuery) => [2];
		const result = await repository.create({
			id: 2,
			text: 'test 2',
			number: 12,
			date: new Date(),
		});
		expect(result).toBeInstanceOf(TestModel);
		expect(result.id).toEqual(2);
		expect(result.text).toEqual('test 2');
		expect(result.number).toEqual(12);
		expect(result.date).toBeInstanceOf(Date);
	});

	it('update - normal case', async () => {
		await db.query(sql`INSERT INTO "Test" VALUES (1, 'test 1', 11, DATE 'yesterday');`);
		const model = new TestModel();
		Object.assign(model, {
			id: 1,
			text: 'test 1',
			number: 11,
			date: new Date(),
		});

		const result = await repository.update(model, {
			text: 'test 2',
		});

		expect(result).toBeInstanceOf(TestModel);
		expect(result.id).toEqual(1);
		expect(result.text).toEqual('test 2');
		expect(result.number).toEqual(11);
	});
	it('update - the database does not return updated records', async () => {
		db.updateAndGet = async (q: SqlQuery) => null;
		await db.query(sql`INSERT INTO "Test" VALUES (1, 'test 1', 11, DATE 'yesterday');`);
		const model = new TestModel();
		Object.assign(model, {
			id: 1,
			text: 'test 1',
			number: 11,
			date: new Date(),
		});

		const result = await repository.update(model, {
			text: 'test 2',
		});

		expect(result).toBeInstanceOf(TestModel);
		expect(result.id).toEqual(1);
		expect(result.text).toEqual('test 2');
		expect(result.number).toEqual(11);
	});
	it('update - not found case', async () => {
		const model = new TestModel();
		Object.assign(model, {
			id: 1,
			text: 'test 1',
			number: 11,
			date: new Date(),
		});

		await expectAsync(
			repository.update(model, { text: 'test 2' })
		).toBeRejectedWithError(NotFoundError);
	});
	it('update - too many results case', async () => {
		await db.query(sql`
			INSERT INTO "Test" VALUES
				(1, 'test 1', 11, DATE 'yesterday'),
				(1, 'test 1', 11, DATE 'yesterday');
		`);

		const model = new TestModel();
		Object.assign(model, {
			id: 1,
			text: 'test 1',
			number: 11,
			date: new Date(),
		});

		await expectAsync(
			repository.update(model, { text: 'test 2' })
		).toBeRejectedWithError(TooManyResultsError);
	});
	it('update - should not affect unrelated properties', async () => {
		await db.query(sql`INSERT INTO "Test" VALUES (1, 'test 1', 11, DATE 'yesterday');`);
		const model = await repository.get(1);
		model.propertyUnrelatedToTheTable = true;

		const result = await repository.update(model, {
			text: 'test 2',
		});

		expect(result.propertyUnrelatedToTheTable).toEqual(true);
	});

	it('delete - normal case', async () => {
		await db.query(sql`INSERT INTO "Test" VALUES (1, 'test 1', 11, DATE 'yesterday');`);
		const model = new TestModel();
		Object.assign(model, {
			id: 1,
			text: 'test 1',
			number: 11,
			date: new Date(),
		});

		await repository.delete(model);
	});

	it('load relationship - has one', async () => {
		await db.query(sql`
			INSERT INTO "Test" VALUES (1, 'test 1', 11, DATE 'yesterday');
			INSERT INTO "RelatedTest" VALUES (1, 1);
		`);

		const relatedModel = await relatedTestRepository.get(1);
		expect(relatedModel.testId).toBe(1);
		expect(relatedModel.test).toBeUndefined();

		const newRelatedModel = await relatedTestRepository.loadTestRelationship(relatedModel);
		expect(relatedModel.test).toBeUndefined();
		expect(newRelatedModel.test).not.toBeUndefined();
		expect(newRelatedModel.test).toBeInstanceOf(TestModel);
		expect((<TestModel>newRelatedModel.test).id).toBe(1);
	});

	it('load relationship - has many', async () => {
		await db.query(sql`
			INSERT INTO "Test" VALUES (1, 'test 1', 11, DATE 'yesterday');
			INSERT INTO "Test" VALUES (2, 'test 2', 12, DATE 'today');
			INSERT INTO "RelatedTest" VALUES (1, 1);
			INSERT INTO "RelatedTest" VALUES (2, 1);
			INSERT INTO "RelatedTest" VALUES (2, 2);
		`);

		const model = await repository.get(1);
		expect(model.relatedTests).toBeUndefined();

		const newModel = await repository.loadRelatedTestsRelationship(model);
		expect(model.relatedTests).toBeUndefined();
		expect(newModel.relatedTests).not.toBeUndefined();
		expect(newModel.relatedTests).toBeInstanceOf(Array);
		expect((<RelatedTestModel[]>newModel.relatedTests).length).toEqual(2);
		expect((<RelatedTestModel[]>newModel.relatedTests)[0]).toBeInstanceOf(RelatedTestModel);
		expect((<RelatedTestModel[]>newModel.relatedTests)[1]).toBeInstanceOf(RelatedTestModel);
		expect((<RelatedTestModel[]>newModel.relatedTests)[0].id).toEqual(1);
		expect((<RelatedTestModel[]>newModel.relatedTests)[1].id).toEqual(2);
	});

	it('load relationship - many many', async () => {
		await db.query(sql`
			INSERT INTO "Test" VALUES (1, 'test 1', 11, DATE 'yesterday');
			INSERT INTO "Test" VALUES (2, 'test 2', 12, DATE 'today');

			INSERT INTO "RelatedTest" VALUES (1, 1);
			INSERT INTO "RelatedTest" VALUES (2, 1);
			INSERT INTO "RelatedTest" VALUES (3, 2);

			INSERT INTO "ManyManyTest" VALUES (1, 1);
			INSERT INTO "ManyManyTest" VALUES (1, 2);
			INSERT INTO "ManyManyTest" VALUES (2, 1);
			INSERT INTO "ManyManyTest" VALUES (2, 2);
			INSERT INTO "ManyManyTest" VALUES (2, 3);
		`);

		const model = await repository.get(1);
		expect(model.manyManyRelatedTests).toBeUndefined();

		const newModel = await repository.loadManyManyRelatedTestsRelationship(model);
		expect(model.manyManyRelatedTests).toBeUndefined();
		expect(newModel.manyManyRelatedTests).not.toBeUndefined();
		expect(newModel.manyManyRelatedTests).toBeInstanceOf(Array);
		expect((<RelatedTestModel[]>newModel.manyManyRelatedTests).length).toEqual(2);
		expect((<RelatedTestModel[]>newModel.manyManyRelatedTests)[0]).toBeInstanceOf(RelatedTestModel);
		expect((<RelatedTestModel[]>newModel.manyManyRelatedTests)[1]).toBeInstanceOf(RelatedTestModel);
		expect((<RelatedTestModel[]>newModel.manyManyRelatedTests)[0].id).toEqual(1);
		expect((<RelatedTestModel[]>newModel.manyManyRelatedTests)[1].id).toEqual(2);
	});
});
