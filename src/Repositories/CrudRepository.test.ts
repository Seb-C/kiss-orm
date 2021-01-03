import 'jasmine';
import NotFoundError from '../Errors/NotFoundError';
import TooManyResultsError from '../Errors/TooManyResultsError';
import DatabaseInterface from '../Databases/DatabaseInterface';
import PgSqlDatabase from '../Databases/PgSqlDatabase';
import MySqlDatabase from '../Databases/MySqlDatabase';
import CrudRepository from './CrudRepository';
import SqlQuery from '../Queries/SqlQuery';
import QueryIdentifier from '../Queries/QueryIdentifier';

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
			relatedTests: await (new RelatedTestRepository(this.database)).search(sql`
				${new QueryIdentifier('testId')} = ${test.id}
			`),
		});
	}

	async loadManyManyRelatedTestsRelationship(test: TestModel) {
		return this.createModelFromAttributes({
			...test,
			manyManyRelatedTests: await (new RelatedTestRepository(this.database)).search(sql`
				${new QueryIdentifier('id')} IN (
					SELECT ${new QueryIdentifier('relatedTestId')}
					FROM ${new QueryIdentifier('ManyManyTest')}
					WHERE ${new QueryIdentifier('testId')} = ${test.id}
				)
			`),
		});
	}
}

class TestScopedRepository extends CrudRepository<TestModel> {
	constructor(database: DatabaseInterface) {
		super({
			database,
			table: 'TestWithDuplicates',
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

class TestWithDuplicatesRepository extends CrudRepository<TestModel> {
	constructor(database: DatabaseInterface) {
		super({
			database,
			table: 'TestWithDuplicates',
			primaryKey: 'id',
			model: TestModel,
		});
	}
}

// Instead of mocking everything, I chose to test the repository directly against real databases.
// This offers a better coverage for any database differences.
describe('CrudRepository - PgSqlDatabase', getTestForRepositoryWithDatabase(PgSqlDatabase, {
	host: 'pgsql',
	port: 5432,
	database: 'test',
	user: 'test',
	password: 'test'
}, sql``));
describe('CrudRepository - MySqlDatabase', getTestForRepositoryWithDatabase(MySqlDatabase, {
	host: 'mysql',
	database: 'test',
	user: 'test',
	password: 'test',
}, sql`PRIMARY KEY AUTO_INCREMENT`));

function getTestForRepositoryWithDatabase(DatabaseClass: any, config: any, primaryKeyAttributes: SqlQuery) {
	return () => {
		let db: DatabaseInterface;
		let repository: TestRepository;
		let scopedRepository: TestScopedRepository;
		let relatedTestRepository: RelatedTestRepository;
		let repositoryWithDuplicates: TestWithDuplicatesRepository;

		beforeEach(async () => {
			db = new DatabaseClass(config);

			await db.query(sql`
				CREATE TEMPORARY TABLE ${new QueryIdentifier('Test')} (
					${new QueryIdentifier('id')} INTEGER NOT NULL ${primaryKeyAttributes},
					${new QueryIdentifier('text')} TEXT NOT NULL,
					${new QueryIdentifier('number')} INTEGER NOT NULL,
					${new QueryIdentifier('date')} DATE NOT NULL
				);
			`);
			await db.query(sql`
				CREATE TEMPORARY TABLE ${new QueryIdentifier('RelatedTest')} (
					${new QueryIdentifier('id')} INTEGER NOT NULL ${primaryKeyAttributes},
					${new QueryIdentifier('testId')} INTEGER NOT NULL
				);
			`);
			await db.query(sql`
				CREATE TEMPORARY TABLE ${new QueryIdentifier('ManyManyTest')} (
					${new QueryIdentifier('testId')} INTEGER NOT NULL,
					${new QueryIdentifier('relatedTestId')} INTEGER NOT NULL
				);
			`);
			await db.query(sql`
				CREATE TEMPORARY TABLE ${new QueryIdentifier('TestWithDuplicates')} (
					${new QueryIdentifier('id')} INTEGER NOT NULL,
					${new QueryIdentifier('text')} TEXT NOT NULL,
					${new QueryIdentifier('number')} INTEGER NOT NULL,
					${new QueryIdentifier('date')} DATE NOT NULL
				);
			`);

			repository = new TestRepository(db);
			scopedRepository = new TestScopedRepository(db);
			relatedTestRepository = new RelatedTestRepository(db);
			repositoryWithDuplicates = new TestWithDuplicatesRepository(db);
		});
		afterEach(async () => {
			await db.query(sql`DROP TABLE ${new QueryIdentifier('Test')};`);
			await db.query(sql`DROP TABLE ${new QueryIdentifier('RelatedTest')};`);
			await db.query(sql`DROP TABLE ${new QueryIdentifier('ManyManyTest')};`);
			await db.query(sql`DROP TABLE ${new QueryIdentifier('TestWithDuplicates')};`);
			await db.disconnect();
		});

		it('get - normal case', async () => {
			await db.query(sql`
				INSERT INTO ${new QueryIdentifier('Test')} VALUES
					(1, 'test 1', 11, DATE('2020-01-01')),
					(2, 'test 2', 12, DATE('2020-01-03'));
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
				INSERT INTO ${new QueryIdentifier('TestWithDuplicates')} VALUES
					(1, 'test 1', 11, DATE('2020-01-01')),
					(1, 'test 2', 12, DATE('2020-01-01'));
			`);

			await expectAsync(repositoryWithDuplicates.get(1)).toBeRejectedWithError(TooManyResultsError);
		});

		it('get - scoped case', async () => {
			await db.query(sql`
				INSERT INTO ${new QueryIdentifier('TestWithDuplicates')} VALUES
					(1, 'test 1', 42, DATE('2020-01-01')),
					(1, 'test 2', 43, DATE('2020-01-01'));
			`);

			const result = await scopedRepository.get(1);
			expect(result.text).toEqual('test 1');
		});
		it('get - not found in scope case', async () => {
			await db.query(sql`INSERT INTO ${new QueryIdentifier('TestWithDuplicates')} VALUES (1, 'test 2', 12, DATE('2020-01-01'));`);

			await expectAsync(scopedRepository.get(1)).toBeRejectedWithError(NotFoundError);
		});

		it('search - normal case without filters', async () => {
			await db.query(sql`
				INSERT INTO ${new QueryIdentifier('Test')} VALUES
					(1, 'test 1', 11, DATE('2020-01-01')),
					(2, 'test 2', 12, DATE('2020-01-03'));
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
				INSERT INTO ${new QueryIdentifier('Test')} VALUES
					(1, 'test 1', 11, DATE('2020-01-01')),
					(2, 'test 2', 12, DATE('2020-01-03')),
					(3, 'test 3', 13, DATE('2020-01-02'));
			`);

			const results = await repository.search(sql`number > 11 AND text LIKE '%2'`);
			expect(results.length).toEqual(1);
			expect(results[0].id).toEqual(2);
		});
		it('search - with an order', async () => {
			await db.query(sql`
				INSERT INTO ${new QueryIdentifier('Test')} VALUES
					(1, 'test 1', 11, ('2020-01-01')),
					(2, 'test 2', 12, ('2020-01-03'));
			`);

			const results = await repository.search(null, sql`number DESC`);
			expect(results.length).toEqual(2);
			expect(results[0].id).toEqual(2);
			expect(results[1].id).toEqual(1);
		});
		it('search - with a filter and order', async () => {
			await db.query(sql`
				INSERT INTO ${new QueryIdentifier('Test')} VALUES
					(1, 'test 1', 11, DATE('2020-01-01')),
					(2, 'test 2', 12, DATE('2020-01-03')),
					(3, 'test 3', 13, DATE('2020-01-02'));
			`);

			const results = await repository.search(sql`number > 11`, sql`number DESC`);
			expect(results.length).toEqual(2);
			expect(results[0].id).toEqual(3);
			expect(results[1].id).toEqual(2);
		});
		it('search - scoped', async () => {
			await db.query(sql`
				INSERT INTO ${new QueryIdentifier('TestWithDuplicates')} VALUES
					(1, 'test 1', 42, DATE('2020-01-01')),
					(2, 'test 2', 42, DATE('2020-01-01')),
					(3, 'test 3', 13, DATE('2020-01-01'));
			`);

			const results = await scopedRepository.search();
			expect(results.length).toEqual(2);
			expect(results[0].id).toEqual(1);
			expect(results[1].id).toEqual(2);
		});
		it('search - scoped and filtered', async () => {
			await db.query(sql`
				INSERT INTO ${new QueryIdentifier('TestWithDuplicates')} VALUES
					(1, 'test 1', 42, DATE('2020-01-01')),
					(2, 'test 2', 42, DATE('2020-01-01')),
					(3, 'test 3', 13, DATE('2020-01-01'));
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
			await db.query(sql`INSERT INTO ${new QueryIdentifier('Test')} VALUES (1, 'test 1', 11, DATE '2020-01-01');`);
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
			await db.query(sql`INSERT INTO ${new QueryIdentifier('Test')} VALUES (1, 'test 1', 11, DATE '2020-01-01');`);
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
		if (DatabaseClass !== MySqlDatabase) {
			// MySQL cannot return the records after an UPDATE, so we cannot provide this exception
			it('update - too many results case', async () => {
				await db.query(sql`
					INSERT INTO ${new QueryIdentifier('TestWithDuplicates')} VALUES
						(1, 'test 1', 11, DATE('2020-01-01')),
						(1, 'test 1', 11, DATE('2020-01-01'));
				`);

				const model = new TestModel();
				Object.assign(model, {
					id: 1,
					text: 'test 1',
					number: 11,
					date: new Date(),
				});

				await expectAsync(
					repositoryWithDuplicates.update(model, { text: 'test 2' })
				).toBeRejectedWithError(TooManyResultsError);
			});
		}
		it('update - should not affect unrelated properties', async () => {
			await db.query(sql`INSERT INTO ${new QueryIdentifier('Test')} VALUES (1, 'test 1', 11, DATE('2020-01-01'));`);
			const model = await repository.get(1);
			model.propertyUnrelatedToTheTable = true;

			const result = await repository.update(model, {
				text: 'test 2',
			});

			expect(result.propertyUnrelatedToTheTable).toEqual(true);
		});

		it('delete - normal case', async () => {
			await db.query(sql`INSERT INTO ${new QueryIdentifier('Test')} VALUES (1, 'test 1', 11, DATE('2020-01-01'));`);
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
			await db.query(sql`INSERT INTO ${new QueryIdentifier('Test')} VALUES (1, 'test 1', 11, DATE('2020-01-01'));`);
			await db.query(sql`INSERT INTO ${new QueryIdentifier('RelatedTest')} VALUES (1, 1);`);

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
			await db.query(sql`INSERT INTO ${new QueryIdentifier('Test')} VALUES (1, 'test 1', 11, DATE('2020-01-01'));`);
			await db.query(sql`INSERT INTO ${new QueryIdentifier('Test')} VALUES (2, 'test 2', 12, DATE('2020-01-02'));`);
			await db.query(sql`INSERT INTO ${new QueryIdentifier('RelatedTest')} VALUES (1, 1);`);
			await db.query(sql`INSERT INTO ${new QueryIdentifier('RelatedTest')} VALUES (2, 1);`);
			await db.query(sql`INSERT INTO ${new QueryIdentifier('RelatedTest')} VALUES (3, 2);`);

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
			await db.query(sql`INSERT INTO ${new QueryIdentifier('Test')} VALUES (1, 'test 1', 11, DATE('2020-01-01'));`);
			await db.query(sql`INSERT INTO ${new QueryIdentifier('Test')} VALUES (2, 'test 2', 12, DATE('2020-01-02'));`);

			await db.query(sql`INSERT INTO ${new QueryIdentifier('RelatedTest')} VALUES (1, 1);`);
			await db.query(sql`INSERT INTO ${new QueryIdentifier('RelatedTest')} VALUES (2, 1);`);
			await db.query(sql`INSERT INTO ${new QueryIdentifier('RelatedTest')} VALUES (3, 2);`);

			await db.query(sql`INSERT INTO ${new QueryIdentifier('ManyManyTest')} VALUES (1, 1);`);
			await db.query(sql`INSERT INTO ${new QueryIdentifier('ManyManyTest')} VALUES (1, 2);`);
			await db.query(sql`INSERT INTO ${new QueryIdentifier('ManyManyTest')} VALUES (2, 1);`);
			await db.query(sql`INSERT INTO ${new QueryIdentifier('ManyManyTest')} VALUES (2, 2);`);
			await db.query(sql`INSERT INTO ${new QueryIdentifier('ManyManyTest')} VALUES (2, 3);`);

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
	};
};
