export default class TooManyResultsError {
	public readonly message: string;

	constructor(message: string) {
		this.message = message;
	}
}
