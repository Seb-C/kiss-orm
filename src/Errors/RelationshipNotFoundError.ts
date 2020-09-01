export default class RelationshipNotFoundError extends Error {
	public readonly message: string;

	constructor(message: string) {
		super();
		this.name = 'RelationshipNotFoundError';
		Object.setPrototypeOf(this, new.target.prototype);
		this.message = message;
	}
}
