export default class RelationshipNotFoundError {
	public readonly message: string;

	constructor(message: string) {
		this.message = message;
	}
}
