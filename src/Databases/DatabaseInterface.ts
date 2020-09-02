import SqlQuery from '../Queries/SqlQuery';

export default interface DatabaseInterface {
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	query(query: SqlQuery): Promise<any[]>;
};
