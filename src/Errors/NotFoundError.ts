export default class NotFoundError extends Error {
	public readonly message: string;

	constructor(message: string) {
		super();
		this.name = 'NotFoundError';
		Object.setPrototypeOf(this, new.target.prototype);
		this.message = message;
	}
}
