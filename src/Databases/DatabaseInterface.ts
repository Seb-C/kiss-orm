import SqlQuery from '../Queries/SqlQuery';

export default interface DatabaseInterface {
	connect(autoReconnect?: boolean): Promise<void>;
	disconnect(): Promise<void>;
	query(query: SqlQuery): Promise<any[]>;
};
