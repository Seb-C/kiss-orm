export default class TooManyResultsError extends Error {
	public readonly message: string;

	constructor(message: string) {
		super();
		this.name = 'TooManyResultsError';
		Object.setPrototypeOf(this, new.target.prototype);
		this.message = message;
	}
}
